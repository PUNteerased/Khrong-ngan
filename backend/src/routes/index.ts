import { Router } from "express"
import rateLimit from "express-rate-limit"
import * as authController from "../controllers/auth.controller.js"
import * as userController from "../controllers/user.controller.js"
import * as drugController from "../controllers/drug.controller.js"
import * as chatController from "../controllers/chat.controller.js"
import * as chatHistoryController from "../controllers/chatHistory.controller.js"
import * as adminController from "../controllers/admin.controller.js"
import * as adminLogsController from "../controllers/adminLogs.controller.js"
import * as adminLoginController from "../controllers/adminLogin.controller.js"
import { authMiddleware } from "../middleware/auth.js"
import { adminAuthMiddleware, adminOrKeyMiddleware } from "../middleware/adminAuth.js"

export const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
})

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
})

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
})

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "laneya-backend" })
})

router.post("/api/auth/register", authLimiter, authController.register)
router.post("/api/auth/login", authLimiter, authController.login)

router.get("/api/users/me", authMiddleware, userController.getMe)
router.patch("/api/users/me", authMiddleware, userController.patchMe)

router.get("/api/drugs", drugController.listDrugs)
router.get("/api/drugs/:id", drugController.getDrug)
router.post("/api/drugs", adminOrKeyMiddleware, drugController.createDrug)
router.patch("/api/drugs/:id", adminOrKeyMiddleware, drugController.patchDrug)
router.patch("/api/drugs/:id/restock", adminOrKeyMiddleware, drugController.restockDrug)
router.delete("/api/drugs/:id", adminOrKeyMiddleware, drugController.deleteDrug)

router.post("/api/chat", chatLimiter, authMiddleware, chatController.postChat)
router.get(
  "/api/chat/sessions",
  authMiddleware,
  chatHistoryController.listMySessions
)
router.get(
  "/api/chat/sessions/:sessionId/messages",
  authMiddleware,
  chatHistoryController.getSessionMessages
)

router.post("/api/admin/login", adminLoginLimiter, adminLoginController.adminLogin)

router.get("/api/admin/stats", adminAuthMiddleware, adminController.getStats)
router.get("/api/admin/top-drugs", adminAuthMiddleware, adminController.topDrugs)
router.get(
  "/api/admin/sessions",
  adminAuthMiddleware,
  adminLogsController.listChatSessions
)
