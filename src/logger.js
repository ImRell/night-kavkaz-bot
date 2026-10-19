const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });
const COLORS = Object.freeze({
  debug: '\u001b[36m',
  info: '\u001b[32m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
});
const RESET = '\u001b[0m';
const DIM = '\u001b[90m';
const FIELD_LABELS = Object.freeze({
  userId: 'user',
  telegramId: 'user',
  adminId: 'admin',
  actorId: 'admin',
  topUpId: 'пополнение',
  purchaseId: 'покупка',
  productId: 'товар',
  jobId: 'рассылка',
  amount: 'сумма',
  balance: 'баланс',
  stars: 'звёзды',
  recipients: 'получатели',
  sent: 'отправлено',
  failed: 'ошибки',
  skipped: 'пропущено',
  uncertain: 'не подтверждено',
  pending: 'ожидают',
  total: 'всего',
  delivered: 'доставлено админам',
  code: 'код',
  status: 'статус',
  signal: 'сигнал',
  method: 'метод',
  attempt: 'попытка',
  rulesVersion: 'правила',
});
const clean = (value) =>
  String(value)
    .replace(/\b\d{5,}:[A-Za-z0-9_-]{20,}\b/g, '[скрыто]')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function readLoggerConfig(env = process.env) {
  const level = env.LOG_LEVEL?.trim().toLowerCase() || 'info';
  const color = env.LOG_COLOR?.trim().toLowerCase() || 'auto';
  const timeZone = env.LOG_TIMEZONE?.trim() || 'Europe/Moscow';
  if (!Object.hasOwn(LEVELS, level))
    throw new TypeError('LOG_LEVEL: debug, info, warn, error или silent.');
  if (!['auto', 'true', 'false'].includes(color))
    throw new TypeError('LOG_COLOR: auto, true или false.');
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone }).format();
  } catch {
    throw new TypeError(
      'LOG_TIMEZONE должен быть действительным часовым поясом, например Europe/Moscow.',
    );
  }
  return { level, color, timeZone };
}

export function createLogger({
  level = 'info',
  color = 'auto',
  timeZone = 'Europe/Moscow',
  clock = Date.now,
  stdout = process.stdout,
  stderr = process.stderr,
  env = process.env,
} = {}) {
  const settings = readLoggerConfig({ LOG_LEVEL: level, LOG_COLOR: color, LOG_TIMEZONE: timeZone });
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: settings.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  });
  const colored = (stream) => {
    if (settings.color !== 'auto') return settings.color === 'true';
    if (Object.hasOwn(env, 'NO_COLOR') || env.FORCE_COLOR === '0') return false;
    return Object.hasOwn(env, 'FORCE_COLOR') || Boolean(stream.isTTY);
  };
  function timestamp() {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(clock())).map((part) => [part.type, part.value]),
    );
    const zone = settings.timeZone === 'Europe/Moscow' ? 'МСК' : settings.timeZone;
    return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond} ${zone}`;
  }
  function write(severity, message, details = {}) {
    if (LEVELS[severity] < LEVELS[settings.level]) return;
    const stream = ['warn', 'error'].includes(severity) ? stderr : stdout;
    try {
      const fields =
        details && typeof details === 'object'
          ? Object.entries(details)
              .filter(
                ([key, value]) =>
                  Object.hasOwn(FIELD_LABELS, key) &&
                  ['string', 'number', 'boolean'].includes(typeof value),
              )
              .map(([key, value]) => `${FIELD_LABELS[key]}=${clean(value).slice(0, 80)}`)
          : [];
      const label = severity.toUpperCase().padEnd(5);
      const text = clean(message).slice(0, 240);
      const suffix = fields.length ? ` │ ${fields.join(' · ')}` : '';
      const line = colored(stream)
        ? `${DIM}${timestamp()}${RESET} │ ${COLORS[severity]}${label}${RESET} │ ${text}${DIM}${suffix}${RESET}\n`
        : `${timestamp()} │ ${label} │ ${text}${suffix}\n`;
      stream.write(line);
    } catch {}
  }
  return Object.freeze(
    Object.fromEntries(
      ['debug', 'info', 'warn', 'error'].map((severity) => [
        severity,
        (message, details) => write(severity, message, details),
      ]),
    ),
  );
}
