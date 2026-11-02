import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 60 * 1000;
const TELEGRAM_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;
const formatSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
// Sends the database to the owners once a day. The last run lives in the database itself,
// so restarts neither reset the schedule nor trigger extra backups.
export function createBackups({ store, telegram, recipients, logger = console, clock = Date.now }) {
  let timer;
  let current = null;
  let retryAt = 0;
  let stopped = false;
  async function notify(text) {
    for (const id of recipients) {
      try {
        await telegram.sendMessage(id, text);
      } catch {}
    }
  }
  async function send() {
    const date = new Date(clock()).toISOString().slice(0, 10);
    const dir = await mkdtemp(join(tmpdir(), 'night-kavkaz-backup-'));
    try {
      const file = join(dir, `night-kavkaz-${date}.sqlite`);
      store.backupTo(file);
      const { size } = await stat(file);
      if (size > TELEGRAM_UPLOAD_LIMIT_BYTES) {
        logger.error('Бэкап базы больше лимита Telegram.', { total: size });
        await notify(
          `Бэкап базы не отправлен: файл ${formatSize(size)} больше лимита Telegram в 50 МБ. ` +
            'Заберите базу с сервера вручную.',
        );
        store.setLastBackupAt(new Date(clock()).toISOString());
        return;
      }
      let delivered = 0;
      for (const id of recipients) {
        try {
          await telegram.sendDocument(
            id,
            { source: file, filename: `night-kavkaz-${date}.sqlite` },
            {
              caption: `Бэкап базы за ${date}, ${formatSize(size)}. Внутри данные пользователей и покупок: никому не пересылайте.`,
            },
          );
          delivered += 1;
        } catch (error) {
          logger.warn('Не удалось отправить бэкап владельцу.', {
            userId: id,
            code: error.response?.error_code ?? error.code ?? 'UNKNOWN',
          });
        }
      }
      if (delivered) {
        store.setLastBackupAt(new Date(clock()).toISOString());
        logger.info('Бэкап базы отправлен.', { recipients: recipients.length, sent: delivered });
      } else {
        retryAt = clock() + RETRY_DELAY_MS;
        logger.error('Бэкап базы не доставлен ни одному владельцу. Повтор через час.');
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  function tick() {
    if (stopped || current || clock() < retryAt) return current;
    const last = store.getLastBackupAt();
    if (last && clock() - Date.parse(last) < DAY_MS) return current;
    current = send()
      .catch((error) => {
        retryAt = clock() + RETRY_DELAY_MS;
        logger.error('Ошибка создания бэкапа базы.', { code: error.code ?? error.name });
      })
      .finally(() => {
        current = null;
      });
    return current;
  }
  return {
    tick,
    start() {
      if (!recipients.length) {
        logger.warn('ADMIN_IDS пуст: бэкап базы отправлять некому.');
        return;
      }
      tick();
      timer = setInterval(tick, CHECK_INTERVAL_MS);
      timer.unref();
    },
    // Waits for a running backup, because the store closes right after this.
    async stop() {
      stopped = true;
      clearInterval(timer);
      await current;
    },
  };
}
