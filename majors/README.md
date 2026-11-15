# Bản đồ Majors — Trail UTMB & Road Marathon

Quả địa cầu tương tác các giải UTMB World Series Majors + Abbott World Marathon Majors, dùng được mọi năm, có tab "Chuyến đi" (gợi ý sẵn) và "Lên kế hoạch" (AI soạn lịch trình theo điểm khởi hành, số đêm, số người, phong cách, sở thích).

```
majors/
├── index.html            trang chính (globe + panel + planner)
├── majors.json           DỮ LIỆU — file duy nhất cần sửa hằng năm
├── countries-110m.json   bản đồ nền (không cần đụng)
├── vendor/               d3 + topojson (offline, không phụ thuộc CDN)
├── worker.js             Cloudflare Worker giữ API key cho tính năng AI
└── embed-snippet.html    đoạn nhúng vào bài viết
```

## 1. Cách trang được phục vụ (đã cài xong 15/11/2026)

- Repo GitHub `anhducafc/home` → Cloudflare Pages `home-a9u.pages.dev` (tự deploy khi push).
- Domain `anhducafc.com` do Worker `anhducafc-home` phục vụ, nên có thêm Worker **`majors`** (code = `worker.js`) với route `anhducafc.com/majors*` và `www.anhducafc.com/majors*`: nó lấy file từ `home-a9u.pages.dev/majors/*` và trả lời AI tại `/majors/api/plan`.
- Vì vậy: **sửa gì trong thư mục `majors/` chỉ cần push lên GitHub**, không đụng Worker. Cache 5 phút cho .html/.json.
- Trong bài viết (tag **Khám Phá**, **Cuộc Sống**) dán nội dung `embed-snippet.html`.

Deep link hữu ích để dẫn thẳng vào một giải trong bài: `/majors/?race=berlin`, `/majors/?race=cm&origin=HAN`, `/majors/?year=2027`.
ID các giải: `uta vda utmb kodiak cm tokyo boston london capetown sydney berlin chicago nyc shanghai`.

## 2. Tính năng "Lên kế hoạch" bằng AI (model MIỄN PHÍ qua OpenRouter)

Không dùng Anthropic API, không tốn credit. Worker `majors` gọi các model `:free` của OpenRouter, tự chuyển model khác nếu một model bận.

1. Tạo key miễn phí (không cần thẻ) tại openrouter.ai/keys.
2. dash.cloudflare.com → Workers & Pages → `majors` → Settings → Variables and Secrets:
   - `OPENROUTER_API_KEY` (Secret) — key vừa tạo.
   - `ALLOWED_ORIGINS` (Text) = `https://anhducafc.com,https://www.anhducafc.com` — chỉ site của bạn gọi được.
   - `OPENROUTER_MODELS` (tuỳ chọn) — danh sách model ngăn cách bằng dấu phẩy, thử lần lượt (xem openrouter.ai/models?q=free).
   - Giới hạn lượt/ngày (tuỳ chọn): KV namespace bind tên `RATE`, `DAILY_LIMIT` = `40`.
3. Xoá secret `ANTHROPIC_API_KEY` cũ (nếu còn) và thu hồi key đó trong Anthropic Console.
4. Giới hạn của OpenRouter free: 20 lượt/phút, 50 lượt/ngày (1.000/ngày nếu từng nạp ≥ 10 USD). Trang tự thử lại tối đa 3 lần khi model trả JSON hỏng.

## 3. Cập nhật hằng năm (5 phút, chỉ sửa `majors.json`)

Ngày giải **tự tính** theo quy tắc lịch (`rule`): Berlin = Chủ nhật cuối tháng 9, Boston = thứ Hai thứ 3 tháng 4, Tokyo = CN đầu tháng 3… Khi lịch chính thức công bố, nếu khác quy tắc thì thêm vào `dates`:

```json
"dates": {"2026": ["2026-09-27"], "2027": ["2027-09-26"]}
```
Giải nhiều ngày ghi `[ngày đầu, ngày cuối]`. Giải có trong `dates` hiện bình thường; giải tính theo quy tắc hiện kèm chữ "lịch dự kiến".

Mỗi năm nên rà:
- `meta` → kỷ lục course mới (Berlin, Chicago, Sydney hay đổi), quy mô.
- `role`/`kind` → Shanghai đổi `"kind": "cand"` thành `"road"` nếu được công nhận Major; Major UTMB có thể đổi địa điểm (kiểm tra utmb.world/news tháng 1).
- `travel.budget` → nhích theo giá vé.
- `updated` → ngày bạn sửa (hiện ở chân sidebar).

Thêm giải mới: copy một block trong `races`, đổi `id`, toạ độ (`lon`, `lat`), `rule`, nội dung. Không cần sửa `index.html`.

## 4. Tuỳ biến nhanh trong `index.html`

Khối `CONFIG` ở đầu script: đường dẫn dữ liệu, endpoint AI, dòng credit. Màu sắc ở `:root` trong CSS (hệ "Sapa trail": pine/moss/dawn/night).
