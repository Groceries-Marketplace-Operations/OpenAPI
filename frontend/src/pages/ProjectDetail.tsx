import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { projectsApi, diDiApi } from '../api';
import type { ProjectDetail as PD } from '../types';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: project } = useQuery<PD>({ queryKey: ['project', id], queryFn: () => projectsApi.get(id!) });
  const [showConfig, setShowConfig] = useState(false);
  const [cfg, setCfg] = useState({ appId: '', appSecret: '' });
  const [saving, setSaving] = useState(false);

  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testEnabled, setTestEnabled] = useState(false);
  const [testShops, setTestShops] = useState<string[]>([]);
  const [newShop, setNewShop] = useState('');
  const [savingTest, setSavingTest] = useState(false);
  const [testOrder, setTestOrder] = useState({ appShopId: '', orderIndex: '' });
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const isAdmin = user?.roles?.includes('admin');

  const openTestPanel = () => {
    setTestEnabled(project?.diDiConfig?.testModeEnabled ?? false);
    setTestShops(project?.diDiConfig?.testShops ?? []);
    setTestResult(null);
    setTestError('');
    setShowTestPanel(true);
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await projectsApi.upsertDiDiConfig(id!, cfg);
      qc.invalidateQueries({ queryKey: ['project', id] });
      setShowConfig(false);
      setCfg({ appId: '', appSecret: '' });
    } finally { setSaving(false); }
  };

  const saveTestMode = async () => {
    setSavingTest(true);
    try {
      await projectsApi.updateTestMode(id!, testEnabled, testShops);
      qc.invalidateQueries({ queryKey: ['project', id] });
    } finally { setSavingTest(false); }
  };

  const addShop = () => {
    const v = newShop.trim();
    if (v && !testShops.includes(v)) setTestShops(p => [...p, v]);
    setNewShop('');
  };

  const submitTestOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    setTestError('');
    setSubmittingOrder(true);
    try {
      const res = await diDiApi.createTestOrder(project!.slug, {
        appShopId: testOrder.appShopId,
        orderIndex: Number(testOrder.orderIndex),
      });
      setTestResult(res);
    } catch (err: any) {
      setTestError(err?.response?.data?.message ?? err.message ?? 'Error');
    } finally { setSubmittingOrder(false); }
  };

  if (!project) return <div style={{ padding: 32 }}>Loading…</div>;

  const apiBase = `${window.location.protocol}//${window.location.host}`;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/" style={{ color: '#FF6B00', textDecoration: 'none', fontSize: 14 }}>← Projects</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</h1>
          <div style={{ color: '#888', fontSize: 14, marginTop: 2 }}>/{project.slug}</div>
          {project.description && <div style={{ color: '#555', fontSize: 14, marginTop: 4 }}>{project.description}</div>}
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openTestPanel} style={ghostBtn}>
              Test Mode {project.diDiConfig?.testModeEnabled ? '🟢' : '⚪'}
            </button>
            <button onClick={() => setShowConfig(v => !v)} style={btnStyle}>
              {project.diDiConfig ? 'Edit DiDi Config' : 'Set DiDi Config'}
            </button>
          </div>
        )}
      </div>

      {/* DiDi Config form */}
      {showConfig && (
        <form onSubmit={saveConfig} style={cardStyle}>
          <h3 style={{ marginBottom: 16 }}>DiDi Configuration</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <input placeholder="App ID" required value={cfg.appId} onChange={e => setCfg(p => ({ ...p, appId: e.target.value }))} style={inputStyle} />
            <input placeholder="App Secret" required value={cfg.appSecret} onChange={e => setCfg(p => ({ ...p, appSecret: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={btnStyle}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowConfig(false)} style={ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      {/* Test mode panel */}
      {showTestPanel && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Test Mode</h3>
            <button onClick={() => setShowTestPanel(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div
              onClick={() => setTestEnabled(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: testEnabled ? '#FF6B00' : '#ddd',
                position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: testEnabled ? 23 : 3, width: 18, height: 18,
                borderRadius: '50%', background: '#fff', transition: 'left .2s',
              }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{testEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>

          {/* Test shops */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>Allowed Test Shops</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {testShops.map(s => (
                <span key={s} style={{ background: '#f0f0f0', padding: '4px 10px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s}
                  <button onClick={() => setTestShops(p => p.filter(x => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
              {testShops.length === 0 && <span style={{ color: '#aaa', fontSize: 13 }}>No shops added</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Shop ID (e.g. 1111)"
                value={newShop}
                onChange={e => setNewShop(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addShop())}
                style={{ ...inputStyle, flex: 1, width: 'auto' }}
              />
              <button type="button" onClick={addShop} style={ghostBtn}>Add</button>
            </div>
          </div>

          <button onClick={saveTestMode} disabled={savingTest} style={btnStyle}>
            {savingTest ? 'Saving…' : 'Save'}
          </button>

          {/* Create test order — only when DB already has testModeEnabled=true */}
          {project.diDiConfig?.testModeEnabled && project.diDiConfig.testShops.length > 0 && (
            <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 12 }}>Create Test Order</div>
              <form onSubmit={submitTestOrder} style={{ display: 'grid', gap: 10 }}>
                <select
                  required
                  value={testOrder.appShopId}
                  onChange={e => setTestOrder(p => ({ ...p, appShopId: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Select shop…</option>
                  {project.diDiConfig!.testShops.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Order Index"
                  required
                  min={1}
                  value={testOrder.orderIndex}
                  onChange={e => setTestOrder(p => ({ ...p, orderIndex: e.target.value }))}
                  style={inputStyle}
                />
                <button type="submit" disabled={submittingOrder} style={{ ...btnStyle, background: '#1976d2' }}>
                  {submittingOrder ? 'Creating…' : 'Create Test Order'}
                </button>
              </form>

              {testResult && (
                <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#166534', marginBottom: 6 }}>✓ Order created</div>
                  <div><b>Order ID:</b> <code style={{ fontFamily: 'monospace' }}>{testResult.orderId}</code></div>
                  <div style={{ marginTop: 4 }}><b>Shop:</b> {testResult.appShopId} &nbsp;·&nbsp; <b>Index:</b> {testResult.orderIndex} &nbsp;·&nbsp; <b>Date:</b> {testResult.date}</div>
                </div>
              )}
              {testError && (
                <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>
                  {testError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Endpoints */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>Endpoints</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <EndpointRow method="POST" url={`${apiBase}/didi/${project.slug}/webhook`} label="Order webhook (DiDi → here)" />
          <EndpointRow method="GET" url={`${apiBase}/didi/${project.slug}/orders?app_shop_id=&order_index=`} label="Order lookup" />
        </div>
      </div>

      {/* Order events */}
      <div style={cardStyle}>
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Recent Orders ({project.orderEvents?.length ?? 0})</h3>
        {project.orderEvents?.length === 0
          ? <div style={{ color: '#888', fontSize: 14 }}>No orders yet.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    {['Date', 'Shop', 'Index', 'Order ID', 'Confirmed', 'Error'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#888', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.orderEvents.map(ev => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={td}>{ev.date}</td>
                      <td style={td}>{ev.appShopId}</td>
                      <td style={td}>{ev.orderIndex}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{ev.orderId}</td>
                      <td style={td}>
                        <span style={{ color: ev.confirmed ? '#2e7d32' : '#c62828', fontWeight: 500 }}>
                          {ev.confirmed ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ ...td, color: '#c62828', fontSize: 12 }}>{ev.confirmError ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

function EndpointRow({ method, url, label }: { method: string; url: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ background: method === 'POST' ? '#fff3e0' : '#e3f2fd', color: method === 'POST' ? '#e65100' : '#1565c0', padding: '2px 8px', borderRadius: 4, fontWeight: 600, minWidth: 48, textAlign: 'center' }}>{method}</span>
      <code style={{ background: '#f5f5f5', padding: '4px 10px', borderRadius: 4, flex: 1, wordBreak: 'break-all' }}>{url}</code>
      <span style={{ color: '#888' }}>{label}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', marginBottom: 16 };
const btnStyle: React.CSSProperties = { background: '#FF6B00', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, width: '100%' };
const td: React.CSSProperties = { padding: '8px 8px', verticalAlign: 'middle' };
