# Web-craft

최신 Minecraft Java 에디션의 브라우저 이식 가능성을 검증하는 실험 저장소입니다.
현재는 **JAR 정적 분석 도구, 브라우저 기능 진단 페이지, 작은 Java 프로그램의 Wasm GC 빌드 실험**을 제공합니다.
Minecraft 실행, 완전한 Java 25 웹 런타임, 게임 코드의 TeaVM 변환, 청크 렌더러는 구현하지 않았습니다.

## iPad + Codespaces에서 바로 실행

별도 호스팅이나 artifact 다운로드 없이 Codespaces 안에서 빌드·서빙할 수 있습니다.

1. Codespaces 터미널에서 `git pull --ff-only`로 최신 코드를 가져옵니다.
2. 명령 팔레트에서 **Codespaces: Rebuild Container**를 실행합니다.
   새 설정이 JDK 25·Maven·Node 24·Python을 설치합니다. 완료 후 새 터미널을 여세요.
3. 저장소 루트에서 다음을 실행합니다.

```bash
bash tools/start_codespaces.sh
```

빌드·Java Wasm 실행 검증이 성공하면 개발 서버가 계속 실행됩니다.
**Ports → 8000 → Open in Browser**로 포워딩된 HTTPS 주소를 Safari 새 탭에서 열고,
**환경 검사 시작**, **Java 실행 검사**를 누르세요. 포트는 비공개 상태로 사용할 수 있습니다.
로컬 서버는 HTTP이며 Codespaces의 외부 포워딩 주소가 HTTPS를 제공합니다.

개발 서버는 web 폴더만 제공하며 COOP/COEP와 캐시 비활성 헤더를 보냅니다.
페이지 격리 성공은 프록시와 브라우저를 통과한 실제 `격리 컨텍스트` 값으로 확인하세요.
Codespaces 안의 미리보기 iframe 대신 Safari 새 탭에서 직접 여세요.
서버 종료는 Ctrl+C이며 Codespace가 중지되면 주소도 응답하지 않습니다.
이미 필요한 도구가 설치되어 있다면 컨테이너 재빌드 없이 3번부터 시도할 수 있습니다.
포트 사용 중 오류가 나면 기존 8000 서버를 실행한 터미널에서 종료한 뒤 다시 실행하세요.

## JAR 분석

### iPad에서 GitHub Actions 사용

저장소의 **Actions → Inspect Minecraft target → Run workflow**에서 실행합니다.
분석 도구나 이 워크플로가 main에서 변경될 때도 최신 정식 버전을 자동 분석합니다.
`version`에 공식 버전 ID를 지정하거나 `latest-release`를 사용하세요.
공식 메타데이터가 지정한 클라이언트와 라이브러리 JAR을 임시 다운로드하고 해시를 검증한 뒤 정적 분석합니다.
게임 코드를 실행하지 않으며, 결과물 `compatibility-report`에는 JSON 보고서만 포함합니다.
`target.json`에 실제 선택한 버전, Java 요구 정보, JAR별 SHA-256이 기록됩니다.
모든 라이브러리 artifact JAR을 OS 규칙 필터 없이 분석하므로 artifact로 등록된 native JAR도 포함합니다. 별도 downloads.classifiers 항목과 assets는 제외합니다.
따라서 iPad 실행용 라이브러리 구성이 확정되는 것은 아닙니다.

### 개발 환경에서 직접 실행

Python 3.10 이상, 외부 패키지 없이 실행합니다. 소유한 게임 설치 파일을 로컬에서 분석하세요.
게임과 의존성 JAR을 모두 입력해야 분석 범위가 넓어집니다. 다운로드나 코드 실행은 하지 않습니다.

```bash
python3 tools/inspect_jar.py /path/to/client.jar /path/to/library.jar --output reports/compatibility.json
```

클래스 버전, native 메서드 선언, 위험 API 참조, 동적 로딩 메서드 참조, 포함된 네이티브 파일을 JSON으로 출력합니다.
클래스 major version 69는 Java 25 형식이며, 이것만으로 Java 25 전체 기능 사용 여부를 알 수는 없습니다.
리플렉션으로 구성되는 이름, 실행 중 로딩되는 코드, 모든 디스크립터 참조를 완전히 추적하지 않습니다.
멀티 릴리스 JAR의 버전별 클래스는 별도로 집계합니다. 자세한 한계는 보고서의 `limitations`를 확인하세요.
정상 분석은 종료 코드 0, 파일/클래스 오류가 있으면 부분 보고서를 출력하고 1을 반환합니다.

## 브라우저 진단

주요 대상 기기는 **iPad**입니다. iPad에서는 진단 페이지를 HTTPS로 호스팅한 주소에서 열어 검사합니다.
이 저장소는 아직 호스팅을 구성하지 않았으며, GitHub 파일 보기 화면에서는 페이지가 실행되지 않습니다.
아래 Python 명령은 별도 개발 컴퓨터용이며 iPad Safari에서 실행하는 명령이 아닙니다.

```bash
python3 -m http.server 8000 --directory web
```

같은 기기에서 `http://localhost:8000`을 열고 검사 버튼을 누르세요.
휴대폰에서 다른 컴퓨터의 LAN HTTP 주소로 접속하면 보안 컨텍스트가 아니므로 WebGPU가 노출되지 않을 수 있습니다.
다른 기기에서 접속하거나 배포할 때는 HTTPS를 사용하세요.

WebGPU 어댑터·장치 생성과 단색 렌더 패스 제출을 검사합니다.
Wasm GC는 작은 모듈의 구조체 생성·필드 읽기를 실제 실행합니다.
격리 컨텍스트에서는 Wasm 공유 메모리와 Worker의 Atomics 쓰기·읽기를 검사합니다.
이 검사는 Java 스레드나 실제 Wasm 스레드 프로그램의 실행을 증명하지 않습니다.
WebAssembly, SharedArrayBuffer 노출 여부도 표시하지만 Java·Wasm GC·병렬 실행 호환성을 증명하지는 않습니다.
기본 Python 서버는 COOP/COEP 헤더를 보내지 않으므로 격리 컨텍스트가 false인 것이 예상 결과입니다.
향후 공유 메모리 구성을 사용할 때는 COOP/COEP와 교차 출처 리소스 정책을 함께 설계해야 합니다.

## 다음 관문

1. 목표 게임 버전과 의존성 목록 고정.
2. 실제 JAR 분석 결과로 런타임·네이티브 API 장애물 확인.
3. 게임 코드 일부로 웹 컴파일 실험 수행.
4. 해당 실험이 통과하면 청크 데이터를 WebGPU에 연결.

현재 진행 상태와 통과 기준은 [호환성 문서](docs/compatibility.md)에 기록합니다.
게임 JAR, assets, 계정 토큰, 월드 파일은 저장소에 포함하지 않습니다.

## 로컬 검증

```bash
python3 -m unittest discover -s tools -v
```

합성 클래스 파일로 메타데이터 추출, 손상 파일 처리, CLI 보고서와 종료 코드를 확인합니다.
실제 Minecraft JAR이나 iPad GPU 검증을 대체하지는 않습니다.


## Java → Wasm GC 실행 실험

Actions의 **Build Java Wasm GC smoke**가 Temurin JDK 25로 원본 테스트 코드를 컴파일한 뒤
클래스 형식 69를 확인하고 TeaVM 0.16.0으로 Wasm GC를 생성합니다.
Node.js에서 객체·배열 체크섬 6건과 예외 처리를 검증한 후 `java-smoke-site` artifact를 제공합니다.

아이패드에서 실행하려면 이 artifact를 압축 해제한 **전체 내용**을 현재 HTTPS 호스팅에 배포하고,
페이지의 **Java 실행 검사** 버튼을 누르세요. 생성 파일은 소스 저장소에 커밋하지 않습니다.
`web` 소스만 배포하면 Java Wasm과 runtime 파일이 없어서 안내 오류가 표시됩니다.
자동 호스팅 배포는 이 워크플로에 포함하지 않습니다.

개발 환경에서는 JDK 25와 Maven으로 다음을 실행합니다.

```bash
mvn -B -f java-smoke/pom.xml package
node tools/check_java_smoke.mjs
```

이 실험은 직접 작성한 작은 Java 코드의 class 69 → Wasm GC 경로를 확인합니다.
Minecraft 클래스·모드·JNI·Java 25 전체 표준 API의 지원을 뜻하지 않습니다.
