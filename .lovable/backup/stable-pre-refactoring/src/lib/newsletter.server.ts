import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

/** Server-only: versendet die Double-Opt-in-Bestätigung. */
export async function sendNewsletterConfirmation(
  email: string,
  token: string,
  language: string,
  origin: string,
): Promise<boolean> {
  const confirmUrl = `${origin.replace(/\/$/, "")}/newsletter/confirm?token=${encodeURIComponent(token)}`;
  try {
    const result = await sendTemplateEmail("newsletter-confirm", email, {
      templateData: { confirmUrl, language },
      idempotencyKey: `newsletter-confirm-${token}`,
    });
    return result.sent;
  } catch (error) {
    if (error instanceof EmailAPIError) {
      console.error("newsletter confirmation email failed", error.code, error.status);
      return false;
    }
    throw error;
  }
}
