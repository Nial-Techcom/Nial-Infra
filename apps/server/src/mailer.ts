import nodemailer from 'nodemailer';
import type { Pool } from 'pg';
import type { Config } from './config';
import { decrypt } from './crypto';
import { HttpError } from './errors';
import * as store from './store';

/** Test hook: lets the test-suite capture mails instead of opening a network connection. */
export const mailerHooks = { createTransport: nodemailer.createTransport as (o: any) => { sendMail(m: any): Promise<unknown> } };

export const smtpReady = (s: store.StoredSmtp) => !!s.host && !!s.from;
export const baseUrl = (s: store.StoredSettings, cfg: Config) => (s.publicUrl || cfg.publicUrl || '').replace(/\/+$/, '');

export async function sendMail(pool: Pool, cfg: Config, m: { to: string; subject: string; text: string; html: string }) {
  const st = await store.settings.get(pool);
  if (!smtpReady(st.smtp)) throw new HttpError(400, 'SMTP is not configured');
  const t = mailerHooks.createTransport({
    host: st.smtp.host, port: st.smtp.port, secure: st.smtp.secure,
    auth: st.smtp.user ? { user: st.smtp.user, pass: st.smtp.passwordEnc ? decrypt(st.smtp.passwordEnc, cfg.encryptionKey) : '' } : undefined,
    // Port 587 must upgrade to TLS (STARTTLS): without this a network attacker could strip it and read the SMTP password.
    requireTLS: !st.smtp.secure && st.smtp.port === 587,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  await t.sendMail({ from: st.smtp.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const wrap = (body: string) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">${body}<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="color:#888;font-size:12px">NetForge</p></div>`;
const button = (href: string, label: string) => `<p><a href="${esc(href)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(label)}</a></p><p style="font-size:12px;color:#666;word-break:break-all">${esc(href)}</p>`;

export function inviteMail(rawClientName: string, role: string, link: string) {
  const clientName = rawClientName.replace(/[\r\n\u2028\u2029]+/g, ' '); // never let a name inject mail headers
  const roleFr = role === 'technician' ? 'technicien' : 'lecteur';
  return {
    subject: `NetForge – invitation : ${clientName}`,
    text: `FR : Vous êtes invité(e) à rejoindre le client « ${clientName} » (rôle : ${roleFr}).\nCréez votre compte ou connectez-vous : ${link}\nCe lien expire dans 7 jours.\n\nEN: You are invited to join the client "${clientName}" (role: ${role}).\nCreate your account or sign in: ${link}\nThis link expires in 7 days.`,
    html: wrap(`<h2>Invitation NetForge</h2><p>Vous êtes invité(e) à rejoindre le client <b>${esc(clientName)}</b> (rôle : ${roleFr}). Le lien expire dans 7 jours.</p><p style="color:#555">You are invited to join the client <b>${esc(clientName)}</b> (role: ${esc(role)}). The link expires in 7 days.</p>${button(link, 'Rejoindre / Join')}`),
  };
}

export function resetMail(link: string) {
  return {
    subject: 'NetForge – réinitialisation du mot de passe / password reset',
    text: `FR : Pour choisir un nouveau mot de passe, ouvrez : ${link}\nLe lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nEN: To choose a new password open: ${link}\nThe link is valid for 1 hour. If you did not ask for this, ignore this message.`,
    html: wrap(`<h2>Mot de passe oublié</h2><p>Cliquez pour choisir un nouveau mot de passe (valable 1 heure). Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p><p style="color:#555">Click to choose a new password (valid for 1 hour). If you did not request this, ignore this message.</p>${button(link, 'Nouveau mot de passe / New password')}`),
  };
}
