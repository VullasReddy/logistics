/**
 * Configuration.jsx  (Module 7 - Configuration and System Settings)
 * -----------------
 * Settings come grouped by category from the backend. Each setting has a
 * type (string / number / boolean / select) and we draw the right control.
 * Only changed values are sent when you press Save.
 */
import { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, AppWindow, Bell, Cog, SlidersHorizontal } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loader, Switch, useToast } from '../components/ui';
import { formatDateTime } from '../utils/format';

const CATEGORIES = [
  { key: 'APPLICATION', label: 'Application', icon: AppWindow, help: 'Name, time zone, date and currency formats' },
  { key: 'NOTIFICATION', label: 'Notifications', icon: Bell, help: 'Email / SMS alerts and renewal reminders' },
  { key: 'OPERATIONAL', label: 'Operational', icon: Cog, help: 'Working hours and fleet rules' },
  { key: 'PREFERENCE', label: 'Preferences', icon: SlidersHorizontal, help: 'Look and feel of the console' },
];

/** The right input for a setting, based on its type. */
function SettingControl({ setting, value, onChange, disabled }) {
  switch (setting.value_type) {
    case 'boolean': return <Switch checked={value} disabled={disabled} onChange={onChange} />;
    case 'number': return <input className="input" type="number" min="0" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />;
    case 'select': return (
      <select className="select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {setting.options.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
    default: return <input className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function Configuration() {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('SETTINGS_UPDATE');
  const [groups, setGroups] = useState(null);
  const [values, setValues] = useState({}); // current values in the form, by key
  const [tab, setTab] = useState('APPLICATION');
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/settings').then(({ data }) => {
    setGroups(data);
    setValues(Object.fromEntries(Object.values(data).flat().map((s) => [s.key, s.value])));
  }).catch((e) => toast(errorMessage(e), 'error'));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Which keys differ from what is saved in the database
  const changed = useMemo(() => {
    if (!groups) return {};
    const out = {};
    Object.values(groups).flat().forEach((s) => { if (values[s.key] !== s.value) out[s.key] = values[s.key]; });
    return out;
  }, [groups, values]);
  const changeCount = Object.keys(changed).length;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', { values: changed });
      toast(data.message);
      await load();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setSaving(false); }
  };

  if (!groups) return <Loader />;
  const active = CATEGORIES.find((c) => c.key === tab);

  return (
    <>
      <PageHeader title="Configuration" subtitle="Application, notification and operational settings">
        {editable && <>
          <button className="btn" disabled={!changeCount} onClick={load}><RotateCcw size={15} /> Discard</button>
          <button className="btn btn-primary" disabled={!changeCount || saving} onClick={save}>
            <Save size={15} /> Save {changeCount ? `(${changeCount})` : ''}
          </button>
        </>}
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ padding: 10 }}>
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-link ${tab === key ? 'active' : ''}`} style={{ width: '100%', border: 0, cursor: 'pointer', color: tab === key ? '#fff' : 'var(--text)', background: tab === key ? undefined : 'transparent' }}
              onClick={() => setTab(key)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
        <div className="card">
          <h2>{active.label}</h2>
          <p className="muted" style={{ marginBottom: 8 }}>{active.help}</p>
          {(groups[tab] || []).map((s) => (
            <div className="setting-row" key={s.key}>
              <div>
                <b>{s.label}</b> {s.key in changed && <span className="badge badge-warning" style={{ marginLeft: 6 }}>changed</span>}
                <div className="small muted"><code>{s.key}</code>{s.updated_by_name && ` · last changed by ${s.updated_by_name}, ${formatDateTime(s.updated_at)}`}</div>
              </div>
              <SettingControl setting={s} value={values[s.key]} disabled={!editable} onChange={(v) => setValues({ ...values, [s.key]: v })} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
