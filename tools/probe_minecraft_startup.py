#!/usr/bin/env python3
"""Probe the original client or registry entry point; never launch a game window."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

from fetch_target import MANIFEST, read_url, verified_download
from prepare_minecraft_smoke import ROOT, VERSION, SHA256


def make_pom(artifacts, output, entry_point='net.minecraft.client.main.Main'):
    project = ET.Element('project', xmlns='http://maven.apache.org/POM/4.0.0')
    def value(parent, name, text):
        ET.SubElement(parent, name).text = str(text)
    for name, text in [('modelVersion','4.0.0'), ('groupId','dev.webcraft'),
                       ('artifactId','startup-probe'), ('version','0.1.0')]:
        value(project, name, text)
    dependencies = ET.SubElement(project, 'dependencies')
    for index, artifact in enumerate(artifacts):
        dependency = ET.SubElement(dependencies, 'dependency')
        for name, text in [('groupId','local.probe'), ('artifactId',f'jar-{index}'),
                           ('version','1'), ('scope','system'), ('systemPath',artifact['path'])]:
            value(dependency, name, text)
    dependency = ET.SubElement(dependencies, 'dependency')
    for name, text in [('groupId','org.teavm'), ('artifactId','teavm-classlib'), ('version','0.16.0')]:
        value(dependency, name, text)
    plugins = ET.SubElement(ET.SubElement(project, 'build'), 'plugins')
    plugin = ET.SubElement(plugins, 'plugin')
    for name, text in [('groupId','org.teavm'), ('artifactId','teavm-maven-plugin'), ('version','0.16.0')]:
        value(plugin, name, text)
    configuration = ET.SubElement(plugin, 'configuration')
    for name, text in [('mainClass',entry_point),
                       ('targetType','WEBASSEMBLY_GC'), ('targetDirectory',str(output)),
                       ('targetFileName','startup.wasm'), ('optimizationLevel','SIMPLE')]:
        value(configuration, name, text)
    return ET.tostring(project, encoding='unicode')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=['main','registry'], default='main')
    target = parser.parse_args().target
    entry_point = 'net.minecraft.client.main.Main' if target == 'main' else 'dev.webcraft.browser.RegistryBootstrap'
    directory = ROOT / 'reports' / ('startup-probe' if target == 'main' else 'registry-probe')
    directory.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(read_url(MANIFEST))
    entry = next(item for item in manifest['versions'] if item['id'] == VERSION)
    metadata = json.loads(verified_download(entry))
    items = [('client', metadata['downloads']['client'])]
    for library in metadata.get('libraries', []):
        artifact = library.get('downloads', {}).get('artifact')
        if artifact and artifact['url'].endswith('.jar'):
            items.append((library['name'], artifact))
    artifacts = []
    for index, (name, item) in enumerate(items):
        data = verified_download(item)
        digest = hashlib.sha256(data).hexdigest()
        if index == 0 and digest != SHA256:
            raise ValueError('Pinned client SHA-256 mismatch')
        path = directory / f'{index:04d}.jar'
        path.write_bytes(data)
        artifacts.append(dict(name=name, path=str(path), sha256=digest))
    baseline = None
    if target == 'registry':
        classes = directory / 'classes'
        classes.mkdir(exist_ok=True)
        source = ROOT / 'browser-bootstrap/src/main/java/dev/webcraft/browser/RegistryBootstrap.java'
        classpath = os.pathsep.join(artifact['path'] for artifact in artifacts)
        subprocess.run(['javac','--release','25','-cp',classpath,'-d',str(classes),str(source)], check=True)
        wrapper = directory / 'bootstrap.jar'
        subprocess.run(['jar','--create','--file',str(wrapper),'-C',str(classes),'.'], check=True)
        artifacts.insert(0,dict(name='webcraft-registry-bootstrap',path=str(wrapper),sha256=hashlib.sha256(wrapper.read_bytes()).hexdigest()))
        try:
            run = subprocess.run(['java','-Xmx3g','-cp',str(wrapper)+os.pathsep+classpath,entry_point],
                                 capture_output=True, text=True, timeout=90)
            (directory / 'jvm.log').write_text(run.stdout+'\n'+run.stderr)
            marker = next((line.split('WEBCRAFT_REGISTRY_OK ',1)[1] for line in run.stdout.splitlines() if 'WEBCRAFT_REGISTRY_OK ' in line),None)
            baseline = dict(status='passed' if run.returncode == 0 and marker else 'failed',exitCode=run.returncode)
            if marker: baseline['registry'] = json.loads(marker)
        except subprocess.TimeoutExpired:
            baseline = dict(status='timeout')
    pom = directory / 'pom.xml'
    pom.write_text(make_pom(artifacts, directory / 'wasm',entry_point))
    report = dict(version=VERSION, entryPoint=entry_point,
                  clientSha256=SHA256, compiler='TeaVM 0.16.0 WEBASSEMBLY_GC',
                  libraries=artifacts, scope=('Original Main compilation only.' if target == 'main' else 'Original registry initialization executed on JVM as a baseline; same entry point compiled for Wasm GC, not executed in browser.')+' No game window, authentication, downloaded assets, platform stubs or native replacements. All declared library artifacts included without OS filtering.')
    if baseline is not None: report['jvmBaseline'] = baseline
    env = dict(os.environ, MAVEN_OPTS='-Xmx5g -XX:+ExitOnOutOfMemoryError')
    command = ['mvn','-B','-ntp','-f',str(pom),'org.teavm:teavm-maven-plugin:0.16.0:compile']
    with (directory / 'compile.log').open('w') as log:
        try:
            process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, env=env, timeout=240)
            report['exitCode'] = process.returncode
            report['status'] = 'compiled' if process.returncode == 0 else 'compile-failed'
        except subprocess.TimeoutExpired:
            report['status'] = 'timeout'
    text = (directory / 'compile.log').read_text(errors='replace')
    report['diagnostics'] = [line for line in text.splitlines() if '[ERROR]' in line or 'not found' in line or 'unsupported' in line.lower()][:200]
    (directory / 'result.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({key:report[key] for key in ('entryPoint','status','diagnostics')}, indent=2))
    if baseline is not None: print('JVM baseline: '+json.dumps(baseline))
    print('Expected compiler failures are recorded, not treated as game startup success.')


if __name__ == '__main__':
    main()
