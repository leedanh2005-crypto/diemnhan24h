const express = require('express');
const router = express.Router();
const returnService = require('../services/returnService');

// Lấy danh sách yêu cầu trả hàng
router.get('/', (req, res) => {
  res.json(returnService.getAllReturns());
});

// Tạo yêu cầu trả hàng
router.post('/', async (req, res) => {
  const result = await returnService.createReturn(req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json({ success: false, message: result.message });
  }
  res.json(result.data);
});

// Tạo mã bàn giao cho shipper
router.post('/:id/handover', (req, res) => {
  const result = returnService.createHandover(req.params.id);
  if (!result.ok) {
    return res.status(result.status || 400).json({ success: false, message: result.message });
  }
  res.json(result.data);
});

// Thu hồi mã bàn giao
router.post('/:id/revoke', (req, res) => {
  const result = returnService.revokeHandover(req.params.id);
  if (!result.ok) {
    return res.status(result.status || 400).json({ success: false, message: result.message });
  }
  res.json(result.data);
});

// Hủy yêu cầu trả hàng
router.post('/:id/cancel', (req, res) => {
  const result = returnService.cancelReturn(req.params.id);
  if (!result.ok) {
    return res.status(result.status || 400).json({ success: false, message: result.message });
  }
  res.json(result.data);
});

// Xác nhận sàn đã hoàn tiền
router.post('/:id/refund', (req, res) => {
  const result = returnService.confirmRefund(req.params.id);
  if (!result.ok) {
    return res.status(result.status || 400).json({ success: false, message: result.message });
  }
  res.json(result.data);
});

// Giả lập scanner tại trạm (demo)
router.post('/:id/sim', (req, res) => {
  const action = req.body && req.body.action;
  const result = returnService.simulateAction(req.params.id, action);
  if (!result.ok) {
    return res.status(result.status || 400).json({ success: false, message: result.message });
  }
  res.json(result.data);
});

module.exports = router;
