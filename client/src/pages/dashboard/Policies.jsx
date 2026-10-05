import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as policyApi from '../../services/policyApi.js';
import { Spinner } from '../../components/ui.jsx';

function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="min-w-0 flex-1 text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 1440 }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input-field"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function Policies() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    policyApi
      .getPolicy()
      .then(setPolicy)
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load policy'))
      .finally(() => setLoading(false));
  }, []);

  function update(group, field, value) {
    setPolicy((p) => ({ ...p, [group]: { ...p[group], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await policyApi.updatePolicy({
        idlePolicy: policy.idlePolicy,
        attendancePolicy: policy.attendancePolicy,
        breakPolicy: policy.breakPolicy,
        overtimePolicy: policy.overtimePolicy,
        activityCollectionPolicy: { collectAppMetadata: policy.activityCollectionPolicy.collectAppMetadata },
        devicePolicy: policy.devicePolicy,
        notificationPolicy: policy.notificationPolicy,
      });
      setPolicy(updated);
      toast.success('Policy saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !policy) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Organization policies</h1>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Idle policy</h2>
          <p className="mt-1 text-xs text-gray-500">
            Controls when the desktop agent shows a warning and when it asks the employee to classify inactivity.
          </p>
          <div className="mt-4 space-y-3">
            <NumberField
              label="Warning after (minutes)"
              value={policy.idlePolicy.warningThresholdMinutes}
              onChange={(v) => update('idlePolicy', 'warningThresholdMinutes', v)}
            />
            <NumberField
              label="Justification required after (minutes)"
              value={policy.idlePolicy.justificationThresholdMinutes}
              onChange={(v) => update('idlePolicy', 'justificationThresholdMinutes', v)}
            />
            <Toggle
              label="Require justification for idle periods"
              checked={policy.idlePolicy.requireJustification}
              onChange={(v) => update('idlePolicy', 'requireJustification', v)}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Attendance policy</h2>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Work start time</label>
                <input
                  type="time"
                  className="input-field"
                  value={policy.attendancePolicy.workStartTime}
                  onChange={(e) => update('attendancePolicy', 'workStartTime', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Work end time</label>
                <input
                  type="time"
                  className="input-field"
                  value={policy.attendancePolicy.workEndTime}
                  onChange={(e) => update('attendancePolicy', 'workEndTime', e.target.value)}
                />
              </div>
            </div>
            <NumberField
              label="Grace period (minutes)"
              value={policy.attendancePolicy.graceMinutes}
              onChange={(v) => update('attendancePolicy', 'graceMinutes', v)}
            />
            <Toggle
              label="Automatic check-in"
              checked={policy.attendancePolicy.automaticCheckIn}
              onChange={(v) => update('attendancePolicy', 'automaticCheckIn', v)}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Break & overtime</h2>
          <div className="mt-4 space-y-3">
            <NumberField
              label="Max break minutes per day"
              value={policy.breakPolicy.maxBreakMinutesPerDay}
              onChange={(v) => update('breakPolicy', 'maxBreakMinutesPerDay', v)}
            />
            <NumberField
              label="Overtime after (minutes/day)"
              value={policy.overtimePolicy.overtimeAfterMinutesPerDay}
              onChange={(v) => update('overtimePolicy', 'overtimeAfterMinutesPerDay', v)}
            />
            <Toggle
              label="Require approval for overtime"
              checked={policy.overtimePolicy.requireApproval}
              onChange={(v) => update('overtimePolicy', 'requireApproval', v)}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Devices & notifications</h2>
          <div className="mt-4 space-y-3">
            <NumberField
              label="Max devices per user"
              value={policy.devicePolicy.maxDevicesPerUser}
              min={1}
              max={10}
              onChange={(v) => update('devicePolicy', 'maxDevicesPerUser', v)}
            />
            <Toggle
              label="Email on request status change"
              checked={policy.notificationPolicy.emailOnRequestStatusChange}
              onChange={(v) => update('notificationPolicy', 'emailOnRequestStatusChange', v)}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Activity collection</h2>
          <p className="mt-1 text-xs text-gray-500">
            Off by default. When on, the desktop agent records which application is in focus, in order to show
            "Top apps by time" in Reports.
          </p>
          <div className="mt-4 space-y-3">
            <Toggle
              label="Track app usage (app name only)"
              checked={policy.activityCollectionPolicy.collectAppMetadata}
              onChange={(v) => update('activityCollectionPolicy', 'collectAppMetadata', v)}
            />
            <p className="text-xs text-gray-400">
              Only the application name is ever recorded (e.g. "Google Chrome," "Visual Studio Code") - never
              window titles, tab names, document contents, or anything else on screen.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Screenshot collection is not configurable here or anywhere in the product - it is intentionally excluded
        from the MVP per the organization's activity-collection policy.
      </p>
    </div>
  );
}
