#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VALID_SCENARIOS = new Set(['full', 'delta', 'both']);

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const options = {
    scenario: 'both',
    storeId: process.env.INVENTORY_TEST_STORE_ID ?? '',
    baseUrl: process.env.INVENTORY_TEST_BASE_URL ?? 'http://localhost:3000',
    delayMs: Number(process.env.INVENTORY_TEST_DELAY_MS ?? 3000),
    allowFull: false,
    dryRun: false,
  };

  for (const argument of argv) {
    if (argument === '--allow-full') options.allowFull = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument.startsWith('--scenario=')) {
      options.scenario = argument.slice('--scenario='.length).toLowerCase();
    } else if (argument.startsWith('--store-id=')) {
      options.storeId = argument.slice('--store-id='.length);
    } else if (argument.startsWith('--base-url=')) {
      options.baseUrl = argument.slice('--base-url='.length);
    } else if (argument.startsWith('--delay-ms=')) {
      options.delayMs = Number(argument.slice('--delay-ms='.length));
    } else throw new Error('Unknown argument: ' + argument);
  }

  return options;
}

function printHelp() {
  console.log([
    '',
    'Inventory API scenario tester',
    '',
    'Usage:',
    '  node scripts/test-inventory-scenarios.mjs --store-id=<99-shop-id> --allow-full',
    '',
    'Options:',
    '  --scenario=both|full|delta  Scenario to execute (default: both)',
    '  --store-id=<id>            99Food app_shop_id',
    '  --base-url=<url>           API base URL (default: http://localhost:3000)',
    '  --delay-ms=<number>        Pause between FULL and DELTA (default: 3000)',
    '  --allow-full               Required for FULL because it can replace a catalog',
    '  --dry-run                  Print payloads without sending requests',
    '  --help                     Show this help',
    '',
    'Environment:',
    '  INVENTORY_APP_SECRET    Value sent in the api_key header (required)',
    '  INVENTORY_TEST_STORE_ID    Alternative to --store-id',
    '  INVENTORY_TEST_BASE_URL    Alternative to --base-url',
    '  INVENTORY_TEST_DELAY_MS    Alternative to --delay-ms',
    '',
    'Examples:',
    '  node scripts/test-inventory-scenarios.mjs --store-id=156 --allow-full',
    '  node scripts/test-inventory-scenarios.mjs --scenario=delta --store-id=156',
    '  node scripts/test-inventory-scenarios.mjs --store-id=156 --allow-full --dry-run',
    '',
  ].join('\n'));
}

function fullPayload(storeId) {
  return {
    type: 'FULL',
    records: [
      {
        id: 'inventory-test-001',
        store_id: storeId,
        ean: '750100000001',
        name: 'Inventory Test Product A',
        description: 'FULL test item with regular price',
        price: 49.9,
        discount_price: 0,
        stock: 20,
        sale_type: 'N',
        is_available: true,
        trademark: 'OpenAPI Test',
      },
      {
        id: 'inventory-test-002',
        store_id: storeId,
        ean: '750100000002',
        name: 'Inventory Test Product B',
        description: 'FULL test item with discount price',
        price: 89.5,
        discount_price: 79.5,
        stock: 12,
        sale_type: 'N',
        is_available: true,
        trademark: 'OpenAPI Test',
      },
      {
        id: 'inventory-test-003',
        store_id: storeId,
        ean: '750100000003',
        name: 'Inventory Test Product C',
        description: 'FULL test item initially unavailable',
        price: 25,
        discount_price: 0,
        stock: 0,
        sale_type: 'N',
        is_available: false,
        trademark: 'OpenAPI Test',
      },
    ],
  };
}

function deltaPayload(storeId) {
  return {
    type: 'DELTA',
    records: [
      {
        id: 'inventory-test-001',
        store_id: storeId,
        ean: '750100000001',
        name: 'Inventory Test Product A',
        description: 'DELTA test with updated price and stock',
        price: 52.9,
        discount_price: 47.9,
        stock: 7,
        sale_type: 'N',
        is_available: true,
        trademark: 'OpenAPI Test',
      },
      {
        id: 'inventory-test-002',
        store_id: storeId,
        ean: '750100000002',
        name: 'Inventory Test Product B',
        description: 'DELTA test marking an item unavailable',
        price: 89.5,
        discount_price: 0,
        stock: 0,
        sale_type: 'N',
        is_available: false,
        trademark: 'OpenAPI Test',
      },
      {
        id: 'inventory-test-004',
        store_id: storeId,
        ean: '750100000004',
        name: 'Inventory Test Product D',
        description: 'DELTA test adding a new item',
        price: 35,
        discount_price: 0,
        stock: 5,
        sale_type: 'N',
        is_available: true,
        trademark: 'OpenAPI Test',
      },
    ],
  };
}

async function executeScenario({ name, payload, endpoint, apiKey, dryRun }) {
  console.log('\n[' + name + '] ' + payload.records.length + ' records for store ' + payload.records[0].store_id);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return { name, success: true, dryRun: true };
  }

  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        api_key: apiKey,
        'user-agent': 'openapi-inventory-scenario-test/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('  Network error: ' + message);
    return { name, success: false, error: message };
  }

  const raw = await response.text();
  const requestId = response.headers.get('x-request-id');
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }

  const duration = Date.now() - startedAt;
  console.log('  HTTP:       ' + response.status);
  console.log('  Duration:   ' + duration + ' ms');
  console.log('  Request ID: ' + (requestId ?? 'not returned'));
  console.log('  Response:   ' + JSON.stringify(body));

  const validReceipt = (
    response.ok
    && body
    && typeof body === 'object'
    && body.status === 'created'
    && typeof body.job_id === 'string'
    && (!requestId || body.job_id === requestId)
  );

  if (!validReceipt) {
    console.error('  Result:     FAILED');
    return { name, success: false, status: response.status, requestId, body };
  }

  console.log('  Result:     PASSED');
  return { name, success: true, status: response.status, requestId, body };
}

async function main() {
  loadDotEnv();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }
  if (!VALID_SCENARIOS.has(options.scenario)) {
    throw new Error('--scenario must be both, full or delta');
  }
  if (!options.storeId.trim()) {
    throw new Error('Provide --store-id or INVENTORY_TEST_STORE_ID');
  }
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
    throw new Error('--delay-ms must be a non-negative integer');
  }

  const includesFull = options.scenario === 'both' || options.scenario === 'full';
  if (includesFull && !options.allowFull && !options.dryRun) {
    throw new Error(
      'FULL can replace the complete store catalog. Re-run with --allow-full after confirming this is a test store.',
    );
  }

  const apiKey = process.env.INVENTORY_APP_SECRET;
  if (!apiKey && !options.dryRun) {
    throw new Error('INVENTORY_APP_SECRET is required and is never printed by this script');
  }

  const endpoint = options.baseUrl.replace(/\/+$/, '') + '/inventory';
  const scenarios = options.scenario === 'both'
    ? [
        { name: 'FULL', payload: fullPayload(options.storeId) },
        { name: 'DELTA', payload: deltaPayload(options.storeId) },
      ]
    : options.scenario === 'full'
      ? [{ name: 'FULL', payload: fullPayload(options.storeId) }]
      : [{ name: 'DELTA', payload: deltaPayload(options.storeId) }];

  console.log('Inventory API test');
  console.log('Endpoint: ' + endpoint);
  console.log('Scenario: ' + options.scenario.toUpperCase());
  if (options.dryRun) console.log('Mode: dry run (no requests will be sent)');

  const results = [];
  for (const [index, scenario] of scenarios.entries()) {
    results.push(await executeScenario({
      ...scenario,
      endpoint,
      apiKey,
      dryRun: options.dryRun,
    }));
    if (!options.dryRun && index < scenarios.length - 1 && options.delayMs > 0) {
      console.log('\nWaiting ' + options.delayMs + ' ms before the next scenario...');
      await new Promise(resolvePromise => setTimeout(resolvePromise, options.delayMs));
    }
  }

  const failures = results.filter(result => !result.success);
  console.log('\nSummary: ' + (results.length - failures.length) + '/' + results.length + ' scenarios passed');
  if (failures.length > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error('\nTest aborted: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
