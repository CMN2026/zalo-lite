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

  async sendPasswordResetLink(email: string, resetLink: string, expiresInMinutes: number) {
    if (!env.SMTP_HOST) {
      if (env.NODE_ENV !== "production") {
        console.log(`[DEV][RESET_LINK] ${email}: ${resetLink}`);
        return;
      }
      throw new HttpError(500, "email_service_not_configured");
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <p>Xin chào bạn,</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ZaloLite.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            Đặt lại mật khẩu
          </a>
        </p>
        <p>Liên kết này có hiệu lực trong <strong>${expiresInMinutes} phút</strong>.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
        <p>Trân trọng,<br/>ZaloLite</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: "Đặt lại mật khẩu ZaloLite",
      html,
      text: `Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ZaloLite.\nMở liên kết sau để đặt mật khẩu mới (hiệu lực ${expiresInMinutes} phút): ${resetLink}`,
    });
  }
}
