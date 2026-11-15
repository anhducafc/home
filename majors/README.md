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

## 2. Tính năng "Lên kế hoạch" bằng AI

Worker `majors` đã có sẵn; chỉ cần biến môi trường:

1. dash.cloudflare.com → Workers & Pages → `majors` → Settings.
2. Variables and Secrets:
   - `ANTHROPIC_API_KEY` (Secret) — key từ console.anthropic.com (tổ chức Soulfvn của bạn dùng được).
   - `ALLOWED_ORIGINS` = `https://anhducafc.com,https://www.anhducafc.com` — chỉ site của bạn gọi được.
   - `MODEL` (tuỳ chọn) — mặc định `claude-sonnet-5-5`.
   - Giới hạn lượt/ngày (tuỳ chọn): tạo KV namespace, bind tên `RATE`, đặt `DAILY_LIMIT` = `200`.
3. `index.html` đã trỏ `plannerEndpoint` về `/majors/api/plan` khi chạy trên anhducafc.com — không cần sửa.
4. Chi phí: mỗi kế hoạch ~3–4k token đầu ra, vài cent. Với `DAILY_LIMIT` 200 thì tối đa vài USD/ngày kể cả khi bị spam.

Muốn cho người xem dùng key riêng của họ (không qua Worker): đặt `allowOwnKey: true`.

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

Khối `CONFIG` ở đầu script: đường dẫn dữ liệu, endpoint AI, model, dòng credit. Màu sắc ở `:root` trong CSS (hệ "Sapa trail": pine/moss/dawn/night).
