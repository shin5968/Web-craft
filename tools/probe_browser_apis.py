#!/usr/bin/env python3
"""Verify limited browser API semantics against Java 25, then probe game registry."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile

from fetch_target import MANIFEST, read_url, verified_download
from prepare_minecraft_smoke import ROOT, VERSION, SHA256
from probe_minecraft_startup import make_pom
from inspect_jar import ClassReader

DIRECTORY=ROOT/'reports/browser-api-probe'


def run(command, name, timeout=240):
    path=DIRECTORY/(name+'.log')
    with path.open('w') as output:
        completed=subprocess.run([str(item) for item in command],stdout=output,stderr=subprocess.STDOUT,
                                 timeout=timeout,env=dict(os.environ,MAVEN_OPTS='-Xmx5g -XX:+ExitOnOutOfMemoryError'))
    text=path.read_text(errors='replace')
    return completed.returncode,text


def require(command,name,timeout=240):
    code,text=run(command,name,timeout)
    if code:
        useful='\n'.join(line[:1200] for line in text.splitlines() if 'error:' in line or 'Exception' in line or 'Error:' in line or '[ERROR]' in line or line.lstrip().startswith('at ') or 'Caused by:' in line)
        raise RuntimeError(f'{name} failed ({code}): '+(useful or text[-4000:]))
    return text


def public_class(data):
    reader=ClassReader(data);reader.take(8);count=reader.u2();index=1
    while index<count:
        tag=reader.u1()
        if tag==1:reader.take(reader.u2())
        elif tag in (7,8,16,19,20):reader.take(2)
        elif tag in (3,4,9,10,11,12,17,18):reader.take(4)
        elif tag in (5,6):reader.take(8);index+=1
        elif tag==15:reader.take(3)
        else:raise ValueError('Unknown class constant')
        index+=1
    return bool(reader.u2()&1)


def embedded_source(artifacts,directory,fixture_only=False):
    resources=[];providers=set();excluded=set();total=0
    for artifact in artifacts:
        with zipfile.ZipFile(artifact['path']) as archive:
            names=set(archive.namelist())
            for info in archive.infolist():
                name=info.filename
                wanted=(name.startswith('fixtures/') or name=='version.json' or name=='pack.mcmeta' or (name.startswith('assets/minecraft/lang/') and name.endswith('.json'))
                        or name.startswith('META-INF/services/') or name.endswith(('.properties','.xml')))
                if info.is_dir() or not wanted:continue
                data=archive.read(info);total+=len(data)
                if total>12*1024*1024:raise ValueError('Bundled metadata exceeds 12 MiB limit')
                resources.append((name,data))
                if name.startswith('META-INF/services/'):
                    for line in data.decode('utf8').splitlines():
                        provider=line.split('#',1)[0].strip()
                        if re.fullmatch(r'[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+',provider) and provider.replace('.','/')+'.class' in names:
                            binary=provider.replace('.','/')
                            hierarchy=[binary.split('$')[0]]
                            hierarchy.extend('$'.join(binary.split('$')[:i+1]) for i in range(1,len(binary.split('$'))))
                            if all(path+'.class' in names and public_class(archive.read(path+'.class')) for path in hierarchy):providers.add(provider)
                            else:excluded.add(provider)
    # Strings are chunked well below the JVM constant-pool UTF-8 size limit.
    statements=[]
    for index,(name,data) in enumerate(resources):
        encoded=base64.b64encode(data).decode();chunks=[encoded[i:i+12000] for i in range(0,len(encoded),12000)] or ['']
        expression='new StringBuilder()'+''.join('.append('+json.dumps(chunk)+')' for chunk in chunks)+'.toString()'
        statements.append(f'BrowserResources.register({json.dumps(name)},java.util.Base64.getDecoder().decode({expression}));')
    statements.append('BrowserResources.registerClass("java.lang.String",String.class);')
    for provider in sorted(providers):
        statements.append('BrowserResources.registerClass('+json.dumps(provider)+','+provider.replace('$','.')+'.class);')
    # Split registration into small methods, including when many metadata files exist.
    methods=[]
    for index in range(0,len(statements),30):
        methods.append('private static void part'+str(index//30)+'(){\n'+'\n'.join(statements[index:index+30])+'\n}')
    source='package dev.webcraft.compat; public final class EmbeddedResources { private static boolean installed; public static synchronized void install(){if(installed)return;'
    source+=''.join('part'+str(i)+'();' for i in range(len(methods)))+'installed=true;}' + '\n'.join(methods)+'}'
    directory.mkdir(parents=True,exist_ok=True);path=directory/'EmbeddedResources.java';path.write_text(source)
    return path,dict(resourceCount=len(resources),bytes=total,registeredProviders=sorted(providers),excludedNonPublicProviders=sorted(excluded),
                     selection='version.json, pack.mcmeta, default translation and deprecated-key metadata, fixtures, META-INF/services, properties and XML; read-only; classpath order retained')


def compile_wasm(artifacts,entry,directory,name):
    directory.mkdir(parents=True,exist_ok=True)
    pom=directory/'pom.xml';pom.write_text(make_pom(artifacts,directory,entry))
    code,text=run(['mvn','-B','-ntp','-f',pom,'org.teavm:teavm-maven-plugin:0.16.0:compile',
                   'org.teavm:teavm-maven-plugin:0.16.0:copy-webassembly-gc-runtime','-Dteavm.wasmGC.runtime.fileName=startup.wasm-runtime.js'],name)
    errors=[line for line in text.splitlines() if '[ERROR]' in line]
    categories={key:sum(key in line for line in errors) for key in ['java.lang.ScopedValue','java.lang.StackWalker','java.util.concurrent.locks.','ClassLoader.getResource','Class.getResource','ClassLoader.loadClass']}
    return dict(status='compiled' if code==0 else 'compile-failed',exitCode=code,
                errorLineCount=len(errors),requestedApiDiagnostics=categories,diagnostics=errors[:200])


def artifact(name,path):return dict(name=name,path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest())


def main():
    DIRECTORY.mkdir(parents=True,exist_ok=True)
    report=dict(version=VERSION,scope='Limited synchronous browser API profile. JVM reference, isolated Wasm execution, then original registry compilation. Not a running Minecraft client.')
    try:
        report['phase']='tools'
        dependencies=DIRECTORY/'tool-dependencies'
        require(['mvn','-B','-ntp','-f',ROOT/'tools/java/pom.xml','org.apache.maven.plugins:maven-dependency-plugin:3.8.1:copy-dependencies','-DoutputDirectory='+str(dependencies)],'tool-dependencies')
        asm=os.pathsep.join(str(p) for p in sorted(dependencies.glob('*.jar')))
        transformer=DIRECTORY/'transformer';transformer.mkdir(exist_ok=True)
        require(['javac','-cp',asm,'-d',transformer,ROOT/'tools/java/LazyUtilExecutors.java',ROOT/'tools/java/PortBrowserApis.java'],'compile-transformer')
        toolcp=str(transformer)+os.pathsep+asm
        def port(items,label):
            result=[]
            for index,item in enumerate(items):
                dest=DIRECTORY/f'{label}-{index:04d}.jar'
                require(['java','-cp',toolcp,'PortBrowserApis',item['path'],dest],f'{label}-transform-{index}')
                result.append(artifact(item['name']+'-api-port',dest))
            return result
        report['phase']='unit-jvm'
        fixtures=[]
        for index in range(2):
            path=DIRECTORY/f'fixtures-{index}.jar'
            with zipfile.ZipFile(path,'w') as archive:
                if index==0:archive.writestr('fixtures/sample.txt',b'browser-resource')
                archive.writestr('fixtures/providers.txt',b'first' if index==0 else b'second')
            fixtures.append(artifact('fixture',path))
        unit_generated,unit_resources=embedded_source(fixtures,DIRECTORY/'unit-generated')
        classes=DIRECTORY/'unit-classes';classes.mkdir(exist_ok=True)
        sources=list((ROOT/'browser-compat/src/main/java').rglob('*.java'))+list((ROOT/'browser-compat/src/test/java').rglob('*.java'))+[unit_generated]
        require(['javac','--release','25','-d',classes,*sources],'compile-unit')
        require(['java','-cp',toolcp+os.pathsep+str(classes),'PortBrowserApis','--self-test'],'legacy-frame-check')
        unitjar=DIRECTORY/'unit.jar';require(['jar','--create','--file',unitjar,'-C',classes,'.'],'jar-unit')
        unit_items=[artifact('api-unit',unitjar),*fixtures]
        cp=os.pathsep.join(item['path'] for item in unit_items)
        original=require(['java','-cp',cp,'dev.webcraft.test.ApiSemanticsCheck'],'unit-reference')
        marker=re.search(r'WEBCRAFT_APIS_OK \d+',original).group()
        port_unit=port(unit_items,'unit-port');cp=os.pathsep.join(item['path'] for item in port_unit)
        patched=require(['java','-cp',cp,'dev.webcraft.test.ApiSemanticsCheck'],'unit-port-jvm')
        if marker not in patched:raise AssertionError('API JVM results differ')
        limits=require(['java','-cp',cp,'dev.webcraft.compat.ProfileLimitsCheck'],'profile-limits')
        if 'WEBCRAFT_PROFILE_LIMITS_OK' not in limits:raise AssertionError('Profile limits not enforced')
        report['unitJvm']=dict(status='passed',marker=marker)
        report['phase']='unit-wasm'
        report['unitWasm']=compile_wasm(port_unit,'dev.webcraft.test.ApiSemanticsCheck',DIRECTORY/'unit-wasm','unit-wasm')
        if report['unitWasm']['status']!='compiled':raise RuntimeError('Isolated compatibility Wasm compilation failed')
        wasm=require(['node',ROOT/'tools/run_wasm_main.mjs',DIRECTORY/'unit-wasm/startup.wasm'],'unit-wasm-run')
        if marker not in wasm:raise AssertionError('Wasm API checks did not complete with matching marker')
        report['unitWasm']['execution']='passed';report['unitWasm']['marker']=marker
        report['phase']='official-input'
        manifest=json.loads(read_url(MANIFEST));entry=next(v for v in manifest['versions'] if v['id']==VERSION)
        metadata=json.loads(verified_download(entry));downloads=[('client',metadata['downloads']['client'])]
        downloads.extend((lib['name'],lib['downloads']['artifact']) for lib in metadata['libraries'] if lib.get('downloads',{}).get('artifact',{}).get('url','').endswith('.jar'))
        original_items=[]
        for index,(name,item) in enumerate(downloads):
            path=DIRECTORY/f'original-{index:04d}.jar';path.write_bytes(verified_download(item))
            original_items.append(artifact(name,path))
        if original_items[0]['sha256']!=SHA256:raise ValueError('Pinned client SHA-256 mismatch')
        lazy=DIRECTORY/'client-lazy.jar'
        require(['java','-cp',toolcp+os.pathsep+os.pathsep.join(item['path'] for item in original_items),'LazyUtilExecutors',original_items[0]['path'],lazy],'lazy-transform')
        lazy_items=[artifact('client-lazy',lazy),*original_items[1:]]
        generated,bundle=embedded_source(original_items,DIRECTORY/'registry-generated')
        runtimeclasses=DIRECTORY/'runtime-classes';runtimeclasses.mkdir(exist_ok=True)
        originalcp=os.pathsep.join(item['path'] for item in original_items)
        bootstrap=ROOT/'browser-bootstrap/src/main/java/dev/webcraft/browser/RegistryBootstrap.java'
        require(['javac','--release','25','-cp',originalcp,'-d',runtimeclasses,*list((ROOT/'browser-compat/src/main/java').rglob('*.java')),generated,bootstrap,bootstrap.with_name('RegistryJvmHarness.java')],'compile-registry-runtime')
        runtimejar=DIRECTORY/'registry-runtime.jar';require(['jar','--create','--file',runtimejar,'-C',runtimeclasses,'.'],'jar-registry-runtime')
        reference=require(['java','-Xmx3g','-cp',str(runtimejar)+os.pathsep+originalcp,'dev.webcraft.browser.RegistryJvmHarness'],'registry-reference',90)
        reference_registry=json.loads(re.search(r'WEBCRAFT_REGISTRY_OK (\{[^\n]*\})',reference).group(1))
        report['phase']='registry-port'
        ported=port([artifact('registry-runtime',runtimejar),*lazy_items],'registry-port')
        cp=os.pathsep.join(item['path'] for item in ported)
        registered=require(['java','-Xmx3g','-cp',cp,'dev.webcraft.browser.RegistryJvmHarness'],'registry-port-jvm',90)
        registry=json.loads(re.search(r'WEBCRAFT_REGISTRY_OK (\{[^\n]*\})',registered).group(1))
        if registry!=reference_registry:raise AssertionError('Original and port registry results differ')
        report['registryJvm']=dict(status='passed',registry=registry)
        report['bundle']=bundle;report['portedArtifacts']=ported
        report['phase']='registry-wasm'
        report['registryWasm']=compile_wasm(ported,'dev.webcraft.browser.RegistryBootstrap',DIRECTORY/'registry-wasm','registry-wasm')
        if report['registryWasm']['status']=='compiled':
            registered=require(['node',ROOT/'tools/run_wasm_main.mjs',DIRECTORY/'registry-wasm/startup.wasm','--registry-result'],'registry-wasm-run',90)
            actual=json.loads(re.search(r'WEBCRAFT_REGISTRY_OK (\{[^\n]*\})',registered).group(1))
            if actual!=reference_registry:raise AssertionError('Wasm registry differs')
            report['registryWasm']['execution']='passed'
        report['phase']='complete';report['status']='checks-complete'
    except Exception as error:
        report['status']='failed';report['error']=str(error)
        raise
    finally:
        (DIRECTORY/'result.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:v for k,v in report.items() if k not in ['portedArtifacts']},indent=2))


if __name__=='__main__':main()
