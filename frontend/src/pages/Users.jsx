/**
 * Users.jsx  (Module 2 - User Creation and Management)
 * ---------
 * List + search + filters, create/edit form, activate/deactivate,
 * reset password. Buttons only appear if the role allows them.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, KeyRound, Power } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Field, Badge, Pagination, Loader, Empty, useToast } from '../components/ui';
import { formatDateTime, initials } from '../utils/format';

const EMPTY_FORM = { full_name: '', email: '', phone: '', role_id: '', branch_id: '', password: '' };

/** Create / edit form inside a modal. */
function UserForm({ user, roles, branches, onClose, onSaved }) {
  const isEdit = !!user;
  const toast = useToast();
  const [form, setForm] = useState(isEdit
    ? { full_name: user.full_name, email: user.email, phone: user.phone || '', role_id: user.role_id, branch_id: user.branch_id || '' }
    : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setSaving(true);
    setErrors({});
    // Convert empty dropdowns to null so the backend stores "no branch"
    const body = { ...form, branch_id: form.branch_id ? Number(form.branch_id) : null, role_id: Number(form.role_id) || undefined };
    try {
      if (isEdit) {
        await api.put(`/users/${user.id}`, body);
        toast('User updated');
        onSaved();
      } else {
        const { data } = await api.post('/users', body);
        toast('User created');
        if (data.tempPassword) setTempPassword(data.tempPassword); // show once
        else onSaved();
      }
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (tempPassword) {
    return (
      <Modal title="User created" onClose={onSaved} footer={<button className="btn btn-primary" onClick={onSaved}>Done</button>}>
        <p style={{ marginBottom: 14 }}>Share this temporary password with <b>{form.full_name}</b>. It is shown only once.
          They will be asked to set a new password at first login.</p>
        <div className="temp-password"><code>{tempPassword}</code></div>
      </Modal>
    );
  }

  return (
    <Modal title={isEdit ? 'Edit user' : 'Add new user'} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save user'}</button>
      </>}>
      <div className="form-grid">
        <Field label="Full name *" error={errors.full_name}>
          <input className="input" value={form.full_name} onChange={set('full_name')} placeholder="e.g. Rahul Kumar" />
        </Field>
        <Field label="Email *" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" />
        </Field>
        <Field label="Mobile number" error={errors.phone}>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" maxLength={10} />
        </Field>
        <Field label="Role *" error={errors.role_id}>
          <select className="select" value={form.role_id} onChange={set('role_id')}>
            <option value="">Select role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Branch" error={errors.branch_id} hint="Leave empty for head office">
          <select className="select" value={form.branch_id} onChange={set('branch_id')}>
            <option value="">Head office (no branch)</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {!isEdit && (
          <Field label="Password" error={errors.password} hint="Leave empty to generate a temporary password">
            <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Optional" />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export default function Users() {
  const { can, user: me } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();

  const [filters, setFilters] = useState({ search: params.get('search') || '', role_id: '', branch_id: '', status: '', page: 1 });
  const [result, setResult] = useState(null);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [resetInfo, setResetInfo] = useState(null);

  const load = useCallback(() => {
    api.get('/users', { params: filters }).then(({ data }) => setResult(data)).catch((e) => toast(errorMessage(e), 'error'));
  }, [filters, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 250); // small delay while typing in search
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    api.get('/roles').then(({ data }) => setRoles(data)).catch(() => {});
    api.get('/branches').then(({ data }) => setBranches(data)).catch(() => {});
  }, []);

  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });

  const toggleStatus = async (u) => {
    try {
      await api.patch(`/users/${u.id}/status`, { is_active: !u.is_active });
      toast(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const resetPassword = async (u) => {
    if (!window.confirm(`Reset password for ${u.full_name}? Their current password will stop working.`)) return;
    try {
      const { data } = await api.post(`/users/${u.id}/reset-password`);
      setResetInfo({ name: u.full_name, password: data.tempPassword });
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="User Management" subtitle="Create users, assign roles and branches, control access">
        {can('USER_CREATE') && <button className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={17} /> Add User</button>}
      </PageHeader>

      <div className="card">
        <div className="toolbar">
          <div className="search-box" style={{ boxShadow: 'none', border: '1px solid var(--border)', padding: '8px 14px', flex: '0 1 300px' }}>
            <Search size={17} />
            <input value={filters.search} onChange={setFilter('search')} placeholder="Search name, email, phone" />
          </div>
          <select className="select" style={{ width: 180 }} value={filters.role_id} onChange={setFilter('role_id')}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="select" style={{ width: 210 }} value={filters.branch_id} onChange={setFilter('branch_id')}>
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="select" style={{ width: 140 }} value={filters.status} onChange={setFilter('status')}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {!result ? <Loader /> : result.data.length === 0 ? <Empty>No users match these filters.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>User</th><th>Phone</th><th>Role</th><th>Branch</th><th>Status</th><th>Last login</th><th /></tr>
              </thead>
              <tbody>
                {result.data.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <span className="avatar">{initials(u.full_name)}</span>
                        <div><b>{u.full_name}</b><div className="small muted">{u.email}</div></div>
                      </div>
                    </td>
                    <td className="nowrap">{u.phone || '—'}</td>
                    <td><Badge tone="purple">{u.role_name}</Badge></td>
                    <td>{u.branch_name || <span className="muted">Head office</span>}</td>
                    <td>{u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</td>
                    <td className="small muted nowrap">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}</td>
                    <td>
                      <div className="actions">
                        {can('USER_UPDATE') && <button className="btn btn-icon" title="Edit user" aria-label="Edit user" onClick={() => setEditing(u)}><Pencil size={15} /></button>}
                        {can('USER_UPDATE') && <button className="btn btn-icon" title="Reset password" aria-label="Reset password" onClick={() => resetPassword(u)}><KeyRound size={15} /></button>}
                        {can('USER_STATUS') && u.id !== me.id && (
                          <button className={`btn btn-icon ${u.is_active ? 'danger' : 'success'}`} title={u.is_active ? 'Deactivate' : 'Activate'}
                            aria-label={u.is_active ? 'Deactivate user' : 'Activate user'} onClick={() => toggleStatus(u)}>
                            <Power size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination pagination={result?.pagination} onPage={(page) => setFilters({ ...filters, page })} />
      </div>

      {editing !== undefined && (
        <UserForm user={editing} roles={roles} branches={branches}
          onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />
      )}

      {resetInfo && (
        <Modal title="Password reset" onClose={() => setResetInfo(null)} footer={<button className="btn btn-primary" onClick={() => setResetInfo(null)}>Done</button>}>
          <p style={{ marginBottom: 14 }}>New temporary password for <b>{resetInfo.name}</b> (shown once):</p>
          <div className="temp-password"><code>{resetInfo.password}</code></div>
        </Modal>
      )}
    </>
  );
}
