"""Small JVM class fixtures exercise parsing and command-line error handling."""
import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from inspect_jar import inspect_class


def u2(value):
    return struct.pack('>H', value)


def fixture():
    pool = []

    def utf(value):
        data = value.encode()
        pool.append(b'\x01' + u2(len(data)) + data)
        return len(pool)

    def cls(value):
        index = utf(value)
        pool.append(b'\x07' + u2(index))
        return len(pool)

    this, parent = cls('Sample'), cls('java/lang/Object')
    cls('org/lwjgl/system/Library')
    owner = cls('java/lang/System')
    method, signature = utf('loadLibrary'), utf('(Ljava/lang/String;)V')
    pool.append(b'\x0c' + u2(method) + u2(signature))
    nt = len(pool)
    pool.append(b'\x0a' + u2(owner) + u2(nt))
    native_name, native_type = utf('nativeCall'), utf('()V')
    # Exercise the two-slot rule for long constants.
    pool.extend([b'\x05' + b'\0' * 8, b''])
    header = struct.pack('>IHHH', 0xCAFEBABE, 0, 69, len(pool) + 1)
    body = u2(0x21) + u2(this) + u2(parent) + u2(0) + u2(0)
    body += u2(1) + u2(0x109) + u2(native_name) + u2(native_type) + u2(0)
    return header + b''.join(pool) + body + u2(0)


class InspectorTests(unittest.TestCase):
    def test_metadata_and_native_method(self):
        name, major, minor, native, refs, calls = inspect_class(fixture())
        self.assertEqual((name, major, minor), ('Sample', 69, 0))
        self.assertEqual(native, ['Sample.nativeCall()V'])
        self.assertIn('org/lwjgl/system/Library', refs)
        self.assertIn('java/lang/System.loadLibrary(Ljava/lang/String;)V', calls)

    def test_invalid_and_truncated_classes(self):
        for data in (b'bad', b'\0' * 10, fixture()[:-1]):
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                inspect_class(data)

    def test_cli_partial_report_and_missing_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            jar = root / 'sample.jar'
            with zipfile.ZipFile(jar, 'w') as archive:
                archive.writestr('Sample.class', fixture())
                archive.writestr('Broken.class', b'bad')
                archive.writestr('native/example.so', b'fixture')
            output = root / 'nested' / 'report.json'
            run = subprocess.run([sys.executable, str(Path(__file__).with_name('inspect_jar.py')),
                                  str(jar), str(root / 'missing.jar'), '--output', str(output)],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 1, run.stderr)
            report = json.loads(output.read_text())
            first, missing = report['jars']
            self.assertEqual(first['class_versions'], {'69.0': 1})
            self.assertEqual(first['class_count'], 1)
            self.assertEqual(first['bundled_native_files'], ['native/example.so'])
            self.assertEqual(first['risk_references']['native_bindings'], ['org/lwjgl/system/Library'])
            self.assertTrue(first['dynamic_loading_references'])
            self.assertEqual(len(first['errors']), 1)
            self.assertTrue(missing['errors'])

    def test_cli_success(self):
        with tempfile.TemporaryDirectory() as temporary:
            jar = Path(temporary) / 'valid.jar'
            with zipfile.ZipFile(jar, 'w') as archive:
                archive.writestr('Sample.class', fixture())
            run = subprocess.run([sys.executable, str(Path(__file__).with_name('inspect_jar.py')), str(jar)],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(run.stdout)['jars'][0]['errors'], [])


if __name__ == '__main__':
    unittest.main()
