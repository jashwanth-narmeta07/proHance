import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import * as analyticsApi from '../../services/analyticsApi.js';
import * as goalsApi from '../../services/goalsApi.js';
import * as departmentsApi from '../../services/departmentsApi.js';
import * as teamsApi from '../../services/teamsApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../constants/permissions.js';
import { Spinner, StatCard } from '../../components/ui.jsx';
import { Modal } from '../../components/overlays.jsx';
import { formatDuration } from '../../utils/formatDuration.js';

const UNCLASSIFIED_IDLE_LABEL = 'Unclassified Idle Time';

function SummaryCards({ summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Computer Active Time" value={formatDuration(summary.computerActiveTimeSeconds)} />
      <StatCard label="Meeting Time" value={formatDuration(summary.meetingTimeSeconds)} />
      <StatCard label="Break Time" value={formatDuration(summary.breakTimeSeconds)} />
      <StatCard
        label={UNCLASSIFIED_IDLE_LABEL}
        value={formatDuration(summary.unclassifiedIdleTimeSeconds)}
        hint="Not yet justified - not a productivity judgment"
      />
      <StatCard
        label="Attendance days"
        value={summary.attendanceDays ?? '—'}
        hint={
          summary.recordedDays > summary.attendanceDays
            ? `${summary.recordedDays} day(s) checked in - counts here need 7h+`
            : 'Days meeting the org\'s full-day minimum'
        }
      />
      <StatCard label="Late arrivals" value={summary.lateArrivalCount ?? '—'} />
      <StatCard label="Overtime days" value={summary.overtimeCount ?? '—'} />
      <StatCard label="Absences" value={summary.absentCount ?? '—'} />
    </div>
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One employee's full stat-card overview, opened from either the HR/Admin
 * "By employee" table or a manager's "By team member" table - the server
 * (getEmployeeOverview) enforces which caller is allowed to open which
 * employee, so this component doesn't need to know which case it's in.
 *
 * Defaults to the range the calling table is currently showing
 * (rangeFilters), and lets the viewer pick one specific date to drill into
 * that single day's numbers instead - "Whole range" switches back.
 */
function EmployeeOverviewModal({ employee, rangeFilters, onClose }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return undefined;
    setSelectedDate('');
    setOverview(null);
  }, [employee]);

  useEffect(() => {
    if (!employee) return undefined;
    let cancelled = false;
    setLoading(true);
    const params = selectedDate
      ? { from: selectedDate, to: selectedDate }
      : Object.fromEntries(Object.entries(rangeFilters || {}).filter(([, v]) => v));
    analyticsApi
      .getEmployeeOverview(employee.id, params)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.response?.data?.message || 'Failed to load employee overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employee, selectedDate, rangeFilters]);

  if (!employee) return null;

  return (
    <Modal open={Boolean(employee)} onClose={onClose} title={`${employee.name} - overview`}>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="overview-date">
            Day overview
          </label>
          <input
            id="overview-date"
            type="date"
            className="input-field"
            max={todayIsoDate()}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        {selectedDate && (
          <button className="btn-secondary" onClick={() => setSelectedDate('')}>
            Whole range
          </button>
        )}
        {overview?.user && (
          <span className="ml-auto text-xs text-gray-500">
            {overview.user.departmentName || 'No department'} · {overview.user.teamName || 'No team'}
          </span>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          overview && <SummaryCards summary={overview.summary} />
        )}
      </div>
    </Modal>
  );
}

const BREAKDOWN_COLORS = ['#2563eb', '#93c5fd', '#34d399', '#e5e7eb'];

function SelfBreakdownChart({ summary }) {
  const chartData = [
    { name: 'Active', minutes: Math.round((summary.computerActiveTimeSeconds || 0) / 60) },
    { name: 'Meeting', minutes: Math.round((summary.meetingTimeSeconds || 0) / 60) },
    { name: 'Break', minutes: Math.round((summary.breakTimeSeconds || 0) / 60) },
    { name: UNCLASSIFIED_IDLE_LABEL, minutes: Math.round((summary.unclassifiedIdleTimeSeconds || 0) / 60) },
  ].filter((d) => d.minutes > 0);

  if (chartData.length === 0) {
    return (
      <div className="card mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Time breakdown</h2>
        <p className="text-sm text-gray-500">No tracked time in this period yet.</p>
      </div>
    );
  }

  return (
    <div className="card mt-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Time breakdown</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="minutes" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
            {chartData.map((entry, i) => (
              <Cell key={entry.name} fill={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} min`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TeamBreakdownChart({ members }) {
  const chartData = members.map((m) => ({
    name: `${m.user.firstName} ${m.user.lastName?.[0] || ''}.`,
    'Active (min)': Math.round((m.summary.computerActiveTimeSeconds || 0) / 60),
    'Meeting (min)': Math.round((m.summary.meetingTimeSeconds || 0) / 60),
    'Break (min)': Math.round((m.summary.breakTimeSeconds || 0) / 60),
    'Idle (min)': Math.round((m.summary.unclassifiedIdleTimeSeconds || 0) / 60),
  }));

  return (
    <div className="card mt-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Team breakdown</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: 'minutes', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Active (min)" fill="#2563eb" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Meeting (min)" fill="#93c5fd" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Break (min)" fill="#34d399" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Idle (min)" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const TEAM_TABLE_COLUMNS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'computerActiveTimeSeconds', label: 'Active', type: 'number' },
  { key: 'meetingTimeSeconds', label: 'Meeting', type: 'number' },
  { key: 'breakTimeSeconds', label: 'Break', type: 'number' },
  { key: 'unclassifiedIdleTimeSeconds', label: UNCLASSIFIED_IDLE_LABEL, type: 'number' },
  { key: 'attendanceDays', label: 'Attendance days (7h+)', type: 'number' },
  { key: 'recordedDays', label: 'Days present', type: 'number' },
  { key: 'lateArrivalCount', label: 'Late', type: 'number' },
  { key: 'overtimeCount', label: 'Overtime days', type: 'number' },
  { key: 'absentCount', label: 'Absences', type: 'number' },
];

const EMPTY_TEAM_FILTERS = { from: '', to: '' };

/**
 * A manager's "all team reports" table - every direct report's full stat
 * card set in one sortable, date-filterable table, each row opening the
 * same EmployeeOverviewModal used from the HR/Admin employee table (the
 * server scopes getEmployeeOverview to a manager's own reports, so this
 * works without any extra permission plumbing here).
 */
function TeamMemberOverviewTable({ initialMembers }) {
  const [rows, setRows] = useState(() => mapTeamMembers(initialMembers));
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_TEAM_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_TEAM_FILTERS);
  const [sortKey, setSortKey] = useState('unclassifiedIdleTimeSeconds');
  const [sortDir, setSortDir] = useState('desc');
  const [overviewFor, setOverviewFor] = useState(null);

  function mapTeamMembers(members) {
    return (members || []).map((m) => ({
      id: m.user.id,
      name: `${m.user.firstName} ${m.user.lastName}`,
      computerActiveTimeSeconds: m.summary.computerActiveTimeSeconds || 0,
      meetingTimeSeconds: m.summary.meetingTimeSeconds || 0,
      breakTimeSeconds: m.summary.breakTimeSeconds || 0,
      unclassifiedIdleTimeSeconds: m.summary.unclassifiedIdleTimeSeconds || 0,
      attendanceDays: m.summary.attendanceDays || 0,
      recordedDays: m.summary.recordedDays || 0,
      lateArrivalCount: m.summary.lateArrivalCount || 0,
      overtimeCount: m.summary.overtimeCount || 0,
      absentCount: m.summary.absentCount || 0,
    }));
  }

  async function applyFilters(activeFilters = filters) {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(activeFilters).filter(([, v]) => v !== ''));
      const members = await analyticsApi.getTeamSummary(params);
      setRows(mapTeamMembers(members));
      setAppliedFilters(activeFilters);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load team reports');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFilters(EMPTY_TEAM_FILTERS);
    applyFilters(EMPTY_TEAM_FILTERS);
  }

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir(TEAM_TABLE_COLUMNS.find((c) => c.key === key)?.type === 'string' ? 'asc' : 'desc');
    }
  }

  const filtersDirty = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(appliedFilters),
    [filters, appliedFilters]
  );

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const column = TEAM_TABLE_COLUMNS.find((c) => c.key === sortKey);
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const cmp =
        column?.type === 'string'
          ? String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''))
          : (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
      return cmp !== 0 ? cmp * dir : a.name.localeCompare(b.name);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="card mt-6">
      <h2 className="text-sm font-semibold text-gray-700">By team member - all team reports</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="team-from">
            From
          </label>
          <input
            id="team-from"
            type="date"
            className="input-field"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="team-to">
            To
          </label>
          <input
            id="team-to"
            type="date"
            className="input-field"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => applyFilters()} disabled={loading}>
          {loading ? 'Applying...' : 'Apply filters'}
        </button>
        <button className="btn-secondary" onClick={handleReset} disabled={loading}>
          Reset
        </button>
        {filtersDirty && !loading && (
          <span className="text-xs text-amber-600">Filters changed - apply to refresh the table.</span>
        )}
        <span className="ml-auto text-xs text-gray-500">{sortedRows.length} team members</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              {TEAM_TABLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 hover:text-gray-700"
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === 'asc' ? ' \u25b2' : ' \u25bc')}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{r.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDuration(r.computerActiveTimeSeconds)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDuration(r.meetingTimeSeconds)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDuration(r.breakTimeSeconds)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                  {formatDuration(r.unclassifiedIdleTimeSeconds)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.attendanceDays}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.recordedDays}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.lateArrivalCount}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.overtimeCount}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.absentCount}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => setOverviewFor({ id: r.id, name: r.name })}
                    className="text-brand-600 hover:underline"
                  >
                    View overview
                  </button>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={TEAM_TABLE_COLUMNS.length + 1} className="px-3 py-6 text-center text-gray-500">
                  No team members found for these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EmployeeOverviewModal
        employee={overviewFor}
        rangeFilters={appliedFilters}
        onClose={() => setOverviewFor(null)}
      />
    </div>
  );
}

function TeamGroupBreakdownChart({ teamBreakdown }) {
  if (!teamBreakdown || teamBreakdown.length === 0) return null;

  const chartData = teamBreakdown.map((t) => ({
    name: `${t.teamName} (${t.headcount})`,
    'Active (min)': Math.round((t.summary.computerActiveTimeSeconds || 0) / 60),
    'Meeting (min)': Math.round((t.summary.meetingTimeSeconds || 0) / 60),
    'Break (min)': Math.round((t.summary.breakTimeSeconds || 0) / 60),
    'Idle (min)': Math.round((t.summary.unclassifiedIdleTimeSeconds || 0) / 60),
  }));

  return (
    <div className="card mt-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Breakdown by team</h2>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: 'minutes', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Active (min)" fill="#2563eb" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Meeting (min)" fill="#93c5fd" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Break (min)" fill="#34d399" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Idle (min)" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const EMPLOYEE_TABLE_COLUMNS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'departmentName', label: 'Department', type: 'string' },
  { key: 'teamName', label: 'Team', type: 'string' },
  { key: 'computerActiveTimeSeconds', label: 'Active', type: 'number' },
  { key: 'meetingTimeSeconds', label: 'Meeting', type: 'number' },
  { key: 'breakTimeSeconds', label: 'Break', type: 'number' },
  { key: 'unclassifiedIdleTimeSeconds', label: UNCLASSIFIED_IDLE_LABEL, type: 'number' },
  { key: 'attendanceDays', label: 'Attendance days (7h+)', type: 'number' },
  { key: 'recordedDays', label: 'Days present', type: 'number' },
  { key: 'lateArrivalCount', label: 'Late', type: 'number' },
  { key: 'overtimeCount', label: 'Overtime days', type: 'number' },
  { key: 'absentCount', label: 'Absences', type: 'number' },
];

const EMPTY_FILTERS = { departmentId: '', teamId: '', from: '', to: '' };

/**
 * Two different kinds of narrowing live here, deliberately:
 *
 *  - department/team/date go to the server, because they change which
 *    employees get summarized at all (one aggregation pair each - see
 *    getOrganizationEmployeeBreakdown). Changing them needs a reload.
 *  - the name box and the column sort are pure client-side work on rows
 *    already in hand, so they stay instant and never re-hit the API.
 */
function EmployeeBreakdownTable() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('unclassifiedIdleTimeSeconds');
  const [sortDir, setSortDir] = useState('desc');
  const [appsFor, setAppsFor] = useState(null); // { id, name } of the employee whose apps modal is open
  const [overviewFor, setOverviewFor] = useState(null); // { id, name } of the employee whose overview modal is open

  // Only fetched once the table is opened - no point paying for these lists
  // on a page load where nobody expands the breakdown.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    Promise.all([departmentsApi.listDepartments(), teamsApi.listTeams()])
      .then(([deptList, teamList]) => {
        if (cancelled) return;
        setDepartments(deptList || []);
        setTeams(teamList || []);
      })
      .catch(() => {
        // Non-fatal: the table still works, the dropdowns just stay empty.
        if (!cancelled) toast.error('Could not load department/team filters');
      });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  async function loadEmployees(activeFilters = filters) {
    setLoading(true);
    try {
      // Blank selects must not be sent as empty strings - the route's
      // validator rejects anything that isn't a valid ObjectId.
      const params = Object.fromEntries(Object.entries(activeFilters).filter(([, v]) => v !== ''));
      const employees = await analyticsApi.getOrganizationEmployeeBreakdown(params);
      setRows(
        employees.map((e) => ({
          id: e.user.id,
          name: `${e.user.firstName} ${e.user.lastName}`,
          departmentName: e.user.departmentName || 'No department',
          teamName: e.user.teamName || 'No team',
          computerActiveTimeSeconds: e.summary.computerActiveTimeSeconds || 0,
          meetingTimeSeconds: e.summary.meetingTimeSeconds || 0,
          breakTimeSeconds: e.summary.breakTimeSeconds || 0,
          unclassifiedIdleTimeSeconds: e.summary.unclassifiedIdleTimeSeconds || 0,
          attendanceDays: e.summary.attendanceDays || 0,
          recordedDays: e.summary.recordedDays || 0,
          lateArrivalCount: e.summary.lateArrivalCount || 0,
          overtimeCount: e.summary.overtimeCount || 0,
          absentCount: e.summary.absentCount || 0,
        }))
      );
      setAppliedFilters(activeFilters);
      setLoaded(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load employee breakdown');
    } finally {
      setLoading(false);
    }
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    loadEmployees(EMPTY_FILTERS);
  }

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      // Names read best A-Z; a duration column is nearly always being
      // opened to find the largest value, so default that one to desc.
      setSortDir(EMPLOYEE_TABLE_COLUMNS.find((c) => c.key === key)?.type === 'string' ? 'asc' : 'desc');
    }
  }

  const filtersDirty = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(appliedFilters),
    [filters, appliedFilters]
  );

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    const copy = needle
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            r.departmentName.toLowerCase().includes(needle) ||
            r.teamName.toLowerCase().includes(needle)
        )
      : [...rows];

    const column = EMPLOYEE_TABLE_COLUMNS.find((c) => c.key === sortKey);
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        column?.type === 'string'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : (av ?? 0) - (bv ?? 0);
      // Ties fall back to name so the row order stays stable between
      // re-sorts instead of shuffling (very common once idle is all zeros).
      return cmp !== 0 ? cmp * dir : a.name.localeCompare(b.name);
    });
    return copy;
  }, [rows, search, sortKey, sortDir]);

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">By employee</h2>
        {!loaded && (
          <button className="btn-secondary" onClick={() => loadEmployees()} disabled={loading}>
            {loading ? 'Loading...' : 'Load employee breakdown'}
          </button>
        )}
      </div>
      {!loaded && (
        <p className="mt-2 text-sm text-gray-500">
          Loaded on demand - this runs one query per employee, so it's kept out of the initial page load.
        </p>
      )}

      {loaded && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="label" htmlFor="emp-department">
                Department
              </label>
              <select
                id="emp-department"
                className="input-field"
                value={filters.departmentId}
                onChange={(e) => setFilter('departmentId', e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id || d._id} value={d.id || d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="emp-team">
                Team
              </label>
              <select
                id="emp-team"
                className="input-field"
                value={filters.teamId}
                onChange={(e) => setFilter('teamId', e.target.value)}
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id || t._id} value={t.id || t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="emp-from">
                From
              </label>
              <input
                id="emp-from"
                type="date"
                className="input-field"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => setFilter('from', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="emp-to">
                To
              </label>
              <input
                id="emp-to"
                type="date"
                className="input-field"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => setFilter('to', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="emp-search">
                Search
              </label>
              <input
                id="emp-search"
                type="search"
                className="input-field"
                placeholder="Name, department, team"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => loadEmployees()} disabled={loading}>
              {loading ? 'Applying...' : 'Apply filters'}
            </button>
            <button className="btn-secondary" onClick={handleReset} disabled={loading}>
              Reset
            </button>
            {filtersDirty && !loading && (
              <span className="text-xs text-amber-600">Filters changed - apply to refresh the table.</span>
            )}
            <span className="ml-auto text-xs text-gray-500">
              {visibleRows.length} of {rows?.length ?? 0} employees
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr>
                  {EMPLOYEE_TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="cursor-pointer whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 hover:text-gray-700"
                    >
                      {col.label}
                      {sortKey === col.key && (sortDir === 'asc' ? ' \u25b2' : ' \u25bc')}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{r.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.departmentName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.teamName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatDuration(r.computerActiveTimeSeconds)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDuration(r.meetingTimeSeconds)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDuration(r.breakTimeSeconds)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatDuration(r.unclassifiedIdleTimeSeconds)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.attendanceDays}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.recordedDays}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.lateArrivalCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.overtimeCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.absentCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => setOverviewFor({ id: r.id, name: r.name })}
                        className="text-brand-600 hover:underline"
                      >
                        View overview
                      </button>{' '}
                      <button onClick={() => setAppsFor({ id: r.id, name: r.name })} className="text-brand-600 hover:underline">
                        View apps
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={EMPLOYEE_TABLE_COLUMNS.length + 1} className="px-3 py-6 text-center text-gray-500">
                      {rows && rows.length > 0
                        ? 'No employees match that search.'
                        : 'No employees found for these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={Boolean(appsFor)} onClose={() => setAppsFor(null)} title={appsFor ? `${appsFor.name} - app usage` : ''}>
        {appsFor && (
          <TopAppsChart
            fetchFn={() => analyticsApi.getEmployeeTopApps(appsFor.id)}
            title=""
          />
        )}
      </Modal>

      <EmployeeOverviewModal
        employee={overviewFor}
        rangeFilters={{ from: appliedFilters.from, to: appliedFilters.to }}
        onClose={() => setOverviewFor(null)}
      />
    </div>
  );
}

function TopAppsChart({ fetchFn, title = 'Top apps by time' }) {
  const [apps, setApps] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn()
      .then((result) => {
        if (!cancelled) setApps(result);
      })
      .catch(() => {
        if (!cancelled) setApps([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFn]);

  if (loading) {
    return (
      <div className="card mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <div className="card mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
        <p className="text-sm text-gray-500">
          No app usage data yet. This needs "Track app usage" turned on in Policies - and even then it only
          ever records the app name, never window titles or on-screen content.
        </p>
      </div>
    );
  }

  const chartData = apps.map((a) => ({
    name: a.appName,
    minutes: Math.round((a.durationSeconds || 0) / 60),
  }));

  return (
    <div className="card mt-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">{title}</h2>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            label={{ value: 'minutes', position: 'insideBottom', offset: -5, fontSize: 11 }}
          />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
          <Tooltip formatter={(value) => `${value} min`} />
          <Bar dataKey="minutes" fill="#2563eb" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChangeIndicator({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const isFlat = value === 0;
  const isUp = value > 0;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isFlat ? 'text-gray-400' : isUp ? 'text-emerald-600' : 'text-red-500'
      )}
    >
      {!isFlat && (isUp ? '▲' : '▼')} {Math.abs(value)}%
    </span>
  );
}

function MetricTrendCard({ title, todayDisplay, comparisons, valueOf, changeOf }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <p className="mt-1 text-xs text-gray-400">Today</p>
      <p className="text-2xl font-semibold text-gray-900">{todayDisplay}</p>
      <table className="mt-4 w-full text-xs">
        <tbody>
          {comparisons.map((c) => (
            <tr key={c.key} className="border-t border-gray-100">
              <td className="py-1.5 text-gray-500">{c.label}</td>
              <td className="py-1.5 text-right text-gray-700">{valueOf(c)}</td>
              <td className="py-1.5 pl-3 text-right">
                <ChangeIndicator value={changeOf(c)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Utilization/Efficiency and the 7D/15D/MTD trend comparisons - Section 20
 * still applies here: these are neutral ratios this product defines for
 * itself (see the comment on computeDerivedMetrics in analytics.service.js),
 * not an audited industry-standard "productivity score".
 */
function TrendSection({ trend }) {
  if (!trend || !trend.today) return null;
  const { today, comparisons } = trend;
  if (comparisons.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Trends</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard
          title="Utilization"
          todayDisplay={`${today.utilizationPercent}%`}
          comparisons={comparisons}
          valueOf={(c) => `${c.utilizationPercent}%`}
          changeOf={(c) => c.change.utilizationPercent}
        />
        <MetricTrendCard
          title="Efficiency"
          todayDisplay={`${today.efficiencyPercent}%`}
          comparisons={comparisons}
          valueOf={(c) => `${c.efficiencyPercent}%`}
          changeOf={(c) => c.change.efficiencyPercent}
        />
        <MetricTrendCard
          title="Logged Hours"
          todayDisplay={formatDuration(today.loggedSeconds)}
          comparisons={comparisons}
          valueOf={(c) => `avg ${formatDuration(c.avgLoggedSeconds)}`}
          changeOf={(c) => c.change.loggedSeconds}
        />
        <MetricTrendCard
          title="Active Hours"
          todayDisplay={formatDuration(today.activeSeconds)}
          comparisons={comparisons}
          valueOf={(c) => `avg ${formatDuration(c.avgActiveSeconds)}`}
          changeOf={(c) => c.change.activeSeconds}
        />
      </div>
    </div>
  );
}

function GoalProgressSection() {
  const [goals, setGoals] = useState(null);

  useEffect(() => {
    let cancelled = false;
    goalsApi
      .getGoalProgress()
      .then((result) => {
        if (!cancelled) setGoals(result);
      })
      .catch(() => {
        if (!cancelled) setGoals([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!goals || goals.length === 0) return null; // no active goals configured - nothing to clutter the page with

  return (
    <div className="card mt-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">My goals</h2>
      <div className="space-y-5">
        {goals.map((g) => (
          <div key={g.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">{g.name}</span>
              <span className="text-xs text-gray-500">
                {g.metric === 'ACTIVE_HOURS' ? 'Active hours' : 'Logged hours'} {g.comparator === 'LTE' ? '≤' : '≥'}{' '}
                {g.thresholdHours}h/day
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <div className="flex gap-1">
                {g.dailyResults.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${formatDuration(d.valueSeconds)}${d.met === null ? ' (no attendance)' : ''}`}
                    className={clsx(
                      'h-5 w-5 rounded',
                      d.met === null ? 'bg-gray-100' : d.met ? 'bg-emerald-400' : 'bg-red-300'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                WTD:{' '}
                {g.wtd.daysElapsed > 0 ? `${g.wtd.daysMet}/${g.wtd.daysElapsed} (${g.wtd.percentMet}%)` : 'No data yet'}
              </span>
              <span className="text-xs text-gray-500">
                MTD:{' '}
                {g.mtd.daysElapsed > 0 ? `${g.mtd.daysMet}/${g.mtd.daysElapsed} (${g.mtd.percentMet}%)` : 'No data yet'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Lets an employee pick one calendar date and see their own overview for
 * just that day - same stat cards as the page's overall summary above,
 * just re-fetched with from=to=<date>. Left self-contained (own date
 * state, own fetch) so picking a date never disturbs the default range
 * shown in the cards above it.
 */
function SelfDayOverview() {
  const [date, setDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setSummary(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    analyticsApi
      .getMySummary({ from: date, to: date })
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.response?.data?.message || 'Failed to load that day\'s overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="card mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Day overview</h2>
          <p className="mt-1 text-xs text-gray-500">Pick a date to see your idle time and everything else for that day.</p>
        </div>
        <div>
          <label className="label" htmlFor="self-day">
            Date
          </label>
          <input
            id="self-day"
            type="date"
            className="input-field"
            max={todayIsoDate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="mt-4 flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {!loading && summary && (
        <div className="mt-4">
          <SummaryCards summary={summary} />
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const canExport = hasPermission('REPORT_EXPORT');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if ([ROLES.HR, ROLES.ORGANIZATION_ADMIN].includes(user.role)) {
          const [result, trend] = await Promise.all([
            analyticsApi.getOrganizationSummary(),
            analyticsApi.getOrganizationTrend(),
          ]);
          setData({ scope: 'organization', trend, ...result });
        } else if (user.role === ROLES.MANAGER) {
          const [members, trend] = await Promise.all([analyticsApi.getTeamSummary(), analyticsApi.getTeamTrend()]);
          setData({ scope: 'team', members, trend });
        } else {
          const [summary, trend] = await Promise.all([analyticsApi.getMySummary(), analyticsApi.getMyTrend()]);
          setData({ scope: 'self', summary, trend });
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.role]);

  async function handleExport() {
    setExporting(true);
    try {
      await analyticsApi.downloadAttendanceReport();
    } catch {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Neutral, factual time breakdowns - not a measure of productivity. {UNCLASSIFIED_IDLE_LABEL} simply
            means no reason has been recorded yet.
          </p>
        </div>
        {canExport && (
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export attendance CSV'}
          </button>
        )}
      </div>

      <GoalProgressSection />

      <div className="mt-6">
        {data.scope === 'organization' && (
          <>
            <StatCard label="Headcount" value={data.headcount} />
            <div className="mt-4">
              <SummaryCards summary={data.summary} />
            </div>
            <TrendSection trend={data.trend} />
            <TeamGroupBreakdownChart teamBreakdown={data.teamBreakdown} />
            <EmployeeBreakdownTable />
            <TopAppsChart fetchFn={analyticsApi.getOrganizationTopApps} title="Top apps by time - organization" />
          </>
        )}
        {data.scope === 'team' &&
          (data.members.length === 0 ? (
            <p className="text-sm text-gray-500">No team members found.</p>
          ) : (
            <>
              <TrendSection trend={data.trend} />
              <TeamBreakdownChart members={data.members} />
              <TeamMemberOverviewTable initialMembers={data.members} />
              <TopAppsChart fetchFn={analyticsApi.getTeamTopApps} title="Top apps by time - team" />
            </>
          ))}
        {data.scope === 'self' && (
          <>
            <SummaryCards summary={data.summary} />
            <TrendSection trend={data.trend} />
            <SelfBreakdownChart summary={data.summary} />
            <SelfDayOverview />
            <TopAppsChart fetchFn={analyticsApi.getMyTopApps} title="Top apps by time" />
          </>
        )}
      </div>
    </div>
  );
}