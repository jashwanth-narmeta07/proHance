import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../constants/permissions.js';
import { StatCard } from '../../components/ui.jsx';
import * as attendanceApi from '../../services/attendanceApi.js';
import { formatClockTime, formatDuration } from '../../utils/formatDuration.js';

function AdminOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axiosClient
      .get('/organizations/overview')
      .then(({ data }) => {
        if (!cancelled) setOverview(data.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total members" value={loading ? '—' : overview?.totalMembers ?? 0} />
      <StatCard
        label="Managers"
        value={loading ? '—' : overview?.roleCounts?.MANAGER ?? 0}
      />
      <StatCard label="HR" value={loading ? '—' : overview?.roleCounts?.HR ?? 0} />
      <StatCard
        label="Employees"
        value={loading ? '—' : overview?.roleCounts?.EMPLOYEE ?? 0}
      />
    </div>
  );
}

function GenericOverview() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi
      .getToday()
      .then(setState)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const attendance = state?.attendance;
  const checkedIn = state?.workSession?.status === 'ACTIVE';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Today's status"
        value={loading ? '—' : checkedIn ? 'Checked in' : attendance ? 'Checked out' : 'Not checked in'}
        hint={attendance ? `Since ${formatClockTime(attendance.checkInAt)}` : undefined}
      />
      <StatCard
        label="Break time"
        value={loading ? '—' : formatDuration(attendance?.breakDurationSeconds || 0)}
      />
      <StatCard label="Open requests" value="—" hint="Available once requests are built" />
      <StatCard label="Notifications" value="—" hint="Available once notifications are built" />
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">
        Welcome back, {user?.firstName}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {user?.role === ROLES.ORGANIZATION_ADMIN
          ? 'Organization overview'
          : `Signed in as ${user?.role}`}
      </p>

      <div className="mt-6">
        {user?.role === ROLES.ORGANIZATION_ADMIN ? <AdminOverview /> : <GenericOverview />}
      </div>
    </div>
  );
}
