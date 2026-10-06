# Directive: Xây Dựng Web App Shipper & Database (MVP)

> **Mục tiêu:** Hoàn thành bản dùng thử (MVP) cho ứng dụng Web của Shipper (giao diện, quét camera) và kết nối thành công với Database.
> **Thời gian dự kiến:** 1 ngày.

---

## 🗂️ 1. Chuẩn Bị Môi Trường & Database (Sáng)
- [ ] **Môi trường:** Đảm bảo máy tính đã cài đặt **Node.js** (tải từ nodejs.org). Khởi động lại máy/IDE sau khi cài.
- [ ] **Database Setup:** 
  - Đăng ký tài khoản [Supabase](https://supabase.com/) (hoặc Firebase) miễn phí.
  - Tạo 1 Project mới đặt tên `diemnhan24h`.
  - Khởi tạo 2 bảng SQL cơ bản (Dùng SQL Editor trên Supabase):
    - Bảng `packages` (id, tracking_code, room_number, iot_tag_id, status, created_at).
    - Bảng `iot_tags` (id, tag_id, status).
- [ ] **API Keys:** Lấy Project URL và `anon` API Key của Supabase lưu vào file `.env` cục bộ.

## 💻 2. Khởi Tạo & Dựng Giao Diện Shipper App (Trưa)
- [ ] **Khởi tạo Project:** Mở Terminal tại `d:\ý tưởng kd\`, chạy lệnh để tạo khung React:
  ```bash
  npx create-vite@latest shipper-app --template react
  cd shipper-app
  npm install
  ```
- [ ] **Cài đặt thư viện:** Cài thư viện quét mã vạch và kết nối Supabase.
  ```bash
  npm install html5-qrcode @supabase/supabase-js
  ```
- [ ] **Dựng UI (CSS Thuần - Dark mode):**
  - Khung trên (40%): Dành riêng cho `div` chứa camera.
  - Khung giữa (20%): Hiện text to báo mã vận đơn đã quét, trạng thái.
  - Khung dưới (40%): Code một bàn phím số (Numpad) siêu to (CSS grid 3x4) + Nút "XÁC NHẬN GỬI" xanh lá.

## 📸 3. Tích Hợp Camera & Xử Lý Logic (Chiều)
- [ ] **Code Camera Component:** 
  - Khởi tạo `Html5QrcodeScanner` trong React `useEffect`.
  - Cấp quyền truy cập camera (thiết lập `facingMode: "environment"` để luôn mở camera sau của điện thoại).
  - Viết hàm `onScanSuccess`: Nhận text từ mã vạch (Shopee/GHN) và hiển thị lên màn hình. Thêm âm thanh "Bíp" bằng thẻ `<audio>`.
- [ ] **Luồng thao tác Shipper:**
  - **Bước 1:** Quét barcode thùng hàng → Lấy được `tracking_code`.
  - **Bước 2:** Bấm Numpad dưới màn hình để nhập `room_number`.
  - **Bước 3:** Quét tiếp mã QR trên cục IoT → Lấy được `iot_tag_id`.
  - Khi đủ 3 thông tin, nút "XÁC NHẬN GỬI" sáng lên.

## 🔗 4. Kết Nối Database & Hoàn Thiện (Cuối ngày)
- [ ] **Kết nối Supabase:** Khởi tạo `supabaseClient.js` sử dụng URL và API key.
- [ ] **Hàm Gửi Dữ Liệu (API Call):** Khi bấm "XÁC NHẬN GỬI", gọi lệnh `supabase.from('packages').insert(...)` để đẩy 3 thông tin vừa quét lên cloud.
- [ ] **Reset Form:** Nếu gửi thành công (HTTP 20X) → Kêu báo thành công → Xóa toàn bộ dữ liệu trên màn hình để camera sẵn sàng quét kiện tiếp theo.
- [ ] **Testing:** 
  - Mở server chạy thử: `npm run dev -- --host` (lấy IP LAN).
  - Lấy điện thoại quét IP để mở web app trên điện thoại (cùng chung mạng Wifi với máy tính) → Quét thử 1 hộp hàng Shopee thật. Lên Supabase check xem dữ liệu đã có chưa.

---

## 🛠️ Edge Cases (Trường hợp ngoại lệ cần lưu ý)
1. **Camera không xin được quyền:** Điện thoại sẽ báo lỗi, cần làm màn hình phụ hướng dẫn Shipper cấp quyền Camera trên trình duyệt.
2. **Trình duyệt iOS/Safari:** `html5-qrcode` có thể gặp chút vấn đề auto-play video trên iPhone, cần test kỹ trên iPhone thực tế.
3. **Quét nhầm mã:** Camera cực nhạy có thể quét liên tục 1 mã 10 lần. Cần code cơ chế "Delay (Debounce)" — quét xong 1 mã thì ngừng quét 2 giây rồi mới mở lại.
