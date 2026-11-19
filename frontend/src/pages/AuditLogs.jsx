/**
 * AuditLogs.jsx  (Module 8 - Audit Logs and User Activity Monitoring)
 * -------------
 * Tabs:
 *   All activity   - every create / update / delete / status change
 *   Login history  - LOGIN, LOGOUT, LOGIN_FAILED only
 *   Daily report   - date-wise counts (bar chart + table)
 * Filters: search, action, module, date range. Export as CSV.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api, { errorMessage } from '../api/client';
import { PageHeader, StatusBadge, Pagination, Loader, Empty, useToast } from '../components/ui';
import { formatDateTime, formatDate, todayISO } from '../utils/format';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'PASSWORD_CHANGE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED'];
const ENTITIES = ['USER', 'ROLE', 'BRANCH', 'LOCATION', 'COMPANY', 'PLAN', 'SUBSCRIPTION', 'SETTINGS'];
const LOGIN_ACTIONS = 'LOGIN,LOGOUT,LOGIN_FAILED';
const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function LogTable({ logs }) {
  const [open, setOpen] = useState(null); // row whose details are expanded
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th style={{ width: 28 }} /><th>Date &amp; time</th><th>User</th><th>Action</th><th>Description</th><th>IP address</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <Fragment key={l.id}>
              <tr onClick={() => l.details && setOpen(open === l.id ? null : l.id)} style={{ cursor: l.details ? 'pointer' : 'default' }}>
                <td>{l.details && (open === l.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}</td>
                <td className="small">{formatDateTime(l.created_at)}</td>
                <td><b>{l.user_name || '—'}</b><div className="small muted">{l.user_email}</div></td>
                <td><StatusBadge value={l.action} /></td>
                <td>{l.description}{l.entity_type && <div className="small muted">{l.entity_type} #{l.entity_id}</div>}</td>
                <td className="small muted">{l.ip_address || '—'}</td>
              </tr>
              {open === l.id && (
                <tr><td /><td colSpan={5}>
                  <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.details, null, 2)}</pre>
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyReport() {
  const [range, setRange] = useState({ from: daysAgoISO(13), to: todayISO() });
  const [report, setReport] = useState(null);
  useEffect(() => { api.get('/audit-logs/report', { params: range }).then(({ data }) => setReport(data)); }, [range]);

  return (
    <div className="card">
      <div className="toolbar">
        <label>From <input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} style={{ width: 160 }} /></label>
        <label>To <input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} style={{ width: 160 }} /></label>
      </div>
      {!report ? <Loader /> : report.days.length === 0 ? <Empty>No activity in this period.</Empty> : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={report.days}>
              <CartesianGrid vertical={false} stroke="#eef1f6" />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="LOGIN" stackId="a" fill="#16a34a" name="Login" />
              <Bar dataKey="CREATE" stackId="a" fill="#3b82f6" name="Create" />
              <Bar dataKey="UPDATE" stackId="a" fill="#7c3aed" name="Update" />
              <Bar dataKey="DELETE" stackId="a" fill="#dc2626" name="Delete" />
              <Bar dataKey="STATUS_CHANGE" stackId="a" fill="#f97316" name="Status change" />
            </BarChart>
          </ResponsiveContainer>
          <table className="table" style={{ marginTop: 16 }}>
            <thead><tr><th>Date</th>{ACTIONS.map((a) => <th key={a}>{a.replace('_', ' ')}</th>)}<th>Total</th></tr></thead>
            <tbody>{report.days.map((d) => (
              <tr key={d.day}><td><b>{formatDate(d.day)}</b></td>{ACTIONS.map((a) => <td key={a}>{d[a] || 0}</td>)}<td><b>{d.total}</b></td></tr>
            ))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default function AuditLogs() {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({ search: '', action: '', entity_type: '', from: '', to: '', page: 1, limit: 15 });
  const [result, setResult] = useState(null);

  // Login history tab forces the action filter
  const effective = tab === 'logins' ? { ...filters, action: filters.action || LOGIN_ACTIONS, entity_type: '' } : filters;

  const load = useCallback(() => {
    api.get('/audit-logs', { params: effective }).then(({ data }) => setResult(data)).catch((e) => toast(errorMessage(e), 'error'));
  }, [JSON.stringify(effective)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab !== 'report') { const t = setTimeout(load, 250); return () => clearTimeout(t); } return undefined; }, [load, tab]);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });

  // Download needs the token, so we fetch it as a file (blob) instead of a plain link
  const exportCsv = async () => {
    try {
      const { data } = await api.get('/audit-logs/export', { params: effective, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = Object.assign(document.createElement('a'), { href: url, download: `audit-logs-${todayISO()}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Who did what, and when. Logs cannot be edited or deleted.">
        {tab !== 'report' && <button className="btn" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
      </PageHeader>

      <div className="tabs">
        {[['all', 'All activity'], ['logins', 'Login history'], ['report', 'Daily report']].map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => { setTab(k); setFilters({ ...filters, action: '', page: 1 }); }}>{label}</button>
        ))}
      </div>

      {tab === 'report' ? <DailyReport /> : (
        <div className="card">
          <div className="toolbar">
            <div className="search-box" style={{ boxShadow: 'none', border: '1px solid var(--border)', padding: '8px 14px', flex: '0 1 260px' }}>
              <Search size={17} /><input value={filters.search} onChange={set('search')} placeholder="Search description or email" />
            </div>
            <select className="select" style={{ width: 170 }} value={filters.action} onChange={set('action')}>
              <option value="">All actions</option>
              {(tab === 'logins' ? LOGIN_ACTIONS.split(',') : ACTIONS).map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
            </select>
            {tab === 'all' && (
              <select className="select" style={{ width: 160 }} value={filters.entity_type} onChange={set('entity_type')}>
                <option value="">All modules</option>{ENTITIES.map((e) => <option key={e}>{e}</option>)}
              </select>
            )}
            <input className="input" type="date" style={{ width: 150 }} value={filters.from} onChange={set('from')} title="From date" />
            <input className="input" type="date" style={{ width: 150 }} value={filters.to} onChange={set('to')} title="To date" />
          </div>
          {!result ? <Loader /> : result.data.length === 0 ? <Empty>No activity matches these filters.</Empty> : <LogTable logs={result.data} />}
          <Pagination pagination={result?.pagination} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </>
  );
}
