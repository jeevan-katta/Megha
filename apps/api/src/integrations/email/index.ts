import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../config';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface EmailProvider {
  name: string;
  send(message: OutgoingEmail): Promise<void>;
}

/** Writes each email to a file so it can be read locally; nothing leaves the machine. */
const developmentProvider: EmailProvider = {
  name: 'development',
  async send(message) {
    await mkdir(config.emailOutbox, { recursive: true });
    const file = path.join(
      config.emailOutbox,
      new Date().toISOString().replace(/[:.]/g, '-') +
        '-' +
        message.to.replace(/[^a-z0-9@.-]/gi, '_') +
        '.txt',
    );
    await writeFile(
      file,
      `From: ${config.emailFrom}\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
    );
  },
};

let transport: Transporter | undefined;
/** Any SMTP service (Gmail, Zoho, Brevo, Amazon SES, …). */
const smtpProvider: EmailProvider = {
  name: 'smtp',
  async send(message) {
    transport ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    await transport.sendMail({ from: config.emailFrom, ...message });
  },
};

export const emailProvider: EmailProvider | null =
  config.email === 'smtp'
    ? smtpProvider
    : config.email === 'development'
      ? developmentProvider
      : null;
