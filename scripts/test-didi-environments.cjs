const assert = require('node:assert/strict');
const { createHash, createHmac } = require('node:crypto');
const { DiDiFoodService } = require('../backend/dist/integrations/didi-food/didi-food.service');
const { ProjectsService } = require('../backend/dist/projects/projects.service');

async function main() {
  const cfg = { appId: '9007199254740993', appSecret: 'prod-secret', testAppId: 'test-app', testAppSecret: 'test-secret', testModeEnabled: true, testShops: ['shop'] };
  const records = new Map();
  const key = x => [x.projectId, x.environment, x.appShopId, x.date, x.orderIndex].join('|');
  const db = {
    project: { findUnique: async () => ({ id: 'p', active: true }) },
    diDiOrderEvent: {
      upsert: async ({ create }) => records.set(key(create), create),
      create: async ({ data }) => records.set(key(data), data),
      findUnique: async ({ where }) => records.get(key(where.projectId_environment_appShopId_date_orderIndex)),
    },
  };
  const service = new DiDiFoodService(db, { getDiDiConfig: async () => cfg });
  const confirmations = [];
  service.confirmOrderAsync = async (...args) => confirmations.push(args);
  const now = Math.floor(Date.now() / 1000);
  const payload = appId => ({ app_id: appId, type: 'orderNew', app_shop_id: 'shop', timestamp: now, data: { order_info: { order_id: appId === cfg.appId ? '123' : '456', order_index: 1 } } });
  async function send(appId, secret, wrapped = false) {
    let raw = JSON.stringify(payload(appId));
    if (appId === cfg.appId) raw = raw.replace('"' + appId + '"', appId);
    if (wrapped) raw = JSON.stringify({ PARAM: raw });
    return service.handleWebhook('slug', raw, createHash('md5').update(raw + secret).digest('hex'));
  }
  await send(cfg.appId, cfg.appSecret, true);
  await send(cfg.testAppId, cfg.testAppSecret);
  assert.equal(records.size, 2, 'same shop/index/date can exist in both environments');
  assert.equal(confirmations[0][1], 'production');
  assert.equal(confirmations[0][3], cfg.appSecret);
  assert.equal(confirmations[1][1], 'test');
  assert.equal(confirmations[1][3], cfg.testAppSecret);
  await assert.rejects(send(cfg.appId, cfg.testAppSecret), /Invalid signature/);
  await assert.rejects(send('unknown', cfg.appSecret), /Invalid app_id/);
  const headers = (appId, secret, timestamp = String(now)) => ({ 'x-app-id': appId, 'x-timestamp': timestamp, 'x-signature': createHmac('sha256', secret).update(appId + ':' + timestamp).digest('hex') });
  assert.equal((await service.queryOrder('slug', headers(cfg.appId, cfg.appSecret), 'shop', 1)).data.order_id, '123');
  assert.equal((await service.queryOrder('slug', headers(cfg.testAppId, cfg.testAppSecret), 'shop', 1)).data.order_id, '456');
  await assert.rejects(service.queryOrder('slug', headers(cfg.appId, cfg.appSecret, 'NaN'), 'shop', 1), /Timestamp expired/);
  cfg.testModeEnabled = false;
  await assert.rejects(send(cfg.testAppId, cfg.testAppSecret), /Test mode/);
  await send(cfg.appId, cfg.appSecret);
  cfg.testModeEnabled = true;
  cfg.testShops = [];
  await assert.rejects(send(cfg.testAppId, cfg.testAppSecret), /Test mode/);
  cfg.testShops = ['shop'];
  await service.createTestOrder('slug', 'shop', 2);
  await assert.rejects(service.queryOrder('slug', headers(cfg.appId, cfg.appSecret), 'shop', 2), /Order not found/);
  assert.ok(await service.queryOrder('slug', headers(cfg.testAppId, cfg.testAppSecret), 'shop', 2));

  let saved;
  const projects = new ProjectsService({ diDiConfig: { findUnique: async () => cfg, upsert: async args => { saved = args.update; } } }, { get: () => '' });
  assert.deepEqual(await projects.upsertDiDiConfig('p', { appId: cfg.appId, appSecret: '', testAppSecret: '' }), { success: true });
  assert.equal(saved.appSecret, cfg.appSecret);
  assert.equal(saved.testAppSecret, cfg.testAppSecret);
  assert.equal(saved.testModeEnabled, true);
  assert.deepEqual(saved.testShops, ['shop']);
  await assert.rejects(projects.upsertDiDiConfig('p', { appId: cfg.appId, testAppId: cfg.appId }), /must differ/);
  await assert.rejects(projects.upsertDiDiConfig('p', { appId: 'changed' }), /Secret is required/);
  await assert.rejects(projects.upsertDiDiConfig('p', { appId: cfg.appId, testAppId: 'changed' }), /Secret is required/);
  console.log('DiDi environment checks passed (no network or database writes).');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
