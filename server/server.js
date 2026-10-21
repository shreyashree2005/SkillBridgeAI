const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth");

// Connect MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// HOME
// ==========================================
app.get("/", (req, res) => {
  res.json({
    message: "🌉 SkillBridge AI API is running",
    version: "1.0.0"
  });
});

// ==========================================
// HEALTH ROUTES
// ==========================================
app.use("/api", healthRoutes);

// ==========================================
// AUTH ROUTES
// ==========================================
app.use("/api/auth", authRoutes);

// ==========================================
// 404
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  res.status(500).json({
    error: "Something went wrong on the server"
  });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});