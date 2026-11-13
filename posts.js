/* ================================================================
   posts.js — NƠI QUẢN LÝ TOÀN BỘ NỘI DUNG TRANG anhducafc.com
   Sửa file này rồi upload đè lên cPanel là xong, không cần đụng index.html.
   ================================================================ */

/* ---------- 1. Thông tin chung ---------- */
const SITE = {
  author: "Tommy",
  authorTag: "SAP ABAP dev · bố của hai bạn nhỏ",
  authorBio: "Ban ngày viết ABAP, tối về cùng con dựng mấy công cụ học tập, cuối tuần chạy trail.",
  avatar: "",            // vd "images/avatar.jpg" — để trống thì hiện chữ cái đầu
  newsletterEmail: "",   // vd "hello@anhducafc.com" — nút "Nhận bài mới" sẽ mở thư gửi tới đây
};

/* ---------- 2. Header: các sub-domain ---------- */
const SUBDOMAINS = [
  { name: "Giờ Ra Chơi",  host: "games.anhducafc.com",        url: "https://games.anhducafc.com/",        color: "#E0782F", icon: "🎮", desc: "Cổng game HTML5 cho học sinh, 45 phút/ngày" },
  { name: "English Path", host: "selfstudy.anhducafc.com",    url: "https://selfstudy.anhducafc.com/",    color: "#2F6FB4", icon: "📘", desc: "Tự học tiếng Anh theo CEFR, mỗi ngày một bài" },
  { name: "Chinese Path", host: "selfstudy.anhducafc.com/zh", url: "https://selfstudy.anhducafc.com/zh/", color: "#C0392B", icon: "🀄", desc: "Tự học tiếng Trung theo HSK" },
];

/* ---------- 3. Chuyên mục (thứ tự ở đây = thứ tự tab trên trang) ---------- */
const CATS = {
  "cuoc-song": { name: "Cuộc sống", color: "#C2603A" },
  "tin-tuc":   { name: "Tin tức",   color: "#2F6FB4" },
  "kham-pha":  { name: "Khám phá",  color: "#3E8E5E" },
  "chia-se":   { name: "Chia sẻ",   color: "#8E44AD" },
};

/* ---------- 4. Bài viết ----------
   Mỗi bài là một khối { ... }. Thêm bài mới: chép một khối, dán lên ĐẦU danh sách, sửa nội dung.
   - slug     : đường dẫn bài, viết thường không dấu, nối bằng gạch ngang (không trùng nhau)
   - cat      : một trong các khoá ở mục 3: cuoc-song | tin-tuc | kham-pha | chia-se
   - date     : "YYYY-MM-DD"
   - featured : true → lên khối "Nổi bật" đầu trang (chỉ cần 1 bài; nếu không có bài nào thì lấy bài mới nhất)
   - image    : (tuỳ chọn) ảnh bìa, vd "images/ten-anh.jpg" hoặc link https://...
                Bỏ trống → trang tự vẽ ảnh bìa hoạ tiết theo màu chuyên mục.
   - quote    : (tuỳ chọn) câu trích hiện ở khối Nổi bật
   - body     : nội dung, viết HTML đơn giản giữa hai dấu ` `:
                <p>đoạn văn</p>  <h2>tiêu đề nhỏ</h2>  <ul><li>gạch đầu dòng</li></ul>
                <blockquote>trích dẫn</blockquote>  <a href="...">link</a>
                <img src="images/abc.jpg" alt="mô tả">   ← chèn ảnh trong bài
   ------------------------------------------------ */
const POSTS = [
  {
    slug: "sang-chu-nhat-cung-con", cat: "cuoc-song", date: "2026-11-09", featured: true,
    title: "Sáng Chủ nhật không màn hình: một thử nghiệm nhỏ của nhà mình",
    excerpt: "Một buổi sáng mỗi tuần cả nhà tắt hết điện thoại, TV. Tuần đầu khó, tuần thứ ba thì các con tự nhắc.",
    quote: "Hoá ra thứ các con cần nhất vào cuối tuần không phải trò chơi mới, mà là bố mẹ ngồi xuống cùng.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Ý tưởng bắt đầu từ một câu hỏi của con: "Sao bố lúc nào cũng cầm điện thoại?". Thế là cả nhà thống nhất: sáng Chủ nhật, từ lúc thức dậy đến 11 giờ, không ai dùng màn hình.</p>
<h2>Cả nhà làm gì thay vào đó?</h2>
<ul><li>Đi bộ ra công viên, mỗi người chọn một thứ để kể lại.</li><li>Nấu bữa sáng chung, con được giao một việc riêng.</li><li>Đọc sách to cho nhau nghe.</li></ul>
<blockquote>Tuần đầu ai cũng bứt rứt. Tuần thứ ba, các con là người nhắc bố mẹ.</blockquote>`
  },
  {
    slug: "chay-bo-va-gia-dinh", cat: "cuoc-song", date: "2026-10-26",
    title: "Chạy trail khi có hai con nhỏ: chuyện sắp xếp thời gian",
    excerpt: "Chạy lúc 5 giờ sáng, gom buổi dài vào cuối tuần, và học cách chấp nhận những tuần tập không đủ.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Câu hỏi mình hay được hỏi nhất: "Lấy đâu ra thời gian?". Câu trả lời thật là: lấy từ giấc ngủ buổi tối và từ việc bớt lướt mạng.</p>
<h2>Ba nguyên tắc của mình</h2>
<ul><li>Buổi chạy ngắn trong tuần: xong trước khi cả nhà thức dậy.</li><li>Buổi dài cuối tuần: báo trước cho cả nhà, về kịp ăn trưa.</li><li>Tuần bận thì nghỉ, không cố bù.</li></ul>`
  },
  {
    slug: "ra-mat-anhducafc", cat: "tin-tuc", date: "2026-11-13",
    title: "anhducafc.com chính thức có trang chủ mới",
    excerpt: "Một nơi để gom lại các dự án nhỏ và ghi chép cá nhân. Đây là những gì bạn sẽ tìm thấy ở đây.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Sau một thời gian làm các trang nhỏ rời rạc, mình gom tất cả về một trang chủ. Thanh menu phía trên dẫn tới từng dự án:</p>
<ul><li><a href="https://games.anhducafc.com/">Giờ Ra Chơi</a> — cổng game cho học sinh.</li><li><a href="https://selfstudy.anhducafc.com/">English Path</a> — tự học tiếng Anh.</li><li><a href="https://selfstudy.anhducafc.com/zh/">Chinese Path</a> — tự học tiếng Trung.</li></ul>
<p>Phần bên dưới là blog, chia làm bốn mục: Cuộc sống, Tin tức, Khám phá và Chia sẻ.</p>`
  },
  {
    slug: "gio-ra-choi-co-game-moi", cat: "tin-tuc", date: "2026-11-06",
    title: "Giờ Ra Chơi có thêm game gõ phím TíTách và Đố chữ hôm nay",
    excerpt: "Hai trò mới tự làm: tập gõ 10 ngón có đua trực tuyến, và đuổi hình bắt chữ đổi câu mỗi ngày.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p><b>TíTách</b> giúp các bạn nhỏ tập gõ 10 ngón bằng tiếng Anh và tiếng Việt Telex, có thể đua với bạn ở máy khác.</p>
<p><b>Đố chữ hôm nay</b> có 5 câu đố hình mỗi ngày, đổi lúc 0 giờ, có bảng xếp hạng.</p>
<p>Chơi ngay tại <a href="https://games.anhducafc.com/">games.anhducafc.com</a>.</p>`
  },
  {
    slug: "cung-duong-chay-sang", cat: "kham-pha", date: "2026-10-19",
    title: "Đi tìm cung đường chạy buổi sáng có bóng cây ở Sài Gòn",
    excerpt: "Tiêu chí của mình: ít xe, có bóng mát, có chỗ đổ nước. Ghi lại vài nơi đã thử.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Chạy ở thành phố thì không khí và xe cộ là hai thứ khó nhất. Mình bắt đầu ghi chép lại những cung đường đã thử, chấm điểm theo ba tiêu chí.</p>
<h2>Tiêu chí chấm điểm</h2>
<ul><li>Ít xe vào khung 5–6 giờ sáng.</li><li>Có bóng cây che phần lớn quãng đường.</li><li>Có chỗ mua nước giữa đường.</li></ul>
<p>Bạn có cung đường nào hay thì gợi ý cho mình nhé.</p>`
  },
  {
    slug: "cuon-sach-thang-nay", cat: "kham-pha", date: "2026-10-02",
    title: "Thử đọc sách tiếng Anh cùng con: bắt đầu từ truyện tranh",
    excerpt: "Không phải giáo trình, mà là truyện tranh và sách tranh. Cả bố và con đều thấy dễ thở hơn.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Đọc giáo trình thì con mệt, bố cũng mệt. Mình thử chuyển sang truyện tranh và sách tranh tiếng Anh, mỗi tối 15 phút.</p>
<blockquote>Không cần hiểu hết từng chữ. Hiểu câu chuyện là đủ.</blockquote>`
  },
  {
    slug: "tu-hoc-tieng-anh-nguoi-di-lam", cat: "chia-se", date: "2026-10-12",
    title: "Tự học tiếng Anh khi đi làm cả ngày: chia nhỏ để không bỏ cuộc",
    excerpt: "Podcast khi chạy nhẹ, nghe trên đường đi làm, và một buổi tối cố định. Những gì đã hiệu quả với mình.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Điểm yếu lớn nhất của mình là phản xạ nói trong cuộc họp. Không có nhiều thời gian, nên mình chia việc học thành nhiều mảnh nhỏ.</p>
<h2>Lịch của mình</h2>
<ul><li>Nghe podcast trong những buổi chạy nhẹ.</li><li>Nghe lại bài trên taxi, metro khi đi làm.</li><li>Ba buổi tối mỗi tuần học có hệ thống trên <a href="https://selfstudy.anhducafc.com/">English Path</a>.</li></ul>`
  },
  {
    slug: "lam-web-cho-con-khong-can-server", cat: "chia-se", date: "2026-09-28",
    title: "Làm web học tập cho con mà không cần thuê server",
    excerpt: "GitHub để lưu code, Cloudflare để chạy miễn phí. Ghi lại các bước cho bố mẹ nào muốn thử.",
    body: `<p>[Bài mẫu — bạn thay bằng nội dung của mình.]</p>
<p>Mọi trang mình làm cho con đều chạy miễn phí. Bạn không cần biết nhiều về server, chỉ cần một tài khoản GitHub và một tài khoản Cloudflare.</p>
<ul><li>Code để trên GitHub, sửa ngay trên trình duyệt.</li><li>Cloudflare tự đưa trang lên mạng mỗi khi có thay đổi.</li><li>Gắn tên miền riêng nếu muốn.</li></ul>`
  },
];
