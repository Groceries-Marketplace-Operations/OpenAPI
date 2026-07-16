import client from './client';

export const authApi = {
  me: () => client.get('/auth/me').then(r => r.data),
};

export const projectsApi = {
  list: () => client.get('/projects').then(r => r.data),
  get: (id: string) => client.get(`/projects/${id}`).then(r => r.data),
  create: (data: any) => client.post('/projects', data).then(r => r.data),
  update: (id: string, data: any) => client.patch(`/projects/${id}`, data).then(r => r.data),
  upsertDiDiConfig: (id: string, data: any) => client.post(`/projects/${id}/didi-config`, data).then(r => r.data),
};

export const accountsApi = {
  list: () => client.get('/accounts').then(r => r.data),
  setRole: (id: string, roles: string[]) => client.patch(`/accounts/${id}/roles`, { roles }).then(r => r.data),
};
