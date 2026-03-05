# openclaw-skills

개인 OpenClaw 스킬 모음

## 스킬 목록

### [work-tracker](./work-tracker/)
다우오피스 출퇴근 사진을 텔레그램으로 보내면 주간 근무현황 + 추천 퇴근시간을 계산해주는 스킬.

### [grok-prompt-runner](./grok-prompt-runner/)
agent-browser로 Grok에 프롬프트를 자동 전송하고 결과를 수집하는 도구.

## 설치

```bash
# work-tracker 설치
cd work-tracker && ./install.sh && openclaw gateway restart

# grok-prompt-runner 실행
# 1. Chrome을 debug 모드로 실행
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug-profile"
# 2. 실행
node grok-prompt-runner/run.js
```

## License

MIT
