/**
 * Cloudflare Worker — proxy "Lên kế hoạch" cho Bản đồ Majors (anhducafc.com)
 * Giữ API key trên server, chỉ cho phép gọi từ domain của bạn, giới hạn kích thước request.
 *
 * Triển khai (5 phút):
 *   1. https://dash.cloudflare.com → Workers & Pages → Create → Worker → dán file này.
 *   2. Settings → Variables and Secrets:
 *        ANTHROPIC_API_KEY  (Secret)  = sk-ant-...
 *        ALLOWED_ORIGINS    (Text)    = https://anhducafc.com,https://www.anhducafc.com
 *        MODEL              (Text)    = claude-sonnet-5-5        (tuỳ chọn)
 *        DAILY_LIMIT        (Text)    = 200                      (tuỳ chọn, cần KV binding tên RATE)
 *   3. Deploy → copy URL dạng https://majors-planner.<account>.workers.dev
 *   4. Dán URL đó vào CONFIG.plannerEndpoint trong index.html.
 */

const SYSTEM_PROMPT = `Bạn là một huấn luyện viên chạy bộ kiêm người lên kế hoạch du lịch cho runner Việt Nam đi thi đấu các giải Major (UTMB World Series Majors và Abbott World Marathon Majors).
Viết bằng tiếng Việt tự nhiên, ngắn gọn, cụ thể. Ưu tiên: (1) tới đích đủ sớm để hồi phục sau bay dài và lệch múi giờ, (2) hậu cần race (expo/bib, gear check, bữa tối trước race, giờ dậy, di chuyển tới vạch xuất phát), (3) hồi phục sau race, rồi mới tới tham quan. Gợi ý món ăn địa phương nhưng tránh đồ lạ/sống trong 48h trước race. Không bịa giá vé máy bay cụ thể; chỉ đưa khoảng ước tính và nói rõ là ước tính.
Chỉ trả về JSON hợp lệ theo schema sau, không có markdown, không có lời dẫn:
{
 "title": string,
 "summary": string,                 // 2–3 câu tóm tắt tinh thần chuyến đi
 "flights": {"out": string, "back": string, "tip": string},
 "stay": {"area": string, "why": string, "alternatives": string},
 "days": [ {"day": number, "date": string, "label": string, "blocks": [ {"time": string, "what": string, "note": string} ] } ],
 "eat": [ {"name": string, "when": string, "why": string} ],
 "memory": [string],                 // 3 việc làm chuyến đi đáng nhớ nhất
 "packing": [string],               // 5–8 món đặc thù cho giải này (khí hậu, bắt buộc)
 "budget": {"currency": "USD", "low": number, "high": number, "note": string},
 "warnings": [string]               // visa, thời tiết, cutoff, lừa đảo, an toàn
}`;

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin'
    }
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const c = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: c.headers });
    if (!c.ok) return new Response('Origin not allowed', { status: 403, headers: c.headers });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: c.headers });

    // Giới hạn theo ngày (tuỳ chọn): bind KV namespace tên RATE
    if (env.RATE && env.DAILY_LIMIT) {
      const key = 'd:' + new Date().toISOString().slice(0, 10);
      const n = parseInt(await env.RATE.get(key) || '0', 10);
      if (n >= parseInt(env.DAILY_LIMIT, 10)) {
        return new Response(JSON.stringify({ error: 'Hôm nay đã hết lượt lên kế hoạch, mai quay lại nhé.' }), { status: 429, headers: { ...c.headers, 'content-type': 'application/json' } });
      }
      await env.RATE.put(key, String(n + 1), { expirationTtl: 172800 });
    }

    let body;
    try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: c.headers }); }
    const prompt = String(body.prompt || '').slice(0, 6000);
    if (!prompt) return new Response('Missing prompt', { status: 400, headers: c.headers });

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.MODEL || 'claude-sonnet-5-5',
        max_tokens: 4000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      return new Response(JSON.stringify({ error: 'Upstream ' + upstream.status, detail: t.slice(0, 500) }), { status: 502, headers: { ...c.headers, 'content-type': 'application/json' } });
    }
    // Chuyển tiếp SSE nguyên vẹn
    return new Response(upstream.body, { headers: { ...c.headers, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
  }
};
