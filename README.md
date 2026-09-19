# 치지직 LaTeX 채팅 위젯

치지직(CHZZK) 기본 채팅 위젯과 같은 모양인데, 채팅에 **LaTeX 문법이 있으면 수식으로 그려 주는** OBS 용 채팅 위젯입니다.
서버 없이 `index.html` 파일 하나로 동작합니다 (GitHub Pages 배포).

- 일반 채팅: 기본 위젯과 동일 (검정 말풍선, 닉네임 색, 뱃지, 이모티콘, 치즈 후원/구독 메시지)
- LaTeX 가 감지된 채팅: 전용 스타일(초록 테두리 + LaTeX 표식)로 바뀌고 수식이 [KaTeX](https://katex.org) 로 렌더링됨

## 사용법 (스트리머)

1. <https://wisebear-kor.github.io/chzzk_chatting_with_latex/> 를 엽니다.
2. 치지직 스튜디오의 채팅 위젯 URL(`https://chzzk.naver.com/chat/…`)을 붙여 넣습니다.
3. 변환된 주소를 OBS **브라우저 소스**의 URL 에 넣습니다. 크기는 기본 위젯과 같게 잡으면 됩니다.

주소는 이런 모양입니다. 한 번 넣어 두면 방송을 새로 켜도 그대로 쓸 수 있습니다.

```
https://wisebear-kor.github.io/chzzk_chatting_with_latex/?hash=<위젯 URL 끝의 32자리 값>
```

미리보기: <https://wisebear-kor.github.io/chzzk_chatting_with_latex/?demo=1>

## 수식 쓰는 법 (시청자)

| 입력 | 결과 |
| --- | --- |
| `오일러 공식 $e^{i\pi}+1=0$` | 문장 안 수식 |
| `$$\int_0^1 x^2\,dx$$` | 가운데 정렬된 큰 수식 (`\[ \]` 도 가능, `\( \)` 는 문장 안 수식) |
| `답은 \frac{1}{2} 입니다` | 구분자 없이도 `\frac`, `\sqrt` 같은 LaTeX 명령이 있으면 자동 감지 |
| `속력=\frac{거리}{시간}임` | 한글이 붙어 있어도, 중괄호 안 한글도 됩니다 |
| `\ce{2H2 + O2 -> 2H2O}` | 화학식 (mhchem) |

- 수식만 보낸 채팅은 자동으로 큰 수식으로 표시됩니다.
- 말풍선보다 넓은 수식은 너비에 맞게 줄어듭니다.
- 문법이 틀리면 그냥 원래 글자로 보입니다.
- `$5 아니면 $10`, `^^`, `T_T`, `\o/`, `C:\Users\…` 같은 것은 수식으로 오인하지 않습니다.
  그래서 `x^2` 처럼 구분자도 `\명령` 도 없는 것은 감지하지 않습니다. `$x^2$` 로 감싸 주세요.

## URL 옵션

| 옵션 | 설명 |
| --- | --- |
| `hash` | 치지직 채팅 위젯 URL 끝의 32자리 값. URL 전체를 넣어도 됩니다. |
| `channel` | 위젯 해시 대신 채널 ID 로 조회 (19세 방송은 `hash` 만 됩니다) |
| `detect` | `auto`(기본) · `delimiter`(`$` 등 구분자로 감싼 것만) · `off` |
| `demo=1` | 가짜 채팅으로 모양 미리보기 |
| `chatChannelId` | 자동 조회를 건너뛰고 직접 지정. 방송을 켤 때마다 바뀌는 값이라 임시 방편입니다. |
| `proxy` | 직접 배포한 조회 프록시 주소 (아래 "비상용 프록시") |
| `debug` | 브라우저 콘솔에 동작 로그 출력 |

모양은 OBS 브라우저 소스의 **사용자 지정 CSS** 에서 CSS 변수로 바꿀 수 있습니다.

```css
:root { --chat-font-size: 28px; --chat-line-height: 38px; --bubble-max-width: 640px; --math-accent: #ffd54a; }
```

## 동작 원리와 한계

- 채팅은 위젯(브라우저)이 치지직 채팅 서버에 **WebSocket 으로 직접** 붙어서 읽기 전용으로 받습니다. 로그인도 토큰도 쓰지 않습니다.
- 다만 접속하려면 그 방송의 `chatChannelId` 가 필요한데, 이 값은 **방송을 켤 때마다 새로 발급**되고,
  "위젯 해시 → chatChannelId" 를 알려 주는 치지직 API 는 `chzzk.naver.com` 밖의 웹페이지에서 부르면
  CORS 로 거절됩니다(403). 서버 없는 정적 페이지로는 직접 읽을 방법이 없습니다.
- 그래서 이 한 번의 조회만 CORS 헤더를 붙여 주는 공개 중계 서비스 **[r.jina.ai](https://jina.ai/reader)** 를 거칩니다
  (20초마다 1회, 실패하면 allorigins 로 한 번 더 시도). 중계로 나가는 정보는 위젯 해시뿐이고, 채팅 내용은 중계를 거치지 않습니다.
- **즉 이 위젯은 제3자 서비스(r.jina.ai)와 치지직의 비공개 API 에 기대고 있습니다.** 어느 쪽이든 정책이 바뀌면 채팅 채널 조회가
  멈출 수 있습니다. 그때는 화면 왼쪽 아래에 안내가 뜨고, 마지막으로 알던 채널로는 계속 접속을 시도합니다.
- 표시하는 것: 일반 채팅, 치즈 후원(채팅/미션/파티), 구독 메시지. 영상 후원·구독 선물·상점 구매·시스템 메시지는 표시하지 않습니다.
  블라인드 처리된 채팅은 기본 위젯처럼 사라집니다.

### 비상용 프록시 (선택)

중계 서비스가 막혔을 때를 위한 대비책입니다. [`proxy/worker.js`](proxy/worker.js) 내용을
[Cloudflare Workers](https://workers.cloudflare.com)(무료)에 그대로 붙여 넣어 배포하고, 위젯 주소 뒤에
`&proxy=https://<이름>.workers.dev` 를 붙이면 공개 중계보다 먼저 그쪽으로 조회합니다.
(로컬에서 동작 검증은 했지만 Cloudflare 에 실제 배포해 보지는 않았습니다.)

## 수식 렌더링의 안전장치

채팅은 누구나 보낼 수 있는 입력이므로:

- KaTeX `trust: false` — `\href`, `\url`, `\includegraphics`, `\htmlStyle` 등은 수식으로 그리지 않고 원문 그대로 표시
- `maxSize`, `maxExpand` 로 거대한 상자·매크로 폭탄 차단, 매크로는 메시지끼리 공유하지 않음
- 말풍선 크기 상한(너비 520px, 높이 340px = CSS 변수 `--bubble-max-height`) 밖은 그리지 않음.
  `\raisebox{-100em}{x}` 처럼 KaTeX 가 허용하는 음수 치수로 말풍선을 화면 밖까지 늘리는 장난은,
  명령을 걸러 내는 대신 **실제로 그려진 크기를 재서** 상한을 넘치면 수식 없이 원문 글자로 다시 그림 (매크로로 숫자를 숨겨도 통하지 않음)
- 메시지당 수식 8개
- 채팅 글자는 전부 `textContent` 로만 넣고, 이모티콘 이미지는 치지직과 같은 호스트만 허용
- KaTeX 는 버전을 고정한 CDN(jsDelivr → 실패 시 unpkg)에서 SRI 무결성 검사와 함께 불러옴

## 개발

파일 하나(`index.html`)가 전부입니다. LaTeX 감지 로직은 그 안의 `<script id="latex-core">` 블록이고,
테스트는 그 블록만 떼어 실제 KaTeX 로 검증합니다.

```bash
npm install   # 테스트용 katex 만 설치됩니다
npm test
```

로컬에서 볼 때는 아무 정적 서버로나 열면 됩니다 (예: `npx serve`), 그리고 `/?demo=1`.

## 배포 (GitHub Pages)

저장소 Settings → Pages → Source: **Deploy from a branch**, Branch: **main** / **/(root)**.

## 라이선스

[MIT](LICENSE) © 2026 wisebear — 자유롭게 쓰고 고치고 배포해도 되지만, **있는 그대로(AS IS) 제공되며 어떤 보증도 책임도 지지 않습니다.**

네이버·치지직과 무관한 비공식 프로젝트입니다. 공개되지 않은 치지직 API 와 제3자 서비스에 기대고 있어 예고 없이 동작이 멈출 수 있고,
사용에 따른 책임(치지직 이용약관 준수 포함)은 사용하는 분에게 있습니다.

수식 렌더링에 쓰는 [KaTeX](https://github.com/KaTeX/KaTeX)(MIT)는 저장소에 포함하지 않고 실행 시 CDN 에서 불러옵니다.
