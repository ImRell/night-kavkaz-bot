import { button, bold } from '../emoji.js';
import { formatMoscowEnd } from '../../discounts.js';

const PAGE_SIZE = 5;
const status = discount => !discount ? 'не задана'
  : `${discount.percent}% до ${formatMoscowEnd(discount.endsAt)} — ${discount.active ? 'активна' : discount.enabled ? 'истекла' : 'отключена'}`;
export function adminDiscountsScreen(store, requestedPage = 0) {
  const products = store.listProducts().items;
  const lastPage = Math.max(0, Math.ceil(products.length / PAGE_SIZE) - 1);
  const page = Math.min(Math.max(0, requestedPage), lastPage);
  const parts = [bold('Скидки'), '\n\nНа все товары: ', status(store.getDiscount()),
    '\n\nИндивидуальная скидка имеет приоритет над общей. Скидки не суммируются.',
    '\nВыберите все товары или отдельный товар:'];
  const rows = [[button('Все товары', 'admin_discount:all', { icon: 'folder' })]];
  for (const product of products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
    rows.push([button([...product.title].slice(0, 50).join(''), `admin_discount:${product.id}`, { icon: 'cart' })]);
  }
  const navigation = [];
  if (page > 0) navigation.push(button('← Назад', `admin_discounts:${page - 1}`, { icon: 'back' }));
  if (page < lastPage) navigation.push(button('Далее →', `admin_discounts:${page + 1}`, { icon: 'lightning' }));
  if (navigation.length) rows.push(navigation);
  rows.push([button('Обновить', `admin_discounts:${page}`, { icon: 'lightning' })], [button('В админ-панель', 'admin_menu', { icon: 'back' })]);
  return { parts, rows };
}

export function adminDiscountScreen(store, productId = null, notice = '') {
  const product = productId === null ? null : store.getProduct(productId);
  if (productId !== null && !product) return {
    parts: ['Товар недоступен.'], rows: [[button('Назад', 'admin_discounts', { icon: 'back' })]],
  };
  const target = productId === null ? 'all' : String(productId);
  const discount = store.getDiscount(productId);
  const parts = [bold(product ? `Скидка: ${product.title}` : 'Скидка на все товары'), '\n\n',
  ...(notice ? [notice, '\n\n'] : []), 'Настройка: ', status(discount),
    '\nЦена округляется вверх до целого рубля.'];
  if (product) {
    parts.push(`\nБазовая цена: ${product.basePrice} ₽\nТекущая цена: ${product.price} ₽`);
    if (product.discountPercent) parts.push(`\nПрименяется ${product.discountScope === 'all' ? 'общая' : 'индивидуальная'} скидка ${product.discountPercent}% до ${formatMoscowEnd(product.discountEndsAt)}.`);
    parts.push('\nПосле отключения или окончания индивидуальной скидки применяется активная общая, если она есть.');
  } else parts.push('\nНе затрагивает товары с активной индивидуальной скидкой.');
  const rows = [[button(discount ? 'Изменить / включить скидку' : 'Задать скидку', `admin_discount_set:${target}`, { icon: 'star' })]];
  if (discount?.enabled) rows.push([button('Отключить скидку', `admin_discount_off:${target}`, { icon: 'cancel', style: 'danger' })]);
  rows.push([button('Обновить', `admin_discount:${target}`, { icon: 'lightning' })], [button('Назад', 'admin_discounts', { icon: 'back' })]);
  return { parts, rows };
}

