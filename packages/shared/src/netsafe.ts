/**
 * True when a server address would send passwords and tokens in clear text over a network we cannot vouch for:
 * plain http:// to something that is not localhost, a .local name, a single-label host or a private/link-local IP.
 */
export function isInsecureRemoteUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return false; }
  if (u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home.arpa') || h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith('fe80:')) return false;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return !(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254));
  }
  return h.includes('.'); // "proxmox", "nas" … single-label names are local
}
