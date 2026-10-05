import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as membersApi from '../../services/membersApi.js';
import { FormError } from '../../components/ui.jsx';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    if (!token) {
      toast.error('This invitation link is missing its token');
      return;
    }
    setSubmitting(true);
    try {
      await membersApi.acceptInvitation({ token, ...form });
      setDone(true);
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Failed to accept invitation');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="card max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900">You're all set</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account has been created. You can now log in with your organization, email, and password.
          </p>
          <button className="btn-primary mt-4 w-full" onClick={() => navigate('/login')}>
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold text-gray-900">Accept your invitation</h1>
        <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
          {!token && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This link is missing its invitation token. Use the link from your invitation email.
            </p>
          )}
          <div>
            <label className="label">First name</label>
            <input
              className="input-field"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <FormError>{errors.firstName}</FormError>
          </div>
          <div>
            <label className="label">Last name</label>
            <input
              className="input-field"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
            <FormError>{errors.lastName}</FormError>
          </div>
          <div>
            <label className="label">Create a password</label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <FormError>{errors.password}</FormError>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Setting up your account...' : 'Accept & create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
