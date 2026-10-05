import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { FormError } from '../../components/ui.jsx';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const initialState = {
  organization: {
    name: '',
    slug: '',
    companyEmail: '',
    industry: '',
    companySize: '',
    country: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    website: '',
  },
  admin: { firstName: '', lastName: '', email: '', password: '' },
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function RegisterOrganization() {
  const { registerOrganization } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  function updateOrg(field, value) {
    setForm((f) => ({
      ...f,
      organization: {
        ...f.organization,
        [field]: value,
        ...(field === 'name' && !slugTouched ? { slug: slugify(value) } : {}),
      },
    }));
  }

  function updateAdmin(field, value) {
    setForm((f) => ({ ...f, admin: { ...f.admin, [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        organization: {
          ...form.organization,
          companySize: form.organization.companySize || undefined,
          website: form.organization.website || undefined,
        },
      };
      await registerOrganization(payload);
      toast.success('Organization created');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field.replace(/^(organization|admin)\./, '')] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-center text-2xl font-semibold text-gray-900">
          Register your organization
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          This creates your organization and your Organization Admin account.
        </p>

        <form onSubmit={handleSubmit} className="card mt-6 space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900">Company details</legend>
            <div>
              <label className="label">Company name</label>
              <input
                className="input-field"
                value={form.organization.name}
                onChange={(e) => updateOrg('name', e.target.value)}
              />
              <FormError>{errors.name}</FormError>
            </div>
            <div>
              <label className="label">Organization slug (used to log in)</label>
              <input
                className="input-field"
                value={form.organization.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  updateOrg('slug', slugify(e.target.value));
                }}
              />
              <FormError>{errors.slug}</FormError>
            </div>
            <div>
              <label className="label">Company email</label>
              <input
                type="email"
                className="input-field"
                value={form.organization.companyEmail}
                onChange={(e) => updateOrg('companyEmail', e.target.value)}
              />
              <FormError>{errors.companyEmail}</FormError>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Industry</label>
                <input
                  className="input-field"
                  value={form.organization.industry}
                  onChange={(e) => updateOrg('industry', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Company size</label>
                <select
                  className="input-field"
                  value={form.organization.companySize}
                  onChange={(e) => updateOrg('companySize', e.target.value)}
                >
                  <option value="">Select...</option>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Country</label>
                <input
                  className="input-field"
                  value={form.organization.country}
                  onChange={(e) => updateOrg('country', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Website</label>
                <input
                  className="input-field"
                  placeholder="https://example.com"
                  value={form.organization.website}
                  onChange={(e) => updateOrg('website', e.target.value)}
                />
                <FormError>{errors.website}</FormError>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-gray-200 pt-4">
            <legend className="text-sm font-semibold text-gray-900">Your admin account</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name</label>
                <input
                  className="input-field"
                  value={form.admin.firstName}
                  onChange={(e) => updateAdmin('firstName', e.target.value)}
                />
                <FormError>{errors.firstName}</FormError>
              </div>
              <div>
                <label className="label">Last name</label>
                <input
                  className="input-field"
                  value={form.admin.lastName}
                  onChange={(e) => updateAdmin('lastName', e.target.value)}
                />
                <FormError>{errors.lastName}</FormError>
              </div>
            </div>
            <div>
              <label className="label">Admin email</label>
              <input
                type="email"
                className="input-field"
                value={form.admin.email}
                onChange={(e) => updateAdmin('email', e.target.value)}
              />
              <FormError>{errors.email}</FormError>
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input-field"
                value={form.admin.password}
                onChange={(e) => updateAdmin('password', e.target.value)}
              />
              <FormError>{errors.password}</FormError>
              <p className="mt-1 text-xs text-gray-400">
                At least 8 characters, with an uppercase letter and a number.
              </p>
            </div>
          </fieldset>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Creating organization...' : 'Create organization'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
