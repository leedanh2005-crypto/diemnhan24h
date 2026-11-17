const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const orderService = require('./orderService');

const RETURNS_FILE = path.join(__dirname, '../../returns.json');
const RETURN_DAYS = 15;
const HANDOVER_MS = 30 * 60 * 1000;

class ReturnService {
  constructor() {
    this._memoryReturns = null;
  }

  loadReturns() {
    try {
      if (fs.existsSync(RETURNS_FILE)) {
        const data = fs.readFileSync(RETURNS_FILE, 'utf8');
        const list = JSON.parse(data);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {
      console.warn('⚠️ Lỗi đọc returns.json:', e.message);
    }

    if (!this._memoryReturns) {
      this._memoryReturns = [];
    }
    return this._memoryReturns;
  }

  saveReturns(list) {
    this._memoryReturns = list;
    try {
      fs.writeFileSync(RETURNS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ Không thể ghi file returns.json:', e.message);
    }
  }

  rtCode(prefix) {
    return prefix + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  rtView(r) {
    const { userId, ...rest } = r;
    return rest;
  }

  getAllReturns() {
    const list = this.loadReturns()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      success: true,
      returnDays: RETURN_DAYS,
      returns: list.map(this.rtView)
    };
  }

  getReturnByHandoverCode(code) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const all = this.loadReturns();
    return all.find((x) => x.handover && x.handover.code === clean) || null;
  }

  async createReturn({ orderId, trackingCode, reason }) {
    if (!orderId) {
      return { ok: false, status: 400, message: 'Chưa chọn đơn hàng.' };
    }
    const cleanTracking = String(trackingCode || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9-]{8,30}$/.test(cleanTracking)) {
      return { ok: false, status: 400, message: 'Mã vận đơn trả hàng không hợp lệ (8–30 ký tự gồm chữ và số).' };
    }
    const cleanReason = String(reason || '').trim().slice(0, 200);
    if (!cleanReason) {
      return { ok: false, status: 400, message: 'Vui lòng chọn lý do trả hàng.' };
    }

    const orders = await orderService.getAllOrders();
    const order = orders.find((x) => String(x.orderId) === String(orderId) || String(x.trackingCode) === String(orderId));

    if (!order) {
      return { ok: false, status: 404, message: 'Không tìm thấy đơn hàng.' };
    }

    if (order.stationStatus !== 'RECEIVED') {
      return { ok: false, status: 400, message: 'Chỉ trả được đơn đã nhận hàng.' };
    }

    const all = this.loadReturns();
    if (all.some((r) => String(r.orderId) === String(orderId) && r.status !== 'CANCELLED')) {
      return { ok: false, status: 400, message: 'Đơn này đã có yêu cầu trả hàng.' };
    }
    if (all.some((r) => r.trackingCode === cleanTracking && r.status !== 'CANCELLED')) {
      return { ok: false, status: 400, message: 'Mã vận đơn này đã được dùng cho một yêu cầu khác.' };
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + RETURN_DAYS * 86400000);

    const r = {
      id: 'RT' + Date.now().toString(36).toUpperCase(),
      userId: 'user-1204',
      orderId: String(order.orderId || orderId),
      orderCode: order.orderCode || ('ORD' + cleanTracking.slice(0, 6)),
      marketplace: order.marketplace || 'Shopee',
      amount: order.totalAmount || order.amount || 0,
      items: (order.items || []).map((i) => ({
        productName: i.productName || i.name || 'Sản phẩm',
        variant: i.variant || '',
        quantity: i.quantity || 1,
        image: i.image || '',
      })),
      trackingCode: cleanTracking,
      reason: cleanReason,
      status: 'WAIT_DROPOFF',
      dropCode: this.rtCode('RT'),
      handover: null,
      chip: null,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
      timeline: [{ s: 'WAIT_DROPOFF', at: now.toISOString(), note: 'Cư dân tạo yêu cầu' }],
    };

    all.unshift(r);
    this.saveReturns(all);
    return { ok: true, data: { success: true, return: this.rtView(r) } };
  }

  createHandover(id) {
    const all = this.loadReturns();
    const r = all.find((x) => x.id === id);
    if (!r) return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu trả hàng.' };
    if (r.status !== 'AT_STATION') return { ok: false, status: 400, message: 'Chỉ tạo được mã bàn giao khi kiện đã được gửi tại trạm.' };

    const now = Date.now();
    r.handover = {
      code: this.rtCode('HO'),
      createdAt: new Date(now).toISOString(),
      exp: new Date(now + HANDOVER_MS).toISOString(),
      used: false,
    };
    this.saveReturns(all);
    return { ok: true, data: { success: true, return: this.rtView(r) } };
  }

  revokeHandover(id) {
    const all = this.loadReturns();
    const r = all.find((x) => x.id === id);
    if (!r) return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu trả hàng.' };
    r.handover = null;
    this.saveReturns(all);
    return { ok: true, data: { success: true, return: this.rtView(r) } };
  }

  cancelReturn(id) {
    const all = this.loadReturns();
    const r = all.find((x) => x.id === id);
    if (!r) return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu trả hàng.' };
    if (!['WAIT_DROPOFF', 'AT_STATION'].includes(r.status)) {
      return { ok: false, status: 400, message: 'Không thể hủy yêu cầu ở trạng thái này.' };
    }
    const atStation = r.status === 'AT_STATION';
    r.status = 'CANCELLED';
    r.handover = null;
    r.timeline.push({
      s: 'CANCELLED',
      at: new Date().toISOString(),
      note: atStation ? 'Cư dân hủy, nhận lại kiện tại trạm' : 'Cư dân hủy yêu cầu'
    });
    this.saveReturns(all);
    return {
      ok: true,
      data: {
        success: true,
        return: this.rtView(r),
        message: atStation
          ? 'Đã hủy. Để nhận lại kiện, hãy đưa mã QR gửi trả vào máy quét tại trạm.'
          : 'Đã hủy yêu cầu trả hàng.'
      }
    };
  }

  confirmRefund(id) {
    const all = this.loadReturns();
    const r = all.find((x) => x.id === id);
    if (!r) return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu trả hàng.' };
    if (r.status !== 'HANDED_OVER') {
      return { ok: false, status: 400, message: 'Chỉ xác nhận hoàn tiền sau khi đã bàn giao shipper.' };
    }
    r.status = 'REFUNDED';
    r.timeline.push({
      s: 'REFUNDED',
      at: new Date().toISOString(),
      note: 'Cư dân xác nhận sàn đã hoàn tiền'
    });
    this.saveReturns(all);
    return { ok: true, data: { success: true, return: this.rtView(r) } };
  }

  simulateAction(id, action) {
    const all = this.loadReturns();
    const r = all.find((x) => x.id === id);
    if (!r) return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu trả hàng.' };

    if (action === 'dropoff') {
      if (r.status !== 'WAIT_DROPOFF') {
        return { ok: false, status: 400, message: 'Yêu cầu này không ở trạng thái chờ mang đến trạm.' };
      }
      r.status = 'AT_STATION';
      r.chip = 'CP-' + crypto.randomBytes(2).toString('hex').toUpperCase();
      r.timeline.push({
        s: 'AT_STATION',
        at: new Date().toISOString(),
        note: 'Máy quét: QR gửi trả và tem kiện khớp, gắn chip ' + r.chip
      });
    } else if (action === 'pickup') {
      if (r.status !== 'AT_STATION') {
        return { ok: false, status: 400, message: 'Kiện chưa ở trạng thái đã gửi tại trạm.' };
      }
      const h = r.handover;
      if (!h || h.used || new Date(h.exp) < new Date()) {
        return { ok: false, status: 400, message: 'Chưa có mã bàn giao còn hiệu lực. Hãy bấm "Shipper đã đến lấy" để tạo mã trước.' };
      }
      h.used = true;
      r.status = 'HANDED_OVER';
      r.timeline.push({
        s: 'HANDED_OVER',
        at: new Date().toISOString(),
        note: 'Shipper quét mã ' + h.code + ' và xác nhận tem kiện'
      });
    } else {
      return { ok: false, status: 400, message: 'Hành động không hợp lệ.' };
    }

    this.saveReturns(all);
    return { ok: true, data: { success: true, return: this.rtView(r) } };
  }
}

module.exports = new ReturnService();
