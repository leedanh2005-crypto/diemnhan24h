require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

// Import các routes
const orderRoutes = require('./src/routes/orderRoutes');
const connectionRoutes = require('./src/routes/connectionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/logos", express.static(path.join(__dirname, "logos")));
app.get("/favicon.ico", (req, res) => res.sendFile(path.join(__dirname, "logos", "favicon.ico")));
app.get("/favicon.png", (req, res) => res.sendFile(path.join(__dirname, "logos", "favicon.png")));

// API Routes
// Note: /api/stats was previously handled on its own route, we moved it to orderRoutes to keep it clean.
// So we map /api/stats to /api/orders/stats. 
// Wait, the frontend expects /api/stats. So we should route it explicitly.
app.get("/api/health", (req, res) => {
  res.json({ success: true, app: "PICKO Resident API", status: "online", db: "Supabase" });
});

// Gắn routes
app.use('/api/orders', orderRoutes);
app.use('/api', connectionRoutes);

// Handle /api/stats directly for backward compatibility with frontend
const orderController = require('./src/controllers/orderController');
app.get('/api/stats', orderController.getStats.bind(orderController));

// Budget API – lưu bằng localStorage ở client, server chỉ trả stub
let _budgetStore = {};
app.get('/api/budget', (req, res) => res.json({ budget: _budgetStore }));
app.post('/api/budget', (req, res) => { _budgetStore = req.body || {}; res.json({ budget: _budgetStore }); });

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