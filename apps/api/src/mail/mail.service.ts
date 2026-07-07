import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";

/**
 * Verification / reset mail. With SMTP_HOST configured this sends real mail;
 * without it (local dev, CI) it logs the full action link so the flow stays
 * exercisable end-to-end. The e2e suite reads links through a test hook.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  /** Test hook: last links per recipient (populated only when SMTP is off). */
  readonly devOutbox = new Map<string, { subject: string; url: string }>();

  constructor() {
    this.transporter = env.smtp.host
      ? nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.port === 465,
          auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
        })
      : null;
    if (!this.transporter)
      this.logger.warn("SMTP not configured — mail links will be logged to the console (dev mode).");
  }

  private async deliver(to: string, subject: string, url: string, intro: string): Promise<void> {
    if (!this.transporter) {
      this.devOutbox.set(to, { subject, url });
      this.logger.log(`✉ [dev] ${subject} → ${to}\n    ${url}`);
      return;
    }
    await this.transporter.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text: `${intro}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>${intro}</p><p><a href="${url}">${url}</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
  }

  sendEmailVerification(to: string, token: string): Promise<void> {
    const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    return this.deliver(to, "Verify your JSL Imports email", url, "Confirm your email address to continue:");
  }

  sendPasswordReset(to: string, token: string): Promise<void> {
    const url = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return this.deliver(to, "Reset your JSL Imports password", url, "Use the link below to choose a new password (valid for 1 hour):");
  }
}
