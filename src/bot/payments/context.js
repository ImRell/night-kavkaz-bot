import { answerCallback } from '../transport.js';
import { isTopUpAmount } from '../top-up-options.js';
import { welcomeScreen, receiptTooManyScreen } from '../../ui/screens.js';
import { topUpAdminCaption, topUpAdminKeyboard } from '../../ui/admin/screens.js';
const RECEIPT_TTL_MS = 30 * 60 * 1000;
const MAX_PENDING_CARD_TOP_UPS = 1;
const STARS_PAYLOAD = /^stars:(\d{1,9}):([1-9]\d{0,19})$/;
export function createContext({
  store,
  transport,
  rulesVersion,
  moneyAcceptCard = null,
  hooks = {},
  clock = Date.now,
  logger = console,
}) {
  const waitingReceipt = new Map();
  const agreed = (id) => {
    const record = store.get(id);
    return record?.acceptedAt && record.rulesVersion === rulesVersion ? record : null;
  };
  async function requireAgreement(ctx) {
    const record = agreed(ctx.from.id);
    if (record) return record;
    await answerCallback(ctx, 'Сначала подтвердите возраст и согласие с правилами.');
    await transport.show(ctx, welcomeScreen());
    return null;
  }
  async function blockIfPending(ctx) {
    const pending = store.pendingCardTopUp(ctx.from.id);
    if (!pending) return false;
    waitingReceipt.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Дождитесь проверки первого чека.', { show_alert: true });
    await transport.show(ctx, receiptTooManyScreen(pending));
    return true;
  }
  function amountFrom(ctx) {
    const amount = Number(ctx.match[1]);
    return isTopUpAmount(amount) ? amount : null;
  }
  function activeReceiptState(userId) {
    const state = waitingReceipt.get(userId);
    if (!state) return null;
    if (state.createdAt + RECEIPT_TTL_MS < clock()) {
      waitingReceipt.delete(userId);
      return 'expired';
    }
    return state;
  }
  async function sendReceiptToAdmins(ctx, topUp) {
    const user = store.findRegisteredUser(String(topUp.telegramId));
    const caption = topUpAdminCaption(topUp, user);
    const extra = { caption, reply_markup: topUpAdminKeyboard(topUp.id) };
    let delivered = 0;
    for (const admin of store.listAdmins()) {
      try {
        const message =
          topUp.receiptKind === 'photo'
            ? await ctx.telegram.sendPhoto(admin.telegramId, topUp.receiptFileId, extra)
            : await ctx.telegram.sendDocument(admin.telegramId, topUp.receiptFileId, extra);
        store.addTopUpAdminMessage(topUp.id, admin.telegramId, message.message_id);
        delivered++;
      } catch {}
    }
    if (!delivered)
      logger.error('Чек не доставлен ни одному администратору.', { topUpId: topUp.id });
    else logger.debug?.('Чек отправлен администраторам.', { topUpId: topUp.id, delivered });
  }
  function parseStarsPayload(payload) {
    const match = STARS_PAYLOAD.exec(payload ?? '');
    if (!match) return null;
    const amount = Number(match[1]);
    return isTopUpAmount(amount) ? { amount, userId: match[2] } : null;
  }
  return {
    store,
    transport,
    rulesVersion,
    moneyAcceptCard,
    hooks,
    clock,
    logger,
    waitingReceipt,
    agreed,
    requireAgreement,
    blockIfPending,
    amountFrom,
    activeReceiptState,
    sendReceiptToAdmins,
    parseStarsPayload,
    RECEIPT_TTL_MS,
    MAX_PENDING_CARD_TOP_UPS,
    STARS_PAYLOAD,
  };
}
