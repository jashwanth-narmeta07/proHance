import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as membersApi from '../../services/membersApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../constants/permissions.js';
import { Modal, StatusBadge } from '../../components/overlays.jsx';
import { EmptyState, FormError, Spinner } from '../../components/ui.jsx';

const INVITABLE_ROLES = [ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.ORGANIZATION_ADMIN];

function InviteMemberModal({ open, onClose, onInvited }) {
  const [form, setForm] = useState({ email: '', role: ROLES.EMPLOYEE, departmentId: '', teamId: '', managerId: '' });
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    membersApi.listDepartments().then(setDepartments).catch(() => {});
    membersApi.listTeams().then(setTeams).catch(() => {});
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        email: form.email,
        role: form.role,
        ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        ...(form.teamId ? { teamId: form.teamId } : {}),
        ...(form.managerId ? { managerId: form.managerId } : {}),
      };
      await membersApi.inviteMember(payload);
      toast.success(`Invitation sent to ${form.email}`);
      setForm({ email: '', role: ROLES.EMPLOYEE, departmentId: '', teamId: '', managerId: '' });
      onInvited();
      onClose();
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Failed to send invitation');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Work email</label>
          <input
            type="email"
            className="input-field"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <FormError>{errors.email}</FormError>
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="input-field"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Department</label>
            <select
              className="input-field"
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Team</label>
            <select
              className="input-field"
              value={form.teamId}
              onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
            >
              <option value="">None</option>
              {teams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send invitation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({ open, onClose, onSaved, member, isOrgLevel }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    designation: '',
    departmentId: '',
    teamId: '',
    managerId: '',
    role: ROLES.EMPLOYEE,
    status: 'ACTIVE',
  });
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [potentialManagers, setPotentialManagers] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !member) return;
    setForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      designation: member.designation || '',
      departmentId: member.departmentId || '',
      teamId: member.teamId || '',
      managerId: member.managerId || '',
      role: member.role,
      status: member.status,
    });
    setErrors({});
    if (isOrgLevel) {
      membersApi.listDepartments().then(setDepartments).catch(() => {});
      membersApi.listTeams().then(setTeams).catch(() => {});
      membersApi
        .listMembers()
        .then((all) =>
          setPotentialManagers(
            all.filter((m) => [ROLES.MANAGER, ROLES.ORGANIZATION_ADMIN].includes(m.role) && m._id !== member._id)
          )
        )
        .catch(() => {});
    }
  }, [open, member, isOrgLevel]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const payload = { firstName: form.firstName, lastName: form.lastName, designation: form.designation };
      if (isOrgLevel) {
        payload.role = form.role;
        payload.status = form.status;
        payload.departmentId = form.departmentId || null;
        payload.teamId = form.teamId || null;
        payload.managerId = form.managerId || null;
      }
      await membersApi.updateMember(member._id, payload);
      toast.success('Member updated');
      onSaved();
      onClose();
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Failed to update member');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
        </div>
        <div>
          <label className="label">Designation</label>
          <input
            className="input-field"
            placeholder="e.g. Senior Engineer"
            value={form.designation}
            onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
          />
          <FormError>{errors.designation}</FormError>
        </div>

        {isOrgLevel && (
          <>
            <div>
              <label className="label">Role</label>
              <select
                className="input-field"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <FormError>{errors.role}</FormError>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Department</label>
                <select
                  className="input-field"
                  value={form.departmentId}
                  onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Team</label>
                <select
                  className="input-field"
                  value={form.teamId}
                  onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
                >
                  <option value="">None</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Manager</label>
              <select
                className="input-field"
                value={form.managerId}
                onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
              >
                <option value="">None</option>
                {potentialManagers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.firstName} {m.lastName} ({m.role})
                  </option>
                ))}
              </select>
              <FormError>{errors.managerId}</FormError>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
              <FormError>{errors.status}</FormError>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OffboardConfirmModal({ open, onClose, member, onOffboarded }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleOffboard() {
    setSubmitting(true);
    try {
      await membersApi.offboardMember(member._id);
      toast.success(`${member.firstName} ${member.lastName} has been offboarded`);
      onOffboarded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to offboard member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Remove member">
      <p className="text-sm text-gray-600">
        Remove <span className="font-medium text-gray-900">{member?.firstName} {member?.lastName}</span> from the
        organization? Their status moves to <code>EXITED</code> and their sessions are immediately invalidated -
        they won't be able to log in again. Their historical attendance, activity, and report data is kept intact,
        not deleted.
      </p>
      <div className="flex justify-end gap-3 pt-5">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary bg-red-600 hover:bg-red-700"
          onClick={handleOffboard}
          disabled={submitting}
        >
          {submitting ? 'Removing...' : 'Remove member'}
        </button>
      </div>
    </Modal>
  );
}

export default function Members() {
  const { hasPermission, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [offboarding, setOffboarding] = useState(null);
  const canInvite = hasPermission('MEMBER_INVITE');
  const canEdit = hasPermission('EMPLOYEE_UPDATE');
  const canRemove = hasPermission('MEMBER_MANAGE');
  const isOrgLevel = ['ORGANIZATION_ADMIN', 'HR'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersList, invitationsList] = await Promise.all([
        membersApi.listMembers(),
        canInvite ? membersApi.listInvitations('PENDING') : Promise.resolve([]),
      ]);
      setMembers(membersList);
      setInvitations(invitationsList);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [canInvite]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id) {
    try {
      await membersApi.revokeInvitation(id);
      toast.success('Invitation revoked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke invitation');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Members</h1>
        {canInvite && (
          <button className="btn-primary" onClick={() => setInviteOpen(true)}>
            Invite member
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {canInvite && invitations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-700">Pending invitations</h2>
              <div className="card mt-2 divide-y divide-gray-100 p-0">
                {invitations.map((inv) => (
                  <div key={inv._id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                      <p className="text-xs text-gray-500">{inv.role}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={inv.status} />
                      <button
                        onClick={() => handleRevoke(inv._id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            {members.length === 0 ? (
              <EmptyState
                title="No members yet"
                description={canInvite ? 'Invite your first team member to get started.' : 'No members are visible to you yet.'}
              />
            ) : (
              <div className="card overflow-hidden p-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                      {(canEdit || canRemove) && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map((m) => (
                      <tr key={m._id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {m.firstName} {m.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.role}</td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={m.status} />
                        </td>
                        {(canEdit || canRemove) && (
                          <td className="px-4 py-3 text-right text-sm">
                            {canEdit && (
                              <button onClick={() => setEditing(m)} className="text-brand-600 hover:underline">
                                Edit
                              </button>
                            )}
                            {canRemove && m.status !== 'EXITED' && (
                              <button
                                onClick={() => setOffboarding(m)}
                                className="ml-4 text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={load} />
      <EditMemberModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSaved={load}
        member={editing}
        isOrgLevel={isOrgLevel}
      />
      <OffboardConfirmModal
        open={Boolean(offboarding)}
        onClose={() => setOffboarding(null)}
        member={offboarding}
        onOffboarded={load}
      />
    </div>
  );
}
