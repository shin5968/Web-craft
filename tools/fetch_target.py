#!/usr/bin/env python3
"""Resolve an official Minecraft version and stage JARs for static inspection."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'


def read_url(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in {
        'piston-meta.mojang.com', 'piston-data.mojang.com',
        'launchermeta.mojang.com', 'launcher.mojang.com', 'libraries.minecraft.net',
    }:
        raise ValueError(f'Unapproved download host: {parsed.hostname}')
    with urlopen(url, timeout=60) as response:
        return response.read()


def verified_download(item):
    data = read_url(item['url'])
    if hashlib.sha1(data).hexdigest() != item['sha1']:
        raise ValueError('Download SHA-1 mismatch')
    if 'size' in item and len(data) != item['size']:
        raise ValueError('Download size mismatch')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default='latest-release')
    parser.add_argument('--directory', type=Path, default=Path('reports'))
    args = parser.parse_args()
    manifest = json.loads(read_url(MANIFEST))
    target = manifest['latest']['release'] if args.version == 'latest-release' else args.version
    versions = [item for item in manifest['versions'] if item['id'] == target]
    if len(versions) != 1:
        raise ValueError(f'Unknown or ambiguous version: {target}')
    metadata = json.loads(verified_download(versions[0]))
    args.directory.mkdir(parents=True, exist_ok=True)
    jar_dir = args.directory / 'jars'
    jar_dir.mkdir(exist_ok=True)
    artifacts = [('client', metadata['downloads']['client'])]
    for lib in metadata.get('libraries', []):
        artifact = lib.get('downloads', {}).get('artifact')
        if artifact and artifact['url'].endswith('.jar'):
            artifacts.append((lib['name'], artifact))
    record = {'requested_version':args.version, 'resolved_version':target,
              'java_version':metadata.get('javaVersion'), 'artifacts':[],
              'scope':'Client and all library artifact JARs, without OS rule filtering. Includes native JARs listed as artifacts; separate downloads.classifiers entries and assets excluded. No code execution.'}
    for number, (name, item) in enumerate(artifacts):
        data = verified_download(item)
        path = jar_dir / f'{number:04d}.jar'
        path.write_bytes(data)
        record['artifacts'].append({'name':name, 'path':str(path), 'url':item['url'],
                                    'sha1':item['sha1'], 'sha256':hashlib.sha256(data).hexdigest(),
                                    'size':len(data)})
    (args.directory / 'target.json').write_text(json.dumps(record, indent=2) + '\n')
    print(f'Resolved {target}: {len(artifacts)} JARs staged; no game code executed.')


if __name__ == '__main__':
    main()
