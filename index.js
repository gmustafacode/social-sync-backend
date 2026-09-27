import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "./config/db.js";

// Import Services (Cron Jobs)
import "./services/scheduler.service.js";

// Import Core Feature Routes
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import postRoutes from "./routes/post.routes.js";
import socialRoutes from "./routes/social.routes.js";
import calendarRoutes from "./routes/calendar.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import preferenceRoutes from "./routes/preference.routes.js";
import userRoutes from "./routes/user.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

// Import Platform-Specific Social Routes (from Backend IMP)
import linkedinRoutes from "./routes/linkedin.routes.js";
import xRoutes from "./routes/x.routes.js";
import facebookRoutes from "./routes/facebook.routes.js";
import instagramRoutes from "./routes/instagram.routes.js";
import tiktokRoutes from "./routes/tiktok.routes.js";
import mediaRoutes from "./routes/media.routes.js";

const app = express();
const PORT = process.env.PORT || 8000;

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// =====================================================
// ROOT HEALTH CHECK
// =====================================================
app.get("/", (req, res) => {
    res.json({
        message: "My FYP Backend is running smoothly!",
        status: "healthy",
        database: "MongoDB",
        services: [
            "Social Media Automation",
            "AI Content Intelligence",
            "Post Scheduler",
            "Multi-Platform Publishing",
            "Analytics & Calendar Overview"
        ]
    });
});

app.get("/api/health", (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? "healthy" : "degraded",
        database: databaseReady ? "connected" : "disconnected"
    });
});

// =====================================================
// API ROUTES
// =====================================================
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", userRoutes);
app.use("/api/webhooks", webhookRoutes);

// Mounting Social Platform Routes (from Backend IMP)
app.use("/api/social/linkedin", linkedinRoutes);
app.use("/api/social/x", xRoutes);
app.use("/api/social/facebook", facebookRoutes);
app.use("/api/social/instagram", instagramRoutes);
app.use("/api/social/tiktok", tiktokRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("[Unhandled Error]:", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

// =====================================================
// SERVER INITIALIZATION
// =====================================================
const startServer = async () => {
    await connectDB();
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Ready to accept LAN requests at http://0.0.0.0:${PORT}`);
    });
};

startServer();
