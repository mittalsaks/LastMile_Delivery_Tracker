const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const zoneRoutes = require("./routes/zoneRoutes");           // Part 2
const rateCardRoutes = require("./routes/rateCardRoutes");   // Part 2
const codConfigRoutes = require("./routes/codConfigRoutes"); // Part 2
const orderRoutes = require("./routes/orderRoutes");         // Part 3 + 4 + 5 (merged file)
const agentRoutes = require("./routes/agentRoutes");         // Part 4
const rescheduleRoutes = require("./routes/rescheduleRoutes"); // Part 6

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Last-Mile Delivery Tracker API is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/ratecards", rateCardRoutes);
app.use("/api/codconfig", codConfigRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/agents", agentRoutes);
// rescheduleRoutes adds /api/orders/:id/reschedule and /reschedule/reassign —
// same prefix as orderRoutes is fine since both use sub-paths under /:id/...
app.use("/api/orders", rescheduleRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
