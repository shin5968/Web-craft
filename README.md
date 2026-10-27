# Web-craft

최신 Minecraft Java 에디션의 브라우저 이식 가능성을 검증하는 실험 저장소입니다.
현재는 **JAR 정적 분석 도구와 브라우저 기능 진단 페이지**만 제공합니다.
Minecraft 실행, Java 25 웹 런타임, TeaVM 변환, 청크 렌더러는 구현하지 않았습니다.

## JAR 분석

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
