/**
 * Cloudflare Worker "majors" — hai việc trong một:
 *   1. Phục vụ bản đồ tại anhducafc.com/majors/* (lấy file từ Pages home-a9u.pages.dev/majors/*)
 *      → push lên GitHub là tự cập nhật, không cần đụng Worker.
 *   2. Cầu nối AI cho tab "Lên kế hoạch": POST /majors/api/plan → OpenRouter (model MIỄN PHÍ).
 *      Không dùng Anthropic API, không tốn credit.
 *
 * Variables and Secrets (Settings của Worker):
 *   OPENROUTER_API_KEY (Secret)  key miễn phí tạo tại openrouter.ai/keys — không cần thẻ
 *   ALLOWED_ORIGINS    (Text)    https://anhducafc.com,https://www.anhducafc.com
 *   OPENROUTER_MODELS  (Text, tuỳ chọn)  danh sách model ngăn cách bằng dấu phẩy, thử lần lượt; mặc định bên dưới
 *   PAGES_ORIGIN       (Text, tuỳ chọn)  mặc định https://home-a9u.pages.dev
 *   DAILY_LIMIT        (Text, tuỳ chọn)  tổng số kế hoạch/ngày, cần KV binding tên RATE
 *
 * Giới hạn model free của OpenRouter: 20 lượt/phút, 50 lượt/ngày (1.000/ngày nếu từng nạp ≥ 10 USD).
 */

const DEFAULT_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'baidu/ernie-5.5-flash-preview:free',
  'inclusionai/ling-3.2-flash:free',
  'openrouter/free'            // bộ định tuyến tự chọn một model free còn sống — chốt chặn cuối
];

const SYSTEM_PROMPT = `Bạn là huấn luyện viên chạy bộ kiêm người lên kế hoạch du lịch cho runner Việt Nam đi thi đấu các giải Major (UTMB World Series Majors và Abbott World Marathon Majors).
Viết tiếng Việt tự nhiên, ngắn gọn, cụ thể. Ưu tiên: (1) tới đích đủ sớm để hồi phục sau bay dài và lệch múi giờ, (2) hậu cần race (expo/bib, gear check, bữa tối trước race, giờ dậy, di chuyển tới vạch xuất phát), (3) hồi phục sau race, rồi mới tới tham quan. Gợi ý món địa phương nhưng tránh đồ lạ/sống trong 48 giờ trước race. Không bịa giá vé máy bay cụ thể; chỉ ước tính và nói rõ là ước tính.
QUAN TRỌNG: chỉ trả về MỘT đối tượng JSON hợp lệ (không markdown, không giải thích, không dấu phẩy thừa) theo đúng schema:
{"title":string,"summary":string,"flights":{"out":string,"back":string,"tip":string},"stay":{"area":string,"why":string,"alternatives":string},"days":[{"day":number,"date":string,"label":string,"blocks":[{"time":string,"what":string,"note":string}]}],"eat":[{"name":string,"when":string,"why":string}],"memory":[string],"packing":[string],"budget":{"currency":"USD","low":number,"high":number,"note":string},"warnings":[string]}`;

const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { ...headers, 'content-type': 'application/json' } });

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || 'https://anhducafc.com,https://www.anhducafc.com').split(',').map(s => s.trim()).filter(Boolean);
}

// Chuẩn hoá SSE của OpenRouter (OpenAI-style) thành sự kiện đơn giản mà trang web đã hiểu:
//   data: {"type":"content_block_delta","delta":{"text":"..."}}
function normalizeStream(upstreamBody, modelUsed) {
  const dec = new TextDecoder(), enc = new TextEncoder();
  let buf = '';
  const emit = (ctrl, obj) => ctrl.enqueue(enc.encode('data: ' + JSON.stringify(obj) + '\n\n'));
  return upstreamBody.pipeThrough(new TransformStream({
    start(ctrl) { emit(ctrl, { type: 'meta', model: modelUsed }); },
    transform(chunk, ctrl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) {
        if (!ln.startsWith('data:')) continue;           // bỏ comment ": OPENROUTER PROCESSING"
        const payload = ln.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') { emit(ctrl, { type: 'message_stop' }); continue; }
        try {
          const ev = JSON.parse(payload);
          if (ev.error) { emit(ctrl, { type: 'error', error: { message: ev.error.message || 'Lỗi từ model' } }); continue; }
          const text = ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content;
          if (text) emit(ctrl, { type: 'content_block_delta', delta: { text } });
        } catch (e) { /* bỏ qua dòng hỏng */ }
      }
    },
    flush(ctrl) { emit(ctrl, { type: 'message_stop' }); }
  }));
}

async function handlePlan(request, env) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const ok = allowedOrigins(env);
  const cors = { 'Access-Control-Allow-Origin': ok.includes(origin) ? origin : ok[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Chỉ nhận POST.' }, 405, cors);

  // Chỉ trang của bạn được gọi (curl/bot không có Origin/Referer hợp lệ sẽ bị chặn)
  const fromOk = ok.includes(origin) || ok.some(o => referer.startsWith(o + '/'));
  if (!fromOk) return json({ error: 'Nguồn gọi không được phép.' }, 403, cors);

  if (!env.OPENROUTER_API_KEY) return json({ error: 'Worker chưa có OPENROUTER_API_KEY — thêm key miễn phí từ openrouter.ai/keys vào Settings → Variables and Secrets.' }, 503, cors);

  if (env.RATE && env.DAILY_LIMIT) {
    const key = 'd:' + new Date().toISOString().slice(0, 10);
    const n = parseInt(await env.RATE.get(key) || '0', 10);
    if (n >= parseInt(env.DAILY_LIMIT, 10)) return json({ error: 'Hôm nay đã hết lượt lên kế hoạch, mai quay lại nhé.' }, 429, cors);
    await env.RATE.put(key, String(n + 1), { expirationTtl: 172800 });
  }

  let body; try { body = await request.json(); } catch { return json({ error: 'JSON không hợp lệ.' }, 400, cors); }
  const prompt = String(body.prompt || '').slice(0, 6000);
  if (!prompt) return json({ error: 'Thiếu nội dung yêu cầu.' }, 400, cors);

  const models = (env.OPENROUTER_MODELS ? env.OPENROUTER_MODELS.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_MODELS);
  const tried = [];
  for (const model of models) {
    let res;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
          'http-referer': 'https://anhducafc.com/majors/',
          'x-title': 'anhducafc Majors planner'
        },
        body: JSON.stringify({
          model,
          stream: true,
          max_tokens: 4000,
          temperature: 0.5,
          reasoning: { enabled: false },        // model tự bỏ qua nếu không hỗ trợ; tránh "nghĩ" tốn thời gian/lượt
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }]
        })
      });
    } catch (e) { tried.push(model + ': network'); continue; }
    if (res.ok && res.body) return new Response(normalizeStream(res.body, model), { headers: { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
    tried.push(model + ': ' + res.status);
    if (res.status === 401 || res.status === 402) {      // key sai/hết quyền: thử model khác cũng vô ích
      const t = await res.text();
      return json({ error: 'OpenRouter từ chối key (' + res.status + ').', detail: t.slice(0, 300) }, 502, cors);
    }
  }
  return json({ error: 'Các model miễn phí đang bận hoặc hết lượt hôm nay (OpenRouter free: 20 lượt/phút, 50 lượt/ngày). Thử lại sau ít phút.', tried }, 503, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/majors/api/plan') return handlePlan(request, env);

    // Phục vụ tĩnh từ Pages
    const pagesOrigin = (env.PAGES_ORIGIN || 'https://home-a9u.pages.dev').replace(/\/$/, '');
    let path = url.pathname;
    if (path === '/majors') return Response.redirect(url.origin + '/majors/' + url.search, 301);
    if (path.endsWith('/')) path += 'index.html';
    const upstream = await fetch(pagesOrigin + path + url.search, { headers: { 'accept': request.headers.get('accept') || '*/*' }, cf: { cacheTtl: 300, cacheEverything: true } });
    const res = new Response(upstream.body, upstream);
    res.headers.set('cache-control', path.endsWith('.json') || path.endsWith('.html') ? 'public, max-age=300' : 'public, max-age=86400');
    return res;
  }
};
