import { en } from './en';
import { fr } from './fr';
import type { Alert, Locale } from '../types';

export { en, fr };
export type { Translation } from './en';
export const resources = { en: { translation: en }, fr: { translation: fr } } as const;
export const LOCALES: Locale[] = ['en', 'fr'];

/** Framework-free translate helper: translate('fr', 'alerts.title') with {{param}} interpolation. */
export function translate(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const tree = locale === 'fr' ? fr : en;
  let cur: unknown = tree;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return key;
  }
  if (typeof cur !== 'string') return key;
  return cur.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
}

export function alertMessage(locale: Locale, alert: Alert): string {
  const out = translate(locale, `alerts.messages.${alert.code}`, alert.params);
  return out.startsWith('alerts.messages.') ? alert.message : out;
}
