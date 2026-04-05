import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER
    ? {
        user: SMTP_USER,
        pass: SMTP_PASS,
      }
    : undefined,
});

export class EmailService {
  async sendVerificationEmail(to: string, link: string) {
    const subject = "Xác thực email - OTT Care";
    const html = `
      <p>Xin chào,</p>
      <p>Vui lòng nhấn vào liên kết dưới đây để xác thực email:</p>
      <p><a href="${link}">Xác thực email</a></p>
      <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    `;

    return transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
  }
}
