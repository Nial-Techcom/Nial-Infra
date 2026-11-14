/**
 * Bridge between the web app and the desktop shell.
 * In a browser every method has a plain-web fallback, so components never care where they run.
 */
export interface DesktopBridge {
  isDesktop: true;
  getServerUrl(): Promise<string | null>;
  setServerUrl(url: string): Promise<void>;
  saveFile(name: string, data: ArrayBuffer | string, mime: string): Promise<boolean>;
  openFile(extensions: string[]): Promise<{ name: string; text: string } | null>;
  onMenu(cb: (action: string) => void): () => void;
}

declare global {
  interface Window {
    nialInfraDesktop?: DesktopBridge;
  }
}

export const desktop = typeof window !== 'undefined' ? window.nialInfraDesktop : undefined;
export const isDesktop = !!desktop;

let serverUrl: string | null = null;
export async function initPlatform() {
  if (desktop) serverUrl = await desktop.getServerUrl();
}
export const getServerUrl = () => serverUrl;
export async function setServerUrl(url: string) {
  serverUrl = url.replace(/\/+$/, '');
  await desktop?.setServerUrl(serverUrl);
}

/** API base URL: desktop uses the configured server, the web app uses its own origin (/api/v1). */
export function apiBase(): string {
  if (desktop) return `${serverUrl ?? ''}/api/v1`;
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
}

export async function saveFile(name: string, data: ArrayBuffer | string | Blob, mime: string): Promise<boolean> {
  if (desktop) {
    const payload = data instanceof Blob ? await data.arrayBuffer() : data;
    return desktop.saveFile(name, payload, mime);
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

export async function openTextFile(extensions: string[]): Promise<{ name: string; text: string } | null> {
  if (desktop) return desktop.openFile(extensions);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.map((e) => `.${e}`).join(',');
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function safeName(s: string) {
  return s.replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60) || 'nial-infra';
}
