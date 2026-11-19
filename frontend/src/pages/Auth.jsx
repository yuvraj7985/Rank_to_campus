import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Auth({ mode = 'login' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegistration = mode === 'register';

  const change = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const user = isRegistration
        ? await register(form)
        : await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/student');
    } catch (requestError) {
      setError(
        requestError.message ||
        requestError.errors?.[0]?.message ||
        'Unable to authenticate. Check your details and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="brand light">
          <span className="brand-icon"><GraduationCap /></span>
          <span>Rank<span className="accent">2</span>Campus<small>ADMISSION INTELLIGENCE</small></span>
        </div>
        <div className="hero-copy">
          <span className="pill">YOUR FUTURE, BETTER PLANNED</span>
          <h1>Make your next<br />move <em>count.</em></h1>
          <p>Explore opportunities, understand your admission chances, and make confident academic decisions.</p>
          <div className="hero-points">
            <span><ShieldCheck /> Secure student portal</span>
            <span><GraduationCap /> Smarter college discovery</span>
          </div>
        </div>
        <div className="auth-foot">© {new Date().getFullYear()} Rank2Campus · Built for better decisions</div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <span className="eyebrow">WELCOME {isRegistration ? 'ABOARD' : 'BACK'}</span>
          <h2>{isRegistration ? 'Create your account' : 'Sign in to Rank2Campus'}</h2>
          <p className="muted">
            {isRegistration
              ? 'Enter your name, mobile number, email, and password to get started.'
              : 'Sign in with your email address and password.'}
          </p>

          <form onSubmit={submit}>
            {isRegistration && (
              <>
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={change}
                  placeholder="Your full name"
                  minLength="2"
                  maxLength="80"
                  required
                />
                <label htmlFor="auth-phone">Mobile number</label>
                <input
                  id="auth-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  pattern="(\+91)?[6-9][0-9]{9}"
                  maxLength="13"
                  value={form.phone}
                  onChange={change}
                  placeholder="9876543210 or +919876543210"
                  required
                />
              </>
            )}

            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              maxLength="254"
              value={form.email}
              onChange={change}
              placeholder="you@example.com"
              required
            />
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              minLength={isRegistration ? 8 : undefined}
              maxLength={isRegistration ? 72 : undefined}
              value={form.password}
              onChange={change}
              placeholder={isRegistration ? 'At least 8 characters' : 'Enter your password'}
              required
            />

            {error && <div className="alert error" role="alert" aria-live="polite">{error}</div>}
            <button className="btn primary full" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : isRegistration ? 'Create account' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="auth-switch">
            {isRegistration ? 'Already have an account?' : 'New to Rank2Campus?'}
            {' '}
            <Link to={isRegistration ? '/login' : '/register'}>
              {isRegistration ? 'Sign in' : 'Create account'}
            </Link>
          </div>
          <div className="secure-note">
            <ShieldCheck size={16} /> Your information is protected with secure authentication.
          </div>
        </div>
      </div>
    </div>
  );
}
