/* ================================================================
   config.js — thông tin chung, menu sub-domain, chuyên mục (ít khi cần sửa)
   BÀI VIẾT: viết & sửa tại anhducafc.com/admin (lưu ở data/posts.json)
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

