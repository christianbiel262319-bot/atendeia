import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireTenant } from "../tenants/tenant.middleware.js";
import { CrmController } from "./crm.controller.js";

const controller = new CrmController();
export const crmRouter = Router();

crmRouter.use(asyncHandler(requireTenant));
crmRouter.get("/contacts", asyncHandler(controller.list.bind(controller)));
crmRouter.patch("/contacts/:id", asyncHandler(controller.update.bind(controller)));
