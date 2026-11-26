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

let localPackages = []; // Khởi tạo danh sách rỗng theo yêu cầu (không tự động tải đơn hàng cũ trên Supabase)
const sessionStartTime = new Date(); // Mốc thời gian chỉ nhận đơn mới kể từ khi phiên làm việc bắt đầu

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
        await this.resetDemoOrder({ allowCreateSample: false, onlyRevertReceived: true });
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
    const lookbackIso = new Date(Date.now() - 24 * 3600000).toISOString();

    // 1. Lấy từ Supabase tất cả kiện hàng trong 24h gần nhất hoặc đang ở trạng thái chờ tại trạm
    // (không phụ thuộc thời điểm server khởi động/cold-start trên cloud hay lệch giờ máy khách)
    try {
      const localCodes = localPackages.map(p => p["Mã vận đơn"]).filter(Boolean);
      let filterExp = `created_at.gte.${lookbackIso},"Cập nhật gần nhất".gte.${lookbackIso},"Trạng thái tại trạm PICKO".in.("Hàng đã được giao đến trạm","Đang yêu cầu lấy hàng")`;
      if (localCodes.length > 0) {
        filterExp += `,"Mã vận đơn".in.(${localCodes.join(',')})`;
      }

      const dbQuery = supabase
        .from('packages')
        .select('*')
        .or(filterExp)
        .order('created_at', { ascending: false });

      const { data, error } = await withTimeout(dbQuery, 2500);
      if (!error && Array.isArray(data)) {
        supabaseRows = data;
      }
    } catch (err) {
      console.warn('⚠️ Supabase timeout/offline, sử dụng dữ liệu PODO nội bộ');
    }

    // 2. Hợp nhất giữa localPackages (dữ liệu mẫu/bộ nhớ) và Supabase (dữ liệu thật từ Kiosk / Shipper)
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
          const merged = { ...existing, ...r };
          pkgMap.set(key, merged);

          // Cập nhật ngược lại localPackages để giữ đồng bộ trạng thái mới nhất (và nạp đơn mới từ Supabase vào RAM)
          const lIdx = localPackages.findIndex(lp => (lp["Mã vận đơn"] || lp.id) === key);
          if (lIdx >= 0) {
            localPackages[lIdx] = { ...localPackages[lIdx], ...r };
          } else {
            localPackages.push({ ...r });
          }
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

  async getStats(query = {}) {
    const orders = await this.getAllOrders(query);
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
    const defaultProducts = {
      'SPXVN091234567': { name: 'Đèn bàn thông minh Rạng Đông LED 9W R-01', amount: 58000, qty: 2 },
      'SPXVN086888204': { name: 'Bộ củ cáp sạc nhanh Anker GaN 65W Type-C', amount: 126000, qty: 2 },
      'SPXVN077123999': { name: 'Chuột không dây Logitech MX Anywhere 3S', amount: 185000, qty: 1 }
    };
    const def = defaultProducts[code] || {};
    const productName = payload.productName || def.name || 'Kiện hàng tiếp nhận tại trạm PODO';
    const amount = Number(payload.totalAmount) || def.amount || 125000;
    const qty = Number(payload.quantity) || def.qty || 1;

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
      "Tổng số sản phẩm": qty,
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
   * Khi cư dân bấm "Lấy hàng", gán mã token QR vào đúng kiện được chọn (hoặc tất cả kiện đang tại trạm)
   */
  async assignPickupToken(token, targetCodes = []) {
    const now = new Date().toISOString();
    const filterSet = new Set((Array.isArray(targetCodes) ? targetCodes : []).map(c => String(c).trim()).filter(Boolean));
    let assignedCodes = [];

    // Đảm bảo localPackages đã đồng bộ các kiện mới từ Supabase (nếu Shipper vừa check-in trực tiếp lên Supabase)
    try {
      await this.getAllOrders({ since: new Date(Date.now() - 3600000).toISOString() });
    } catch (e) {}

    // Cập nhật kiện đang tại trạm ở bộ nhớ cục bộ
    localPackages.forEach(p => {
      if (p["Trạng thái tại trạm PICKO"] === 'Hàng đã được giao đến trạm') {
        const matchTarget = filterSet.size === 0 ||
          filterSet.has(p["Mã vận đơn"]) ||
          filterSet.has(p["Mã đơn hàng trên sàn"]);
        if (matchTarget) {
          p["Mã lấy hàng"] = token;
          p["Cập nhật gần nhất"] = now;
          if (p["Mã vận đơn"]) assignedCodes.push(p["Mã vận đơn"]);
        }
      }
    });

    // Đồng bộ lên Supabase cho các kiện đã chọn tại trạm
    try {
      if (assignedCodes.length > 0) {
        await withTimeout(
          supabase
            .from('packages')
            .update({
              "Mã lấy hàng": token,
              "Cập nhật gần nhất": now
            })
            .in('Mã vận đơn', assignedCodes),
          2000
        );
      } else {
        await withTimeout(
          supabase
            .from('packages')
            .update({
              "Mã lấy hàng": token,
              "Cập nhật gần nhất": now
            })
            .eq('Trạng thái tại trạm PICKO', 'Hàng đã được giao đến trạm'),
          2000
        );
      }
    } catch (e) {
      console.warn('Lỗi gán mã token lên Supabase:', e.message);
    }

    console.log(`🔑 [Assign Pickup Token] Gán mã token lấy hàng ${token} cho ${assignedCodes.length > 0 ? assignedCodes.join(', ') : 'các kiện tại trạm'}`);
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

    // Fallback: nếu có kiện đang tại trạm trong localPackages
    const atStation = localPackages.filter(p => p["Trạng thái tại trạm PICKO"] === 'Hàng đã được giao đến trạm');
    if (atStation.length > 0) {
      return {
        count: atStation.length,
        apartment: atStation[0]["Số căn hộ"] || '1204',
        trackingCode: atStation[0]["Mã vận đơn"]
      };
    }

    return { count: 1, apartment: '1204', trackingCode: 'SPXVN091234567' };
  }

  /**
   * Kiosk xác nhận mã QR -> Thẻ iTag kêu + Đổi trạng thái sang "Đã nhận"
   */
  async verifyPickupQR(token) {
    const now = new Date().toISOString();
    let affectedCodes = [];
    let apt = '1204';

    // 0. Đồng bộ đơn mới từ Supabase trước để tránh thiếu đơn vừa quét từ Shipper/Kiosk (bất kể server cold-start)
    try {
      await this.getAllOrders({ since: new Date(Date.now() - 3600000).toISOString() });
    } catch (e) {}

    // 1. Ưu tiên khớp chính xác token ("Mã lấy hàng") hoặc mã vận đơn ("Mã vận đơn") trong localPackages
    localPackages.forEach(p => {
      const matchToken = p["Mã lấy hàng"] === token;
      const matchTracking = p["Mã vận đơn"] === token;

      if (matchToken || matchTracking) {
        p["Trạng thái tại trạm PICKO"] = "Đã nhận";
        p["Mã lấy hàng"] = null;
        p["Cập nhật gần nhất"] = now;
        if (p["Mã vận đơn"]) affectedCodes.push(p["Mã vận đơn"]);
        if (p["Số căn hộ"]) apt = p["Số căn hộ"];
      }
    });

    // 2. Nếu localPackages chưa thấy khớp chính xác, truy vấn trực tiếp từ Supabase theo token/mã vận đơn
    if (affectedCodes.length === 0) {
      try {
        const { data: sbMatches } = await withTimeout(
          supabase
            .from('packages')
            .select('*')
            .or(`"Mã lấy hàng".eq.${token},"Mã vận đơn".eq.${token}`),
          2000
        );

        let rowsToClaim = Array.isArray(sbMatches) ? sbMatches : [];

        // Chỉ fallback sang các kiện đang tại trạm nếu không có kiện nào gắn token cụ thể (VD: QR offline)
        if (rowsToClaim.length === 0 && token && token.startsWith('PICKO-')) {
          const localAtStation = localPackages.filter(
            p => p["Trạng thái tại trạm PICKO"] === 'Hàng đã được giao đến trạm' && !p["Mã lấy hàng"]
          );
          if (localAtStation.length > 0) {
            rowsToClaim = localAtStation;
          } else {
            const { data: atStationRows } = await withTimeout(
              supabase
                .from('packages')
                .select('*')
                .eq('Trạng thái tại trạm PICKO', 'Hàng đã được giao đến trạm')
                .is('Mã lấy hàng', null),
              2000
            );
            if (Array.isArray(atStationRows)) rowsToClaim = atStationRows;
          }
        }

        for (const r of rowsToClaim) {
          if (r["Mã vận đơn"]) {
            affectedCodes.push(r["Mã vận đơn"]);
            if (r["Số căn hộ"]) apt = r["Số căn hộ"];
            const updatedRow = {
              ...r,
              "Trạng thái tại trạm PICKO": "Đã nhận",
              "Mã lấy hàng": null,
              "Cập nhật gần nhất": now
            };
            const lIdx = localPackages.findIndex(lp => lp["Mã vận đơn"] === r["Mã vận đơn"]);
            if (lIdx >= 0) localPackages[lIdx] = { ...localPackages[lIdx], ...updatedRow };
            else localPackages.push(updatedRow);
          }
        }
      } catch (e) {
        console.warn('Lỗi truy vấn Supabase khi verify QR:', e.message);
      }
    }

    if (affectedCodes.length === 0) {
      return {
        success: false,
        message: 'Mã QR không hợp lệ hoặc không có kiện hàng đang chờ nhận tại trạm.'
      };
    }

    // 3. Cập nhật trạng thái Đã nhận lên Supabase
    try {
      await withTimeout(
        supabase
          .from('packages')
          .update({
            "Trạng thái tại trạm PICKO": "Đã nhận",
            "Mã lấy hàng": null,
            "Cập nhật gần nhất": now
          })
          .in('Mã vận đơn', affectedCodes),
        2000
      );
    } catch (e) {
      console.warn('Lỗi cập nhật Supabase khi verify QR:', e.message);
    }

    console.log(`✅ [Verify Pickup QR] Đã chuyển trạng thái sang Đã nhận cho kiện: ${affectedCodes.join(', ')}`);

    // 🔄 TỰ ĐỘNG RESET SAU 1 PHÚT (60 GIÂY) - chỉ reset các đơn đã nhận về trạm, không tự bơm đơn mẫu
    setTimeout(async () => {
      await this.resetDemoOrder({ allowCreateSample: false, onlyRevertReceived: true });
      console.log('🔄 [Tự động reset] Đã đưa kiện về trạng thái sẵn sàng tại trạm sau 1 phút!');
    }, 60000);

    return {
      success: true,
      packagesCount: affectedCodes.length,
      apartment: apt,
      trackingCode: affectedCodes[0]
    };
  }

  /**
   * Đưa các đơn hàng hiện tại về trạng thái "Hàng đã được giao đến trạm" (chờ cư dân quét mã lấy hàng)
   */
  async resetDemoOrder({ allowCreateSample = true, onlyRevertReceived = false } = {}) {
    const now = new Date().toISOString();
    let affectedCodes = [];

    // Nếu localPackages đang rỗng: chỉ nạp đơn mẫu ĐÈN BÀN LED khi người dùng chủ động bấm Reset/Tạo mẫu
    if (!localPackages || localPackages.length === 0) {
      if (!allowCreateSample) {
        return {
          success: true,
          message: 'Chưa có đơn hàng nào để reset.',
          count: 0,
          codes: []
        };
      }
      localPackages = createDefaultShopeeOrders().slice(0, 1);
    }

    localPackages.forEach(p => {
      if (onlyRevertReceived && p["Trạng thái tại trạm PICKO"] !== "Đã nhận") {
        return;
      }
      p["Trạng thái tại trạm PICKO"] = "Hàng đã được giao đến trạm";
      p["Trạng thái đơn trên sàn"] = "Đang giao";
      p["Mã lấy hàng"] = null;
      p["Cập nhật gần nhất"] = now;
      if (p["Mã vận đơn"]) affectedCodes.push(p["Mã vận đơn"]);
    });

    if (affectedCodes.length === 0) {
      if (onlyRevertReceived) {
        return { success: true, count: 0, codes: [] };
      }
      affectedCodes = ['SPXVN091234567'];
    }

    try {
      await withTimeout(
        supabase
          .from('packages')
          .update({
            "Trạng thái tại trạm PICKO": "Hàng đã được giao đến trạm",
            "Trạng thái đơn trên sàn": "Đang giao",
            "Mã lấy hàng": null,
            "Cập nhật gần nhất": now
          })
          .in('Mã vận đơn', affectedCodes),
        2500
      );
    } catch (e) {
      console.warn('Lỗi cập nhật reset lên Supabase:', e.message);
    }

    console.log(`🔄 [Reset Đơn Hàng] Đã đưa ${affectedCodes.length} đơn hàng (${affectedCodes.join(', ')}) về trạng thái "Hàng đã được giao đến trạm" (${new Date().toLocaleTimeString('vi-VN')})`);
    return {
      success: true,
      message: `Đã đưa ${affectedCodes.length} đơn hàng về trạng thái chờ cư dân lấy hàng tại trạm!`,
      count: affectedCodes.length,
      codes: affectedCodes
    };
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

  clearAllOrders() {
    localPackages = [];
    return true;
  }

  getShopeeConnected() {
    return isShopeeConnected;
  }
}

module.exports = new OrderService();
