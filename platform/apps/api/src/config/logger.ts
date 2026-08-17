import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "accessToken",
      "refreshToken",
      "csrfToken",
      "secret",
      "*.password",
      "*.accessToken",
      "*.refreshToken",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
});
