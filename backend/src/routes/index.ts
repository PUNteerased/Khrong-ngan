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
import * as adminHealthController from "../controllers/adminHealth.controller.js"
import * as adminUsersController from "../controllers/adminUsers.controller.js"
import * as knowledgeController from "../controllers/knowledge.controller.js"
import * as healthTipsController from "../controllers/healthTips.controller.js"
import * as i18nController from "../controllers/i18n.controller.js"
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
router.post("/api/auth/google", authLimiter, authController.loginWithGoogle)
router.post("/api/auth/email-otp/request", authLimiter, authController.requestEmailOtp)
router.post("/api/auth/email-otp/verify", authLimiter, authController.verifyEmailOtp)
router.post(
  "/api/auth/password-reset/request",
  authLimiter,
  authController.requestPasswordReset
)
router.post(
  "/api/auth/password-reset/confirm",
  authLimiter,
  authController.confirmPasswordReset
)
router.post("/api/auth/otp/request", authLimiter, authController.requestPhoneOtp)
router.post("/api/auth/otp/verify", authLimiter, authController.verifyPhoneOtp)

router.get("/api/users/me", authMiddleware, userController.getMe)
router.patch("/api/users/me", authMiddleware, userController.patchMe)
router.delete("/api/users/me", authMiddleware, userController.deleteMe)
router.post("/api/users/me/phone-otp/request", authMiddleware, userController.requestPhoneChangeOtp)
router.post("/api/users/me/phone-otp/verify", authMiddleware, userController.verifyPhoneChangeOtp)
router.post("/api/users/me/change-password", authMiddleware, userController.changeMyPassword)

router.get("/api/drugs", drugController.listDrugs)
router.get("/api/drugs/:id", drugController.getDrug)
router.get("/api/drugs/:id/safety-check", authMiddleware, drugController.getDrugSafetyCheck)
router.post("/api/drugs", adminOrKeyMiddleware, drugController.createDrug)
router.patch("/api/drugs/:id", adminOrKeyMiddleware, drugController.patchDrug)
router.patch("/api/drugs/:id/restock", adminOrKeyMiddleware, drugController.restockDrug)
router.delete("/api/drugs/:id", adminOrKeyMiddleware, drugController.deleteDrug)

router.get("/api/knowledge/search", knowledgeController.searchKnowledge)
router.get("/api/knowledge/diseases", knowledgeController.listDiseases)
router.get("/api/knowledge/symptoms", knowledgeController.listSymptoms)
router.get("/api/knowledge/drugs", knowledgeController.listKnowledgeDrugs)
router.get("/api/knowledge/diseases/:slug", knowledgeController.getDiseaseDetail)
router.get("/api/knowledge/symptoms/:slug", knowledgeController.getSymptomDetail)
router.get("/api/knowledge/drugs/:idOrSlug", knowledgeController.getKnowledgeDrugDetail)

router.get("/api/health-tips/search", healthTipsController.searchHealthTips)
router.get("/api/health-tips/:slug", healthTipsController.getHealthTipDetail)
router.get("/api/i18n/ui", i18nController.listUiTranslations)

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

router.get("/api/admin/health", adminAuthMiddleware, adminHealthController.getAdminHealth)
router.get("/api/admin/stats", adminAuthMiddleware, adminController.getStats)
router.get("/api/admin/overview", adminAuthMiddleware, adminController.getOverview)
router.get("/api/admin/top-drugs", adminAuthMiddleware, adminController.topDrugs)

router.get(
  "/api/admin/sessions/:sessionId",
  adminAuthMiddleware,
  adminLogsController.getAdminSession
)
router.post(
  "/api/admin/sessions/:sessionId/feedback",
  adminAuthMiddleware,
  adminLogsController.postSessionFeedback
)
router.get(
  "/api/admin/sessions",
  adminAuthMiddleware,
  adminLogsController.listChatSessions
)

router.get(
  "/api/admin/users",
  adminAuthMiddleware,
  adminUsersController.listUsers
)
router.get(
  "/api/admin/users/:id",
  adminAuthMiddleware,
  adminUsersController.getUser
)
router.patch(
  "/api/admin/users/:id",
  adminAuthMiddleware,
  adminUsersController.patchUser
)
router.delete(
  "/api/admin/users/:id",
  adminAuthMiddleware,
  adminUsersController.deleteUser
)
router.post(
  "/api/admin/knowledge/sync/dry-run",
  adminAuthMiddleware,
  knowledgeController.dryRunKnowledgeSheetSync
)
router.post(
  "/api/admin/knowledge/sync",
  adminAuthMiddleware,
  knowledgeController.syncKnowledgeSheet
)
router.get(
  "/api/admin/knowledge/sync/status",
  adminAuthMiddleware,
  knowledgeController.getKnowledgeSyncStatus
)
