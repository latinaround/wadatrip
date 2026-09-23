type EmailOptions = {
  to: string;
  from: string;
  subject: string;
  text: string;
  logScope: string;
};

type EmailResult = { sent: boolean; reason?: 'email_not_configured' | 'email_failed' | 'email_error' };

const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'sendgrid')).toLowerCase();
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';

function configured() {
  return Boolean(process.env.EMAIL_FROM && ((EMAIL_PROVIDER === 'resend' && RESEND_API_KEY) || (EMAIL_PROVIDER === 'sendgrid' && SENDGRID_API_KEY)));
}

export async function sendTransactionalEmail(options: EmailOptions): Promise<EmailResult> {
  if (!configured()) return { sent: false, reason: 'email_not_configured' };

  try {
    const isResend = EMAIL_PROVIDER === 'resend';
    const response = await fetch(isResend ? 'https://api.resend.com/emails' : 'https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${isResend ? RESEND_API_KEY : SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(isResend
        ? { from: options.from, to: [options.to], subject: options.subject, text: options.text }
        : {
            personalizations: [{ to: [{ email: options.to }] }],
            from: { email: options.from },
            subject: options.subject,
            content: [{ type: 'text/plain', value: options.text }],
          }),
    });

    if (!response.ok) {
      console.error(`[${options.logScope}] Email failed`, response.status);
      return { sent: false, reason: 'email_failed' };
    }
    return { sent: true };
  } catch (error: any) {
    console.error(`[${options.logScope}] Email error`, error?.message || error);
    return { sent: false, reason: 'email_error' };
  }
}
