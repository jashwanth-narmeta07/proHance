import { useEffect } from 'react';
import clsx from 'clsx';

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  ACTIVE: 'bg-green-50 text-green-700',
  IDLE: 'bg-amber-50 text-amber-700',
  OFFLINE: 'bg-gray-100 text-gray-600',
  REGISTERED: 'bg-blue-50 text-blue-700',
  INVITED: 'bg-amber-50 text-amber-700',
  PENDING: 'bg-amber-50 text-amber-700',
  ON_LEAVE: 'bg-blue-50 text-blue-700',
  SUSPENDED: 'bg-red-50 text-red-700',
  DEACTIVATED: 'bg-gray-100 text-gray-600',
  EXITED: 'bg-gray-100 text-gray-600',
  REVOKED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-gray-100 text-gray-600',
  ACCEPTED: 'bg-green-50 text-green-700',
};

export function StatusBadge({ status }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
      )}
    >
      {status}
    </span>
  );
}