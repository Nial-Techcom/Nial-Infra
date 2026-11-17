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
const wrap = (body: string) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">${body}<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="color:#888;font-size:12px">Nial-Infra</p></div>`;
const button = (href: string, label: string) => `<p><a href="${esc(href)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(label)}</a></p><p style="font-size:12px;color:#666;word-break:break-all">${esc(href)}</p>`;

const clean = (v: string) => v.replace(/[\r\n\u2028\u2029]+/g, ' '); // never let a name inject mail headers

export function inviteMail(rawClientName: string, role: string, link: string, rawInviter?: string | null) {
  const clientName = clean(rawClientName);
  const inviter = rawInviter ? clean(rawInviter) : '';
  const edit = role === 'technician';
  const rightsFr = edit ? 'modifier le client' : 'consulter le client (lecture seule)';
  const rightsEn = edit ? 'edit the client' : 'view the client (read-only)';
  const whoFr = inviter ? `${inviter} vous invite` : 'Vous êtes invité(e)';
  const whoEn = inviter ? `${inviter} invites you` : 'You are invited';
  return {
    subject: `Nial-Infra – ${inviter ? `${inviter} partage « ${clientName} » avec vous` : `invitation : ${clientName}`}`,
    text: `FR : ${whoFr} à rejoindre le client « ${clientName} » : il sera ajouté à vos données. Vous pourrez ${rightsFr}.\nCréez votre compte ou connectez-vous pour accepter : ${link}\nCe lien expire dans 7 jours.\n\nEN: ${whoEn} to join the client "${clientName}": it will be added to your data. You will be able to ${rightsEn}.\nCreate your account or sign in to accept: ${link}\nThis link expires in 7 days.`,
    html: wrap(`<h2>${inviter ? `${esc(inviter)} partage un client avec vous` : 'Invitation Nial-Infra'}</h2><p>${esc(whoFr)} à rejoindre le client <b>${esc(clientName)}</b> : il sera ajouté à vos données. Vous pourrez <b>${esc(rightsFr)}</b>. Le lien expire dans 7 jours.</p><p style="color:#555">${esc(whoEn)} to join the client <b>${esc(clientName)}</b>: it will be added to your data. You will be able to <b>${esc(rightsEn)}</b>. The link expires in 7 days.</p>${button(link, 'Accepter / Accept')}`),
  };
}

export function resetMail(link: string) {
  return {
    subject: 'Nial-Infra – réinitialisation du mot de passe / password reset',
    text: `FR : Pour choisir un nouveau mot de passe, ouvrez : ${link}\nLe lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nEN: To choose a new password open: ${link}\nThe link is valid for 1 hour. If you did not ask for this, ignore this message.`,
    html: wrap(`<h2>Mot de passe oublié</h2><p>Cliquez pour choisir un nouveau mot de passe (valable 1 heure). Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p><p style="color:#555">Click to choose a new password (valid for 1 hour). If you did not request this, ignore this message.</p>${button(link, 'Nouveau mot de passe / New password')}`),
  };
}
