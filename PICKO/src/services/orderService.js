// d:\ý tưởng kd\PICKO\src\services\orderService.js
const supabase = require('../config/supabase');
const { mapToFrontendOrder } = require('../utils/mapper');

// Trạng thái kết nối Shopee trong phiên (mặc định chưa kết nối)
let isShopeeConnected = false;

// 2 Đơn hàng Shopee chuẩn thực tế tuyệt đối cho Căn hộ 1204 (Khớp 100% phiếu in PODO.png)
const createDefaultShopeeOrders = () => [
  {
    id: 'demo-shp-001',
    "ID nội bộ PICKO": "PK-SHP-001",
    "Mã vận đơn": "SPXVN091234567",
    "Mã đơn hàng trên sàn": "SHP260911A58",
    "Sàn TMĐT": "Shopee",
    "Số căn hộ": "1204",
    "Trạng thái đơn trên sàn": "Đang giao",
    // KIỆN NÀY ĐÃ ĐẾN TRẠM PODO -> CƯ DÂN CÓ THỂ LẤY MÃ QR ĐỂ THẺ ITAG KÊU
    "Trạng thái tại trạm PICKO": "Hàng đã được giao đến trạm",
    "Tổng số sản phẩm": 2,
    "Tổng tiền đơn": 58000,
    "Thời gian đặt đơn": new Date(Date.now() - 3600000 * 20).toISOString(),
    "Cập nhật gần nhất": new Date().toISOString(),
    "Mã lấy hàng": null,
    created_at: new Date(Date.now() - 3600000 * 20).toISOString()
  },
  {
    id: 'demo-shp-002',
    "ID nội bộ PICKO": "PK-SHP-002",
    "Mã vận đơn": "SPXVN086888204",
    "Mã đơn hàng trên sàn": "SHP261011C47",
    "Sàn TMĐT": "Shopee",
    "Số căn hộ": "1204",
    "Trạng thái đơn trên sàn": "Đang giao",
    // KIỆN NÀY ĐANG TRÊN ĐƯỜNG VẬN CHUYỂN -> CHƯA ĐẾN TRẠM
    "Trạng thái tại trạm PICKO": "Chưa nhận",
    "Tổng số sản phẩm": 2,
    "Tổng tiền đơn": 126000,
    "Thời gian đặt đơn": new Date(Date.now() - 3600000 * 40).toISOString(),
    "Cập nhật gần nhất": new Date().toISOString(),
    "Mã lấy hàng": null,
    created_at: new Date(Date.now() - 3600000 * 40).toISOString()
  }
];

let localPackages = createDefaultShopeeOrders();

// Helper timeout 1.5s
async function withTimeout(promise, ms = 1500) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('SUPABASE_TIMEOUT')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

class OrderService {
  /**
   * Lấy toàn bộ đơn hàng của Cư Dân căn hộ 1204
   */
  async getAllOrders() {
    // Nếu chưa bấm Kết nối Shopee, danh sách đơn hàng trống
    if (!this.getShopeeConnected()) {
      return [];
    }

    let rawData = null;

    // Thử lấy từ Supabase
    try {
      const dbQuery = supabase
        .from('packages')
        .select('*')
        .in('Mã vận đơn', ['SPXVN091234567', 'SPXVN086888204'])
        .order('created_at', { ascending: false });

      const { data, error } = await withTimeout(dbQuery, 1500);
      if (!error && data && data.length > 0) {
        rawData = data;
      }
    } catch (err) {
      console.warn('⚠️ Supabase timeout/offline, sử dụng dữ liệu PODO nội bộ');
    }

    if (!rawData) {
      rawData = localPackages;
    }

    return rawData.map(mapToFrontendOrder);
  }

  async getOrderById(id) {
    const orders = await this.getAllOrders();
    return orders.find(o => o.orderId === id || o.trackingCode === id) || null;
  }

  async getStats() {
    const orders = await this.getAllOrders();
    return {
      total: orders.length,
      totalProducts: orders.reduce((sum, o) => sum + o.totalQuantity, 0),
      shipping: orders.filter((o) => o.status === "Đang giao").length,
      atStation: orders.filter((o) => o.stationStatus === "AT_STATION").length,
      received: orders.filter((o) => o.stationStatus === "RECEIVED").length,
    };
  }

  /**
   * Khi cư dân bấm "Lấy hàng", gán mã token QR vào kiện SPXVN091234567
   */
  async assignPickupToken(token) {
    // Cập nhật kiện SPXVN091234567 ở bộ nhớ cục bộ
    localPackages.forEach(p => {
      if (p["Mã vận đơn"] === 'SPXVN091234567' && p["Trạng thái tại trạm PICKO"] === 'Hàng đã được giao đến trạm') {
        p["Mã lấy hàng"] = token;
      }
    });

    // Thử đồng bộ lên Supabase nếu có mạng
    try {
      await withTimeout(
        supabase
          .from('packages')
          .update({ "Mã lấy hàng": token })
          .eq('Mã vận đơn', 'SPXVN091234567'),
        1500
      );
    } catch (e) {}

    return true;
  }

  /**
   * Kiosk tra cứu mã QR trước khi bấm nhận
   */
  async inspectPickupQR(token) {
    // Thử Supabase
    try {
      const { data } = await withTimeout(
        supabase
          .from('packages')
          .select('*')
          .eq('Mã lấy hàng', token)
          .eq('Mã vận đơn', 'SPXVN091234567'),
        1200
      );
      if (data && data.length > 0) {
        return { count: 1, apartment: '1204', trackingCode: 'SPXVN091234567' };
      }
    } catch (e) {}

    return { count: 1, apartment: '1204', trackingCode: 'SPXVN091234567' };
  }

  /**
   * Kiosk xác nhận mã QR -> Thẻ iTag kêu + Đổi trạng thái sang "Đã nhận"
   */
  async verifyPickupQR(token) {
    // Cập nhật local
    localPackages.forEach(p => {
      if (p["Mã vận đơn"] === 'SPXVN091234567') {
        p["Trạng thái tại trạm PICKO"] = "Đã nhận";
        p["Mã lấy hàng"] = null;
      }
    });

    // Cập nhật Supabase
    try {
      await withTimeout(
        supabase
          .from('packages')
          .update({
            "Trạng thái tại trạm PICKO": "Đã nhận",
            "Mã lấy hàng": null
          })
          .eq('Mã vận đơn', 'SPXVN091234567'),
        1500
      );
    } catch (e) {}

    // 🔄 TỰ ĐỘNG RESET SAU 6 GIÂY (khi thẻ iTag kêu xong & Kiosk quay lại màn hình chính)
    // Đưa SPXVN091234567 về lại trạng thái "Hàng đã được giao đến trạm" để bạn có thể thử liên tục nhiều lần!
    setTimeout(async () => {
      await this.resetDemoOrder();
      console.log('🔄 [Tự động reset] Đã đưa kiện ĐÈN BÀN LED về trạng thái sẵn sàng tại trạm cho lượt thử tiếp theo!');
    }, 6000);

    return {
      success: true,
      packagesCount: 1,
      apartment: "1204",
      trackingCode: "SPXVN091234567"
    };
  }

  /**
   * Đưa trạng thái SPXVN091234567 về trạng thái chờ cư dân lấy hàng tại trạm
   */
  async resetDemoOrder() {
    localPackages.forEach(p => {
      if (p["Mã vận đơn"] === 'SPXVN091234567') {
        p["Trạng thái tại trạm PICKO"] = "Hàng đã được giao đến trạm";
        p["Mã lấy hàng"] = null;
      }
    });

    try {
      await withTimeout(
        supabase
          .from('packages')
          .update({
            "Trạng thái tại trạm PICKO": "Hàng đã được giao đến trạm",
            "Mã lấy hàng": null
          })
          .eq('Mã vận đơn', 'SPXVN091234567'),
        1500
      );
    } catch (e) {}

    return true;
  }

  /**
   * Bấm "Kết nối Shopee" -> Xuất hiện 2 kiện hàng của Phòng 1204:
   * 1. SPXVN091234567 (Đèn bàn LED & Kệ nhỏ): ĐÃ ĐẾN TRẠM PODO (Gắn thẻ iTag)
   * 2. SPXVN086888204 (Son tint & Kem chống nắng): ĐANG GIAO TRÊN ĐƯỜNG
   */
  async seedShopeeDemoOrders() {
    this.setShopeeConnected(true);
    localPackages = createDefaultShopeeOrders();

    // Đồng bộ trạng thái chuẩn lên Supabase
    try {
      for (const item of localPackages) {
        withTimeout(
          supabase.from('packages').upsert(item, { onConflict: 'Mã vận đơn' }),
          1200
        ).catch(() => {});
      }
    } catch (e) {}

    return true;
  }

  async clearShopeeDemoOrders() {
    this.setShopeeConnected(false);
    localPackages = createDefaultShopeeOrders();
    return true;
  }

  setShopeeConnected(val) {
    isShopeeConnected = !!val;
  }

  getShopeeConnected() {
    return isShopeeConnected;
  }
}

module.exports = new OrderService();
