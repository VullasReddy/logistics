/**
 * Branches.jsx  (Module 4 - Branch and Location Management)
 * ------------
 * Branch list -> create / edit / status. "Manage" opens a panel with
 * two tabs: Locations (warehouses, hubs...) and Users (allocation).
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, MapPin, Trash2, UserPlus, Building2 } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Field, Badge, StatusBadge, Loader, Empty, Switch, useToast } from '../components/ui';

const EMPTY_BRANCH = { name: '', code: '', city: '', state: '', address: '', pincode: '', phone: '', email: '', latitude: '', longitude: '' };
const LOCATION_TYPES = ['WAREHOUSE', 'HUB', 'OFFICE', 'PARKING'];

function BranchForm({ branch, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => {
    const start = { ...EMPTY_BRANCH };
    if (branch) Object.keys(start).forEach((k) => { start[k] = branch[k] ?? ''; });
    return start;
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setSaving(true);
    setErrors({});
    // empty map coordinates must be sent as null, not "" (which would mean 0)
    const body = { ...form, latitude: form.latitude === '' ? null : form.latitude, longitude: form.longitude === '' ? null : form.longitude };
    try {
      if (branch) await api.put(`/branches/${branch.id}`, body);
      else await api.post('/branches', body);
      toast(branch ? 'Branch updated' : 'Branch created');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally { setSaving(false); }
  };

  const input = (key, label, props = {}) => (
    <Field label={label} error={errors[key]} hint={props.hint}>
      <input className="input" value={form[key]} onChange={set(key)} {...props} />
    </Field>
  );

  return (
    <Modal title={branch ? `Edit ${branch.name}` : 'Add branch'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save branch'}</button></>}>
      <div className="form-grid">
        {input('name', 'Branch name *', { placeholder: 'Hyderabad Central Hub' })}
        {input('code', 'Branch code *', { placeholder: 'HYD01', hint: '3–20 letters/numbers' })}
        {input('city', 'City *')}
        {input('state', 'State *')}
        <div className="full">{input('address', 'Address')}</div>
        {input('pincode', 'Pincode', { maxLength: 6 })}
        {input('phone', 'Phone')}
        {input('email', 'Email')}
        <div />
        {input('latitude', 'Latitude', { hint: 'For the map pin, e.g. 17.385' })}
        {input('longitude', 'Longitude', { hint: 'e.g. 78.4867' })}
      </div>
    </Modal>
  );
}

/** Locations tab: list + add + toggle active + delete */
function LocationsTab({ branch, canManage, reload }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', type: 'WAREHOUSE', address: '', city: branch.city, pincode: '' });
  const [errors, setErrors] = useState({});

  const add = async () => {
    try {
      await api.post(`/branches/${branch.id}/locations`, form);
      toast('Location added');
      setForm({ ...form, name: '', address: '', pincode: '' });
      setErrors({});
      reload();
    } catch (err) { setErrors(fieldErrors(err)); toast(errorMessage(err), 'error'); }
  };
  const update = async (loc, changes) => {
    try { await api.put(`/branches/locations/${loc.id}`, changes); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const remove = async (loc) => {
    if (!window.confirm(`Remove location "${loc.name}"?`)) return;
    try { await api.delete(`/branches/locations/${loc.id}`); toast('Location removed'); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      {branch.locations.length === 0 ? <Empty>No locations yet.</Empty> : (
        <table className="table" style={{ marginBottom: 16 }}>
          <thead><tr><th>Name</th><th>Type</th><th>Address</th><th>Active</th><th /></tr></thead>
          <tbody>
            {branch.locations.map((l) => (
              <tr key={l.id}>
                <td><b>{l.name}</b></td>
                <td><Badge tone="info">{l.type}</Badge></td>
                <td className="muted">{[l.address, l.city, l.pincode].filter(Boolean).join(', ') || '—'}</td>
                <td><Switch checked={l.is_active} disabled={!canManage} onChange={(v) => update(l, { is_active: v })} /></td>
                <td className="actions">{canManage && <button className="btn btn-sm btn-danger" onClick={() => remove(l)}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canManage && (
        <div className="perm-group">
          <h4>Add location</h4>
          <div className="form-grid">
            <Field label="Name *" error={errors.name}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Type">
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {LOCATION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Address" full><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="City"><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Pincode" error={errors.pincode}><input className="input" maxLength={6} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></Field>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={add}><Plus size={14} /> Add location</button>
        </div>
      )}
    </>
  );
}

/** Users tab: who works here + allocate more users */
function UsersTab({ branch, canManage }) {
  const toast = useToast();
  const [members, setMembers] = useState(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState([]);

  const loadMembers = useCallback(() => {
    api.get(`/branches/${branch.id}/users`).then(({ data }) => setMembers(data)).catch(() => {});
  }, [branch.id]);
  useEffect(loadMembers, [loadMembers]);

  useEffect(() => {
    if (search.length < 2) { setCandidates([]); return undefined; }
    const t = setTimeout(() => {
      api.get('/users', { params: { search, limit: 8 } })
        .then(({ data }) => setCandidates(data.data.filter((u) => u.branch_id !== branch.id)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search, branch.id]);

  const allocate = async () => {
    try {
      const { data } = await api.post(`/branches/${branch.id}/users`, { user_ids: picked });
      toast(data.message);
      setPicked([]); setSearch(''); loadMembers();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      {canManage && (
        <div className="perm-group" style={{ marginBottom: 16 }}>
          <h4>Allocate users to this branch</h4>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name or email to find users" />
          {candidates.map((u) => (
            <label className="checkbox" key={u.id} style={{ padding: '6px 0' }}>
              <input type="checkbox" checked={picked.includes(u.id)}
                onChange={() => setPicked(picked.includes(u.id) ? picked.filter((id) => id !== u.id) : [...picked, u.id])} />
              {u.full_name} <span className="muted small">— currently {u.branch_name || 'Head office'}</span>
            </label>
          ))}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={!picked.length} onClick={allocate}>
            <UserPlus size={14} /> Move {picked.length || ''} user(s) here
          </button>
        </div>
      )}
      {!members ? <Loader /> : members.length === 0 ? <Empty>No users in this branch.</Empty> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{members.map((u) => (
            <tr key={u.id}><td><b>{u.full_name}</b></td><td className="muted">{u.email}</td><td>{u.role_name}</td>
              <td>{u.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td></tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

function BranchPanel({ branchId, onClose, canManage }) {
  const [branch, setBranch] = useState(null);
  const [tab, setTab] = useState('locations');
  const load = useCallback(() => { api.get(`/branches/${branchId}`).then(({ data }) => setBranch(data)); }, [branchId]);
  useEffect(load, [load]);

  return (
    <Modal wide title={branch ? `${branch.name} (${branch.code})` : 'Branch'} onClose={onClose}>
      {!branch ? <Loader /> : (
        <>
          <div className="tabs">
            <button className={`tab ${tab === 'locations' ? 'active' : ''}`} onClick={() => setTab('locations')}>Locations ({branch.locations.length})</button>
            <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
          </div>
          {tab === 'locations' ? <LocationsTab branch={branch} canManage={canManage} reload={load} /> : <UsersTab branch={branch} canManage={canManage} />}
        </>
      )}
    </Modal>
  );
}

export default function Branches() {
  const { can } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [branches, setBranches] = useState(null);
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [managing, setManaging] = useState(null);
  const canManage = can('BRANCH_MANAGE');

  const load = useCallback(() => {
    api.get('/branches', { params: { search, status } }).then(({ data }) => setBranches(data)).catch((e) => toast(errorMessage(e), 'error'));
  }, [search, status, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const toggleStatus = async (b) => {
    try {
      await api.patch(`/branches/${b.id}/status`, { status: b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      toast(`${b.name} is now ${b.status === 'ACTIVE' ? 'inactive' : 'active'}`);
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Branch Management" subtitle="Branches, their locations and the users working there">
        {canManage && <button className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={17} /> Add Branch</button>}
      </PageHeader>
      <div className="card">
        <div className="toolbar">
          <div className="search-box" style={{ boxShadow: 'none', border: '1px solid var(--border)', padding: '8px 14px', flex: '0 1 300px' }}>
            <Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, city" />
          </div>
          <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
          </select>
        </div>
        {!branches ? <Loader /> : branches.length === 0 ? <Empty>No branches found.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Branch</th><th>Code</th><th>Location</th><th>Users</th><th>Locations</th><th>Status</th><th /></tr></thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td><div className="cell-user"><span className="avatar" style={{ background: '#ffedd5', color: '#ea580c' }}><Building2 size={16} /></span><b>{b.name}</b></div></td>
                    <td><code>{b.code}</code></td>
                    <td className="nowrap"><MapPin size={13} /> {b.city}, {b.state}</td>
                    <td>{b.user_count}</td>
                    <td>{b.location_count}</td>
                    <td><StatusBadge value={b.status} /></td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm" onClick={() => setManaging(b.id)}>Manage</button>
                        {canManage && <button className="btn btn-icon" title="Edit branch" aria-label="Edit branch" onClick={() => setEditing(b)}><Pencil size={15} /></button>}
                        {canManage && <Switch checked={b.status === 'ACTIVE'} onChange={() => toggleStatus(b)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing !== undefined && <BranchForm branch={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
      {managing && <BranchPanel branchId={managing} canManage={canManage} onClose={() => { setManaging(null); load(); }} />}
    </>
  );
}
