import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

export class MetaWhatsAppClient {
  async inspectPhoneNumber(phoneNumberId: string, accessToken: string) {
    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}`);
    url.searchParams.set("fields", "display_phone_number,verified_name");
    return this.request<{ id: string; display_phone_number?: string; verified_name?: string }>(url, accessToken);
  }

  async sendText(input: { phoneNumberId: string; accessToken: string; to: string; body: string }) {
    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(input.phoneNumberId)}/messages`);
    return this.request<{ messaging_product: "whatsapp"; messages: Array<{ id: string }> }>(
      url,
      input.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to,
          type: "text",
          text: { preview_url: false, body: input.body },
        }),
      },
    );
  }

  private async request<T>(url: URL, accessToken: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await response.json().catch(() => ({}))) as T & GraphError;
    if (!response.ok) {
      throw new AppError(
        502,
        "META_API_ERROR",
        "A Meta recusou a conexão. Verifique o número e as permissões do token.",
        { providerCode: payload.error?.code, providerSubcode: payload.error?.error_subcode },
      );
    }
    return payload;
  }
}
