import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { initials } from '../lib/format';

export function Button({ variant = 'default', size, block, loading, icon: Icon, children, className = '', ...props }) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block',
    !children && Icon && 'btn-icon', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" aria-hidden /> : Icon && <Icon size={size === 'sm' ? 14 : 16} aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Input({ label, error, hint, className = '', ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <input id={id} className={`input ${className}`} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Textarea({ label, error, hint, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <textarea id={id} className="textarea" aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, options, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <select id={id} className="select" {...props}>
        {options.map((o) => (typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </Field>
  );
}

export function Card({ title, actions, children, className = '', bodyClass = 'card-body' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export const Badge = ({ tone, children, ...p }) => <span className={`badge ${tone ? `badge-${tone}` : ''}`} {...p}>{children}</span>;

export function Avatar({ user, size = 36, online }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }} aria-hidden>
      {user?.profileImage ? <img src={user.profileImage} alt="" /> : initials(user)}
      {online && <span className="dot" />}
    </span>
  );
}

export const Skeleton = ({ h = 16, w = '100%', r, style }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden />
);

export function CardSkeletons({ count = 6, height = 150 }) {
  return (
    <div className="cards" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-body stack">
          <Skeleton h={18} w="60%" />
          <Skeleton h={12} />
          <Skeleton h={12} w="80%" />
          <Skeleton h={height - 90} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="state">
      <div className="state-icon"><Icon size={22} /></div>
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 420 }}>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon"><AlertTriangle size={22} /></div>
      <h3>Something went wrong</h3>
      <p style={{ maxWidth: 440 }}>{error?.message || 'Could not load this content.'}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, textarea, select, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-header">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" className="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.icon && <t.icon size={15} />} {t.label}
          {t.count ? <Badge>{t.count}</Badge> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
      <span className="subtle tnum">Page {page} of {pages} · {total} results</span>
      <Button variant="outline" size="sm" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
    </nav>
  );
}

export function Progress({ value, tone, label }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`progress ${tone ? `progress-${tone}` : ''}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function ScoreRing({ score, size = 72, stroke = 7, label = 'Score' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score || 0));
  const color = v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="score-ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ fontSize: size * 0.28 }}>{v}</span>
    </div>
  );
}

export function Chips({ items, tone, empty = '—' }) {
  if (!items?.length) return <span className="subtle">{empty}</span>;
  return <div className="chips">{items.map((s) => <span key={s} className={`chip ${tone ? `chip-${tone}` : ''}`}>{s}</span>)}</div>;
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (message, { title = 'Are you sure?', confirmLabel = 'Confirm', danger = true } = {}) =>
    new Promise((resolve) => setState({ message, title, confirmLabel, danger, resolve }));
  const close = (v) => { state?.resolve(v); setState(null); };
  const dialog = (
    <Modal open={Boolean(state)} onClose={() => close(false)} title={state?.title}
      footer={<>
        <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
        <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirmLabel}</Button>
      </>}>
      <p>{state?.message}</p>
    </Modal>
  );
  return [confirm, dialog];
}
