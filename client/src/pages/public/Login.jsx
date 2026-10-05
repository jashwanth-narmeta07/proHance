import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { FormError } from '../../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ organizationSlug: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await login(form);
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        const message = apiError?.message ||
          (err.response
            ? `Login failed (${err.response.status})`
            : 'Unable to reach the server. Check that the backend is running.');
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold text-gray-900">Log in</h1>
        <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="organizationSlug">
              Organization
            </label>
            <input
              id="organizationSlug"
              name="organizationSlug"
              className="input-field"
              placeholder="acme-technologies"
              value={form.organizationSlug}
              onChange={handleChange}
              autoComplete="organization"
            />
            <FormError>{errors.organizationSlug}</FormError>
          </div>
          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input-field"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            <FormError>{errors.email}</FormError>
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input-field"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
            <FormError>{errors.password}</FormError>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          New organization?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
