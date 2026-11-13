<?php
/* API trang quản trị anhducafc.com — không cần sửa file này. */

const ROOT      = __DIR__ . '/..';
const STORE     = __DIR__ . '/store';
const ALL_FILE  = STORE . '/posts.json';          // mọi bài, kể cả nháp (không công khai)
const PUB_FILE  = ROOT . '/data/posts.json';      // bài đã đăng (trang chủ đọc file này)
const AUTH_FILE = STORE . '/auth.json';
const RATE_FILE = STORE . '/login-attempts.json';
const UPLOAD_DIR = ROOT . '/images/uploads';
const MAX_UPLOAD = 10485760;

@ini_set('display_errors', '0');      // cảnh báo PHP không được lẫn vào dữ liệu trả về
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ob_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('adc_admin');
if (PHP_VERSION_ID >= 70300) session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict', 'secure' => $https]);
else session_set_cookie_params(0, '/; samesite=Strict', '', $https, true);
session_start();

function out($data, $code = 200) { if (ob_get_length()) ob_clean(); http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail($msg, $code = 400) { out(['error' => $msg], $code); }
if (!function_exists('str_contains')) { function str_contains($h, $n) { return $n === '' || strpos($h, $n) !== false; } }
if (!function_exists('str_starts_with')) { function str_starts_with($h, $n) { return strncmp($h, $n, strlen($n)) === 0; } }
if (!function_exists('mb_strlen')) {   // hosting thiếu mbstring
  function mb_strlen($s) { return preg_match_all('/./us', (string)$s); }
  function mb_substr($s, $start, $len = null) { preg_match_all('/./us', (string)$s, $m); return implode('', array_slice($m[0], $start, $len)); }
  function mb_strtolower($s) { return strtolower((string)$s); }
}
if (!class_exists('DOMDocument')) { header('Content-Type: application/json; charset=utf-8'); echo '{"error":"Hosting chưa bật PHP extension dom/xml. Vào cPanel → Select PHP Version → Extensions, tick dom và xml."}'; exit; }
function readJson($f, $def) { if (!is_file($f)) return $def; $d = json_decode((string)file_get_contents($f), true); return $d ?? $def; }
function writeJson($f, $data) {
  $dir = dirname($f); if (!is_dir($dir)) mkdir($dir, 0755, true);
  $tmp = $f . '.tmp' . bin2hex(random_bytes(4));
  if (file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) === false) fail('Không ghi được file. Kiểm tra quyền thư mục.', 500);
  rename($tmp, $f);
}
function ensureStore() {
  if (!is_dir(STORE)) mkdir(STORE, 0755, true);
  if (!is_file(STORE . '/.htaccess')) file_put_contents(STORE . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
  if (!is_file(ALL_FILE)) {   // lần đầu: lấy bài từ trang chủ
    $seed = readJson(PUB_FILE, []);
    foreach ($seed as &$p) { $p['id'] = $p['id'] ?? newId(); $p['status'] = $p['status'] ?? 'published'; }
    writeJson(ALL_FILE, $seed);
  }
}
function newId() { return 'p' . bin2hex(random_bytes(5)); }
function loggedIn() { return !empty($_SESSION['ok']) && ($_SESSION['exp'] ?? 0) > time(); }
function csrf() { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16)); return $_SESSION['csrf']; }
function requireAuth() {
  if (!loggedIn()) fail('Phiên đăng nhập đã hết, hãy đăng nhập lại.', 401);
  if (!hash_equals(csrf(), $_SERVER['HTTP_X_CSRF'] ?? '')) fail('Phiên không hợp lệ, hãy tải lại trang.', 403);
  $_SESSION['exp'] = time() + 60 * 60 * 12;
}

/* ---------- Làm sạch nội dung bài ---------- */
function cleanUrl($u, $img = false) {
  $u = trim($u);
  if ($u === '') return '';
  if (preg_match('~^(https?:)?//~i', $u) || str_starts_with($u, '/') || str_starts_with($u, '#') || (!$img && preg_match('~^mailto:~i', $u))) return $u;
  if (!preg_match('~^[a-z][a-z0-9+.-]*:~i', $u)) return $u;   // đường dẫn tương đối
  return '';
}
function cleanHtml($html) {
  $allowed = ['p'=>[], 'h2'=>[], 'h3'=>[], 'b'=>[], 'strong'=>[], 'i'=>[], 'em'=>[], 'u'=>[], 's'=>[], 'br'=>[], 'hr'=>[],
    'ul'=>[], 'ol'=>[], 'li'=>[], 'blockquote'=>[], 'a'=>['href'], 'img'=>['src','alt'], 'figure'=>[], 'figcaption'=>[]];
  $doc = new DOMDocument();
  libxml_use_internal_errors(true);
  $doc->loadHTML('<?xml encoding="utf-8"?><div id="root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
  libxml_clear_errors();
  $root = $doc->getElementById('root');
  if (!$root) return '';
  $walk = function ($node) use (&$walk, $allowed, $doc) {
    foreach (iterator_to_array($node->childNodes) as $c) {
      if ($c instanceof DOMElement) {
        $tag = strtolower($c->tagName);
        if (in_array($tag, ['script','style','iframe','object','embed','form','input','button','select','textarea','svg','math','template','noscript'], true)) { $node->removeChild($c); continue; }
        $walk($c);
        if ($tag === 'div') $tag = 'p';
        if (!isset($allowed[$tag])) {   // bỏ thẻ, giữ chữ
          while ($c->firstChild) $node->insertBefore($c->firstChild, $c);
          $node->removeChild($c); continue;
        }
        $new = $doc->createElement($tag);
        foreach ($allowed[$tag] as $a) {
          if (!$c->hasAttribute($a)) continue;
          $v = $c->getAttribute($a);
          if ($a === 'href' || $a === 'src') $v = cleanUrl($v, $a === 'src');
          if ($v !== '') $new->setAttribute($a, $v);
        }
        if ($tag === 'a') { if (!$new->hasAttribute('href')) { while ($c->firstChild) $node->insertBefore($c->firstChild, $c); $node->removeChild($c); continue; }
          if (preg_match('~^(https?:)?//~i', $new->getAttribute('href'))) { $new->setAttribute('target', '_blank'); $new->setAttribute('rel', 'noopener'); } }
        if ($tag === 'img' && !$new->hasAttribute('src')) { $node->removeChild($c); continue; }
        if ($tag === 'img') $new->setAttribute('loading', 'lazy');
        while ($c->firstChild) $new->appendChild($c->firstChild);
        $node->replaceChild($new, $c);
      } elseif ($c->nodeType === XML_COMMENT_NODE) {
        $node->removeChild($c);
      }
    }
  };
  $walk($root);
  // gom chữ/thẻ inline nằm lẻ ở ngoài cùng vào <p>
  $blocks = ['p','h2','h3','ul','ol','blockquote','figure','hr'];
  $buf = null;
  foreach (iterator_to_array($root->childNodes) as $c) {
    $isBlock = $c instanceof DOMElement && in_array(strtolower($c->tagName), $blocks, true);
    if ($isBlock) { $buf = null; continue; }
    if ($c instanceof DOMText && trim($c->textContent) === '' && !$buf) continue;
    if (!$buf) { $buf = $doc->createElement('p'); $root->insertBefore($buf, $c); }
    $buf->appendChild($c);
  }
  $s = '';
  foreach ($root->childNodes as $c) $s .= $doc->saveHTML($c);
  $s = preg_replace('~<p>(\s|&nbsp;|<br>)*</p>~u', '', $s);
  return trim($s);
}
function slugify($s) {
  $s = mb_strtolower($s, 'UTF-8');
  $map = ['à'=>'a','á'=>'a','ạ'=>'a','ả'=>'a','ã'=>'a','â'=>'a','ầ'=>'a','ấ'=>'a','ậ'=>'a','ẩ'=>'a','ẫ'=>'a','ă'=>'a','ằ'=>'a','ắ'=>'a','ặ'=>'a','ẳ'=>'a','ẵ'=>'a',
    'è'=>'e','é'=>'e','ẹ'=>'e','ẻ'=>'e','ẽ'=>'e','ê'=>'e','ề'=>'e','ế'=>'e','ệ'=>'e','ể'=>'e','ễ'=>'e','ì'=>'i','í'=>'i','ị'=>'i','ỉ'=>'i','ĩ'=>'i',
    'ò'=>'o','ó'=>'o','ọ'=>'o','ỏ'=>'o','õ'=>'o','ô'=>'o','ồ'=>'o','ố'=>'o','ộ'=>'o','ổ'=>'o','ỗ'=>'o','ơ'=>'o','ờ'=>'o','ớ'=>'o','ợ'=>'o','ở'=>'o','ỡ'=>'o',
    'ù'=>'u','ú'=>'u','ụ'=>'u','ủ'=>'u','ũ'=>'u','ư'=>'u','ừ'=>'u','ứ'=>'u','ự'=>'u','ử'=>'u','ữ'=>'u','ỳ'=>'y','ý'=>'y','ỵ'=>'y','ỷ'=>'y','ỹ'=>'y','đ'=>'d'];
  $s = strtr($s, $map);
  $s = preg_replace('~[^a-z0-9]+~', '-', $s);
  return trim(substr($s, 0, 80), '-') ?: 'bai-viet';
}
function publish($all) {
  $pub = array_values(array_filter($all, function ($p) { return ($p['status'] ?? '') === 'published'; }));
  usort($pub, function ($a, $b) { return strcmp($b['date'], $a['date']); });
  writeJson(PUB_FILE, $pub);
}
function backup() {
  $dir = STORE . '/backups'; if (!is_dir($dir)) mkdir($dir, 0755, true);
  if (is_file(ALL_FILE)) copy(ALL_FILE, $dir . '/posts-' . date('Ymd-His') . '.json');
  $files = glob($dir . '/posts-*.json'); sort($files);
  foreach (array_slice($files, 0, max(0, count($files) - 30)) as $old) @unlink($old);   // giữ 30 bản gần nhất
}

/* ---------- Xử lý ---------- */
ensureStore();
$action = $_GET['action'] ?? '';
$in = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $action !== 'upload') {
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if (!str_contains($ct, 'application/json')) fail('Yêu cầu không hợp lệ.');
}

switch ($action) {
  case 'status':
    out(['setup' => !is_file(AUTH_FILE), 'loggedIn' => loggedIn(), 'csrf' => csrf(), 'php' => PHP_VERSION]);

  case 'setup':
    if ($method !== 'POST') fail('Sai phương thức.', 405);
    if (is_file(AUTH_FILE)) fail('Mật khẩu đã được tạo.', 403);
    $pw = (string)($in['password'] ?? '');
    if (mb_strlen($pw) < 8) fail('Mật khẩu cần ít nhất 8 ký tự.');
    writeJson(AUTH_FILE, ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'created' => date('c')]);
    session_regenerate_id(true);
    $_SESSION['ok'] = true; $_SESSION['exp'] = time() + 60 * 60 * 12;
    out(['ok' => true, 'csrf' => csrf()]);

  case 'login':
    if ($method !== 'POST') fail('Sai phương thức.', 405);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '?';
    $rate = readJson(RATE_FILE, []);
    $now = time();
    $rate = array_filter($rate, function ($r) use ($now) { return $r['t'] > $now - 900; });
    $mine = array_filter($rate, function ($r) use ($ip) { return $r['ip'] === $ip; });
    if (count($mine) >= 8) fail('Sai quá nhiều lần. Thử lại sau 15 phút.', 429);
    $auth = readJson(AUTH_FILE, null);
    if (!$auth || !password_verify((string)($in['password'] ?? ''), $auth['hash'])) {
      $rate[] = ['ip' => $ip, 't' => $now]; writeJson(RATE_FILE, array_values($rate));
      usleep(600000);
      fail('Mật khẩu chưa đúng.', 401);
    }
    session_regenerate_id(true);
    $_SESSION['ok'] = true; $_SESSION['exp'] = time() + 60 * 60 * 12;
    out(['ok' => true, 'csrf' => csrf()]);

  case 'logout':
    $_SESSION = []; session_destroy();
    out(['ok' => true]);

  case 'password':
    requireAuth();
    $auth = readJson(AUTH_FILE, null);
    if (!password_verify((string)($in['old'] ?? ''), $auth['hash'] ?? '')) fail('Mật khẩu cũ chưa đúng.');
    if (mb_strlen((string)($in['new'] ?? '')) < 8) fail('Mật khẩu mới cần ít nhất 8 ký tự.');
    writeJson(AUTH_FILE, ['hash' => password_hash((string)$in['new'], PASSWORD_DEFAULT), 'created' => date('c')]);
    out(['ok' => true]);

  case 'list':
    requireAuth();
    out(['posts' => readJson(ALL_FILE, [])]);

  case 'save':
    requireAuth();
    $p = $in['post'] ?? null;
    if (!is_array($p)) fail('Thiếu dữ liệu bài.');
    $title = trim((string)($p['title'] ?? ''));
    if ($title === '') fail('Bài viết cần có tiêu đề.');
    $date = (string)($p['date'] ?? '');
    if (!preg_match('~^\d{4}-\d{2}-\d{2}$~', $date)) $date = date('Y-m-d');
    $all = readJson(ALL_FILE, []);
    $id = (string)($p['id'] ?? '');
    $idx = null;
    foreach ($all as $i => $x) if (($x['id'] ?? '') === $id && $id !== '') $idx = $i;
    if ($idx === null) $id = newId();
    $slug = slugify(trim((string)($p['slug'] ?? '')) ?: $title);
    $base = $slug; $n = 2;
    while (count(array_filter($all, function ($x) use ($slug, $id) { return ($x['slug'] ?? '') === $slug && ($x['id'] ?? '') !== $id; }))) $slug = $base . '-' . $n++;
    $body = cleanHtml((string)($p['body'] ?? ''));
    $excerpt = trim((string)($p['excerpt'] ?? ''));
    if ($excerpt === '') {   // tự lấy từ các đoạn văn đầu bài
      preg_match_all('~<p>(.*?)</p>~s', $body, $mm);
      $t = trim(preg_replace('~\s+~u', ' ', html_entity_decode(strip_tags(implode(' ', $mm[1] ?: [$body])), ENT_QUOTES, 'UTF-8')));
      $excerpt = mb_strlen($t) > 180 ? rtrim(mb_substr($t, 0, 177)) . '…' : $t;
    }
    $post = [
      'id' => $id, 'slug' => $slug, 'title' => mb_substr($title, 0, 200),
      'cat' => preg_replace('~[^a-z0-9-]~', '', (string)($p['cat'] ?? '')) ?: 'cuoc-song',
      'date' => $date, 'status' => ($p['status'] ?? '') === 'published' ? 'published' : 'draft',
      'featured' => !empty($p['featured']), 'image' => cleanUrl((string)($p['image'] ?? ''), true),
      'excerpt' => mb_substr($excerpt, 0, 400), 'quote' => mb_substr(trim((string)($p['quote'] ?? '')), 0, 300),
      'body' => $body, 'updated' => date('c'),
    ];
    backup();
    if ($post['featured']) foreach ($all as &$x) $x['featured'] = false; unset($x);
    if ($idx === null) array_unshift($all, $post); else $all[$idx] = $post;
    writeJson(ALL_FILE, $all);
    publish($all);
    out(['ok' => true, 'post' => $post]);

  case 'delete':
    requireAuth();
    $id = (string)($in['id'] ?? '');
    $all = readJson(ALL_FILE, []);
    $all2 = array_values(array_filter($all, function ($x) use ($id) { return ($x['id'] ?? '') !== $id; }));
    if (count($all2) === count($all)) fail('Không tìm thấy bài.', 404);
    backup();
    writeJson(ALL_FILE, $all2);
    publish($all2);
    out(['ok' => true]);

  case 'upload':
    requireAuth();
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) fail('Tải ảnh lên thất bại' . ($f && in_array($f['error'], [1, 2]) ? ': ảnh quá lớn.' : '.'));
    if ($f['size'] > MAX_UPLOAD) fail('Ảnh lớn hơn 10MB.');
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) fail('Chỉ nhận ảnh JPG, PNG, GIF hoặc WEBP.');
    $sub = date('Y/m');
    $dir = UPLOAD_DIR . '/' . $sub;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail('Không tạo được thư mục ảnh.', 500);
    if (!is_file(UPLOAD_DIR . '/.htaccess')) file_put_contents(UPLOAD_DIR . '/.htaccess', "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar\n<FilesMatch \"\\.(php|phtml|phar|php\\d)$\">\nRequire all denied\n</FilesMatch>\n");
    $name = date('d') . '-' . bin2hex(random_bytes(6)) . '.' . $types[$info[2]];
    if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) fail('Không lưu được ảnh.', 500);
    @chmod("$dir/$name", 0644);
    out(['ok' => true, 'url' => "/images/uploads/$sub/$name", 'w' => $info[0], 'h' => $info[1]]);

  default:
    fail('Không rõ yêu cầu.', 404);
}
