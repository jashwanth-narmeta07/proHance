import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-gray-900">Workforce SaaS</span>
          <div className="flex gap-3">
            <Link to="/login" className="btn-secondary">
              Log in
            </Link>
            <Link to="/register" className="btn-primary">
              Register your organization
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
          Workforce management and work-time analytics, in one place
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Attendance, teams, requests, and computer-activity analytics for growing
          organizations — with clear, permission-based visibility for every role.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="btn-primary">
            Get started
          </Link>
          <Link to="/login" className="btn-secondary">
            I already have an account
          </Link>
        </div>
      </main>
    </div>
  );
}
