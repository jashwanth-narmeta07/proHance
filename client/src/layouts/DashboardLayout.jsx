import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/permissions.js';
import NotificationBell from '../components/NotificationBell.jsx';

const NAV_BY_ROLE = {
  [ROLES.ORGANIZATION_ADMIN]: [
    { to: '/dashboard', label: 'Overview', end: true },
    { to: '/dashboard/workday', label: 'My workday' },
    { to: '/dashboard/members', label: 'Members' },
    { to: '/dashboard/departments', label: 'Departments' },
    { to: '/dashboard/teams', label: 'Teams' },
    { to: '/dashboard/devices', label: 'Devices' },
    { to: '/dashboard/requests', label: 'Requests' },
    { to: '/dashboard/reports', label: 'Reports' },
    { to: '/dashboard/goals', label: 'Goals' },
    { to: '/dashboard/policies', label: 'Policies' },
    { to: '/dashboard/audit-logs', label: 'Audit logs' },
    { to: '/dashboard/settings', label: 'Settings' },
  ],
  [ROLES.HR]: [
    { to: '/dashboard', label: 'Overview', end: true },
    { to: '/dashboard/employees', label: 'Employees' },
    { to: '/dashboard/attendance', label: 'Attendance' },
    { to: '/dashboard/requests', label: 'Requests' },
    { to: '/dashboard/reports', label: 'Reports' },
    { to: '/dashboard/goals', label: 'Goals' },
  ],
  [ROLES.MANAGER]: [
    { to: '/dashboard', label: 'Overview', end: true },
    { to: '/dashboard/my-team', label: 'My team' },
    { to: '/dashboard/team-activity', label: 'Team activity' },
    { to: '/dashboard/requests', label: 'Requests' },
    { to: '/dashboard/projects', label: 'Projects' },
    { to: '/dashboard/reports', label: 'Reports' },
  ],
  [ROLES.EMPLOYEE]: [
    { to: '/dashboard', label: 'Overview', end: true },
    { to: '/dashboard/profile', label: 'My profile' },
    { to: '/dashboard/workday', label: 'My workday' },
    { to: '/dashboard/activity', label: 'My activity' },
    { to: '/dashboard/projects', label: 'My projects' },
    { to: '/dashboard/requests', label: 'My requests' },
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navItems = NAV_BY_ROLE[user?.role] || [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <span className="text-base font-semibold text-gray-900">Workforce SaaS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'block rounded-md px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-sm font-medium text-gray-900">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="truncate text-xs text-gray-500">{user?.role}</p>
          <button onClick={logout} className="btn-secondary mt-3 w-full text-sm">
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-end border-b border-gray-200 bg-white px-8 py-3">
          <NotificationBell />
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
