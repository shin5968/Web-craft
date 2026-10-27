#!/usr/bin/env python3
"""Read Java class metadata without loading or executing the supplied JAR."""
import argparse
import collections
import json
import struct
import sys
import zipfile
from pathlib import Path


class ClassReader:
    def __init__(self, data):
        self.data, self.offset = data, 0

    def take(self, size):
        end = self.offset + size
        if end > len(self.data):
            raise ValueError("truncated class file")
        result = self.data[self.offset:end]
        self.offset = end
        return result

    def u1(self):
        return self.take(1)[0]

    def u2(self):
        return struct.unpack(">H", self.take(2))[0]

    def u4(self):
        return struct.unpack(">I", self.take(4))[0]


def inspect_class(data):
    r = ClassReader(data)
    if r.u4() != 0xCAFEBABE:
        raise ValueError("invalid class magic")
    minor, major = r.u2(), r.u2()
    pool = [None] * r.u2()
    i = 1
    while i < len(pool):
        tag = r.u1()
        if tag == 1:
            pool[i] = (tag, r.take(r.u2()).decode("utf-8", errors="replace"))
        elif tag in (7, 8, 16, 19, 20):
            pool[i] = (tag, r.u2())
        elif tag in (3, 4):
            r.take(4)
        elif tag in (5, 6):
            r.take(8)
            i += 1
        elif tag in (9, 10, 11, 12, 17, 18):
            pool[i] = (tag, r.u2(), r.u2())
        elif tag == 15:
            pool[i] = (tag, r.u1(), r.u2())
        else:
            raise ValueError(f"unsupported constant-pool tag {tag}")
        i += 1

    def utf(index):
        item = pool[index]
        if item is None or item[0] != 1:
            raise ValueError("invalid UTF-8 constant reference")
        return item[1]

    def class_name(index):
        item = pool[index]
        if item is None or item[0] != 7:
            raise ValueError("invalid class constant reference")
        return utf(item[1])

    r.u2()  # class access flags
    name = class_name(r.u2())
    r.u2()  # superclass
    r.take(r.u2() * 2)  # interfaces

    def attributes():
        for _ in range(r.u2()):
            r.u2()
            r.take(r.u4())

    native = []
    for is_method in (False, True):
        for _ in range(r.u2()):
            flags, member, descriptor = r.u2(), utf(r.u2()), utf(r.u2())
            if is_method and flags & 0x0100:
                native.append(f"{name}.{member}{descriptor}")
            attributes()
    attributes()
    if r.offset != len(data):
        raise ValueError("unexpected trailing class data")
    references = {class_name(i) for i, item in enumerate(pool)
                  if item is not None and item[0] == 7}
    calls = []
    for item in pool:
        if item is not None and item[0] in (10, 11):
            nt = pool[item[2]]
            if nt is None or nt[0] != 12:
                raise ValueError("invalid method name/type reference")
            calls.append(f"{class_name(item[1])}.{utf(nt[1])}{utf(nt[2])}")
    return name, major, minor, native, references, calls


RISK_PREFIXES = {
    "native_bindings": ("org/lwjgl/", "com/sun/jna/"),
    "reflection": ("java/lang/reflect/",),
    "method_handles": ("java/lang/invoke/",),
    "filesystem": ("java/io/", "java/nio/file/"),
    "network": ("java/net/", "javax/net/"),
    "unsafe": ("sun/misc/Unsafe", "jdk/internal/misc/Unsafe"),
    "foreign_memory": ("java/lang/foreign/",),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jars", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = {
        "scope": "Static constant-pool and member scan; no code is executed.",
        "limitations": [
            "Not a TeaVM compilation or proof of browser compatibility.",
            "Only supplied JARs are scanned; referenced dependencies are not downloaded.",
            "References may be unused; reflection and runtime-loaded names can be missed.",
            "Class references do not include every type mentioned only in descriptors.",
            "Multi-release entries are counted separately, not selected for a target JVM.",
            "Constant strings use replacement decoding for modified UTF-8 edge cases.",
        ],
        "jars": [],
    }
    failed = False
    for path in args.jars:
        entry = {"path": str(path), "class_count": 0, "class_versions": {},
                 "native_methods": [], "risk_references": {},
                 "dynamic_loading_references": [], "bundled_native_files": [], "errors": []}
        versions = collections.Counter()
        risks = {key: set() for key in RISK_PREFIXES}
        dynamic = set()
        try:
            with zipfile.ZipFile(path) as jar:
                for info in jar.infolist():
                    name = info.filename
                    if name.lower().endswith((".so", ".dll", ".dylib", ".jnilib")):
                        entry["bundled_native_files"].append(name)
                    if not name.endswith(".class"):
                        continue
                    try:
                        if info.file_size > 32 * 1024 * 1024:
                            raise ValueError("class exceeds 32 MiB scan limit")
                        _, major, minor, native, refs, calls = inspect_class(jar.read(info))
                        entry["class_count"] += 1
                        versions[f"{major}.{minor}"] += 1
                        entry["native_methods"].extend(native)
                        for key, prefixes in RISK_PREFIXES.items():
                            risks[key].update(ref for ref in refs if ref.startswith(prefixes))
                        dynamic.update(call for call in calls if call.startswith((
                            "java/lang/Class.forName(", "java/lang/ClassLoader.",
                            "java/lang/System.load(", "java/lang/System.loadLibrary(")))
                    except (ValueError, IndexError, struct.error, RuntimeError,
                            OSError, zipfile.BadZipFile, NotImplementedError) as exc:
                        entry["errors"].append(f"{name}: {exc}")
        except (OSError, zipfile.BadZipFile) as exc:
            entry["errors"].append(str(exc))
        entry["class_versions"] = dict(sorted(versions.items()))
        entry["risk_references"] = {key: sorted(value) for key, value in risks.items()}
        entry["dynamic_loading_references"] = sorted(dynamic)
        entry["native_methods"].sort()
        entry["bundled_native_files"].sort()
        report["jars"].append(entry)
        failed |= bool(entry["errors"])
    result = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result, encoding="utf-8")
    else:
        sys.stdout.write(result)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
