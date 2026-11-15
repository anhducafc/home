/**
 * Cloudflare Worker "majors" — hai việc trong một:
 *   1. Phục vụ bản đồ tại anhducafc.com/majors/* bằng cách lấy file từ Pages (home-a9u.pages.dev/majors/*)
 *      → push lên GitHub là tự cập nhật, không cần đụng Worker.
 *   2. Cầu nối AI cho tab "Lên kế hoạch": POST /majors/api/plan → Anthropic API (key giữ trên server).
 *
 * Cài đặt:
 *   Settings → Domains & Routes → Add route: anhducafc.com/majors*  và  www.anhducafc.com/majors*  (zone anhducafc.com)
 *   Settings → Variables and Secrets:
 *     ANTHROPIC_API_KEY (Secret)
 *     ALLOWED_ORIGINS   = https://anhducafc.com,https://www.anhducafc.com
 *     MODEL             = claude-sonnet-5-5            (tuỳ chọn)
 *     DAILY_LIMIT       = 200                          (tuỳ chọn, cần KV binding tên RATE)
 *     PAGES_ORIGIN      = https://home-a9u.pages.dev   (tuỳ chọn, mặc định như vậy)
 */

const SYSTEM_PROMPT = `Bạn là một huấn luyện viên chạy bộ kiêm người lên kế hoạch du lịch cho runner Việt Nam đi thi đấu các giải Major (UTMB World Series Majors và Abbott World Marathon Majors).
Viết bằng tiếng Việt tự nhiên, ngắn gọn, cụ thể. Ưu tiên: (1) tới đích đủ sớm để hồi phục sau bay dài và lệch múi giờ, (2) hậu cần race (expo/bib, gear check, bữa tối trước race, giờ dậy, di chuyển tới vạch xuất phát), (3) hồi phục sau race, rồi mới tới tham quan. Gợi ý món ăn địa phương nhưng tránh đồ lạ/sống trong 48h trước race. Không bịa giá vé máy bay cụ thể; chỉ đưa khoảng ước tính và nói rõ là ước tính.
Chỉ trả về JSON hợp lệ theo schema sau, không có markdown, không có lời dẫn:
{
 "title": string,
 "summary": string,
 "flights": {"out": string, "back": string, "tip": string},
 "stay": {"area": string, "why": string, "alternatives": string},
 "days": [ {"day": number, "date": string, "label": string, "blocks": [ {"time": string, "what": string, "note": string} ] } ],
 "eat": [ {"name": string, "when": string, "why": string} ],
 "memory": [string],
 "packing": [string],
 "budget": {"currency": "USD", "low": number, "high": number, "note": string},
 "warnings": [string]
}`;

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return { ok, headers: { 'Access-Control-Allow-Origin': ok ? origin : 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' } };
}

async function handlePlan(request, env) {
  const origin = request.headers.get('Origin') || '';
  const c = corsHeaders(origin, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: c.headers });
  if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: c.headers });
  // Cùng origin (anhducafc.com gọi /majors/api/plan) thì không có header Origin khác → cho qua; khác origin thì phải nằm trong ALLOWED_ORIGINS
  if (origin && !c.ok) return new Response('Origin not allowed', { status: 403, headers: c.headers });

  if (env.RATE && env.DAILY_LIMIT) {
    const key = 'd:' + new Date().toISOString().slice(0, 10);
    const n = parseInt(await env.RATE.get(key) || '0', 10);
    if (n >= parseInt(env.DAILY_LIMIT, 10)) return new Response(JSON.stringify({ error: 'Hôm nay đã hết lượt lên kế hoạch, mai quay lại nhé.' }), { status: 429, headers: { ...c.headers, 'content-type': 'application/json' } });
    await env.RATE.put(key, String(n + 1), { expirationTtl: 172800 });
  }

  let body; try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: c.headers }); }
  const prompt = String(body.prompt || '').slice(0, 6000);
  if (!prompt) return new Response('Missing prompt', { status: 400, headers: c.headers });
  if (!env.ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: 'Worker chưa có ANTHROPIC_API_KEY.' }), { status: 500, headers: { ...c.headers, 'content-type': 'application/json' } });

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-5-5', max_tokens: 4000, stream: true, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }] })
  });
  if (!upstream.ok) {
    const t = await upstream.text();
    return new Response(JSON.stringify({ error: 'Upstream ' + upstream.status, detail: t.slice(0, 500) }), { status: 502, headers: { ...c.headers, 'content-type': 'application/json' } });
  }
  return new Response(upstream.body, { headers: { ...c.headers, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
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
