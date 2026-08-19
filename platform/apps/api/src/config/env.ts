import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalSecret = (minimum = 16) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(minimum).optional(),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default("atendeia-api"),
  JWT_AUDIENCE: z.string().min(1).default("atendeia-web"),
  SECRETS_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, {
      message: "SECRETS_ENCRYPTION_KEY deve conter exatamente 32 bytes em base64",
    }),
  COOKIE_SECURE: booleanFromString.default(true),
  TRUST_PROXY: booleanFromString.default(false),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v26.0"),
  META_APP_SECRET: optionalSecret(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalSecret(),
  OPENAI_API_KEY: optionalSecret(20),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  STRIPE_SECRET_KEY: optionalSecret(),
  STRIPE_WEBHOOK_SECRET: optionalSecret(),
  MERCADO_PAGO_ACCESS_TOKEN: optionalSecret(),
  MERCADO_PAGO_WEBHOOK_SECRET: optionalSecret(),
  ASAAS_API_KEY: optionalSecret(),
  ASAAS_WEBHOOK_TOKEN: optionalSecret(),
  ASAAS_API_URL: z.url().default("https://api.asaas.com/v3"),
  CLOUDINARY_CLOUD_NAME: optionalSecret(1),
  CLOUDINARY_API_KEY: optionalSecret(1),
  CLOUDINARY_API_SECRET: optionalSecret(),
});

export type Environment = z.infer<typeof envSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuração de ambiente inválida: ${details}`);
  }
  return parsed.data;
}

export const env = parseEnvironment(process.env);
