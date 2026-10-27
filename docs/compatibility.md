# 호환성 검증 기록

## 현재 상태

목표: 최신 Java 에디션의 특정 버전을 고정해 브라우저에서 실행 가능성을 검증.
정확한 버전, 게임 파일 해시, 의존성 목록은 아직 확보하지 않았습니다.
이 저장소에는 Minecraft 코드나 게임 실행 기능이 없습니다.

| 항목 | 상태 | 다음 통과 기준 |
| --- | --- | --- |
| JAR 정적 분석 | 도구 구현 | 실제 클라이언트·의존성 분석 결과 확보 |
| Java 실행 경로 | 미검증 | 필요한 bytecode·표준 API를 웹에서 실행 |
| TeaVM 활용 | 후보, 미검증 | 실제 게임 코드 일부의 컴파일·실행 성공 |
| WebGPU 진단 | 페이지 구현, 기기 미검증 | iPad에서 장치 생성·렌더 패스 완료 |
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

## 참고

- [TeaVM 개요 및 기존 Java 코드 이식 제약](https://teavm.org/docs/intro/overview.html)
- [Minecraft 26.1 릴리스 노트](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-1)
- [Minecraft 26.3 릴리스 노트](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3)
- [CheerpJ 지원 범위](https://cheerpj.com/docs/faq)
