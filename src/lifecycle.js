export async function runApplication({ bot, broadcastQueue, logger = console }, store) {
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
    await bot.launch({}, () => {
      logger.info?.('Бот подключён к Telegram. Хранилище SQLite готово.');
      if (shuttingDown) stop('shutdown');
      else broadcastQueue.start();
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
    store.close();
    logger.info?.('Бот остановлен.');
  }
}
