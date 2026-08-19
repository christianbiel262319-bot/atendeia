import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { CrmController } from "./crm.controller.js";

const controller = new CrmController();
const operationalRoles = requireRoles("OWNER", "ADMIN", "MANAGER", "AGENT");
export const crmRouter = Router();

crmRouter.use(asyncHandler(requireTenant));
crmRouter.get("/contacts", asyncHandler(controller.list.bind(controller)));
crmRouter.get("/contacts/:id", asyncHandler(controller.get.bind(controller)));
crmRouter.post("/contacts", operationalRoles, asyncHandler(controller.create.bind(controller)));
crmRouter.patch("/contacts/:id", operationalRoles, asyncHandler(controller.update.bind(controller)));
crmRouter.post("/contacts/:id/notes", operationalRoles, asyncHandler(controller.addNote.bind(controller)));
crmRouter.delete("/contacts/:id/notes/:noteId", operationalRoles, asyncHandler(controller.removeNote.bind(controller)));
crmRouter.delete("/contacts/:id", operationalRoles, asyncHandler(controller.archive.bind(controller)));
crmRouter.post("/contacts/:id/restore", operationalRoles, asyncHandler(controller.restore.bind(controller)));
