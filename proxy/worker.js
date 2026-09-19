// (선택, 비상용) 치지직 채팅 채널 조회 프록시 - Cloudflare Workers 용
//
// 평소에는 필요 없다. 위젯(index.html)은 공개 중계 서비스(r.jina.ai)를 통해 채팅 채널을 조회한다.
// 그 서비스가 막히거나 바뀌었을 때, 이 파일 내용을 Cloudflare Workers(무료)에 그대로 붙여 넣어
// 배포하고 위젯 URL 에 &proxy=https://<이름>.workers.dev 를 붙이면 그쪽을 먼저 쓴다.
//
// 왜 필요한가: 치지직 HTTP API 는 chzzk.naver.com 이외의 Origin 을 403 "Invalid CORS request" 로
// 거절해서 브라우저가 직접 부를 수 없다. (채팅 WebSocket 은 제한이 없어 위젯이 직접 붙는다.)
//
// 라우트:  GET /chat-source/<위젯 해시 | 채널 ID>  ->  { chatChannelId, kind }

const CHZZK_API = 'https://api.chzzk.naver.com';
const UPSTREAM_TIMEOUT_MS = 8000;
const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const HEX32 = /^[0-9a-f]{32}$/i;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function upstreamJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: UPSTREAM_HEADERS, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (err) {
    throw new HttpError(502, `치지직 API 요청 실패: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// 위젯 URL 해시(/chat/<해시>) 또는 채널 ID -> 현재 chatChannelId.
// chatChannelId 는 방송을 켤 때마다 새로 발급되므로 위젯이 주기적으로 다시 조회한다.
async function resolveChatSource(id) {
  const widget = await upstreamJson(`${CHZZK_API}/manage/v1/chats/sources/${id}`);
  const fromWidget = widget.body?.content?.chatChannelId;
  if (widget.status === 200 && fromWidget) return { chatChannelId: fromWidget, kind: 'widget' };

  // 위젯 해시가 아니면 400 이 온다. 채널 ID 로 다시 시도.
  const live = await upstreamJson(`${CHZZK_API}/polling/v3.1/channels/${id}/live-status`);
  const fromChannel = live.body?.content?.chatChannelId;
  if (live.status === 200 && fromChannel) return { chatChannelId: fromChannel, kind: 'channel' };

  throw new HttpError(404, '채팅 채널을 찾을 수 없습니다. 위젯 URL 해시 또는 채널 ID 를 확인해 주세요.');
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function route(request) {
  if (request.method !== 'GET') throw new HttpError(405, 'Method Not Allowed');

  const m = new URL(request.url).pathname.match(/^\/chat-source\/([^/]+)$/);
  if (!m) throw new HttpError(404, 'Not Found');
  if (!HEX32.test(m[1])) throw new HttpError(400, '위젯 URL 해시 또는 채널 ID 는 32자리 16진수여야 합니다.');
  return json(200, await resolveChatSource(m[1].toLowerCase()));
}

export default {
  async fetch(request) {
    try {
      return await route(request);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error('[proxy]', err);
      return json(500, { error: 'Internal Server Error' });
    }
  },
};
