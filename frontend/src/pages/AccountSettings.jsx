/**
 * AccountSettings.jsx  (Module 1 - Password management)
 * -------------------
 * Every logged-in user can see their account and change their password.
 * If an admin created/reset the account with a temporary password,
 * the user is sent here and must change it before using the app.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert, Check, X } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Field, Badge, useToast } from '../components/ui';
import { formatDateTime } from '../utils/format';

// Same rules as the backend (auth.routes.js), shown live while typing
const RULES = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['An upper case letter', (p) => /[A-Z]/.test(p)],
  ['A lower case letter', (p) => /[a-z]/.test(p)],
  ['A number', (p) => /\d/.test(p)],
  ['A special character', (p) => /[^A-Za-z0-9]/.test(p)],
];

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const forced = user.must_change_password;

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setErrors({ confirm: 'Passwords do not match' }); return; }
    setSaving(true);
    setErrors({});
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      await refreshUser();
      if (forced) navigate('/');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and password" />
      {forced && (
        <div className="alert alert-error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ShieldAlert size={18} /> You are using a temporary password. Please set a new password to continue.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>My account</h2>
          <dl className="kv">
            <dt>Name</dt><dd><b>{user.full_name}</b></dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Phone</dt><dd>{user.phone || '—'}</dd>
            <dt>Role</dt><dd><Badge tone="purple">{user.role_name}</Badge></dd>
            <dt>Branch</dt><dd>{user.branch_name || 'Head office'}</dd>
            <dt>Last login</dt><dd>{formatDateTime(user.last_login_at)}</dd>
            <dt>Permissions</dt><dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{user.permissions.map((p) => <Badge key={p}>{p}</Badge>)}</dd>
          </dl>
        </div>

        <form className="card" onSubmit={submit}>
          <h2 style={{ marginBottom: 14 }}><KeyRound size={18} /> Change password</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Current password" error={errors.currentPassword}>
              <input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
            </Field>
            <Field label="New password" error={errors.newPassword}>
              <input className="input" type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
            </Field>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 4, fontSize: 13 }}>
              {RULES.map(([label, test]) => {
                const ok = test(form.newPassword);
                return <li key={label} style={{ color: ok ? 'var(--green)' : 'var(--text-muted)' }}>{ok ? <Check size={13} /> : <X size={13} />} {label}</li>;
              })}
            </ul>
            <Field label="Confirm new password" error={errors.confirm}>
              <input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </Field>
            <button className="btn btn-primary" disabled={saving || !RULES.every(([, t]) => t(form.newPassword))}>
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
