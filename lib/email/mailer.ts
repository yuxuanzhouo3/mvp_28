import nodemailer from "nodemailer";

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.AUTH_EMAIL_SMTP_HOST,
      port: parseInt(process.env.AUTH_EMAIL_SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.AUTH_EMAIL_SMTP_USER,
        pass: process.env.AUTH_EMAIL_SMTP_PASS,
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.AUTH_EMAIL_FROM,
        to: email,
        subject: "邮箱验证码",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">邮箱验证码</h2>
            <p style="font-size: 16px; color: #666;">您的验证码是：</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #999;">验证码5分钟内有效，请勿泄露给他人。</p>
          </div>
        `,
      });
      return true;
    } catch (error) {
      console.error("发送邮件失败:", error);
      return false;
    }
  }
}
