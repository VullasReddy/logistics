/**
 * ui.jsx
 * ------
 * Small reusable building blocks so every page looks the same:
 *   <PageHeader>, <Modal>, <Field>, <Badge>, <StatusBadge>,
 *   <Pagination>, <Loader>, <Empty>, <Switch>, useToast()
 */
import { createContext, useCallback, useContext, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

/* ------------------------------ Page header ------------------------------ */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="toolbar" style={{ margin: 0 }}>{children}</div>
    </div>
  );
}

/* --------------------------------- Modal --------------------------------- */
export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Form field ------------------------------- */
/** Label + input + error message. Pass any input as children. */
export function Field({ label, error, hint, full, children }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {error ? <div className="error">{error}</div> : hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* --------------------------------- Badges -------------------------------- */
export const Badge = ({ tone = 'gray', children }) => <span className={`badge badge-${tone}`}>{children}</span>;

const STATUS_TONES = {
  ACTIVE: 'success', INACTIVE: 'gray', EXPIRED: 'danger', EXPIRING: 'warning', CANCELLED: 'gray',
  LOGIN: 'success', LOGOUT: 'gray', LOGIN_FAILED: 'danger', CREATE: 'info', UPDATE: 'purple',
  DELETE: 'danger', PASSWORD_CHANGE: 'warning', STATUS_CHANGE: 'warning',
};
export const StatusBadge = ({ value }) => (
  <Badge tone={STATUS_TONES[value] || 'gray'}>{String(value).replace('_', ' ')}</Badge>
);

/* ------------------------------- Pagination ------------------------------ */
export function Pagination({ pagination, onPage }) {
  if (!pagination) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="pagination">
      <span>Showing {from}–{to} of {total}</span>
      <div>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /> Prev</button>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

/* --------------------------- Loader / Empty / Switch --------------------------- */
export const Loader = () => (
  <div className="loader"><Loader2 size={26} className="spin" style={{ animation: 'spin 1s linear infinite' }} /></div>
);
export const Empty = ({ children = 'Nothing to show yet.' }) => <div className="empty">{children}</div>;

export const Switch = ({ checked, onChange, disabled }) => (
  <label className="switch">
    <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span />
  </label>
);

/* --------------------------------- Toasts -------------------------------- */
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500); // auto hide
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast('Saved'); toast('Failed', 'error'); */
export const useToast = () => useContext(ToastContext);
