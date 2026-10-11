// Скидки считаются от базовой цены products.price.
export function discountedPrice(price, percent) {
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new TypeError('Некорректная цена или процент скидки.');
  }
  // Целочисленный расчёт исключает погрешности Number; округление вверх до рубля.
  return Number((BigInt(price) * BigInt(100 - percent) + 99n) / 100n);
}

export function parseMoscowEnd(text, now = Date.now()) {
  const match = String(text).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) throw new TypeError('Введите дату и время в формате ДД.ММ.ГГГГ ЧЧ:ММ (Москва).');
  const [, day, month, year, hour, minute] = match.map(Number);
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new TypeError('Некорректная дата или время.');
  }
  // Europe/Moscow для будущих дат: UTC+03:00, без сезонного перевода часов.
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) {
    throw new TypeError('Такой календарной даты не существует.');
  }
  const timestamp = local.getTime() - 3 * 60 * 60 * 1000;
  if (timestamp <= now) throw new TypeError('Окончание скидки должно быть в будущем.');
  return new Date(timestamp).toISOString();
}

export function formatMoscowEnd(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value)) + ' МСК';
}

