import { purchaseCompleteScreen, deliveryDelayedScreen } from '../ui/screens.js';
// Turns a paid (pending) purchase into a one-time channel invite and sends it to the buyer.
export function createDelivery({ store, telegram, transport, channels, logger = console }) {
  const inFlight = new Set();
  async function notifyAdmins(text) {
    for (const admin of store.listAdmins()) {
      try {
        await telegram.sendMessage(admin.telegramId, text);
      } catch {}
    }
  }
  async function sendToUser(userId, screen) {
    try {
      await transport.send(telegram, userId, screen);
      return true;
    } catch {
      logger.warn('Не удалось отправить сообщение покупателю.', { userId });
      return false;
    }
  }
  async function createInvite(purchase) {
    const channelId = purchase.productSlug ? channels[purchase.productSlug] : undefined;
    if (!channelId) throw new Error('для товара не указан ID канала в .env');
    const invite = await telegram.createChatInviteLink(channelId, {
      member_limit: 1,
      name: `Покупка №${purchase.id}`.slice(0, 32),
    });
    if (!invite?.invite_link) throw new Error('Telegram вернул пустую ссылку');
    return { channelId, inviteLink: invite.invite_link };
  }
  async function deliver(purchaseId, { notifyOnFailure = true } = {}) {
    if (inFlight.has(purchaseId)) return { status: 'in_progress' };
    inFlight.add(purchaseId);
    try {
      const purchase = store.getPendingPurchase(purchaseId);
      if (!purchase) return { status: 'not_pending' };
      let invite;
      try {
        invite = await createInvite(purchase);
      } catch (error) {
        const reason = error.response?.description ?? error.message;
        logger.error('Не удалось выдать ссылку на канал.', {
          userId: purchase.telegramId,
          purchaseId,
          code: error.response?.error_code ?? error.code ?? 'UNKNOWN',
        });
        if (notifyOnFailure) {
          await sendToUser(purchase.telegramId, deliveryDelayedScreen(purchase));
          await notifyAdmins(
            `Оплаченная покупка №${purchaseId} («${purchase.productTitle}») не выдана пользователю ` +
              `${purchase.telegramId}: ${reason}. Проверьте, что бот админ канала с правом приглашать, ` +
              'затем выдайте товар через «Пользователи → Выдать товар».',
          );
        }
        return { status: 'failed', reason };
      }
      if (!store.completePurchase(purchaseId, invite.inviteLink)) {
        try {
          await telegram.revokeChatInviteLink(invite.channelId, invite.inviteLink);
        } catch {}
        return { status: 'not_pending' };
      }
      logger.info('Покупка выдана. Приглашение создано.', {
        userId: purchase.telegramId,
        purchaseId,
        productId: purchase.productId,
        amount: purchase.total,
      });
      await sendToUser(
        purchase.telegramId,
        purchaseCompleteScreen({
          ...purchase,
          purchaseId,
          inviteLink: invite.inviteLink,
        }),
      );
      return { status: 'delivered', inviteLink: invite.inviteLink };
    } finally {
      inFlight.delete(purchaseId);
    }
  }
  // Retries silently on startup: buyers and admins were already notified on the first failure.
  async function retryPending() {
    for (const purchaseId of store.listPendingPurchaseIds()) {
      await deliver(purchaseId, { notifyOnFailure: false });
    }
  }
  async function notifyUser(userId, text) {
    try {
      await telegram.sendMessage(userId, text);
    } catch {
      logger.warn('Не удалось отправить сообщение покупателю.', { userId });
    }
  }
  return { deliver, retryPending, notifyAdmins, notifyUser };
}
