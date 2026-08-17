import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireTenant } from "../tenants/tenant.middleware.js";
import { AuthController } from "./auth.controller.js";

const controller = new AuthController();
export const authRouter = Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas; aguarde e tente novamente" } },
});

authRouter.get("/me", asyncHandler(requireTenant), asyncHandler(controller.me.bind(controller)));
authRouter.post("/register", authenticationLimiter, asyncHandler(controller.register.bind(controller)));
authRouter.post("/login", authenticationLimiter, asyncHandler(controller.login.bind(controller)));
authRouter.post("/mfa/verify-login", authenticationLimiter, asyncHandler(controller.completeMfaLogin.bind(controller)));
authRouter.post("/refresh", authenticationLimiter, asyncHandler(controller.refresh.bind(controller)));
authRouter.post("/logout", asyncHandler(requireTenant), asyncHandler(controller.logout.bind(controller)));
authRouter.post("/mfa/setup", asyncHandler(requireTenant), asyncHandler(controller.beginMfaSetup.bind(controller)));
authRouter.post("/mfa/confirm", asyncHandler(requireTenant), asyncHandler(controller.confirmMfa.bind(controller)));
