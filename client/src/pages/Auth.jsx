import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Layout';
import { Button, Input, Select } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Brand />
        <div>
          <h2>Learn, teach, collaborate, build — and get hired.</h2>
          <p>Join a community of student builders. Find teammates, close your skill gaps and track your path to your first role.</p>
        </div>
        <p style={{ fontSize: 13 }}>Your data stays yours. Passwords are hashed; resumes are analysed, not shared.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card stack-lg">
          <div>
            <h1>{title}</h1>
            <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

const fieldErrors = (err) => Object.fromEntries((err?.errors || []).map((e) => [e.field, e.message]));

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const errs = fieldErrors(error);
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue to SkillBridge AI.">
      <form className="stack" onSubmit={submit} noValidate>
        {error && !error.errors && <div className="alert alert-danger" role="alert">{error.message}</div>}
        <Input label="Email" type="email" autoComplete="email" required value={form.email} error={errs.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" autoComplete="current-password" required value={form.password} error={errs.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button variant="primary" size="lg" block loading={busy} type="submit">Log in</Button>
        <Button type="button" variant="outline" block onClick={() => setForm({ email: 'demo@skillbridge.example', password: 'DemoPass123' })}>
          Fill in demo account
        </Button>
      </form>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/profile?welcome=1', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const errs = fieldErrors(error);
  return (
    <AuthShell title="Create your account" subtitle="It takes less than a minute.">
      <form className="stack" onSubmit={submit} noValidate>
        {error && !error.errors && <div className="alert alert-danger" role="alert">{error.message}</div>}
        <div className="grid-2">
          <Input label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} error={errs.firstName} />
          <Input label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} error={errs.lastName} />
        </div>
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errs.email} />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')}
          error={errs.password} hint="At least 8 characters, with a letter and a number." />
        <Select label="I want to" value={form.role} onChange={set('role')} options={[
          { value: 'student', label: 'Learn and build' },
          { value: 'mentor', label: 'Mentor others' },
          { value: 'both', label: 'Both learn and mentor' },
        ]} />
        <Button variant="primary" size="lg" block loading={busy} type="submit">Create account</Button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthShell>
  );
}
