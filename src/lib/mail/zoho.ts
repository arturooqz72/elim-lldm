import "server-only";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;

  if (!user || !pass) {
    throw new Error("ZOHO_SMTP_USER y ZOHO_SMTP_PASS no están configurados");
  }

  transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendZohoMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const from = process.env.ZOHO_SMTP_USER;
  await getTransporter().sendMail({
    from: `"Elim LLDM" <${from}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
