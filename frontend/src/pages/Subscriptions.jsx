/**
 * Subscriptions.jsx  (Module 6 - Subscription Management)
 * -----------------
 * Three tabs:
 *   Subscriptions - customers on a plan, validity, expiry, renew/cancel
 *   Plans         - create / modify plans
 *   Renewals      - everything due in the next 30 days (renewal tracking)
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, Pencil, XCircle, History, Crown, Check, Users as UsersIcon } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Field, Badge, StatusBadge, Pagination, Loader, Empty, Switch, useToast } from '../components/ui';
import { formatDate, formatINR, formatNumber, formatDateTime, todayISO } from '../utils/format';

const STATUS_FILTERS = ['', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED'];

/* ---------------------------- Subscription form ---------------------------- */
function SubscriptionForm({ sub, plans, defaultPlanId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(sub
    ? { customer_name: sub.customer_name, customer_email: sub.customer_email || '', plan_id: sub.plan_id, active_users: sub.active_users, start_date: sub.start_date, end_date: sub.end_date, auto_renew: sub.auto_renew }
    : { customer_name: '', customer_email: '', plan_id: defaultPlanId || '', active_users: 0, start_date: todayISO(), end_date: '', auto_renew: false });
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    try {
      if (sub) await api.put(`/subscriptions/${sub.id}`, form);
      else await api.post('/subscriptions', form);
      toast(sub ? 'Subscription updated' : 'Subscription created');
      onSaved();
    } catch (err) { setErrors(fieldErrors(err)); toast(errorMessage(err), 'error'); }
  };

  return (
    <Modal title={sub ? 'Edit subscription' : 'New subscription'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Customer name *" error={errors.customer_name}><input className="input" value={form.customer_name} onChange={set('customer_name')} /></Field>
        <Field label="Billing email" error={errors.customer_email}><input className="input" value={form.customer_email} onChange={set('customer_email')} /></Field>
        <Field label="Plan *" error={errors.plan_id}>
          <select className="select" value={form.plan_id} onChange={set('plan_id')}>
            <option value="">Select plan</option>
            {plans.filter((p) => p.is_active || p.id === form.plan_id).map((p) => <option key={p.id} value={p.id}>{p.name} – {formatINR(p.price_monthly)}/month</option>)}
          </select>
        </Field>
        <Field label="Active users" error={errors.active_users}><input className="input" type="number" min="0" value={form.active_users} onChange={set('active_users')} /></Field>
        <Field label="Start date *" error={errors.start_date}><input className="input" type="date" value={form.start_date} onChange={set('start_date')} /></Field>
        <Field label="End date" error={errors.end_date} hint={sub ? null : 'Empty = one plan period'}><input className="input" type="date" value={form.end_date} onChange={set('end_date')} /></Field>
        <label className="checkbox full"><Switch checked={form.auto_renew} onChange={(v) => setForm({ ...form, auto_renew: v })} /> Auto-renew</label>
      </div>
    </Modal>
  );
}

function RenewForm({ sub, plans, onClose, onSaved }) {
  const toast = useToast();
  const [planId, setPlanId] = useState(sub.plan_id);
  const [periods, setPeriods] = useState(1);
  const plan = plans.find((p) => p.id === Number(planId));

  const renew = async () => {
    try {
      const { data } = await api.post(`/subscriptions/${sub.id}/renew`, { plan_id: Number(planId), periods: Number(periods) });
      toast(`Renewed until ${formatDate(data.end_date)}`);
      onSaved();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <Modal title={`Renew – ${sub.customer_name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={renew}><RefreshCw size={15} /> Renew</button></>}>
      <div className="form-grid">
        <Field label="Plan (change to upgrade / downgrade)">
          <select className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Number of periods" hint={plan ? `1 period = ${plan.duration_days} days` : ''}>
          <input className="input" type="number" min="1" max="36" value={periods} onChange={(e) => setPeriods(e.target.value)} />
        </Field>
      </div>
      <div className="alert alert-info" style={{ marginTop: 16 }}>
        Current end date: <b>{formatDate(sub.end_date)}</b>. The new period starts from {sub.days_left < 0 ? 'today (already expired)' : 'the current end date'}.
        Amount: <b>{formatINR((plan?.price_monthly || 0) * periods)}</b>
      </div>
    </Modal>
  );
}

function HistoryModal({ subId, onClose }) {
  const [sub, setSub] = useState(null);
  useEffect(() => { api.get(`/subscriptions/${subId}`).then(({ data }) => setSub(data)); }, [subId]);
  return (
    <Modal wide title="Renewal history" onClose={onClose}>
      {!sub ? <Loader /> : sub.renewals.length === 0 ? <Empty>No renewals yet for {sub.customer_name}.</Empty> : (
        <table className="table">
          <thead><tr><th>Renewed on</th><th>Plan</th><th>Old end</th><th>New end</th><th>Amount</th><th>By</th></tr></thead>
          <tbody>{sub.renewals.map((r) => (
            <tr key={r.id}><td>{formatDateTime(r.renewed_at)}</td><td>{r.plan_name}</td><td>{formatDate(r.previous_end)}</td>
              <td>{formatDate(r.new_end)}</td><td>{formatINR(r.amount)}</td><td>{r.renewed_by_name || '—'}</td></tr>
          ))}</tbody>
        </table>
      )}
    </Modal>
  );
}

/* --------------------------------- Plans --------------------------------- */
function PlanForm({ plan, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: plan?.name || '', description: plan?.description || '', price_monthly: plan?.price_monthly ?? '',
    duration_days: plan?.duration_days ?? 30, max_users: plan?.max_users ?? 10, max_vehicles: plan?.max_vehicles ?? 10,
    features: (plan?.features || []).join('\n'), is_popular: plan?.is_popular ?? false, is_active: plan?.is_active ?? true,
  });
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    // one feature per line -> array
    const body = { ...form, features: form.features.split('\n').map((f) => f.trim()).filter(Boolean) };
    try {
      if (plan) await api.put(`/subscriptions/plans/${plan.id}`, body);
      else await api.post('/subscriptions/plans', body);
      toast(plan ? 'Plan updated' : 'Plan created');
      onSaved();
    } catch (err) { setErrors(fieldErrors(err)); toast(errorMessage(err), 'error'); }
  };

  return (
    <Modal title={plan ? `Edit plan: ${plan.name}` : 'Create plan'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save plan</button></>}>
      <div className="form-grid">
        <Field label="Plan name *" error={errors.name}><input className="input" value={form.name} onChange={set('name')} /></Field>
        <Field label="Price per month (₹) *" error={errors.price_monthly}><input className="input" type="number" min="0" value={form.price_monthly} onChange={set('price_monthly')} /></Field>
        <Field label="Description" full><input className="input" value={form.description} onChange={set('description')} /></Field>
        <Field label="Validity (days per period)" error={errors.duration_days}><input className="input" type="number" value={form.duration_days} onChange={set('duration_days')} /></Field>
        <Field label="Max users"><input className="input" type="number" value={form.max_users} onChange={set('max_users')} /></Field>
        <Field label="Max vehicles"><input className="input" type="number" value={form.max_vehicles} onChange={set('max_vehicles')} /></Field>
        <div />
        <Field label="Features (one per line)" full><textarea className="textarea" rows={4} value={form.features} onChange={set('features')} /></Field>
        <label className="checkbox"><Switch checked={form.is_popular} onChange={(v) => setForm({ ...form, is_popular: v })} /> Show “Most Popular” badge</label>
        <label className="checkbox"><Switch checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} /> Available for new subscriptions</label>
      </div>
    </Modal>
  );
}

function PlansTab({ plans, canManage, reload }) {
  const [editing, setEditing] = useState(undefined);
  return (
    <>
      {canManage && <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setEditing(null)}><Plus size={16} /> Create plan</button>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {plans.map((p) => (
          <div key={p.id} className={`card plan ${p.is_popular ? 'popular' : ''}`} style={{ textAlign: 'left', padding: 22 }}>
            {p.is_popular && <span className="plan-ribbon">Most Popular</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="plan-name"><Crown size={16} color="#f97316" /> {p.name}</div>
              {!p.is_active && <Badge>Inactive</Badge>}
            </div>
            <div className="plan-price" style={{ fontSize: 26 }}>{formatINR(p.price_monthly)}<small>/{p.duration_days} days</small></div>
            <p className="muted" style={{ marginBottom: 10 }}>{p.description}</p>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 6, marginBottom: 14 }}>
              {p.features.map((f) => <li key={f}><Check size={14} color="#16a34a" /> {f}</li>)}
            </ul>
            <div className="small muted" style={{ marginBottom: 12 }}>
              <UsersIcon size={12} /> {formatNumber(p.active_users)} active users · {p.active_subscriptions} subscriptions · up to {p.max_vehicles} vehicles
            </div>
            {canManage && <button className="btn btn-sm" onClick={() => setEditing(p)}><Pencil size={13} /> Modify plan</button>}
          </div>
        ))}
      </div>
      {editing !== undefined && <PlanForm plan={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </>
  );
}

/* --------------------------------- Page --------------------------------- */
export default function Subscriptions() {
  const { can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const canManage = can('SUBSCRIPTION_MANAGE');

  const [tab, setTab] = useState(params.get('tab') || 'subscriptions');
  const [plans, setPlans] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: params.get('status') || '', plan_id: '', page: 1 });
  const [result, setResult] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [editing, setEditing] = useState(params.get('new') ? null : undefined); // ?new=<planId> opens the form
  const [renewing, setRenewing] = useState(null);
  const [history, setHistory] = useState(null);

  const loadPlans = useCallback(() => api.get('/subscriptions/plans').then(({ data }) => setPlans(data)).catch(() => {}), []);
  const load = useCallback(() => {
    api.get('/subscriptions', { params: filters }).then(({ data }) => setResult(data)).catch((e) => toast(errorMessage(e), 'error'));
    api.get('/subscriptions/renewals/upcoming', { params: { days: 30 } }).then(({ data }) => setUpcoming(data)).catch(() => {});
  }, [filters, toast]);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const refreshAll = () => { load(); loadPlans(); };
  const closeForm = () => { setEditing(undefined); if (params.get('new')) setParams({}); };

  const cancel = async (s) => {
    if (!window.confirm(`Cancel the subscription of ${s.customer_name}?`)) return;
    try { await api.post(`/subscriptions/${s.id}/cancel`); toast('Subscription cancelled'); refreshAll(); } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const daysLeftText = (s) => {
    if (s.computed_status === 'CANCELLED') return '—';
    if (s.days_left < 0) return <span style={{ color: 'var(--red)' }}>{-s.days_left} days ago</span>;
    return <b style={{ color: s.days_left <= 7 ? 'var(--orange-600)' : undefined }}>{s.days_left} days</b>;
  };

  const actions = (s) => (
    <div className="actions">
      <button className="btn btn-sm" title="Renewal history" onClick={() => setHistory(s.id)}><History size={14} /></button>
      {canManage && s.computed_status !== 'CANCELLED' && <>
        <button className="btn btn-sm btn-primary" onClick={() => setRenewing(s)}><RefreshCw size={13} /> Renew</button>
        <button className="btn btn-sm" title="Edit" onClick={() => setEditing(s)}><Pencil size={14} /></button>
        <button className="btn btn-sm btn-danger" title="Cancel" onClick={() => cancel(s)}><XCircle size={14} /></button>
      </>}
    </div>
  );

  return (
    <>
      <PageHeader title="Subscription Management" subtitle="Plans, customer subscriptions, validity and renewals">
        {canManage && tab === 'subscriptions' && <button className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={17} /> New Subscription</button>}
      </PageHeader>

      <div className="tabs">
        {[['subscriptions', 'Subscriptions'], ['plans', 'Plans'], ['renewals', `Renewals due (${upcoming?.length ?? 0})`]].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'plans' && <PlansTab plans={plans} canManage={canManage} reload={loadPlans} />}

      {tab === 'renewals' && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Renewals due in the next 30 days</h2>
          {!upcoming ? <Loader /> : upcoming.length === 0 ? <Empty>Nothing due. 🎉</Empty> : (
            <table className="table">
              <thead><tr><th>Customer</th><th>Plan</th><th>Ends on</th><th>Days left</th><th>Auto-renew</th><th /></tr></thead>
              <tbody>{upcoming.map((s) => (
                <tr key={s.id}><td><b>{s.customer_name}</b></td><td>{s.plan_name}</td><td>{formatDate(s.end_date)}</td>
                  <td>{daysLeftText(s)}</td><td>{s.auto_renew ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>}</td><td>{actions(s)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="card">
          <div className="toolbar">
            <div className="search-box" style={{ boxShadow: 'none', border: '1px solid var(--border)', padding: '8px 14px', flex: '0 1 280px' }}>
              <Search size={17} /><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} placeholder="Search customer" />
            </div>
            <select className="select" style={{ width: 160 }} value={filters.plan_id} onChange={(e) => setFilters({ ...filters, plan_id: e.target.value, page: 1 })}>
              <option value="">All plans</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="tabs" style={{ margin: 0 }}>
              {STATUS_FILTERS.map((s) => (
                <button key={s} className={`tab ${filters.status === s ? 'active' : ''}`} onClick={() => setFilters({ ...filters, status: s, page: 1 })}>{s ? s[0] + s.slice(1).toLowerCase() : 'All'}</button>
              ))}
            </div>
          </div>
          {!result ? <Loader /> : result.data.length === 0 ? <Empty>No subscriptions found.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Customer</th><th>Plan</th><th>Users</th><th>Validity</th><th>Days left</th><th>Status</th><th /></tr></thead>
                <tbody>{result.data.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.customer_name}</b><div className="small muted">{s.customer_email}</div></td>
                    <td>{s.plan_name}<div className="small muted">{formatINR(s.price_monthly)}/month</div></td>
                    <td>{formatNumber(s.active_users)}</td>
                    <td className="small">{formatDate(s.start_date)} → {formatDate(s.end_date)}</td>
                    <td>{daysLeftText(s)}</td>
                    <td><StatusBadge value={s.computed_status} /></td>
                    <td>{actions(s)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Pagination pagination={result?.pagination} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}

      {editing !== undefined && <SubscriptionForm sub={editing} plans={plans} defaultPlanId={params.get('new')} onClose={closeForm} onSaved={() => { closeForm(); refreshAll(); }} />}
      {renewing && <RenewForm sub={renewing} plans={plans} onClose={() => setRenewing(null)} onSaved={() => { setRenewing(null); refreshAll(); }} />}
      {history && <HistoryModal subId={history} onClose={() => setHistory(null)} />}
    </>
  );
}
