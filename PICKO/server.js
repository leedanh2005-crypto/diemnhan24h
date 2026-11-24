process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');

// Import các routes và services
const orderRoutes = require('./src/routes/orderRoutes');
const connectionRoutes = require('./src/routes/connectionRoutes');
const returnRoutes = require('./src/routes/returnRoutes');
const returnService = require('./src/services/returnService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/logos", express.static(path.join(__dirname, "logos")));
app.get("/favicon.ico", (req, res) => res.sendFile(path.join(__dirname, "logos", "favicon.ico")));
app.get("/favicon.png", (req, res) => res.sendFile(path.join(__dirname, "logos", "favicon.png")));
app.get('/dark-luxury.css', (req, res) => res.sendFile(path.join(__dirname, 'dark-luxury.css')));
app.get('/white-luxury.css', (req, res) => res.sendFile(path.join(__dirname, 'white-luxury.css')));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ success: true, app: "PICKO Resident API", status: "online", db: "Supabase" });
});

// Gắn routes
app.use('/api/orders', orderRoutes);
app.use('/api', connectionRoutes);
app.use('/api/returns', returnRoutes);

// Handle /api/stats directly for backward compatibility with frontend
const orderController = require('./src/controllers/orderController');
app.get('/api/stats', orderController.getStats.bind(orderController));

// Budget API – lưu bằng localStorage ở client, server chỉ trả stub
let _budgetStore = {};
app.get('/api/budget', (req, res) => res.json({ budget: _budgetStore }));
app.post('/api/budget', (req, res) => { _budgetStore = req.body || {}; res.json({ budget: _budgetStore }); });

// Trang công khai cho shipper: chỉ hiện QR bàn giao, không lộ thông tin cá nhân
function shipperPage(code, state, r) {
  const ok = state === "ok";
  const msg = {
    invalid: ["Mã không hợp lệ", "Mã này không tồn tại hoặc đã bị cư dân thu hồi."],
    used: ["Mã đã được sử dụng", "Kiện hàng này đã được bàn giao."],
    expired: ["Mã đã hết hạn", "Hãy nhờ cư dân tạo mã mới trong ứng dụng PODO."],
  }[state] || ["Lỗi", "Yêu cầu không xác định."];
  const tail = ok && r ? String(r.trackingCode).slice(-4) : "";
  const shop = ok && r ? String(r.marketplace).replace(/[<>&"']/g, "") : "";
  const exp = ok && r && r.handover ? r.handover.exp : "";
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PODO – Mã bàn giao</title>
<style>
*{box-sizing:border-box;margin:0}
body{font-family:system-ui,Arial,sans-serif;background:linear-gradient(160deg,#ecfdf5,#fff 55%);min-height:100vh;display:grid;place-items:center;padding:20px;color:#0f1f1a}
.c{width:100%;max-width:380px;background:#fff;border-radius:24px;box-shadow:0 20px 50px rgba(5,150,105,.18);overflow:hidden;text-align:center}
.h{padding:22px;color:#fff;background:linear-gradient(135deg,#047857,#10b981)}
.h small{letter-spacing:.14em;font-weight:700;font-size:12px;opacity:.9}
.h b{display:block;margin-top:8px;font:800 30px ui-monospace,Menlo,monospace;letter-spacing:.04em}
.b{padding:24px}
#qr{display:inline-block;padding:14px;border:1px solid #e6ebf4;border-radius:18px;line-height:0}
#qr img{width:240px;height:240px}
.t{margin-top:16px;font-weight:700;color:#047857;font-size:15px}
.s{margin-top:8px;color:#6b7a90;font-size:13.5px;line-height:1.5}
.bad .h{background:linear-gradient(135deg,#b91c1c,#ef4444)}
</style></head><body>
<div class="c ${ok ? "" : "bad"}"><div class="h"><small>PODO · MÃ BÀN GIAO</small><b>${code}</b></div><div class="b">
${ok
  ? `<div id="qr"></div><div class="t" id="left"></div><div class="s">Kiện trả hàng ${shop} · mã vận đơn ...${tail}<br>Đưa mã này vào máy quét tại trạm PODO, tìm kiện có chip sáng và quét tem kiện để xác nhận.</div>`
  : `<div class="t" style="color:#b91c1c;font-size:18px">${msg[0]}</div><div class="s">${msg[1]}</div>`}
</div></div>
${ok ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
var EXP = new Date("${exp}").getTime();
new QRCode(document.getElementById("qr"), {text:"PODO HANDOVER ${code}", width:240, height:240, colorDark:"#18181b", colorLight:"#ffffff", correctLevel:QRCode.CorrectLevel.H});
(function tick(){
  var l = Math.max(0, EXP - Date.now()), m = Math.floor(l / 60000), s = Math.floor(l % 60000 / 1000);
  document.getElementById("left").textContent = l ? "Còn hiệu lực " + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s : "Mã đã hết hạn";
  if (l) setTimeout(tick, 1000); else location.reload();
})();
</script>` : ""}
</body></html>`;
}

app.get("/h/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const r = returnService.getReturnByHandoverCode(code);
  let state = "invalid";
  if (r) {
    const h = r.handover;
    if (h.used || r.status === "HANDED_OVER") state = "used";
    else if (new Date(h.exp) <= new Date()) state = "expired";
    else if (r.status === "AT_STATION") state = "ok";
  }
  res.type("html").send(shipperPage(code, state, r));
});

// Frontend React/HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 PICKO Resident Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔗 Database: Supabase connected`);
});
