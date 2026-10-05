import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as attendanceApi from '../../services/attendanceApi.js';
import { EmptyState, Spinner } from '../../components/ui.jsx';
import { StatusBadge } from '../../components/overlays.jsx';
import { formatClockTime, formatDuration } from '../../utils/formatDuration.js';

export default function TeamAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi
      .getTeamAttendance()
      .then(setRecords)
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load attendance'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Team attendance</h1>
      <p className="mt-1 text-sm text-gray-500">Today's check-in status for people you can view.</p>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : records.length === 0 ? (
          <EmptyState title="No team members found" />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Check-out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Break</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(({ user, attendance }) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {attendance ? formatClockTime(attendance.checkInAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {attendance?.checkOutAt ? formatClockTime(attendance.checkOutAt) : attendance ? 'Still in' : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {attendance ? formatDuration(attendance.breakDurationSeconds) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {attendance ? <StatusBadge status={attendance.status} /> : <StatusBadge status="ABSENT" />}
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
