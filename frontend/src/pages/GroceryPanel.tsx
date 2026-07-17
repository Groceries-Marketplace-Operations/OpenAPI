import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '../api';

const TIMEZONES = ['America/Bogota', 'America/Lima', 'America/Santiago', 'America/Mexico_City', 'UTC'];

const cardStyle: React.CSSProperties = { background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', marginBottom: 16 };
const btnStyle: React.CSSProperties = { background: '#FF6B00', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const blueBtn: React.CSSProperties = { ...btnStyle, background: '#1976d2' };
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, width: '100%', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 };
const td: React.CSSProperties = { padding: '8px', verticalAlign: 'middle', fontSize: 13 };

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    running: { bg: '#fff3e0', color: '#e65100' },
    done: { bg: '#e8f5e9', color: '#2e7d32' },
    done_with_errors: { bg: '#fff3e0', color: '#c62828' },
    failed: { bg: '#fdecea', color: '#c62828' },
    success: { bg: '#e8f5e9', color: '#2e7d32' },
    error: { bg: '#fdecea', color: '#c62828' },
    pending: { bg: '#f5f5f5', color: '#888' },
  };
  const s = map[status] ?? { bg: '#f5f5f5', color: '#555' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  );
}

export default function GroceryPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({ queryKey: ['grocery-config', slug], queryFn: () => groceryApi.getConfig(slug) });
  const { data: uploads, refetch: refetchUploads } = useQuery({ queryKey: ['grocery-uploads', slug], queryFn: () => groceryApi.listUploads(slug) });

  const [showConfig, setShowConfig] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [triggerError, setTriggerError] = useState('');
  const [checkingTasks, setCheckingTasks] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<Record<string, any[]>>({});

  const openConfig = () => {
    setForm(config ? {
      sftpHost: config.sftpHost,
      sftpPort: config.sftpPort,
      sftpUser: config.sftpUser,
      sftpPassword: '',
      sftpRemoteDir: config.sftpRemoteDir,
      maxPerCategory: config.maxPerCategory,
      scheduleEnabled: config.scheduleEnabled,
      scheduleHour: config.scheduleHour,
      scheduleMinute: config.scheduleMinute,
      scheduleTimezone: config.scheduleTimezone,
    } : {
      sftpHost: '117.51.1.122', sftpPort: 36000, sftpUser: 'Animals', sftpPassword: '',
      sftpRemoteDir: '/upload', maxPerCategory: 3000,
      scheduleEnabled: false, scheduleHour: 9, scheduleMinute: 0, scheduleTimezone: 'America/Bogota',
    });
    setShowConfig(true);
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      await groceryApi.upsertConfig(slug, form);
      qc.invalidateQueries({ queryKey: ['grocery-config', slug] });
      setShowConfig(false);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? err.message);
    } finally { setSavingCfg(false); }
  };

  const trigger = async (mode: 'menu' | 'stock') => {
    setTriggering(true);
    setTriggerResult(null);
    setTriggerError('');
    try {
      const res = await groceryApi.trigger(slug, mode);
      setTriggerResult(res);
      refetchUploads();
    } catch (err: any) {
      setTriggerError(err?.response?.data?.message ?? err.message ?? 'Error');
    } finally { setTriggering(false); }
  };

  const checkTasks = async (uploadId: string) => {
    setCheckingTasks(uploadId);
    try {
      const res = await groceryApi.checkTasks(slug, uploadId);
      setTaskResults(p => ({ ...p, [uploadId]: res }));
    } finally { setCheckingTasks(null); }
  };

  const f = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  if (isLoading) return null;

  const hasConfig = !!config;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Grocery Upload</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
      </div>

      {/* Status bar */}
      {hasConfig && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', background: '#f9f9f9', borderRadius: 8, fontSize: 13 }}>
          <span>Schedule: {config.scheduleEnabled
            ? <b>{String(config.scheduleHour).padStart(2,'0')}:{String(config.scheduleMinute).padStart(2,'0')} {config.scheduleTimezone}</b>
            : <span style={{ color: '#aaa' }}>disabled</span>}
          </span>
          {config.lastRunAt && <span style={{ color: '#888' }}>Last run: {new Date(config.lastRunAt).toLocaleString()}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={openConfig} style={ghostBtn}>{hasConfig ? '⚙ Edit Config' : '⚙ Set Config'}</button>
        {hasConfig && (
          <>
            <button onClick={() => trigger('menu')} disabled={triggering} style={btnStyle}>
              {triggering ? 'Running…' : '↑ Upload Menu'}
            </button>
            <button onClick={() => trigger('stock')} disabled={triggering} style={blueBtn}>
              {triggering ? 'Running…' : '↑ Sync Stock'}
            </button>
          </>
        )}
      </div>

      {triggerResult && (
        <div style={{ marginBottom: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          ✓ Upload started — <b>{triggerResult.stores}</b> stores from <code>{triggerResult.filename}</code>
        </div>
      )}
      {triggerError && (
        <div style={{ marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b' }}>
          {triggerError}
        </div>
      )}

      {/* Config form */}
      {showConfig && form && (
        <form onSubmit={saveConfig} style={{ ...cardStyle, border: '1px solid #eee' }}>
          <h4 style={{ marginBottom: 14 }}>SFTP & Schedule Configuration</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={labelStyle}>SFTP Host</label><input style={inputStyle} required value={form.sftpHost} onChange={e => f('sftpHost', e.target.value)} /></div>
            <div><label style={labelStyle}>SFTP Port</label><input style={inputStyle} type="number" required value={form.sftpPort} onChange={e => f('sftpPort', Number(e.target.value))} /></div>
            <div><label style={labelStyle}>Username</label><input style={inputStyle} required value={form.sftpUser} onChange={e => f('sftpUser', e.target.value)} /></div>
            <div><label style={labelStyle}>Password</label><input style={inputStyle} type="password" placeholder={config ? '(unchanged)' : 'Password'} value={form.sftpPassword} onChange={e => f('sftpPassword', e.target.value)} /></div>
            <div><label style={labelStyle}>Remote Directory</label><input style={inputStyle} required value={form.sftpRemoteDir} onChange={e => f('sftpRemoteDir', e.target.value)} /></div>
            <div><label style={labelStyle}>Max Items per Category</label><input style={inputStyle} type="number" required value={form.maxPerCategory} onChange={e => f('maxPerCategory', Number(e.target.value))} /></div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 10 }}>Scheduled Run</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div
                onClick={() => f('scheduleEnabled', !form.scheduleEnabled)}
                style={{ width: 44, height: 24, borderRadius: 12, background: form.scheduleEnabled ? '#FF6B00' : '#ddd', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: form.scheduleEnabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Hour</label>
                <input style={{ ...inputStyle, width: 64 }} type="number" min={0} max={23} value={form.scheduleHour} onChange={e => f('scheduleHour', Number(e.target.value))} />
                <label style={{ ...labelStyle, margin: 0 }}>Minute</label>
                <input style={{ ...inputStyle, width: 64 }} type="number" min={0} max={59} value={form.scheduleMinute} onChange={e => f('scheduleMinute', Number(e.target.value))} />
                <select style={{ ...inputStyle, width: 'auto' }} value={form.scheduleTimezone} onChange={e => f('scheduleTimezone', e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            {form.scheduleEnabled && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                Will run daily at {String(form.scheduleHour).padStart(2,'0')}:{String(form.scheduleMinute).padStart(2,'0')} ({form.scheduleTimezone})
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={savingCfg} style={btnStyle}>{savingCfg ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowConfig(false)} style={ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      {/* Upload history */}
      {uploads && uploads.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 10 }}>Upload History</div>
          {uploads.map((u: any) => (
            <div key={u.id} style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {statusBadge(u.status)}
                  <span style={{ fontWeight: 600 }}>{u.mode}</span>
                  <code style={{ fontSize: 12, color: '#666' }}>{u.filename}</code>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#aaa', fontSize: 12 }}>{new Date(u.createdAt).toLocaleString()}</span>
                  {u.mode === 'menu' && u.stores.some((s: any) => s.taskId) && (
                    <button
                      onClick={() => checkTasks(u.id)}
                      disabled={checkingTasks === u.id}
                      style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}
                    >
                      {checkingTasks === u.id ? '…' : 'Check Tasks'}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      {['Shop', 'Status', 'Task ID', 'Error'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#888', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {u.stores.map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={td}>{s.appShopId}</td>
                        <td style={td}>{statusBadge(s.status)}</td>
                        <td style={{ ...td, fontFamily: 'monospace' }}>{s.taskId ?? '—'}</td>
                        <td style={{ ...td, color: '#c62828' }}>{s.errorMessage ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {taskResults[u.id] && (
                  <div style={{ padding: '10px 14px', background: '#f9f9f9', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Task Status</div>
                    {taskResults[u.id].map((r: any) => (
                      <div key={r.appShopId} style={{ marginBottom: 4 }}>
                        <b>Shop {r.appShopId}</b>: {r.error ? <span style={{ color: '#c62828' }}>{r.error}</span>
                          : <span>status={r.data?.status} — {r.data?.message}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
