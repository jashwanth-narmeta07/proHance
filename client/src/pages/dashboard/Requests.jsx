import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as requestsApi from '../../services/requestsApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState, FormError, Spinner } from '../../components/ui.jsx';
import { Modal, StatusBadge } from '../../components/overlays.jsx';

const TYPE_LABELS = {
  LEAVE: 'Leave',
  ATTENDANCE_CORRECTION: 'Attendance correction',
  WORK_FROM_HOME: 'Work from home',
  OVERTIME: 'Overtime',
  SHIFT_CHANGE: 'Shift change',
  IDLE_TIME_JUSTIFICATION: 'Idle time justification',
  PROFILE_CHANGE: 'Profile change',
  GENERAL: 'General',
};

function NewRequestModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ type: 'LEAVE', title: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      await requestsApi.createRequest(form);
      toast.success('Request submitted');
      setForm({ type: 'LEAVE', title: '', description: '' });
      onCreated();
      onClose();
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        const fieldErrors = {};
        for (const d of apiError.details) fieldErrors[d.field] = d.message;
        setErrors(fieldErrors);
      } else {
        toast.error(apiError?.message || 'Failed to submit request');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New request">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Type</label>
          <select
            className="input-field"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {requestsApi.REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input
            className="input-field"
            placeholder="e.g. Leave on 28 August"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <FormError>{errors.title}</FormError>
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
        <p className="text-xs text-gray-400">
          This will automatically notify your manager and HR - you don't need to choose who reviews it.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequestRow({ request, canReview, onDecision }) {
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [showComment, setShowComment] = useState(false);

  async function decide(decision) {
    setPending(true);
    try {
      await onDecision(request._id, decision, comment);
      setShowComment(false);
      setComment('');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{request.title}</p>
          <p className="text-xs text-gray-500">
            {TYPE_LABELS[request.type]} - {new Date(request.createdAt).toLocaleDateString()}
          </p>
          {request.description && <p className="mt-1 text-sm text-gray-600">{request.description}</p>}
        </div>
        <StatusBadge status={request.status} />
      </div>

      {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
        <div className="mt-3">
          {showComment ? (
            <div className="space-y-2">
              <textarea
                className="input-field"
                rows={2}
                placeholder="Optional comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn-secondary text-sm" onClick={() => decide('REJECTED')} disabled={pending}>
                  Reject
                </button>
                <button className="btn-primary text-sm" onClick={() => decide('APPROVED')} disabled={pending}>
                  Approve
                </button>
              </div>
            </div>
          ) : (
            <button className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setShowComment(true)}>
              Review
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Requests() {
  const { hasPermission } = useAuth();
  const canReview = hasPermission('REQUEST_APPROVE');
  const [tab, setTab] = useState('mine');
  const [myRequests, setMyRequests] = useState([]);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, review] = await Promise.all([
        requestsApi.listMyRequests(),
        canReview ? requestsApi.listForReview() : Promise.resolve([]),
      ]);
      setMyRequests(mine);
      setReviewRequests(review);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [canReview]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecision(id, decision, comment) {
    try {
      if (decision === 'APPROVED') await requestsApi.approveRequest(id, comment);
      else await requestsApi.rejectRequest(id, comment);
      toast.success(`Request ${decision.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  }

  const list = tab === 'mine' ? myRequests : reviewRequests;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Requests</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          New request
        </button>
      </div>

      {canReview && (
        <div className="mt-4 flex gap-1 border-b border-gray-200">
          <button
            className={`px-3 py-2 text-sm font-medium ${tab === 'mine' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500'}`}
            onClick={() => setTab('mine')}
          >
            My requests
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium ${tab === 'review' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500'}`}
            onClick={() => setTab('review')}
          >
            For my review {reviewRequests.length > 0 && `(${reviewRequests.length})`}
          </button>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <EmptyState title={tab === 'mine' ? "You haven't submitted any requests" : 'Nothing waiting for review'} />
        ) : (
          <div className="card divide-y divide-gray-100 p-0">
            {list.map((r) => (
              <RequestRow key={r._id} request={r} canReview={tab === 'review'} onDecision={handleDecision} />
            ))}
          </div>
        )}
      </div>

      <NewRequestModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  );
}
