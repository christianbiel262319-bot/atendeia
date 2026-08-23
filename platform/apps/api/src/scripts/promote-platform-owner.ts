import { z } from "zod";
import { disconnectDatabase, prisma } from "../infra/database/prisma.js";

const email = z.email().parse(process.argv[2] ?? process.env.PLATFORM_OWNER_EMAIL).toLowerCase();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true, emailVerifiedAt: true },
  });
  if (!user) throw new Error("Usuário não encontrado");
  if (user.status !== "ACTIVE") throw new Error("O usuário precisa estar ativo");
  if (!user.emailVerifiedAt) throw new Error("O e-mail do usuário precisa estar verificado");

  await prisma.$transaction(async (tx) => {
    await tx.platformMembership.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: "OWNER", active: true },
      update: { role: "OWNER", active: true },
    });
    await tx.platformAuditLog.create({
      data: {
        actorUserId: user.id,
        targetUserId: user.id,
        action: "platform.owner_promoted",
        metadata: { source: "server_cli" },
      },
    });
  });
  process.stdout.write("Platform Owner configurado com sucesso.\n");
} finally {
  await disconnectDatabase();
}
