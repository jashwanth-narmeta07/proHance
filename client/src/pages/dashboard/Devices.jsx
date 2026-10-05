import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as deviceApi from '../../services/deviceApi.js';
import * as membersApi from '../../services/membersApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState, Spinner } from '../../components/ui.jsx';
import { Modal, StatusBadge } from '../../components/overlays.jsx';

function DeviceTable({ devices, onRevoke, showOwner }) {
  if (devices.length === 0) {
    return <EmptyState title="No devices registered" />;
  }
  return (
    <div className="card overflow-hidden p-0">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Device</th>
            {showOwner && <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Owner</th>}
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">OS</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last heartbeat</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {devices.map((d) => (
            <tr key={d._id}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.deviceName}</td>
              {showOwner && (
                <td className="px-4 py-3 text-sm text-gray-600">
                  {d.userId?.firstName ? `${d.userId.firstName} ${d.userId.lastName}` : d.userId}
                </td>
              )}
              <td className="px-4 py-3 text-sm text-gray-600">
                {d.os ? `${d.os}${d.osVersion ? ' ' + d.osVersion : ''}` : 'Pending agent setup'}
              </td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge status={d.activityStatus} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).toLocaleString() : 'Never'}
              </td>
              <td className="px-4 py-3 text-right">
                {d.status !== 'REVOKED' && (
                  <button onClick={() => onRevoke(d._id)} className="text-sm text-red-600 hover:underline">
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegisterDeviceModal({ open, onClose, onRegistered }) {
  const [deviceName, setDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issuedToken, setIssuedToken] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { device, deviceToken } = await deviceApi.registerDevice({
        deviceName,
        os: navigator.platform,
      });
      setIssuedToken(deviceToken);
      onRegistered(device);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setDeviceName('');
    setIssuedToken(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Register a device">
      {issuedToken ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Copy this token into the desktop agent's setup screen - it will not be shown again.
          </p>
          <code className="block break-all rounded-md bg-gray-100 p-3 text-xs">{issuedToken}</code>
          <button className="btn-primary w-full" onClick={handleClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Device name</label>
            <input
              className="input-field"
              placeholder="e.g. Rahul's laptop"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !deviceName}>
              {submitting ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function RegisterForEmployeeModal({ open, onClose, onRegistered }) {
  const [employees, setEmployees] = useState([]);
  const [userId, setUserId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issuedToken, setIssuedToken] = useState(null);

  useEffect(() => {
    if (!open) return;
    membersApi
      .listMembers()
      .then((all) => setEmployees(all.filter((m) => m.status !== 'EXITED')))
      .catch(() => toast.error('Failed to load employees'));
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { device, deviceToken } = await deviceApi.registerDeviceForEmployee(userId, { deviceName });
      setIssuedToken(deviceToken);
      onRegistered(device);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setUserId('');
    setDeviceName('');
    setIssuedToken(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Register a device for an employee">
      {issuedToken ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Share this token with the employee - they'll paste it into their desktop agent's setup screen. It
            won't be shown again after you close this.
          </p>
          <code className="block break-all rounded-md bg-gray-100 p-3 text-xs">{issuedToken}</code>
          <button className="btn-primary w-full" onClick={handleClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Employee</label>
            <select className="input-field" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select an employee...</option>
              {employees.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.firstName} {m.lastName} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Device name</label>
            <input
              className="input-field"
              placeholder="e.g. Rahul's laptop"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-400">
            This device will belong to the selected employee - their check-ins are what activate tracking on it,
            not yours.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !userId || !deviceName}>
              {submitting ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Devices() {
  const { hasPermission } = useAuth();
  const canManageOrgDevices = hasPermission('DEVICE_MANAGE');
  const [myDevices, setMyDevices] = useState([]);
  const [orgDevices, setOrgDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [forEmployeeModalOpen, setForEmployeeModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, org] = await Promise.all([
        deviceApi.listMyDevices(),
        canManageOrgDevices ? deviceApi.listOrganizationDevices() : Promise.resolve([]),
      ]);
      setMyDevices(mine);
      setOrgDevices(org);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [canManageOrgDevices]);

  useEffect(() => {
    load();
    // activityStatus (Active/Idle/Offline) is computed from the clock on
    // every read (see server/src/models/Device.js) - a device going quiet
    // has nothing to push out and say so, so this page has to keep asking
    // rather than trusting whatever it fetched once to still be true.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleRevoke(id, selfRevoke) {
    try {
      await deviceApi.revokeDevice(id, { selfRevoke });
      toast.success('Device revoked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke device');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Devices</h1>
        <div className="flex gap-3">
          {canManageOrgDevices && (
            <button className="btn-secondary" onClick={() => setForEmployeeModalOpen(true)}>
              Register for employee
            </button>
          )}
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            Register device
          </button>
        </div>
      </div>

      {loading ? ( 
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700">My devices</h2>
            <div className="mt-2">
              <DeviceTable devices={myDevices} onRevoke={(id) => handleRevoke(id, true)} />
            </div>
          </div>

          {canManageOrgDevices && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-700">Organization devices</h2>
              <div className="mt-2">
                <DeviceTable devices={orgDevices} onRevoke={(id) => handleRevoke(id, false)} showOwner />
              </div>
            </div>
          )}
        </>
      )}

      <RegisterDeviceModal open={modalOpen} onClose={() => setModalOpen(false)} onRegistered={load} />
      <RegisterForEmployeeModal
        open={forEmployeeModalOpen}
        onClose={() => setForEmployeeModalOpen(false)}
        onRegistered={load}
      />
    </div>
  );
}