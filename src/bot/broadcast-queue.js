import { broadcastStatusScreen } from '../ui/admin/broadcasts.js';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeCode = (error) =>
  String(error.response?.error_code ?? error.code ?? error.name ?? 'UNKNOWN')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 60);
export function createBroadcastQueue({
  store,
  telegram,
  transport,
  logger = console,
  concurrency = 3,
  intervalMs = 50,
  requestTimeoutMs = 15000,
  clock = Date.now,
  wait = sleep,
} = {}) {
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 10 ||
    !Number.isFinite(intervalMs) ||
    intervalMs < 0 ||
    !Number.isFinite(requestTimeoutMs) ||
    requestTimeoutMs <= 0
  ) {
    throw new TypeError('Некорректные параметры очереди рассылок.');
  }
  let stopping = false,
    started = false,
    task = null,
    gate = Promise.resolve(),
    nextStart = 0;
  const controllers = new Set();
  async function slot() {
    const previous = gate;
    let release;
    gate = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      while (!stopping) {
        const delay = Math.max(nextStart, store.getBroadcastPause()) - clock();
        if (delay <= 0) {
          nextStart = clock() + intervalMs;
          return;
        }
        await wait(Math.min(delay, 250));
      }
      throw Object.assign(new Error('Queue stopping'), { code: 'QUEUE_STOP' });
    } finally {
      release();
    }
  }
  const limitedTelegram = {
    async sendMessage(...args) {
      await slot();
      if (stopping) throw Object.assign(new Error('Queue stopping'), { code: 'QUEUE_STOP' });
      return sendReserved(...args);
    },
  };
  function validDiscount(payload) {
    const notice = payload.discountNotice;
    if (!notice) return true;
    const current = store.getDiscount(notice.productId);
    if (
      !current?.active ||
      current.percent !== notice.percent ||
      current.endsAt !== notice.endsAt ||
      current.updatedAt !== notice.updatedAt ||
      current.updatedBy !== notice.updatedBy
    )
      return false;
    if (notice.productId !== null) {
      const product = store.getProduct(notice.productId);
      if (
        !product ||
        product.price !== payload.expectedPrice ||
        product.basePrice !== payload.expectedBasePrice
      )
        return false;
    }
    return true;
  }
  function allowed(job) {
    if (!store.isAdmin(job.actorId)) {
      store.cancelBroadcast(job.id, job.actorId, 'Администратор больше не имеет доступа.');
      return false;
    }
    if (!validDiscount(job.payload)) {
      store.cancelBroadcast(
        job.id,
        job.actorId,
        'Скидка закончилась, отключена или изменена. Оставшиеся сообщения не отправлены.',
      );
      return false;
    }
    return store.broadcastIsActive(job.id);
  }
  async function recipient(job, row) {
    const finish = (status, options) =>
      store.setBroadcastRecipient(job.id, row.telegramId, status, options);
    if (stopping) {
      finish('pending');
      return;
    }
    if (!allowed(job) || store.isBanned(row.telegramId) || store.isAdmin(row.telegramId)) {
      finish('skipped');
      return;
    }
    try {
      const checked = {
        sendMessage: async (...args) => {
          await slot();
          if (stopping) throw Object.assign(new Error('Queue stopping'), { code: 'QUEUE_STOP' });
          if (!allowed(job) || store.isBanned(row.telegramId) || store.isAdmin(row.telegramId)) {
            throw Object.assign(new Error('Recipient skipped'), { code: 'RECIPIENT_SKIP' });
          }
          return sendReserved(...args);
        },
      };
      if (job.payload.notification)
        await transport.send(checked, row.telegramId, job.payload.notification);
      else await checked.sendMessage(row.telegramId, job.payload.text);
      finish('sent');
    } catch (error) {
      const code = safeCode(error);
      const apiCode = error.response?.error_code;
      if (error.code === 'QUEUE_STOP') {
        finish('pending');
        return;
      }
      if (error.code === 'RECIPIENT_SKIP') {
        finish('skipped');
        return;
      }
      const retryable =
        apiCode === 429 ||
        apiCode >= 500 ||
        ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code);
      if (
        retryable &&
        row.attempts < (apiCode === 429 ? 10 : 5) &&
        store.broadcastIsActive(job.id)
      ) {
        const backoff =
          apiCode === 429
            ? store.getBroadcastPause()
            : clock() + Math.min(30000, 1000 * 2 ** (row.attempts - 1));
        finish('pending', { nextAt: backoff, errorCode: code });
      } else if (!apiCode && !retryable) {
        finish('uncertain', { errorCode: code });
      } else finish('failed', { errorCode: code });
      logger.warn('Ошибка отправки рассылки.', { jobId: job.id, code, attempt: row.attempts });
    }
  }
  async function sendReserved(chatId, text, extra = {}) {
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      return await telegram.callApi(
        'sendMessage',
        { chat_id: chatId, text, ...extra },
        { signal: controller.signal },
      );
    } catch (error) {
      if (error.response?.error_code === 429) {
        const seconds = Number(
          error.response.parameters?.retry_after ?? error.parameters?.retry_after ?? 1,
        );
        store.setBroadcastPause(
          clock() + Math.max(1, Number.isFinite(seconds) ? seconds : 1) * 1000 + 100,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  async function worker(job, control) {
    try {
      while (!stopping && !control.failed && allowed(job)) {
        const row = store.claimBroadcastRecipient(job.id);
        if (row) {
          await recipient(job, row);
          continue;
        }
        if (!store.broadcastHasPending(job.id)) return;
        await wait(100);
      }
    } catch (error) {
      control.failed = error;
      throw error;
    }
  }
  async function reports() {
    for (const job of store.pendingBroadcastAdminNotices()) {
      if (stopping) return;
      store.markBroadcastAdminNotice(job.id);
      const actor = store.findRegisteredUser(job.actorId);
      const label = `${job.actorId}${actor?.username ? ` (@${actor.username})` : ''}`;
      const notice = `Админ ${label} использовал рассылку №${job.id}. Статус: ${job.status}.\n\n${job.payload.text}`;
      for (const target of store.listAdmins()) {
        if (stopping) return;
        if (String(target.telegramId) === job.actorId) continue;
        try {
          await limitedTelegram.sendMessage(target.telegramId, notice);
        } catch (error) {
          logger.warn('Не удалось уведомить администратора о рассылке.', {
            jobId: job.id,
            code: safeCode(error),
          });
        }
      }
    }
    for (const job of store.pendingBroadcastReports()) {
      if (stopping) return;
      if (!store.isAdmin(job.actorId)) {
        store.markBroadcastReported(job.id);
        continue;
      }
      try {
        store.beginBroadcastReport(job.id);
        await transport.send(limitedTelegram, job.actorId, broadcastStatusScreen(job));
        store.markBroadcastReported(job.id);
      } catch (error) {
        if (error.response?.error_code === 403 || error.response?.error_code === 400)
          store.markBroadcastReported(job.id);
        store.deferBroadcastReport(job.id, Math.max(clock() + 10000, store.getBroadcastPause()));
        logger.warn('Не удалось отправить отчёт рассылки.', {
          jobId: job.id,
          code: safeCode(error),
        });
        break;
      }
    }
  }
  async function run() {
    while (!stopping) {
      const job = store.nextBroadcast();
      if (!job) {
        await reports();
        await wait(250);
        continue;
      }
      try {
        logger.info?.('Началась отправка рассылки.', {
          adminId: job.actorId,
          jobId: job.id,
          recipients: job.total,
        });
        const control = { failed: null };
        const outcomes = await Promise.allSettled(
          Array.from({ length: concurrency }, () => worker(job, control)),
        );
        const failed = outcomes.find((result) => result.status === 'rejected');
        if (failed) throw failed.reason;
        if (stopping) store.deferBroadcast(job.id);
        else {
          const finished = store.finishBroadcast(job.id);
          if (finished?.status === 'completed')
            logger.info?.('Рассылка завершена.', {
              adminId: finished.actorId,
              jobId: finished.id,
              sent: finished.counts.sent,
              failed: finished.counts.failed,
              skipped: finished.counts.skipped,
              uncertain: finished.counts.uncertain,
            });
        }
        await reports();
      } catch (error) {
        store.deferBroadcast(job.id);
        logger.error('Фоновая очередь рассылок: сбой.', { jobId: job.id, code: safeCode(error) });
        await wait(1000);
      }
    }
  }
  return {
    enqueue(actorId, payload, recipients) {
      return store.enqueueBroadcast(actorId, payload, recipients);
    },
    start() {
      if (started) return;
      started = true;
      store.recoverBroadcasts();
      task = run().catch((error) =>
        logger.error('Фоновая очередь остановилась.', { code: safeCode(error) }),
      );
    },
    requestStop() {
      stopping = true;
      for (const controller of controllers) controller.abort();
    },
    async stop() {
      stopping = true;
      for (const controller of controllers) controller.abort();
      await task;
    },
  };
}
