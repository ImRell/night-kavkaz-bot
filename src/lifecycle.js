export async function runApplication(
  { bot, broadcastQueue, webhookServer = null, delivery = null, logger = console },
  store,
) {
  let shuttingDown = false;
  let stopRetry;
  const tryStop = (signal) => {
    try {
      bot.stop(signal);
      clearInterval(stopRetry);
      stopRetry = undefined;
      return true;
    } catch {
      return false;
    }
  };
  const stop = (signal) => {
    if (!shuttingDown) logger.info?.('Остановка бота.', { signal });
    shuttingDown = true;
    broadcastQueue.requestStop();
    if (!tryStop(signal) && !stopRetry) {
      stopRetry = setInterval(() => tryStop(signal), 100);
      stopRetry.unref();
    }
  };
  const onSigint = () => stop('SIGINT');
  const onSigterm = () => stop('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    try {
      await webhookServer?.start();
    } catch (error) {
      logger.error('Не удалось запустить HTTP-сервер вебхуков. Проверьте HTTP_HOST и HTTP_PORT.', {
        code: error.code ?? 'UNKNOWN',
      });
      process.exitCode = 1;
      return;
    }
    await bot.launch({}, () => {
      logger.info?.('Бот подключён к Telegram. Хранилище SQLite готово.');
      if (shuttingDown) stop('shutdown');
      else {
        broadcastQueue.start();
        // Purchases paid before a restart may still wait for their invite links.
        delivery?.retryPending().catch(() => {});
      }
    });
  } catch (error) {
    if (!shuttingDown) {
      logger.error(
        'Не удалось запустить бота. Проверьте токен, сеть и отсутствие второго экземпляра.',
        { code: error.response?.error_code ?? error.code ?? 'UNKNOWN' },
      );
      process.exitCode = 1;
    }
  } finally {
    clearInterval(stopRetry);
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    await broadcastQueue.stop();
    await webhookServer?.stop();
    store.close();
    logger.info?.('Бот остановлен.');
  }
}
