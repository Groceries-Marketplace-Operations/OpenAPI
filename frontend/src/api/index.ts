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
  updateTestMode: (id: string, testModeEnabled: boolean, testShops: string[]) =>
    client.patch(`/projects/${id}/didi-config/test-mode`, { testModeEnabled, testShops }).then(r => r.data),
};

export const diDiApi = {
  createTestOrder: (slug: string, data: { appShopId: string; orderIndex: number; date?: string }) =>
    client.post(`/didi/${slug}/test-orders`, data).then(r => r.data),
};

export const groceryApi = {
  getConfig: (slug: string) => client.get(`/didi/${slug}/grocery/config`).then(r => r.data),
  upsertConfig: (slug: string, data: any) => client.post(`/didi/${slug}/grocery/config`, data).then(r => r.data),
  trigger: (slug: string, mode: 'menu' | 'stock') => client.post(`/didi/${slug}/grocery/trigger`, { mode }).then(r => r.data),
  listUploads: (slug: string) => client.get(`/didi/${slug}/grocery/uploads`).then(r => r.data),
  checkTasks: (slug: string, uploadId: string) => client.post(`/didi/${slug}/grocery/uploads/${uploadId}/check-tasks`, {}).then(r => r.data),
};

export const accountsApi = {
  list: () => client.get('/accounts').then(r => r.data),
  setRole: (id: string, roles: string[]) => client.patch(`/accounts/${id}/roles`, { roles }).then(r => r.data),
};
