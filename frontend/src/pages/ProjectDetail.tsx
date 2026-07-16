import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { projectsApi } from '../api';
import type { ProjectDetail as PD } from '../types';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: project } = useQuery<PD>({ queryKey: ['project', id], queryFn: () => projectsApi.get(id!) });
  const [showConfig, setShowConfig] = useState(false);
  const [cfg, setCfg] = useState({ appId: '', appSecret: '' });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.roles?.includes('admin');

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
          <button onClick={() => setShowConfig(v => !v)} style={btnStyle}>
            {project.diDiConfig ? 'Edit DiDi Config' : 'Set DiDi Config'}
          </button>
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
