import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as projectsApi from '../../services/projectsApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState, FormError, Spinner } from '../../components/ui.jsx';
import { Modal, StatusBadge } from '../../components/overlays.jsx';

function NewProjectModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;
      await projectsApi.createProject(payload);
      toast.success('Project created');
      setForm({ name: '', description: '', startDate: '', endDate: '' });
      onCreated();
      onClose();
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Failed to create project');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <FormError>{errors.name}</FormError>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start date</label>
            <input
              type="date"
              className="input-field"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">End date</label>
            <input
              type="date"
              className="input-field"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Projects() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('PROJECT_MANAGE');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await projectsApi.listProjects());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
        {canManage && (
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            New project
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState title="No projects yet" description={canManage ? 'Create your first project to get started.' : undefined} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p._id}
                to={`/dashboard/projects/${p._id}`}
                className="card block transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">{p.name}</h2>
                  <StatusBadge status={p.status} />
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{p.description}</p>}
                <p className="mt-3 text-xs text-gray-400">{p.members?.length || 0} members</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  );
}
