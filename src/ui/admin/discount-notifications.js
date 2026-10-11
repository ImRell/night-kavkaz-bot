import { button, bold, strikethrough } from '../emoji.js';
import { formatMoscowEnd } from '../../discounts.js';
const money = (value) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
export function discountBroadcastOfferScreen(store, productId, token) {
  const discount = store.getDiscount(productId);
  const title = productId === null ? 'все товары' : (store.getProduct(productId)?.title ?? 'товар');
  return {
    parts: [
      bold('Скидка сохранена'),
      `\n\n${title}: ${discount.percent}% до ${formatMoscowEnd(discount.endsAt)}.`,
      '\n\nСделать рассылку с уведомлением об этой скидке?',
      '\nПеред отправкой будет предпросмотр.',
    ],
    rows: [
      [button('Да, показать уведомление', `admin_discount_notify:yes:${token}`, { icon: 'check' })],
      [button('Нет, без рассылки', `admin_discount_notify:no:${token}`, { icon: 'cancel' })],
    ],
  };
}
export function discountNotificationScreen(store, productId, discount) {
  const parts = [bold('Новая скидка!'), '\n\n'];
  if (productId === null) {
    parts.push(
      `Скидка ${discount.percent}% на все товары!`,
      '\nДля товаров с активной индивидуальной скидкой действует индивидуальная скидка, без суммирования.',
    );
  } else {
    const product = store.getProduct(productId);
    parts.push(
      bold(product.title),
      `\nСкидка ${discount.percent}%\nЦена: `,
      strikethrough(money(product.basePrice)),
      ' ',
      bold(money(product.price)),
    );
  }
  parts.push(
    `\n\nДействует до ${formatMoscowEnd(discount.endsAt)}.`,
    '\nПосмотреть товары и актуальные цены можно по кнопке ниже.',
  );
  return { parts, rows: [[button('Посмотреть товары', 'discount_products', { icon: 'cart' })]] };
}
export function discountBroadcastPreviewScreen(notification, recipientCount, token) {
  return {
    parts: [
      bold('Предпросмотр уведомления'),
      `\nПолучателей: ${recipientCount} (без администраторов и заблокированных).\n\n`,
      ...notification.parts,
    ],
    rows: [
      [button('Отправить уведомление', `admin_discount_send:${token}`, { icon: 'check' })],
      [button('Отмена', `admin_discount_notify_cancel:${token}`, { icon: 'cancel' })],
    ],
  };
}
