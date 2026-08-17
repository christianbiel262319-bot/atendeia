import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { constantTimeEqual } from "../../core/security/crypto.js";
import type { TenantContext } from "../../core/tenant/tenant-context.js";
import { prisma } from "../../infra/database/prisma.js";
import type { z } from "zod";
import type { registerMediaSchema } from "./media.schemas.js";

export class MediaService {
  signature(context: TenantContext) {
    const config = cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1_000);
    const folder = `atendeia/${context.tenantId}`;
    return {
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      timestamp,
      folder,
      signature: cloudinarySignature({ folder, timestamp }, config.apiSecret),
    };
  }

  list(context: TenantContext) {
    return prisma.mediaAsset.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async register(context: TenantContext, input: z.infer<typeof registerMediaSchema>) {
    const config = cloudinaryConfig();
    const folder = `atendeia/${context.tenantId}/`;
    if (!input.publicId.startsWith(folder)) {
      throw new AppError(422, "INVALID_MEDIA_FOLDER", "O arquivo não pertence à pasta desta empresa");
    }
    if (!input.secureUrl.startsWith(`https://res.cloudinary.com/${config.cloudName}/`)) {
      throw new AppError(422, "INVALID_MEDIA_URL", "URL de mídia inválida");
    }
    const expected = cloudinarySignature(
      { public_id: input.publicId, version: input.version },
      config.apiSecret,
    );
    if (!constantTimeEqual(expected, input.signature.toLowerCase())) {
      throw new AppError(401, "INVALID_MEDIA_SIGNATURE", "Assinatura de mídia inválida");
    }
    const asset = await prisma.mediaAsset.upsert({
      where: { tenantId_publicId: { tenantId: context.tenantId, publicId: input.publicId } },
      create: {
        tenantId: context.tenantId,
        createdByUserId: context.userId,
        publicId: input.publicId,
        secureUrl: input.secureUrl,
        resourceType: input.resourceType,
        format: input.format ?? null,
        bytes: input.bytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
      },
      update: {
        secureUrl: input.secureUrl,
        resourceType: input.resourceType,
        format: input.format ?? null,
        bytes: input.bytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
      },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "media.registered",
        resourceType: "media_asset",
        resourceId: asset.id,
      },
    });
    return asset;
  }

  async remove(context: TenantContext, id: string): Promise<void> {
    const config = cloudinaryConfig();
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, tenantId: context.tenantId },
    });
    if (!asset) throw new AppError(404, "NOT_FOUND", "Mídia não encontrada");
    const timestamp = Math.floor(Date.now() / 1_000);
    const body = new URLSearchParams({
      public_id: asset.publicId,
      timestamp: String(timestamp),
      api_key: config.apiKey,
      signature: cloudinarySignature({ public_id: asset.publicId, timestamp }, config.apiSecret),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${asset.resourceType}/destroy`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(20_000) },
    );
    if (!response.ok) throw new AppError(502, "MEDIA_PROVIDER_ERROR", "Não foi possível remover a mídia");
    await prisma.$transaction([
      prisma.mediaAsset.deleteMany({ where: { id, tenantId: context.tenantId } }),
      prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: "media.deleted",
          resourceType: "media_asset",
          resourceId: id,
        },
      }),
    ]);
  }
}

export function cloudinarySignature(
  parameters: Record<string, string | number>,
  secret: string,
): string {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${secret}`, "utf8").digest("hex");
}

function cloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Cloudinary ainda não foi configurado");
  }
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}
