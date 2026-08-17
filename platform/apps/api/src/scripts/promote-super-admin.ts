import { z } from "zod";
import { disconnectDatabase, prisma } from "../infra/database/prisma.js";

const email = z.email().parse(process.env.SUPER_ADMIN_EMAIL).toLowerCase();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      isSuperAdmin: true,
      memberships: { where: { active: true }, select: { tenantId: true }, take: 1 },
    },
  });
  if (!user) throw new Error("Usuário não encontrado");
  if (!user.isSuperAdmin) {
    await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
    const membership = user.memberships[0];
    if (membership) {
      await prisma.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorUserId: user.id,
          action: "super_admin.bootstrap_promoted",
          resourceType: "user",
          resourceId: user.id,
        },
      });
    }
  }
  process.stdout.write("Super administrador configurado com sucesso.\n");
} finally {
  await disconnectDatabase();
}
