import nodemailer from "nodemailer";
export async function sendMail(to, subject, text) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER)
    return { sent: false };
  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
  return { sent: true };
}
