/**
 * Dashboard.jsx
 * -------------
 * The home screen from the design. All data comes from ONE call:
 * GET /api/dashboard (see backend/src/modules/dashboard).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon, MapPin, Truck, Crown, ArrowUp, ArrowRight, BarChart3, Clock, User,
  Building2, CreditCard, Settings, ShieldCheck, CalendarDays, ChevronDown, AlertCircle,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { HeroArt, PromoTruck } from '../components/Artwork';
import IndiaMap from '../components/IndiaMap';
import { Loader, Badge } from '../components/ui';
import { formatINR, formatNumber, timeAgo, formatDate } from '../utils/format';

const ORANGE = '#f97316';
const BLUE = '#3b82f6';
const DIST_COLORS = ['#f97316', '#16a34a', '#fb923c', '#4f46e5'];

/** Tiny decorative trend line under each stat number. */
function Sparkline({ color, seed }) {
  const data = [3, 5, 4, 6, 5, 8, 7, 10].map((v, i) => ({ i, v: v + ((seed * (i + 1)) % 3) }));
  return (
    <ResponsiveContainer width={74} height={26}>
      <LineChart data={data}><Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
    </ResponsiveContainer>
  );
}

function StatCard({ icon: Icon, color, bg, value, label, growth, seed, to }) {
  return (
    <Link to={to} className="stat-card">
      <div className="stat-icon" style={{ background: bg }}><Icon size={24} color={color} fill={color} /></div>
      <div className="stat-value">{formatNumber(value)}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-foot">
        <span className="trend-up"><ArrowUp size={13} /> {growth}%</span>
        <Sparkline color={color} seed={seed} />
      </div>
    </Link>
  );
}

// Icon + badge for each activity row, based on what was changed
const ACTIVITY_STYLE = {
  USER: { icon: User, badge: ['New', 'success'] },
  BRANCH: { icon: Building2, badge: ['Updated', 'info'] },
  LOCATION: { icon: MapPin, badge: ['Updated', 'info'] },
  SUBSCRIPTION: { icon: CreditCard, badge: ['Success', 'success'] },
  PLAN: { icon: CreditCard, badge: ['Updated', 'info'] },
  SETTINGS: { icon: Settings, badge: ['Info', 'warning'] },
  ROLE: { icon: ShieldCheck, badge: ['Updated', 'purple'] },
  COMPANY: { icon: Building2, badge: ['Updated', 'info'] },
};

function renewalChip(daysLeft) {
  if (daysLeft <= 3) return <Badge tone="danger">Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}</Badge>;
  if (daysLeft <= 7) return <Badge tone="warning">Expires in {daysLeft} days</Badge>;
  return <Badge tone="info">Renews in {daysLeft} days</Badge>;
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>;
  if (!data) return <Loader />;

  const { stats } = data;
  const firstName = user.full_name.split(' ')[0];

  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="hero">
        <HeroArt />
        <span className="date-chip" style={{ position: 'absolute', right: 28, top: 84, zIndex: 2 }}>
          <CalendarDays size={18} /> {formatDate(new Date())} <ChevronDown size={15} />
        </span>
        <div className="hero-text">
          <h1>Welcome back, <span className="accent">{firstName}!</span></h1>
          <p className="lead">Drive smarter. Manage better with TTC Fleet360.</p>
        </div>
        <div className="stat-row">
          <StatCard icon={UsersIcon} color={ORANGE} bg="#ffedd5" value={stats.users.total} label="Total Users" growth={stats.users.growth} seed={1} to="/users" />
          <StatCard icon={MapPin} color={BLUE} bg="#dbeafe" value={stats.branches.total} label="Total Branches" growth={stats.branches.growth} seed={2} to="/branches" />
          <StatCard icon={Truck} color="#16a34a" bg="#dcfce7" value={stats.activeFleet.total} label="Active Fleet" growth={stats.activeFleet.growth} seed={3} to="/" />
          <StatCard icon={Crown} color="#7c3aed" bg="#ede9fe" value={stats.subscriptions.total} label="Subscriptions" growth={stats.subscriptions.growth} seed={4} to="/subscriptions" />
        </div>
      </section>

      {/* ------------------------- Row 1: charts ------------------------- */}
      <div className="grid-3">
        <div className="card">
          <div className="card-head">
            <div className="card-title"><BarChart3 size={20} color={ORANGE} /> Fleet Performance</div>
            <span className="btn btn-sm">Last 6 Months <ChevronDown size={14} /></span>
          </div>
          <div className="legend"><span><i style={{ background: ORANGE }} />Total Trips</span><span><i style={{ background: BLUE }} />On Time Delivery</span></div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data.fleetPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gTrips" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ORANGE} stopOpacity={0.25} /><stop offset="1" stopColor={ORANGE} stopOpacity={0} /></linearGradient>
                <linearGradient id="gOnTime" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={BLUE} stopOpacity={0.2} /><stop offset="1" stopColor={BLUE} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef1f6" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              {/* scale is at least 0-100, and grows if trips go above 100 */}
              <YAxis tickLine={false} axisLine={false} domain={[0, (max) => Math.max(100, Math.ceil(max / 25) * 25)]} tickCount={5} />
              <Tooltip />
              <Area type="linear" dataKey="total_trips" name="Total Trips" stroke={ORANGE} strokeWidth={2.5} fill="url(#gTrips)" dot={{ r: 4, fill: ORANGE }} />
              <Area type="linear" dataKey="on_time_trips" name="On Time Delivery" stroke={BLUE} strokeWidth={2.5} fill="url(#gOnTime)" dot={{ r: 4, fill: BLUE }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><MapPin size={20} color={ORANGE} /> Branch Distribution</div></div>
          <div className="distribution">
            <IndiaMap pins={data.branchPins} height={250} />
            <ul className="dist-list">
              {data.branchDistribution.map((d, i) => (
                <li key={d.city}><i style={{ background: DIST_COLORS[i] }} />{d.city}<b>{d.percent}%</b></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><Clock size={20} color={ORANGE} /> Recent Activities</div>
            {can('AUDIT_VIEW') && <Link to="/audit-logs" className="link-more">View All <ArrowRight size={15} /></Link>}
          </div>
          {data.recentActivities.length === 0 && <p className="muted">No activity yet.</p>}
          {data.recentActivities.slice(0, 4).map((a) => {
            const style = ACTIVITY_STYLE[a.entity_type] || { icon: Clock, badge: ['Info', 'gray'] };
            const Icon = style.icon;
            const badge = a.action === 'CREATE' ? ['New', 'success'] : style.badge;
            return (
              <div className="activity" key={a.id}>
                <div className="activity-icon"><Icon size={19} /></div>
                <div className="activity-body">
                  <b>{a.user_name || a.user_email || 'System'}</b>
                  <span>{a.description}</span>
                  <span className="small" style={{ color: '#94a3b8' }}>{timeAgo(a.created_at)}</span>
                </div>
                <Badge tone={badge[1]}>{badge[0]}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------------- Row 2: subscriptions ---------------------- */}
      <div className="grid-3" style={{ marginBottom: 0 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Crown size={20} color={ORANGE} fill={ORANGE} /> Subscription Overview</div>
            <Link to="/subscriptions" className="link-more">View Plans <ArrowRight size={15} /></Link>
          </div>
          <div className="plans">
            {data.plans.slice(0, 3).map((p) => (
              <div key={p.id} className={`plan ${p.is_popular ? 'popular' : ''}`}>
                {p.is_popular && <span className="plan-ribbon">Most Popular</span>}
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">{formatINR(p.price_monthly)}<small>/month</small></div>
                <div className="plan-users"><UsersIcon size={12} /> Active Users<b>{formatNumber(p.active_users)}</b></div>
                <button className={`btn btn-sm ${p.is_popular ? 'btn-primary' : 'btn-outline-blue'}`} onClick={() => navigate('/subscriptions?new=' + p.id)}>
                  Choose Plan
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><CalendarDays size={20} color={ORANGE} /> Upcoming Renewals</div>
            <Link to="/subscriptions?status=EXPIRING" className="link-more">View All <ArrowRight size={15} /></Link>
          </div>
          {data.upcomingRenewals.length === 0 && <p className="muted">No renewals due in the next 30 days.</p>}
          {data.upcomingRenewals.slice(0, 3).map((s) => (
            <div className="renewal" key={s.id}>
              <Clock size={20} color={s.days_left <= 7 ? ORANGE : '#1d4ed8'} />
              <span className="name">{s.plan_name} Plan – {s.customer_name}</span>
              {renewalChip(s.days_left)}
            </div>
          ))}
        </div>

        <div className="promo-card">
          <h3>TTC Fleet360</h3>
          <h2>Efficient Fleet.<br />Greater Productivity.</h2>
          <p>Manage your logistics operations with ease and security.</p>
          <Link to="/company" className="btn btn-primary btn-sm" style={{ position: 'relative' }}>Explore Features <ArrowRight size={14} /></Link>
          <PromoTruck />
        </div>
      </div>
    </>
  );
}
