import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '../store/ui';

export function Modal({ title, onClose, children, footer, width = 'max-w-xl' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={`w-full ${width} rounded-lg border border-line bg-panel shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="nf-btn nf-btn-ghost !p-1" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute/80">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${value === t.id ? 'border-access text-ink' : 'border-transparent text-mute hover:text-ink'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ToastHost() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded border px-3 py-2 text-sm shadow-lg ${t.tone === 'error' ? 'border-crit bg-panel text-crit' : 'border-line bg-panel text-ink'}`}>{t.text}</div>
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const { t } = useTranslation();
  const c = useUi((s) => s.confirm);
  const close = useUi((s) => s.closeConfirm);
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-lg border border-line bg-panel p-4 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold">{c.title}</h2>
        <p className="mb-4 text-sm text-mute">{c.message}</p>
        <div className="flex justify-end gap-2">
          <button className="nf-btn" onClick={close} autoFocus>{t('common.cancel')}</button>
          <button className={`nf-btn ${c.danger ? 'nf-btn-danger' : 'nf-btn-primary'}`} onClick={async () => { close(); await c.onConfirm(); }}>{c.confirmLabel ?? t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

export function SeverityDot({ type }: { type: 'critical' | 'warning' | 'info' }) {
  const c = type === 'critical' ? 'bg-crit' : type === 'warning' ? 'bg-warn' : 'bg-info';
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}
