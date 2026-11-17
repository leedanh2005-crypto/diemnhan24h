const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Routes chuẩn RESTful
router.get('/', orderController.getOrders.bind(orderController));
router.get('/search', orderController.searchOrders.bind(orderController)); // Phải đứng trước /:id
router.get('/inspect', orderController.inspectPickupQR.bind(orderController));
router.get('/stats', orderController.getStats.bind(orderController));
router.post('/pickup-qr', orderController.generatePickupQR.bind(orderController));
router.post('/verify-qr', orderController.verifyPickupQR.bind(orderController));
router.post('/reset-demo', orderController.resetDemoOrder.bind(orderController));
router.get('/:id', orderController.getOrderById.bind(orderController));

module.exports = router;
