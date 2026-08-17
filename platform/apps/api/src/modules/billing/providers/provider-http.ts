import { AppError } from "../../../core/errors/app-error.js";
import { logger } from "../../../config/logger.js";

export async function providerRequest<T>(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    logger.error({ error, provider }, "Billing provider request failed");
    throw new AppError(502, "BILLING_PROVIDER_UNAVAILABLE", `O provedor ${provider} está indisponível`);
  }

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    logger.warn({ provider, status: response.status }, "Billing provider rejected request");
    throw new AppError(502, "BILLING_PROVIDER_ERROR", `O provedor ${provider} recusou a operação`);
  }
  return payload as T;
}
