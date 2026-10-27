#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
for required in javac mvn node python3; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Missing $required. In Codespaces run: Codespaces: Rebuild Container" >&2
    exit 1
  fi
done
java_compiler_version="$(javac -version 2>&1)"
if [[ ! "$java_compiler_version" =~ ^javac\ 25([.[:space:]]|$) ]]; then
  echo "Need JDK 25; found: $java_compiler_version" >&2
  echo 'Run Codespaces: Rebuild Container, then open a new terminal.' >&2
  exit 1
fi
mvn -B -f java-smoke/pom.xml package
node tools/check_java_smoke.mjs
python3 tools/prepare_minecraft_smoke.py
mvn -B -f minecraft-smoke/pom.xml package
node tools/check_minecraft_smoke.mjs
exec python3 tools/dev_server.py
