import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as departmentsApi from '../../services/departmentsApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Modal, StatusBadge } from '../../components/overlays.jsx';
import { EmptyState, FormError, Spinner } from '../../components/ui.jsx';

function DepartmentFormModal({ open, onClose, onSaved, department }) {
  const isEdit = Boolean(department);
  const [form, setForm] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: department?.name || '', description: department?.description || '' });
      setErrors({});
    }
  }, [open, department]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const payload = { name: form.name, description: form.description || undefined };
      if (isEdit) {
        await departmentsApi.updateDepartment(department._id, payload);
        toast.success('Department updated');
      } else {
        await departmentsApi.createDepartment(payload);
        toast.success('Department created');
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
        toast.error(apiError?.message || `Failed to ${isEdit ? 'update' : 'create'} department`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit department' : 'New department'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input-field"
            placeholder="e.g. Engineering"
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
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || !form.name.trim()}>
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create department'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ open, onClose, department, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await departmentsApi.deleteDepartment(department._id);
      toast.success('Department deleted');
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete department">
      <p className="text-sm text-gray-600">
        Are you sure you want to delete <span className="font-medium text-gray-900">{department?.name}</span>? This
        can't be undone. Departments that still have teams or members assigned can't be deleted.
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

export default function Departments() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('DEPARTMENT_MANAGE');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await departmentsApi.listDepartments();
      setDepartments(list);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load departments');
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

  function openEdit(dept) {
    setEditing(dept);
    setFormOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Departments</h1>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            New department
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : departments.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No departments yet"
            description={canManage ? 'Create your first department to start organizing teams.' : 'No departments are visible to you yet.'}
          />
        </div>
      ) : (
        <div className="mt-6 card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments.map((dept) => (
                <tr key={dept._id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{dept.description || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={dept.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right text-sm">
                      <button onClick={() => openEdit(dept)} className="text-brand-600 hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(dept)}
                        className="ml-4 text-red-600 hover:underline"
                      >
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

      <DepartmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        department={editing}
      />
      <DeleteConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        department={deleting}
        onDeleted={load}
      />
    </div>
  );
}
