import { button, bold, emoji } from '../emoji.js';
const labels = {
  queued: 'В очереди',
  running: 'Выполняется',
  completed: 'Завершена',
  cancelled: 'Остановлена',
};
export function broadcastMenuScreen() {
  return {
    parts: [
      emoji('ellipsis'),
      ' ',
      bold('Рассылки'),
      '\n\nСоздайте новую рассылку или откройте список своих рассылок.',
    ],
    rows: [
      [button('Новая рассылка', 'admin_broadcast', { icon: 'ellipsis' })],
      [button('Мои рассылки', 'admin_broadcast_jobs', { icon: 'ellipsis' })],
      [button('В админ-панель', 'admin_menu', { icon: 'back' })],
    ],
  };
}
export function broadcastStatusScreen(job) {
  if (!job)
    return {
      parts: ['Рассылка не найдена.'],
      rows: [[button('В раздел рассылок', 'admin_broadcasts', { icon: 'back' })]],
    };
  const { counts } = job;
  const active = ['queued', 'running'].includes(job.status);
  const parts = [
    emoji(active ? 'hourglass' : 'check'),
    ' ',
    bold(`Рассылка №${job.id}: ${labels[job.status]}`),
    `\n\nПолучателей: ${job.total}\nПринято Telegram: ${counts.sent}\nОшибок: ${counts.failed}\nПропущено: ${counts.skipped}`,
    `\nДоставка не подтверждена: ${counts.uncertain}\nОсталось: ${counts.pending + counts.sending}`,
    ...(job.reason ? [`\n\n${job.reason}`] : []),
    ...(active
      ? ['\n\nРаботает в фоне. Можно пользоваться ботом; итог придёт отдельным сообщением.']
      : []),
  ];
  const rows = [
    [button('Обновить статус', `admin_broadcast_status:${job.id}`, { icon: 'lightning' })],
  ];
  if (active)
    rows.push([
      button('Остановить рассылку', `admin_broadcast_stop:${job.id}`, {
        icon: 'cancel',
        style: 'danger',
      }),
    ]);
  rows.push(
    [button('Мои рассылки', 'admin_broadcast_jobs', { icon: 'ellipsis' })],
    [button('В раздел рассылок', 'admin_broadcasts', { icon: 'back' })],
  );
  return { parts, rows };
}
export function broadcastJobsScreen({ items, page, hasNext }) {
  const parts = [emoji('ellipsis'), ' ', bold('Мои рассылки'), '\n\n'];
  const rows = [];
  if (!items.length) parts.push('Рассылок пока нет.');
  for (const job of items) {
    parts.push(`№${job.id}: ${labels[job.status]} — ${job.counts.sent}/${job.total} отправлено\n`);
    rows.push([
      button(`Рассылка №${job.id}`, `admin_broadcast_status:${job.id}`, { icon: 'eyes' }),
    ]);
  }
  const navigation = [];
  if (page > 0)
    navigation.push(button('Назад', `admin_broadcast_jobs:${page - 1}`, { icon: 'back' }));
  if (hasNext)
    navigation.push(button('Далее', `admin_broadcast_jobs:${page + 1}`, { icon: 'lightning' }));
  if (navigation.length) rows.push(navigation);
  rows.push(
    [button('Обновить', `admin_broadcast_jobs:${page}`, { icon: 'lightning' })],
    [button('Новая рассылка', 'admin_broadcast', { icon: 'ellipsis' })],
    [button('В раздел рассылок', 'admin_broadcasts', { icon: 'back' })],
  );
  return { parts, rows };
}
