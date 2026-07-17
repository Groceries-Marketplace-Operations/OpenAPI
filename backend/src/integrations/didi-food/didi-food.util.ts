import { createHash, createHmac } from 'crypto';

export const DIDI_BASE = 'https://openapi.didi-food.com/v1';

export function verifyWebhookSignature(rawBody: string, signature: string, appSecret: string): boolean {
  const md5 = createHash('md5').update(rawBody + appSecret).digest('hex');
  return md5 === signature;
}

export function verifyQuerySignature(appId: string, timestamp: string, signature: string, appSecret: string): boolean {
  const expected = createHmac('sha256', appSecret).update(`${appId}:${timestamp}`).digest('hex');
  return expected === signature;
}

export async function refreshAuthToken(appId: string, appSecret: string, appShopId: string) {
  await fetch(`${DIDI_BASE}/auth/authtoken/refresh?app_id=${appId}&app_secret=${appSecret}&app_shop_id=${appShopId}`);
}

export async function getAuthToken(appId: string, appSecret: string, appShopId: string): Promise<string> {
  const res = await fetch(`${DIDI_BASE}/auth/authtoken/get?app_id=${appId}&app_secret=${appSecret}&app_shop_id=${appShopId}`);
  const data = await res.json() as any;
  if (data.errno !== 0) throw new Error(`getAuthToken failed: ${data.errmsg}`);
  return data.data.auth_token;
}

export async function confirmOrder(authToken: string, orderId: string, retries = 2): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${DIDI_BASE}/order/order/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: authToken, order_id: String(orderId) }),
      });
      const data = await res.json() as any;
      if (data.errno === 0 && data.data === true) return;
    } catch { /* retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error(`confirmOrder failed after ${retries} attempts for order ${orderId}`);
}
