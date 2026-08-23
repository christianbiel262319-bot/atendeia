import { z } from "zod";
import { env } from "../config/env.js";
import { disconnectDatabase, prisma } from "../infra/database/prisma.js";

if (env.ATENDEIA_DEPLOYMENT_STAGE !== "homologation") {
  throw new Error("Este comando existe somente para o ambiente de homologação");
}

const email = z
  .email()
  .parse(process.argv[2] ?? process.env.HOMOLOGATION_TEST_EMAIL)
  .toLowerCase();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      status: true,
      emailVerifiedAt: true,
      memberships: { where: { active: true }, select: { tenantId: true } },
    },
  });
  if (!user) throw new Error("Usuário de homologação não encontrado");
  if (user.status !== "ACTIVE") throw new Error("O usuário precisa estar ativo");
  if (user.memberships.length === 0) throw new Error("O usuário não possui empresa ativa");

  const verifiedAt = user.emailVerifiedAt ?? new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: verifiedAt } });
    await tx.auditLog.createMany({
      data: user.memberships.map(({ tenantId }) => ({
        tenantId,
        actorUserId: user.id,
        action: "auth.homologation_email_verified",
        resourceType: "user",
        resourceId: user.id,
        metadata: { source: "server_cli" },
      })),
    });
  });
  process.stdout.write("E-mail de teste verificado em homologação.\n");
} finally {
  await disconnectDatabase();
}
