import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as goalsApi from '../../services/goalsApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Modal, StatusBadge } from '../../components/overlays.jsx';
import { EmptyState, FormError, Spinner } from '../../components/ui.jsx';

const METRIC_LABELS = {
  LOGGED_HOURS: 'Logged Hours',
  ACTIVE_HOURS: 'Active Hours',
};

function GoalFormModal({ open, onClose, onSaved, goal }) {
  const isEdit = Boolean(goal);
  const [form, setForm] = useState({
    name: '',
    metric: 'LOGGED_HOURS',
    comparator: 'GTE',
    thresholdHours: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: goal?.name || '',
      metric: goal?.metric || 'LOGGED_HOURS',
      comparator: goal?.comparator || 'GTE',
      thresholdHours: goal?.thresholdHours ?? '',
    });
    setErrors({});
  }, [open, goal]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        metric: form.metric,
        comparator: form.comparator,
        thresholdHours: Number(form.thresholdHours),
      };
      if (isEdit) {
        await goalsApi.updateGoal(goal._id, payload);
        toast.success('Goal updated');
      } else {
        await goalsApi.createGoal(payload);
        toast.success('Goal created');
      }
      onSaved();
      onClose();
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || `Failed to ${isEdit ? 'update' : 'create'} goal`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit goal' : 'New goal'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input-field"
            placeholder="e.g. Logged Hours >= 8.5"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <FormError>{errors.name}</FormError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Metric</label>
            <select
              className="input-field"
              value={form.metric}
              onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
            >
              <option value="LOGGED_HOURS">Logged Hours</option>
              <option value="ACTIVE_HOURS">Active Hours</option>
            </select>
          </div>
          <div>
            <label className="label">Comparison</label>
            <select
              className="input-field"
              value={form.comparator}
              onChange={(e) => setForm((f) => ({ ...f, comparator: e.target.value }))}
            >
              <option value="GTE">At least (≥)</option>
              <option value="LTE">At most (≤)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Threshold (hours per day)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            className="input-field"
            placeholder="e.g. 8.5"
            value={form.thresholdHours}
            onChange={(e) => setForm((f) => ({ ...f, thresholdHours: e.target.value }))}
          />
          <FormError>{errors.thresholdHours}</FormError>
        </div>
        <p className="text-xs text-gray-400">
          Applies to every active employee in the organization. Evaluated per calendar day against their Attendance
          and activity data - days with no attendance (weekends, days off) don't count against it.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !form.name.trim() || !form.thresholdHours}
          >
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create goal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ open, onClose, goal, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await goalsApi.deleteGoal(goal._id);
      toast.success('Goal deleted');
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete goal');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete goal">
      <p className="text-sm text-gray-600">
        Delete <span className="font-medium text-gray-900">{goal?.name}</span>? Employees will stop being evaluated
        against it immediately. This doesn't affect their historical attendance or activity data.
      </p>
      <div className="flex justify-end gap-3 pt-5">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary bg-red-600 hover:bg-red-700"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

export default function Goals() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('GOAL_MANAGE');
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await goalsApi.listGoals();
      setGoals(list);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal) {
    setEditing(goal);
    setFormOpen(true);
  }

  async function toggleStatus(goal) {
    try {
      await goalsApi.updateGoal(goal._id, { status: goal.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update goal');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Goals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Org-wide daily targets - every active employee sees their own progress against these on their Reports
            page.
          </p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            New goal
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : goals.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No goals yet"
            description={canManage ? 'Create a goal to start tracking it org-wide.' : 'No goals have been set up yet.'}
          />
        </div>
      ) : (
        <div className="mt-6 card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {goals.map((g) => (
                <tr key={g._id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{METRIC_LABELS[g.metric] || g.metric}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {g.comparator === 'LTE' ? '≤' : '≥'} {g.thresholdHours}h/day
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={g.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right text-sm">
                      <button onClick={() => openEdit(g)} className="text-brand-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => toggleStatus(g)} className="ml-4 text-gray-600 hover:underline">
                        {g.status === 'ACTIVE' ? 'Archive' : 'Reactivate'}
                      </button>
                      <button onClick={() => setDeleting(g)} className="ml-4 text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GoalFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} goal={editing} />
      <DeleteConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} goal={deleting} onDeleted={load} />
    </div>
  );
}
