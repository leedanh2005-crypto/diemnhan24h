const express = require('express');
const router = express.Router();

const orderService = require('../services/orderService');

let connections = [
  { marketplace: "Shopee", connected: false },
  { marketplace: "TikTok Shop", connected: false },
  { marketplace: "Lazada", connected: false },
  { marketplace: "Tiki", connected: false },
];

router.get('/connections', (req, res) => res.json(connections));

const setConnection = async (req, res, isConnected) => {
  const name = req.body && (req.body.marketplace || req.body.name);
  const item = connections.find((c) => c.marketplace === name);
  if (!item) {
    return res.status(400).json({ success: false, message: "Sàn thương mại không hợp lệ" });
  }
  item.connected = isConnected;

  if (isConnected && name === 'Shopee') {
    try {
      await orderService.seedShopeeDemoOrders();
      return res.json({ 
        success: true, 
        message: `Đã kết nối Shopee và đồng bộ 2 đơn hàng đang vận chuyển!` 
      });
    } catch (err) {
      console.error("Lỗi seed Shopee demo:", err);
    }
  }

  if (!isConnected && name === 'Shopee') {
    try {
      await orderService.clearShopeeDemoOrders();
      return res.json({
        success: true,
        message: `Đã ngắt kết nối Shopee và ẩn các đơn hàng demo!`
      });
    } catch (err) {
      console.error("Lỗi clear Shopee demo:", err);
    }
  }

  res.json({ success: true, message: isConnected ? `Đã kết nối ${name}` : `Đã ngắt kết nối ${name}` });
};

router.post('/connect', (req, res) => setConnection(req, res, true));
router.post('/disconnect', (req, res) => setConnection(req, res, false));

module.exports = router;
