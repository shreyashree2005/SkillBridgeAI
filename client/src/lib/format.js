export const fullName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');
export const initials = (u) => ((u?.firstName?.[0] || '') + (u?.lastName?.[0] || '')).toUpperCase() || '?';

export const compact = (n) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

export const money = (n, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

export const date = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString(undefined, opts) : '';

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, sec] of units) if (abs >= sec) return rtf.format(-Math.round(s / sec), unit);
  return 'just now';
};

export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const toDateTimeInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export const titleCase = (s = '') => s.replace(/(^|[-\s])(\w)/g, (_, p, c) => `${p === '-' ? ' ' : p}${c.toUpperCase()}`);

export const scoreTone = (s) => (s >= 75 ? 'good' : s >= 50 ? 'warning' : 'danger');
