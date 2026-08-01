type SendResult = {
  ok: boolean;
  mode: "resend" | "log";
  error?: string;
};

/**
 * Send a transactional email.
 * Prefer Resend (RESEND_API_KEY). If unset, log the content server-side
 * so ops can recover a verification code from PM2 logs during bootstrap.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || "Forge Regex <onboarding@resend.dev>";

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [opts.to],
          subject: opts.subject,
          text: opts.text,
          html: opts.html ?? `<pre>${escapeHtml(opts.text)}</pre>`,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[email/resend]", res.status, body);
        return { ok: false, mode: "resend", error: body.slice(0, 200) };
      }
      return { ok: true, mode: "resend" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      console.error("[email/resend]", message);
      return { ok: false, mode: "resend", error: message };
    }
  }

  console.info(
    "[email/log] No RESEND_API_KEY — message logged below\n" +
      `to: ${opts.to}\nsubject: ${opts.subject}\n${opts.text}`
  );
  return { ok: true, mode: "log" };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
