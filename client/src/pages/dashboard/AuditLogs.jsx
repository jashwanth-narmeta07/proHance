import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as auditLogApi from '../../services/auditLogApi.js';
import { EmptyState, Spinner } from '../../components/ui.jsx';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditLogApi
      .listAuditLogs()
      .then(setLogs)
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Audit logs</h1>
      <p className="mt-1 text-sm text-gray-500">A record of sensitive actions taken across the organization.</p>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {log.action.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.targetEntity} · {String(log.targetId).slice(-6)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{String(log.actorId).slice(-6)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
