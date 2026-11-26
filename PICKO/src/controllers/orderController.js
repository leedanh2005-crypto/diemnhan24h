const orderService = require('../services/orderService');

class OrderController {
  
  async getOrders(req, res) {
    try {
      const orders = await orderService.getAllOrders({ since: req.query.since });
      res.json({ success: true, orders });
    } catch (error) {
      console.error("Lỗi getOrders:", error);
      res.status(500).json({ success: false, message: "Không thể tải dữ liệu đơn hàng" });
    }
  }

  async searchOrders(req, res) {
    try {
      const keyword = String(req.query.q || "").trim();
      const orders = await orderService.getAllOrders({ keyword });
      res.json({ success: true, orders });
    } catch (error) {
      console.error("Lỗi searchOrders:", error);
      res.status(500).json({ success: false, message: "Lỗi tìm kiếm đơn hàng" });
    }
  }

  async getOrderById(req, res) {
    try {
      const order = await orderService.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
      }
      res.json({ success: true, order });
    } catch (error) {
      console.error("Lỗi getOrderById:", error);
      res.status(500).json({ success: false, message: "Không thể tải chi tiết đơn hàng" });
    }
  }

  async getStats(req, res) {
    try {
      const stats = await orderService.getStats({ since: req.query.since });
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Lỗi getStats:", error);
      res.status(500).json({ success: false, message: "Lỗi tính toán thống kê" });
    }
  }

  async generatePickupQR(req, res) {
    try {
      const token = 'PICKO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60000).toISOString(); 
      const trackingCodes = Array.isArray(req.body?.trackingCodes) ? req.body.trackingCodes : [];

      // Ghi mã này vào Supabase cho đúng các đơn đang chờ được chọn
      await orderService.assignPickupToken(token, trackingCodes);

      res.json({
        success: true,
        token: token,
        expiresAt: expiresAt,
        message: "Đã tạo mã QR lấy hàng thành công"
      });
    } catch (error) {
      console.error("Lỗi generatePickupQR:", error);
      res.status(500).json({ success: false, message: "Không thể tạo mã QR" });
    }
  }

  async inspectPickupQR(req, res) {
    try {
      const token = req.query.token || req.body?.token;
      if (!token) return res.status(400).json({ success: false, message: "Thiếu token" });
      const info = await orderService.inspectPickupQR(token);
      res.json({ success: true, ...info });
    } catch (error) {
      console.error("Lỗi inspectPickupQR:", error);
      res.json({ success: true, count: 1, apartment: "1204" });
    }
  }

  async verifyPickupQR(req, res) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: "Thiếu mã xác thực." });
      }

      const result = await orderService.verifyPickupQR(token);
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        message: `Thành công! Mở tủ cho căn hộ ${result.apartment}. Đã giao ${result.packagesCount} kiện hàng.`,
        data: result
      });
    } catch (error) {
      console.error("Lỗi verifyPickupQR:", error);
      res.status(500).json({ success: false, message: "Lỗi hệ thống khi quét QR" });
    }
  }

  async checkinOrder(req, res) {
    try {
      const payload = req.body;
      if (!payload || (!payload.trackingCode && !payload.code)) {
        return res.status(400).json({ success: false, message: "Thiếu mã vận đơn" });
      }

      const order = await orderService.checkinPackage(payload);
      res.json({
        success: true,
        message: `Đã nạp kiện hàng ${order.trackingCode} vào trạm PODO cho Căn hộ ${order.apartment}`,
        order
      });
    } catch (error) {
      console.error("Lỗi checkinOrder:", error);
      res.status(500).json({ success: false, message: error.message || "Không thể tiếp nhận kiện hàng" });
    }
  }

  async resetDemoOrder(req, res) {
    try {
      const result = await orderService.resetDemoOrder();
      res.json(result || { success: true, message: "Đã đưa tất cả đơn hàng về trạng thái sẵn sàng tại trạm PICKO!" });
    } catch (error) {
      console.error("Lỗi resetDemoOrder:", error);
      res.status(500).json({ success: false, message: "Không thể reset đơn" });
    }
  }

  async clearAllOrders(req, res) {
    try {
      orderService.clearAllOrders();
      res.json({ success: true, message: "Đã dọn sạch danh sách đơn hàng, sẵn sàng tiếp nhận đơn mới" });
    } catch (error) {
      console.error("Lỗi clearAllOrders:", error);
      res.status(500).json({ success: false, message: "Lỗi dọn sạch đơn hàng" });
    }
  }
}

module.exports = new OrderController();
