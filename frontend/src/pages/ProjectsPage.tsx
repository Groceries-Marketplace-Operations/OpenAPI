import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { projectsApi } from '../api';
import type { Project } from '../types';

export default function ProjectsPage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: projectsApi.list });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });

  const isAdmin = user?.roles?.includes('admin');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await projectsApi.create(form);
    qc.invalidateQueries({ queryKey: ['projects'] });
    setCreating(false);
    setForm({ name: '', slug: '', description: '' });
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>OpenAPI</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#666' }}>{user?.email}</span>
          {isAdmin && <button onClick={() => setCreating(true)} style={btnStyle}>+ New Project</button>}
          <button onClick={logout} style={{ ...btnStyle, background: '#fff', color: '#333', border: '1px solid #ddd' }}>Logout</button>
        </div>
      </div>

      {creating && (
        <form onSubmit={submit} style={{ background: '#fff', padding: 24, borderRadius: 10, marginBottom: 24, boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
          <h3 style={{ marginBottom: 16 }}>New Project</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <input placeholder="Name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Slug (e.g. cruz-verde)" required value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} style={inputStyle} />
            <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="submit" style={btnStyle}>Create</button>
            <button type="button" onClick={() => setCreating(false)} style={{ ...btnStyle, background: '#fff', color: '#333', border: '1px solid #ddd' }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {projects.map(p => (
          <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#888' }}>/{p.slug}</div>
                {p.description && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{p.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {p.diDiConfig && <span style={{ fontSize: 12, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 4 }}>DiDi ✓</span>}
                <span style={{ fontSize: 12, background: p.active ? '#e3f2fd' : '#fafafa', color: p.active ? '#1565c0' : '#999', padding: '2px 8px', borderRadius: 4 }}>{p.active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </Link>
        ))}
        {projects.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 48 }}>No projects yet.</div>}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = { background: '#FF6B00', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: 14 };
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, width: '100%' };
