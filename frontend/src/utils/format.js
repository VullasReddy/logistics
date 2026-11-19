/**
 * format.js - small display helpers used across pages.
 */

/** ₹2,499 (Indian number grouping) */
export const formatINR = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** 1,240 */
export const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');

/** 19 Nov 2026 */
export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** 19 Nov 2026, 10:42 am */
export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** "2 min ago", "3 hours ago", "5 days ago" */
export function timeAgo(value) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const units = [['day', 86400], ['hour', 3600], ['min', 60]];
  for (const [name, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${name}${n > 1 && name !== 'min' ? 's' : ''} ago`;
  }
  return 'just now';
}

/** "Rahul Kumar" -> "RK" */
export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Today's date as YYYY-MM-DD in local time (for <input type="date">) */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
