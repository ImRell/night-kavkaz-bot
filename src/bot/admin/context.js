import { answerCallback } from '../transport.js';
import { adminMenuScreen } from '../../ui/admin/screens.js';
import { createPromptTools } from './prompts.js';
import { createDirectoryTools } from './users.js';
import { createReceiptTools } from './receipts.js';
import { createDiscountTools } from './discounts.js';
import { createBroadcastTools } from './broadcasts.js';
const INPUT_TTL_MS = 10 * 60 * 1000;
const MAX_BROADCAST_LENGTH = 3500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const validId = (value) => /^[1-9]\d{0,19}$/.test(value);
const validUserQuery = (value) => validId(value) || /^@?[A-Za-z0-9_]{1,32}$/.test(value);
const USER_TOOL_INPUTS = new Set(['lookup', 'credit', 'ban', 'unban']);
const USERS_CANCEL = 'admin_users_cancel';
export function createContext({
  store,
  transport,
  broadcastQueue,
  clock = Date.now,
  logger = console,
}) {
  const inputs = new Map();
  const drafts = new Map();
  const discountOffers = new Map();
  const admin = (ctx) =>
    Boolean(ctx.from && ctx.chat?.type === 'private' && store.isAdmin(ctx.from.id));
  async function deny(ctx) {
    await answerCallback(ctx, 'Доступ только для администраторов.', { show_alert: true });
  }
  async function showMenu(ctx) {
    await transport.show(
      ctx,
      adminMenuScreen(store.isMaintenanceMode(), store.pendingReceiptCount()),
    );
  }
  const context = {
    store,
    transport,
    broadcastQueue,
    clock,
    logger,
    inputs,
    drafts,
    discountOffers,
    admin,
    deny,
    showMenu,
    INPUT_TTL_MS,
    MAX_BROADCAST_LENGTH,
    sleep,
    validId,
    validUserQuery,
    USER_TOOL_INPUTS,
    USERS_CANCEL,
  };
  Object.assign(context, createPromptTools(context));
  Object.assign(context, createDirectoryTools(context));
  Object.assign(context, createReceiptTools(context));
  Object.assign(context, createDiscountTools(context));
  Object.assign(context, createBroadcastTools(context));
  return context;
}
