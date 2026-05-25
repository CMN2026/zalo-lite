import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export class EmailService {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  async sendVerificationCode(email: string, code: string, expiresInMinutes: number) {
    if (!env.SMTP_HOST) {
      if (env.NODE_ENV !== "production") {
        console.log(`[DEV][OTP] ${email}: ${code}`);
        return;
      }
      throw new HttpError(500, "email_service_not_configured");
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <p>Xin chào bạn,</p>
        <p>Mã OTP xác nhận đăng ký tài khoản ZaloLite của bạn là:</p>
        <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p>Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <p>Trân trọng,<br/>ZaloLite</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: "Mã xác nhận từ ZaloLite",
      html,
      text: `Xin chào bạn,\nMã OTP xác nhận đăng ký tài khoản ZaloLite của bạn là: ${code}\nMã có hiệu lực trong ${expiresInMinutes} phút.`,
    });
  }
}
