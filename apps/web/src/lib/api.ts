import { createApi, ApiError } from '@infra-tech/shared';
import { apiBase } from './platform';
import { useAuth } from '../store/auth';

export const api = createApi({
  get baseUrl() {
    return apiBase();
  },
  getToken: () => useAuth.getState().token,
  onUnauthorized: () => useAuth.getState().logout(),
});

/** Human message for an error, translated for the common cases. */
export function errorText(e: unknown, t: (k: string) => string): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return t('errors.network');
    if (e.status === 401) return t('errors.unauthorized');
    if (e.status === 403) return t('errors.forbidden');
    return e.message;
  }
  return e instanceof Error ? e.message : t('errors.generic');
}
