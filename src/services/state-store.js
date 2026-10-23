import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const statePath = path.resolve(process.cwd(), config.sync.stateFile);
let writeChain = Promise.resolve();

async function ensureState() {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  try {
    await fs.access(statePath);
  } catch {
    await fs.writeFile(statePath, JSON.stringify({ orders: {}, webhookIds: {} }, null, 2));
  }
}

async function readState() {
  await ensureState();
  try {
    const text = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(text || '{}');
    parsed.orders ||= {};
    parsed.webhookIds ||= {};
    return parsed;
  } catch (error) {
    console.error('[state] Failed to read state file:', error.message);
    return { orders: {}, webhookIds: {} };
  }
}

async function writeState(state) {
  await ensureState();
  const temp = `${statePath}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2));
  await fs.rename(temp, statePath);
}

function enqueueWrite(operation) {
  const next = writeChain.then(operation, operation);
  writeChain = next.catch(() => {});
  return next;
}

export async function hasWebhook(webhookId) {
  if (!webhookId) return false;
  const state = await readState();
  return Boolean(state.webhookIds[webhookId]);
}

export async function markWebhook(webhookId, metadata = {}) {
  if (!webhookId) return;
  await enqueueWrite(async () => {
    const state = await readState();
    state.webhookIds[webhookId] = { at: new Date().toISOString(), ...metadata };
    await writeState(state);
  });
}

export async function getOrderRecord(shopifyOrderId) {
  const state = await readState();
  return state.orders[String(shopifyOrderId)] || null;
}

export async function saveOrderRecord(shopifyOrderId, record) {
  await enqueueWrite(async () => {
    const state = await readState();
    state.orders[String(shopifyOrderId)] = {
      ...(state.orders[String(shopifyOrderId)] || {}),
      ...record,
      updatedAt: new Date().toISOString(),
    };
    await writeState(state);
  });
}
