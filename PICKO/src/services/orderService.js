// d:\ý tưởng kd\PICKO\src\services\orderService.js
const supabase = require('../config/supabase');
const { mapToFrontendOrder } = require('../utils/mapper');

// Mặc định kết nối Shopee sẵn để hiển thị dữ liệu ngay
let isShopeeConnected = true;

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
  },
  {
    id: 'demo-shp-003',
    "ID nội bộ PICKO": "PK-SHP-003",
    "Mã vận đơn": "SPXVN077123999",
    "Mã đơn hàng trên sàn": "SHP260815B12",
    "Sàn TMĐT": "Shopee",
    "Số căn hộ": "1204",
    "Trạng thái đơn trên sàn": "Đã giao",
    // KIỆN NÀY CƯ DÂN ĐÃ NHẬN -> CÓ THỂ TẠO YÊU CẦU TRẢ HÀNG
    "Trạng thái tại trạm PICKO": "Đã nhận",
    "Tổng số sản phẩm": 1,
    "Tổng tiền đơn": 185000,
    "Thời gian đặt đơn": new Date(Date.now() - 3600000 * 96).toISOString(),
    "Cập nhật gần nhất": new Date(Date.now() - 3600000 * 48).toISOString(),
    "Mã lấy hàng": null,
    created_at: new Date(Date.now() - 3600000 * 96).toISOString()
  }
];

let localPackages = createDefaultShopeeOrders();

// Helper timeout 2.5s
async function withTimeout(promise, ms = 2500) {
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
  constructor() {
    // 🔄 TỰ ĐỘNG RESET TRẠNG THÁI ĐƠN HÀNG SAU MỖI 1 PHÚT (60 GIÂY)
    this._autoResetTimer = setInterval(async () => {
      try {
        await this.resetDemoOrder();
      } catch (err) {
        console.error('Lỗi auto-reset 1 phút:', err);
      }
    }, 60000);
    console.log('⏱️ [Auto-Reset] Đã kích hoạt bộ đếm tự động reset trạng thái đơn hàng định kỳ 1 phút/lần');
  }

  /**
   * Lấy toàn bộ đơn hàng của Cư Dân (kết hợp Supabase và bộ nhớ cục bộ)
   */
  async getAllOrders(query = {}) {
    let supabaseRows = null;

    // 1. Lấy dữ liệu thực tế từ Supabase (lấy toàn bộ các kiện để không bị sót đơn mới quét từ Kiosk)
    try {
      const dbQuery = supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await withTimeout(dbQuery, 2500);
      if (!error && Array.isArray(data)) {
        supabaseRows = data;
      }
    } catch (err) {
      console.warn('⚠️ Supabase timeout/offline, sử dụng dữ liệu PODO nội bộ');
    }

    // 2. Hợp nhất giữa localPackages (dữ liệu mẫu) và Supabase (dữ liệu thật từ Kiosk / Shipper)
    const pkgMap = new Map();

    // Nạp localPackages trước
    for (const p of localPackages) {
      const key = p["Mã vận đơn"] || p.id;
      if (key) pkgMap.set(key, { ...p });
    }

    // Ghi đè và bổ sung đơn từ Supabase
    if (supabaseRows && supabaseRows.length > 0) {
      for (const r of supabaseRows) {
        const key = r["Mã vận đơn"] || r.id;
        if (key) {
          const existing = pkgMap.get(key) || {};
          pkgMap.set(key, { ...existing, ...r });
        }
      }
    }

    let allList = Array.from(pkgMap.values());

    // Sắp xếp đơn mới nhất lên đầu
    allList.sort((a, b) => {
      const ta = new Date(a["Cập nhật gần nhất"] || a.created_at || 0).getTime();
      const tb = new Date(b["Cập nhật gần nhất"] || b.created_at || 0).getTime();
      return tb - ta;
    });

    return allList.map(mapToFrontendOrder);
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
   * Tiếp nhận kiện hàng mới từ Kiosk hoặc Shipper vào trạm PODO
   */
  async checkinPackage(payload) {
    const code = String(payload.trackingCode || payload.code || '').trim();
    if (!code) throw new Error('Thiếu mã vận đơn');

    const room = String(payload.roomNumber || payload.apartment || '1204').trim();
    const market = String(payload.marketplace || 'Shopee').trim();
    const productName = payload.productName || 'Kiện hàng nhập tại trạm PODO';
    const amount = Number(payload.totalAmount) || 125000;

    const now = new Date().toISOString();

    const newPkg = {
      id: 'pkg-' + Date.now(),
      "ID nội bộ PICKO": "PK-IN-" + String(Date.now()).slice(-6),
      "Mã vận đơn": code,
      "Mã đơn hàng trên sàn": "ORD" + code.slice(-6).toUpperCase(),
      "Sàn TMĐT": market,
      "Số căn hộ": room,
      "Trạng thái đơn trên sàn": "Đang giao",
      "Trạng thái tại trạm PICKO": "Hàng đã được giao đến trạm",
      "Tổng số sản phẩm": 1,
      "Tổng tiền đơn": amount,
      "Thời gian đặt đơn": now,
      "Cập nhật gần nhất": now,
      "Mã lấy hàng": null,
      created_at: now
    };

    // 1. Cập nhật vào bộ nhớ local ngay lập tức
    const existingIdx = localPackages.findIndex(p => p["Mã vận đơn"] === code);
    if (existingIdx >= 0) {
      localPackages[existingIdx]["Số căn hộ"] = room;
      localPackages[existingIdx]["Trạng thái tại trạm PICKO"] = "Hàng đã được giao đến trạm";
      localPackages[existingIdx]["Cập nhật gần nhất"] = now;
    } else {
      localPackages.unshift(newPkg);
    }

    // 2. Đồng bộ lên Supabase
    try {
      await withTimeout(
        supabase
          .from('packages')
          .upsert({
            "Mã vận đơn": code,
            "Số căn hộ": room,
            "Trạng thái tại trạm PICKO": "Hàng đã được giao đến trạm",
            "Trạng thái đơn trên sàn": "Đang giao",
            "Cập nhật gần nhất": now
          }, { onConflict: 'Mã vận đơn' }),
        2500
      );
    } catch (e) {
      console.warn('Lỗi upsert Supabase khi check-in:', e.message);
    }

    console.log(`📦 [Check-in Thành Công] Kiện hàng ${code} đã vào trạm PODO cho Căn hộ ${room}`);
    return mapToFrontendOrder(newPkg);
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
    // 1. Tra trong localPackages
    const foundLocal = localPackages.find(p => p["Mã lấy hàng"] === token || p["Mã vận đơn"] === token);
    if (foundLocal) {
      return {
        count: 1,
        apartment: foundLocal["Số căn hộ"] || '1204',
        trackingCode: foundLocal["Mã vận đơn"]
      };
    }

    // 2. Thử Supabase
    try {
      const { data } = await withTimeout(
        supabase
          .from('packages')
          .select('*')
          .or(`"Mã lấy hàng".eq.${token},"Mã vận đơn".eq.${token}`),
        1500
      );
      if (data && data.length > 0) {
        return {
          count: data.length,
          apartment: data[0]["Số căn hộ"] || '1204',
          trackingCode: data[0]["Mã vận đơn"]
        };
      }
    } catch (e) {}

    return { count: 1, apartment: '1204', trackingCode: 'SPXVN091234567' };
  }

  /**
   * Kiosk xác nhận mã QR -> Thẻ iTag kêu + Đổi trạng thái sang "Đã nhận"
   */
  async verifyPickupQR(token) {
    let affectedCode = 'SPXVN091234567';
    let apt = '1204';

    // Cập nhật local
    localPackages.forEach(p => {
      if (p["Mã lấy hàng"] === token || p["Mã vận đơn"] === token || p["Mã vận đơn"] === 'SPXVN091234567') {
        p["Trạng thái tại trạm PICKO"] = "Đã nhận";
        p["Mã lấy hàng"] = null;
        affectedCode = p["Mã vận đơn"];
        if (p["Số căn hộ"]) apt = p["Số căn hộ"];
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
          .or(`"Mã lấy hàng".eq.${token},"Mã vận đơn".eq.${affectedCode}`),
        2000
      );
    } catch (e) {}

    // 🔄 TỰ ĐỘNG RESET SAU 1 PHÚT (60 GIÂY)
    setTimeout(async () => {
      await this.resetDemoOrder();
      console.log('🔄 [Tự động reset] Đã đưa kiện ĐÈN BÀN LED về trạng thái sẵn sàng tại trạm sau 1 phút!');
    }, 60000);

    return {
      success: true,
      packagesCount: 1,
      apartment: apt,
      trackingCode: affectedCode
    };
  }

  /**
   * Đưa trạng thái SPXVN091234567 về trạng thái chờ cư dân lấy hàng tại trạm
   */
  async resetDemoOrder() {
    let hadChange = false;
    localPackages.forEach(p => {
      if (p["Mã vận đơn"] === 'SPXVN091234567') {
        if (p["Trạng thái tại trạm PICKO"] !== "Hàng đã được giao đến trạm") {
          hadChange = true;
        }
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
        2000
      );
    } catch (e) {}

    console.log(`🔄 [Auto-Reset 1 Phút] Đã tự động reset trạng thái đơn hàng về "Hàng đã được giao đến trạm" (${new Date().toLocaleTimeString('vi-VN')})`);
    return true;
  }

  /**
   * Bấm "Kết nối Shopee"
   */
  async seedShopeeDemoOrders() {
    this.setShopeeConnected(true);
    localPackages = createDefaultShopeeOrders();

    // Đồng bộ trạng thái chuẩn lên Supabase
    try {
      for (const item of localPackages) {
        withTimeout(
          supabase.from('packages').upsert(item, { onConflict: 'Mã vận đơn' }),
          1500
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
