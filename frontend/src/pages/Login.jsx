/**
 * Login.jsx  (Module 1)
 * ---------
 * Email + password form. On success the token is saved by AuthContext
 * and we go to the page the user originally wanted (or the dashboard).
 */
import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { BrandMark, Truck, TruckDefs } from '../components/Artwork';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-art">
        <div style={{ display: 'inline-block', textAlign: 'center', alignSelf: 'flex-start' }}>
          <BrandMark width={130} />
          <div className="brand-name" style={{ marginTop: 4 }}>TTC Fleet<span style={{ color: '#f97316' }}>360</span></div>
          <div className="brand-sub">Logistics &amp; Fleet Management</div>
        </div>
        <div>
          <h2>Drive smarter.<br />Manage better.</h2>
          <p>One place for your users, branches, subscriptions and every action taken in the system.</p>
        </div>
        <svg viewBox="0 0 420 180" style={{ width: '80%', maxWidth: 460 }} aria-hidden="true">
          <defs><TruckDefs idp="login" /></defs>
          <Truck x={10} y={10} s={1} idp="login" />
        </svg>
      </section>

      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <h1>Welcome back <span className="accent">👋</span></h1>
          <p className="muted" style={{ marginBottom: 24 }}>Sign in to the admin console</p>

          {params.get('expired') && <div className="alert alert-info">Your session ended. Please sign in again.</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" required
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@ttcfleet360.com" />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="icon-btn" style={{ position: 'absolute', right: 6, top: 5 }}
                onClick={() => setShowPassword(!showPassword)} aria-label="Show password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-block" style={{ padding: 12 }} disabled={busy}>
            <LogIn size={18} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="small muted" style={{ marginTop: 18, display: 'flex', gap: 6, alignItems: 'center' }}>
            <ShieldCheck size={15} /> Protected with JWT. Account locks after 5 wrong attempts.
          </p>
        </form>
      </section>
    </div>
  );
}
