export function telegramId(id) {
  const value = String(id);
  if (!/^[1-9]\d*$/.test(value)) throw new TypeError('Некорректный Telegram ID.');
  return value;
}
