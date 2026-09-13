import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getCalendarEvents } from "../controllers/calendar.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getCalendarEvents);

export default router;
