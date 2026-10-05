import { Routes, Route } from 'react-router-dom';
import Landing from './pages/public/Landing.jsx';
import Login from './pages/public/Login.jsx';
import RegisterOrganization from './pages/public/RegisterOrganization.jsx';
import AcceptInvitation from './pages/public/AcceptInvitation.jsx';
import NotFound from './pages/public/NotFound.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import DashboardHome from './pages/dashboard/DashboardHome.jsx';
import Members from './pages/dashboard/Members.jsx';
import Departments from './pages/dashboard/Departments.jsx';
import Teams from './pages/dashboard/Teams.jsx';
import Goals from './pages/dashboard/Goals.jsx';
import MyWorkday from './pages/dashboard/MyWorkday.jsx';
import TeamAttendance from './pages/dashboard/TeamAttendance.jsx';
import Requests from './pages/dashboard/Requests.jsx';
import Projects from './pages/dashboard/Projects.jsx';
import ProjectDetail from './pages/dashboard/ProjectDetail.jsx';
import Reports from './pages/dashboard/Reports.jsx';
import Policies from './pages/dashboard/Policies.jsx';
import Devices from './pages/dashboard/Devices.jsx';
import AuditLogs from './pages/dashboard/AuditLogs.jsx';
import ComingSoon from './pages/dashboard/ComingSoon.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<RegisterOrganization />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="members" element={<Members />} />
        <Route path="employees" element={<Members />} />
        <Route path="departments" element={<Departments />} />
        <Route path="teams" element={<Teams />} />
        <Route path="goals" element={<Goals />} />
        <Route path="workday" element={<MyWorkday />} />
        <Route path="attendance" element={<TeamAttendance />} />
        <Route path="requests" element={<Requests />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="policies" element={<Policies />} />
        <Route path="devices" element={<Devices />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        {/* Remaining sub-sections are scaffolded so navigation doesn't 404
            while their APIs are built out in later phases (attendance,
            requests, reports, policies, audit logs, etc). */}
        <Route path="*" element={<ComingSoon title="Coming soon" />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
