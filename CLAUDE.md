# openclaw-skills

개인 OpenClaw 스킬 모음. 텔레그램 봇을 통해 AI 기반 자동화를 수행한다.

## 프로젝트 구조

```
openclaw-skills/
├── work-tracker/          # 다우오피스 출퇴근 시간 계산 스킬
│   ├── SKILL.md           # OpenClaw 스킬 정의 (GPT 비전 + exec)
│   ├── scripts/
│   │   └── calc_hours.js  # 근무시간 계산 엔진 (Node.js, 외부 의존성 없음)
│   └── install.sh         # ~/.openclaw/workspace/skills/에 설치
│
└── grok-prompt-runner/    # agent-browser로 Grok에 프롬프트 자동 전송
    ├── run.js             # 메인 실행 스크립트 (Node.js)
    ├── prompts/           # 프롬프트 템플릿 (.txt)
    │   └── ai-trend.txt   # AI 트렌드 분석 프롬프트
    └── outputs/           # Grok 응답 저장 (gitignored)
```

## 기술 스택

- **언어**: JavaScript (Node.js) only — Python 사용 금지
- **브라우저 자동화**: agent-browser (npm) + Chrome --remote-debugging-port=9222
- **OpenClaw 스킬**: SKILL.md + exec 도구로 스크립트 실행
- **외부 의존성**: 없음 (Node.js 내장 모듈만 사용)

## 규칙

- 모든 스크립트는 Node.js로 작성 (Python, bash wrapper 금지)
- 한국어 텍스트 처리 시 JSON.stringify()로 안전하게 전달
- agent-browser는 AGENT_BROWSER_AUTO_CONNECT=1 환경변수 사용
- Chrome은 --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug-profile"로 실행

## work-tracker 회사 규칙

- 주 40시간 (월-금)
- 코어타임: 11:00-17:00
- 점심: 12:30-13:30 무조건 차감
- 반차: 4시간 인정
- 휴가/공휴일: 8시간 인정
- 금요일: 17:00 퇴근 고정

## 테스트

```bash
# work-tracker
node work-tracker/scripts/calc_hours.js --data '{"days":[...]}'

# grok-prompt-runner (Chrome이 debug 모드로 열려있어야 함)
node grok-prompt-runner/run.js [prompt-file]
```
