import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { KnowledgeController } from "./knowledge.controller.js";

const controller = new KnowledgeController();
export const knowledgeRouter = Router();

knowledgeRouter.use(asyncHandler(requireTenant));
knowledgeRouter.get("/", asyncHandler(controller.list.bind(controller)));
knowledgeRouter.use(requireRoles("OWNER", "ADMIN", "MANAGER"));
knowledgeRouter.post("/products", asyncHandler(controller.createProduct.bind(controller)));
knowledgeRouter.patch("/products/:id", asyncHandler(controller.updateProduct.bind(controller)));
knowledgeRouter.post("/services", asyncHandler(controller.createService.bind(controller)));
knowledgeRouter.patch("/services/:id", asyncHandler(controller.updateService.bind(controller)));
knowledgeRouter.post("/faqs", asyncHandler(controller.createFaq.bind(controller)));
knowledgeRouter.patch("/faqs/:id", asyncHandler(controller.updateFaq.bind(controller)));
knowledgeRouter.put("/business-hours", asyncHandler(controller.upsertHour.bind(controller)));
knowledgeRouter.delete("/:resource/:id", asyncHandler(controller.remove.bind(controller)));
