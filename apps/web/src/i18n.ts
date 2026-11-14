import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { resources } from '@nial-infra/shared';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: resources as never,
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'nf.lang', caches: ['localStorage'] },
  });

export default i18n;
