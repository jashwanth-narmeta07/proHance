import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as attendanceApi from '../../services/attendanceApi.js';
import { Spinner, StatCard } from '../../components/ui.jsx';
import { formatClockTime, formatDuration } from '../../utils/formatDuration.js';

export default function MyWorkday() {
  const [state, setState] = useState(null); // { attendance, onBreak }
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const result = await attendanceApi.getToday();
      setState(result);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load today\'s attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live-ticking elapsed timer while checked in.
  useEffect(() => {
    if (state?.workSession?.status !== 'ACTIVE') return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [state]);

  const elapsedSeconds = useMemo(() => {
    if (!state?.workSession || state.attendance?.checkOutAt) return 0;
    return (now - new Date(state.workSession.checkInAt).getTime()) / 1000;
  }, [state, now]);

  const totalTodaySeconds = useMemo(() => {
    if (!state?.attendance) return 0;
    if (state.attendance.checkOutAt) return state.attendance.totalDurationSeconds;
    // Still checked in: cumulative total from any earlier session(s) today,
    // plus the current session's live elapsed time.
    return (state.attendance.totalDurationSeconds || 0) + elapsedSeconds;
  }, [state, elapsedSeconds]);

  const isCheckedIn = state?.workSession?.status === 'ACTIVE';

  async function handleCheckIn() {
    setActionPending(true);
    try {
      await attendanceApi.checkIn();
      toast.success('Checked in');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally {
      setActionPending(false);
    }
  }

  async function handleCheckOut() {
    setActionPending(true);
    try {
      await attendanceApi.checkOut();
      toast.success('Checked out');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally {
      setActionPending(false);
    }
  }

  async function handleBreakToggle() {
    setActionPending(true);
    try {
      if (state.onBreak) {
        await attendanceApi.endBreak();
        toast.success('Break ended');
      } else {
        await attendanceApi.startBreak();
        toast.success('Break started');
      }
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionPending(false);
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
      <h1 className="text-xl font-semibold text-gray-900">My workday</h1>

      <div className="card mt-6 flex flex-col items-center gap-4 py-10 text-center">
        {isCheckedIn ? (
          <>
            <p className="text-sm text-gray-500">
              Checked in at {formatClockTime(state.workSession?.checkInAt || state.attendance.checkInAt)}
              {state.onBreak && ' · On break'}
            </p>
            <p className="text-4xl font-semibold tabular-nums text-gray-900">
              {formatDuration(elapsedSeconds)}
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={handleBreakToggle} disabled={actionPending}>
                {state.onBreak ? 'End break' : 'Start break'}
              </button>
              <button className="btn-primary" onClick={handleCheckOut} disabled={actionPending}>
                Check out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              {state?.attendance?.checkOutAt
                ? `You checked out at ${formatClockTime(state.attendance.checkOutAt)}`
                : "You haven't checked in today"}
            </p>
            <button className="btn-primary" onClick={handleCheckIn} disabled={actionPending}>
              Check in
            </button>
          </>
        )}
      </div>

      {state?.attendance && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total time today"
            value={formatDuration(totalTodaySeconds)}
          />
          <StatCard label="Break time" value={formatDuration(state.attendance.breakDurationSeconds)} />
          <StatCard
            label="Status"
            value={state.attendance.status}
            hint={state.attendance.flags?.join(', ') || undefined}
          />
        </div>
      )}
    </div>
  );
}
