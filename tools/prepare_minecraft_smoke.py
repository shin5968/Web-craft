#!/usr/bin/env python3
"""Stage the pinned official client for a local, original-bytecode probe."""
import hashlib
import json
import zipfile
from pathlib import Path

from fetch_target import MANIFEST, read_url, verified_download
from inspect_jar import inspect_class

ROOT = Path(__file__).resolve().parents[1]
VERSION = '26.3'
SHA256 = '4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d'
CLASS = 'net/minecraft/util/ARGB.class'


def main():
    jar = ROOT / 'minecraft-smoke/input/client.jar'
    if jar.exists() and hashlib.sha256(jar.read_bytes()).hexdigest() == SHA256:
        data = jar.read_bytes()
    else:
        manifest = json.loads(read_url(MANIFEST))
        entry = next(v for v in manifest['versions'] if v['id'] == VERSION)
        metadata = json.loads(verified_download(entry))
        data = verified_download(metadata['downloads']['client'])
        if hashlib.sha256(data).hexdigest() != SHA256:
            raise ValueError('Pinned Minecraft 26.3 SHA-256 mismatch')
        jar.parent.mkdir(parents=True, exist_ok=True)
        jar.write_bytes(data)
    with zipfile.ZipFile(jar) as archive:
        raw = archive.read(CLASS)
    name, major, minor, native, refs, calls = inspect_class(raw)
    if major != 69:
        raise ValueError(f'Unexpected class format: {major}')
    result = {'version':VERSION, 'client_sha256':SHA256, 'class':name,
              'class_sha256':hashlib.sha256(raw).hexdigest(), 'class_major':major,
              'native_methods':native, 'class_references':sorted(refs),
              'scope':'Original game bytecode input. Only reachable ARGB color methods are compiled. No game startup.'}
    output = ROOT / 'web/minecraft-smoke'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'provenance.json').write_text(json.dumps(result, indent=2)+'\n')
    print(f'Prepared {VERSION} {name}, class format {major}; pinned client hash verified.')


if __name__ == '__main__':
    main()
