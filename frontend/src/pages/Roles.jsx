/**
 * Roles.jsx  (Module 3 - Role-Based Access Control)
 * ---------
 * Shows every role as a card. Create/edit opens a permission matrix
 * grouped by module (Users, Branches, ...) with "select all" per group.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Pencil, Trash2, Lock, Users as UsersIcon } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Field, Badge, Loader, useToast } from '../components/ui';

function RoleForm({ role, permissions, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selected, setSelected] = useState(new Set(role?.permissions || []));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Group permissions by module: { USERS: [...], BRANCHES: [...] }
  const groups = useMemo(() => {
    const g = {};
    for (const p of permissions) (g[p.module] ||= []).push(p);
    return g;
  }, [permissions]);

  const toggle = (code) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code); else next.add(code);
    setSelected(next);
  };

  const toggleGroup = (perms, allOn) => {
    const next = new Set(selected);
    perms.forEach((p) => (allOn ? next.delete(p.code) : next.add(p.code)));
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = { name, description, permissions: [...selected] };
    try {
      if (role) await api.put(`/roles/${role.id}`, body);
      else await api.post('/roles', body);
      toast(role ? 'Role updated' : 'Role created');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal wide title={role ? `Edit role: ${role.name}` : 'Create role'} onClose={onClose}
      footer={<>
        <span className="muted small" style={{ marginRight: 'auto' }}>{selected.size} of {permissions.length} permissions selected</span>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save role'}</button>
      </>}>
      <div className="form-grid" style={{ marginBottom: 18 }}>
        <Field label="Role name *" error={errors.name}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dispatcher" />
        </Field>
        <Field label="Description" error={errors.description}>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" />
        </Field>
      </div>
      {errors.permissions && <div className="alert alert-error">{errors.permissions}</div>}
      <div className="perm-grid">
        {Object.entries(groups).map(([module, perms]) => {
          const allOn = perms.every((p) => selected.has(p.code));
          return (
            <div className="perm-group" key={module}>
              <h4>
                {module}
                <button className="link-more" style={{ fontSize: 12 }} onClick={() => toggleGroup(perms, allOn)}>
                  {allOn ? 'Clear' : 'Select all'}
                </button>
              </h4>
              {perms.map((p) => (
                <label className="checkbox" key={p.code} style={{ padding: '4px 0' }}>
                  <input type="checkbox" checked={selected.has(p.code)} onChange={() => toggle(p.code)} />
                  {p.description}
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export default function Roles() {
  const { can } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [editing, setEditing] = useState(undefined);

  const load = () => api.get('/roles').then(({ data }) => setRoles(data)).catch((e) => toast(errorMessage(e), 'error'));

  useEffect(() => {
    load();
    api.get('/roles/permissions').then(({ data }) => setPermissions(data)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      toast('Role deleted');
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const manage = can('ROLE_MANAGE');

  return (
    <>
      <PageHeader title="Role & Permissions" subtitle="Decide what each type of user can see and do">
        {manage && <button className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={17} /> Create Role</button>}
      </PageHeader>

      {!roles ? <Loader /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {roles.map((r) => (
            <div className="card" key={r.id}>
              <div className="card-head">
                <div className="card-title">
                  <span className="stat-icon" style={{ background: r.is_system ? '#ffedd5' : '#ede9fe', width: 40, height: 40, margin: 0 }}>
                    {r.is_system ? <Lock size={19} color="#f97316" /> : <ShieldCheck size={19} color="#7c3aed" />}
                  </span>
                  {r.name}
                </div>
                {r.is_system && <Badge tone="warning">System</Badge>}
              </div>
              <p className="muted" style={{ minHeight: 20 }}>{r.description || 'No description'}</p>
              <div style={{ display: 'flex', gap: 16, margin: '14px 0', fontWeight: 600 }}>
                <span><UsersIcon size={15} /> {r.user_count} users</span>
                <span><ShieldCheck size={15} /> {r.permissions.length} permissions</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {r.permissions.slice(0, 6).map((p) => <Badge key={p} tone="gray">{p}</Badge>)}
                {r.permissions.length > 6 && <Badge tone="info">+{r.permissions.length - 6} more</Badge>}
              </div>
              {manage && !r.is_system && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" onClick={() => setEditing(r)}><Pencil size={14} /> Edit permissions</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(r)} disabled={r.user_count > 0}
                    title={r.user_count > 0 ? 'Move users to another role first' : 'Delete role'}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <RoleForm role={editing} permissions={permissions} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(); }} />
      )}
    </>
  );
}
