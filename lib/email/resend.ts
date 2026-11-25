import { logSafeError } from "../security/safe-log";

type TransactionalEmail = { to: string; subject: string; html: string };
export type EmailDeliveryResult = { sent: true } | { sent: false; reason: "not_configured" | "provider_rejected" | "network_error" };

async function getSafeProviderErrorType(response: Response): Promise<string | undefined> {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

    const candidate = "name" in payload ? payload.name : undefined;
    if (typeof candidate !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(candidate)) {
      return undefined;
    }
    return candidate.toLowerCase();
  } catch {
    return undefined;
  }
}

export async function sendTransactionalEmail(message: TransactionalEmail): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("Transactional email configuration is incomplete", {
      provider: "resend",
      apiKeyConfigured: Boolean(apiKey),
      fromConfigured: Boolean(from),
    });
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const providerErrorType = await getSafeProviderErrorType(response);
      console.error("Transactional email provider rejected request", {
        provider: "resend",
        status: response.status,
        ...(providerErrorType ? { providerErrorType } : {}),
      });
      return { sent: false, reason: "provider_rejected" };
    }

    return { sent: true };
  } catch (error) {
    logSafeError("Transactional email network request failed", error);
    return { sent: false, reason: "network_error" };
  }
}

export function getPublicAppUrl(): string | null {
  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
  try { const url = new URL(raw); if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null; return url.origin; }
  catch { return null; }
}
