import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as teamsApi from '../../services/teamsApi.js';
import * as departmentsApi from '../../services/departmentsApi.js';
import * as membersApi from '../../services/membersApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../constants/permissions.js';
import { Modal, StatusBadge } from '../../components/overlays.jsx';
import { EmptyState, FormError, Spinner } from '../../components/ui.jsx';

function TeamFormModal({ open, onClose, onSaved, team, departments, managers, canReassignManager }) {
  const isEdit = Boolean(team);
  const [form, setForm] = useState({ name: '', description: '', departmentId: '', managerId: '', status: 'ACTIVE' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: team?.name || '',
        description: team?.description || '',
        departmentId: team?.departmentId || '',
        managerId: team?.managerId || '',
        status: team?.status || 'ACTIVE',
      });
      setErrors({});
    }
  }, [open, team]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, description: form.description || undefined, status: form.status };
        if (canReassignManager) payload.managerId = form.managerId || null;
        await teamsApi.updateTeam(team._id, payload);
        toast.success('Team updated');
      } else {
        const payload = {
          name: form.name,
          description: form.description || undefined,
          departmentId: form.departmentId,
          ...(form.managerId ? { managerId: form.managerId } : {}),
        };
        await teamsApi.createTeam(payload);
        toast.success('Team created');
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
        toast.error(apiError?.message || `Failed to ${isEdit ? 'update' : 'create'} team`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit team' : 'New team'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input-field"
            placeholder="e.g. Platform"
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
            placeholder="Optional"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <FormError>{errors.description}</FormError>
        </div>
        {!isEdit && (
          <div>
            <label className="label">Department</label>
            <select
              className="input-field"
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">Select a department</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <FormError>{errors.departmentId}</FormError>
          </div>
        )}
        {canReassignManager && (
          <div>
            <label className="label">Manager</label>
            <select
              className="input-field"
              value={form.managerId}
              onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
            >
              <option value="">None</option>
              {managers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
            <FormError>{errors.managerId}</FormError>
          </div>
        )}
        {isEdit && (
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !form.name.trim() || (!isEdit && !form.departmentId)}
          >
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ open, onClose, team, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await teamsApi.deleteTeam(team._id);
      toast.success('Team deleted');
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete team">
      <p className="text-sm text-gray-600">
        Are you sure you want to delete <span className="font-medium text-gray-900">{team?.name}</span>? This can't
        be undone. Teams that still have members assigned can't be deleted.
      </p>
      <div className="flex justify-end gap-3 pt-5">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

export default function Teams() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('TEAM_MANAGE');
  const isManager = user?.role === ROLES.MANAGER;
  const canCreate = canManage && !isManager;
  const canReassignManager = !isManager;

  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const departmentName = useMemo(() => {
    const map = {};
    departments.forEach((d) => {
      map[d._id] = d.name;
    });
    return (id) => map[id] || '—';
  }, [departments]);

  const managerName = useMemo(() => {
    const map = {};
    managers.forEach((m) => {
      map[m._id] = `${m.firstName} ${m.lastName}`;
    });
    return (id) => (id ? map[id] || 'Unassigned' : 'Unassigned');
  }, [managers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsList, departmentsList, managersList] = await Promise.all([
        teamsApi.listTeams(),
        departmentsApi.listDepartments().catch(() => []),
        canReassignManager
          ? Promise.all([
              membersApi.listMembers({ role: ROLES.MANAGER }),
              membersApi.listMembers({ role: ROLES.ORGANIZATION_ADMIN }),
            ]).then(([a, b]) => [...a, ...b])
          : Promise.resolve([]),
      ]);
      setTeams(teamsList);
      setDepartments(departmentsList);
      setManagers(managersList);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [canReassignManager]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(team) {
    setEditing(team);
    setFormOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
        {canCreate && (
          <button className="btn-primary" onClick={openCreate}>
            New team
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : teams.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No teams yet"
            description={
              canCreate
                ? 'Create a team within a department to get started.'
                : isManager
                  ? "You don't manage any teams yet."
                  : 'No teams are visible to you yet.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Manager</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teams.map((team) => (
                <tr key={team._id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{team.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{departmentName(team.departmentId)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{managerName(team.managerId)}</td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={team.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right text-sm">
                      <button onClick={() => openEdit(team)} className="text-brand-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => setDeleting(team)} className="ml-4 text-red-600 hover:underline">
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

      <TeamFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        team={editing}
        departments={departments}
        managers={managers}
        canReassignManager={canReassignManager}
      />
      <DeleteConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} team={deleting} onDeleted={load} />
    </div>
  );
}
