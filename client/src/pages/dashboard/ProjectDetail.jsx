import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as projectsApi from '../../services/projectsApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { FormError, Spinner } from '../../components/ui.jsx';import { Modal, StatusBadge } from '../../components/overlays.jsx';

const COLUMNS = [
  { key: 'TODO', label: 'To do' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'COMPLETED', label: 'Completed' },
];

function NewTaskModal({ open, onClose, onCreated, projectId }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await projectsApi.createTask(projectId, form);
      toast.success('Task created');
      setForm({ title: '', description: '', priority: 'MEDIUM' });
      onCreated();
      onClose();
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Failed to create task');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input
            className="input-field"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <FormError>{errors.title}</FormError>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Priority</label>
          <select
            className="input-field"
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
          >
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskCard({ task, onMove }) {
  const nextColumns = COLUMNS.filter((c) => c.key !== task.status);
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <StatusBadge status={task.priority} />
      </div>
      {task.description && <p className="mt-1 text-xs text-gray-500">{task.description}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {nextColumns.map((c) => (
          <button
            key={c.key}
            onClick={() => onMove(task._id, c.key)}
            className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-200"
          >
            → {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('TASK_MANAGE');
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([projectsApi.getProject(id), projectsApi.listProjectTasks(id)]);
      setProject(p);
      setTasks(t);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMove(taskId, status) {
    try {
      await projectsApi.updateTask(taskId, { status });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status } : t)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  }

  if (loading || !project) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <Link to="/dashboard/projects" className="text-sm text-brand-600 hover:underline">
        ← All projects
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          {project.description && <p className="mt-1 text-sm text-gray-500">{project.description}</p>}
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            New task
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-lg bg-gray-50 p-3">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {col.label} ({colTasks.length})
              </h2>
              <div className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-gray-400">No tasks</p>
                ) : (
                  colTasks.map((t) => <TaskCard key={t._id} task={t} onMove={handleMove} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} projectId={id} />
    </div>
  );
}
