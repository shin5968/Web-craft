# 호환성 검증 기록

## 현재 상태

목표: 최신 Java 에디션의 특정 버전을 고정해 브라우저에서 실행 가능성을 검증.
첫 자동 분석에서 26.3과 의존성 목록·파일 해시를 확보했습니다. Java 웹 실행은 아직 미검증입니다.
이 저장소에는 Minecraft 코드나 게임 실행 기능이 없습니다.

| 항목 | 상태 | 다음 통과 기준 |
| --- | --- | --- |
| JAR 정적 분석 | 26.3 및 115개 JAR 분석 완료 | 실행 경로별 의존성 분류 |
| Java 실행 경로 | 미검증 | 필요한 bytecode·표준 API를 웹에서 실행 |
| TeaVM 활용 | 후보, 미검증 | 실제 게임 코드 일부의 컴파일·실행 성공 |
| WebGPU 진단 | 사용자 iPad에서 장치 생성·렌더 패스 완료 보고 | 실제 게임 렌더러 검증은 별도 |
| Wasm GC | 사용자 iPad에서 구조체 생성·읽기 42 성공 보고 | Java 컴파일 결과 실행 검증은 별도 |
| 공유 메모리 | 사용자 환경에서 격리 false·API 미노출 | 격리 구성 후 Worker 원자적 쓰기 결과 42 |
| WebGPU 게임 렌더러 | 미구현 | 게임 데이터에서 청크 하나 표시 |
| 오디오·저장·네트워크 | 미구현 | 각 브라우저 API 경로의 독립 검증 |
| 인증·모드·전체 싱글플레이 | 미구현 | 기본 클라이언트 실행 후 범위 결정 |

## 기록할 환경

- 게임 버전과 JAR SHA-256
- 함께 분석한 의존성 JAR 목록
- Python/분석 도구 버전과 Git commit
- iPad 모델·iPadOS·브라우저 버전, 브라우저 진단 결과
- Java 웹 실행 후보와 정확한 버전, 컴파일 오류와 재현 명령

## 결과 해석

`risk_references`는 조사할 후보 목록입니다. 참조가 있어도 실제 실행 경로에서는 사용하지 않을 수 있으며,
참조가 없어도 동적 로딩·리플렉션·메서드 디스크립터 등에 의존성이 숨어 있을 수 있습니다.
native 메서드가 0개여도 LWJGL 등 별도 의존성의 native 호출이 없어지는 것은 아닙니다.
클래스 버전 분석은 해당 JVM용 파일 형식임을 보여 줄 뿐, TeaVM이나 웹 JVM의 지원 여부를 판정하지 않습니다.
브라우저 WebGPU 성공도 Minecraft 구동 성공을 의미하지 않습니다.

## 사용자 기기에서 관측한 결과

2026-10-27 사용자 제공 로그: Safari 27.0.1, 보안 컨텍스트 true,
WebAssembly 노출, 어댑터 설명 apple, maxBufferSize 1073741824,
단색 렌더 패스 제출·완료. crossOriginIsolated false, SharedArrayBuffer 미노출.
기기는 사용자가 iPad라고 확인했습니다. UA의 Macintosh 표기로 기기 모델을 추정하지 않습니다.
최대 버퍼 크기는 전체 사용 가능 메모리나 게임 성능을 나타내지 않습니다.

## 실제 JAR 분석

`.github/workflows/inspect-target.yml`을 수동 실행하면 공식 메타데이터에서 버전을 확정하고,
JAR 해시를 검증한 후 정적 분석 결과를 JSON artifact로 제공합니다.
첫 정적 분석은 완료했습니다. 정적 분석 성공은 웹 실행 성공을 의미하지 않습니다.

## 참고

- [TeaVM 개요 및 기존 Java 코드 이식 제약](https://teavm.org/docs/intro/overview.html)
- [Minecraft 26.1 릴리스 노트](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-1)
- [Minecraft 26.3 릴리스 노트](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3)
- [CheerpJ 지원 범위](https://cheerpj.com/docs/faq)


## 첫 실제 분석 결과 — 26.3

[실행 기록 및 JSON artifact](https://github.com/shin5968/Web-craft/actions/runs/40447128242)

- 메타데이터 Java 요구 버전: 25.
- 클라이언트: 클래스 11,383개, 모두 class version 69.0.
- 전체: JAR 115개, 클래스 43,348개, 분석 오류 0개.
- 클라이언트의 LWJGL/JNA 클래스 참조: 고유 284개.
- 전체 입력 JAR의 native 메서드 선언: 5,683개, 포함된 native 파일: 96개.
- 클라이언트 SHA-256: `4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d`.

| 클라이언트 참조 계열 | 고유 클래스 수 | 브라우저 이식 조사 방향 |
| --- | ---: | --- |
| Vulkan | 164 | 게임 렌더링 계층과 WebGPU 백엔드 연결 |
| SDL | 39 | 창·입력·이벤트의 브라우저 구현 |
| OpenGL | 16 | 선택한 렌더링 경로의 사용 여부 확인 |
| OpenAL | 15 | Web Audio 등 웹 오디오 경로 검토 |
| JNA | 13 | OS 정보 등 호출 경로를 분리하고 웹 대체 구현 검토 |

수치는 정적 클래스 참조 수이며 호출 횟수나 실제 실행 경로 수가 아닙니다.
클라이언트 자체의 native 선언은 0개지만 의존성 JAR에는 있으므로 native 의존성이 없다는 뜻이 아닙니다.
현재 보고서는 OS 규칙 필터 없이 artifact를 수집해 여러 OS용 native JAR도 포함합니다.
첫 target.json의 scope 문자열은 native classifier 제외 범위를 넓게 표현했으나,
실제로는 downloads.artifact의 native JAR도 포함하며 별도 downloads.classifiers 항목만 수집하지 않습니다.

다음 실행 관문: Java 25 클래스 형식을 처리할 웹 컴파일/실행 후보를 정하고,
게임의 작고 플랫폼 독립적인 코드 일부에 대해 실제 컴파일·실행을 확인합니다.
Wasm GC 성공만으로 이 관문을 통과할 수는 없습니다.


## Java 컴파일 실행 실험

`java-smoke/`는 독립적으로 작성한 작은 Java 프로그램이며 Minecraft 코드가 아닙니다.
JDK 25의 class format 69를 입력해 TeaVM 0.16.0으로 Wasm GC를 생성합니다.
객체·record·배열·정수 연산·예외 처리를 검증합니다. class format을 읽는 것과
Java 25 전체 언어·라이브러리·동적 로딩 기능을 지원하는 것은 별개입니다.
워크플로 결과와 iPad 실행 결과를 각각 확인해야 합니다.


### 첫 빌드 검증 결과

[Java Wasm GC 실행 기록](https://github.com/shin5968/Web-craft/actions/runs/40447957292)

2026-10-27 GitHub Actions에서 JDK 25 컴파일, class major 69 확인,
TeaVM 0.16.0 Wasm GC 변환 및 Node.js 실행이 모두 성공했습니다.
Java 객체·배열 체크섬 6건과 예외 처리 결과가 참조값과 일치했습니다.
`java-smoke-site` artifact에는 생성된 Wasm과 런타임을 포함한 전체 web 폴더가 있습니다.
아이패드에서 이 Java 빌드 결과를 실행한 것은 아직 확인하지 않았습니다.

이 결과로 작은 원본 Java 코드의 class 69 입력을 처리하는 경로는 확보했습니다.
Minecraft 코드의 실제 변환, 네이티브 API 대체, Java 25 전체 호환성은 여전히 미검증입니다.
