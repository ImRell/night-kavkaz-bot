import { emoji, button, urlButton, bold, strikethrough } from './emoji.js';
import { isStarsAmount, starsForRub } from '../domain/stars.js';
const back = (target) => [[button('Назад', target, { icon: 'back' })]];
export const money = (amount, currency = 'RUB') =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
const ONE_TIME_LINK_WARNING =
  'Ссылка одноразовая: по ней может войти только один человек. ' +
  'Не пересылайте её никому. Если по ней зайдёт кто-то другой, вы уже не сможете войти, а новую ссылку выдать нельзя.';
export function maintenanceScreen() {
  return {
    parts: [
      emoji('warning'),
      ' ',
      bold('Бот временно на технических работах.'),
      '\n\nПопробуйте воспользоваться ботом немного позже.',
    ],
  };
}
export function bannedScreen() {
  return {
    parts: [
      emoji('lock'),
      ' ',
      bold('Ваш аккаунт заблокирован.'),
      '\n\n',
      emoji('bullet'),
      ' Доступ к боту закрыт администрацией.',
      '\n',
      emoji('bullet'),
      ' Если вы считаете, что это ошибка, свяжитесь с администратором.',
    ],
  };
}
export function welcomeScreen() {
  return {
    parts: [
      emoji('folder'),
      ' ',
      bold('Приветствуем! Перед началом работы, пожалуйста, ознакомьтесь с основными правилами.'),
      '\n\n',
      emoji('bullet'),
      ' 1.0 ',
      bold('Использовать бот можно только с 18 лет.'),
      '\n',
      emoji('bullet'),
      ' 1.1 ',
      bold('Используйте бот только по его назначению.'),
      '\n',
      emoji('bullet'),
      ' 1.2 ',
      bold('Не пытайтесь нарушить работу бота или его инфраструктуру.'),
      '\n',
      emoji('bullet'),
      ' 1.3 ',
      bold('Не используйте бота для запрещённых или незаконных действий и не отправляйте спам.'),
      '\n\n',
      emoji('star'),
      ' ',
      bold('Подтверждение'),
      '\n\n',
      bold(
        'Нажимая кнопку «Я согласен», вы подтверждаете, что вам исполнилось 18 лет, ознакомились с правилами и принимаете их. После подтверждения вам станет доступно главное меню бота.',
      ),
      '\n\n',
      bold('Для сохранения согласия бот хранит ваш Telegram ID и дату подтверждения.'),
    ],
    rows: [[button('Я согласен', 'accept_rules', { icon: 'check' })]],
  };
}
export function menuScreen(user = {}, isAdmin = false) {
  const name = user.first_name?.trim() || 'друг';
  return {
    parts: [
      emoji('bullet'),
      ' ',
      bold(`Привет, ${name}!`),
      '\n\n',
      emoji('question'),
      ' ',
      bold('Добро пожаловать в магазин приватных каналов!'),
      '\n',
      bold('Здесь вы можете быстро и удобно получить доступ к закрытым каналам.'),
      '\n\n',
      emoji('diamond'),
      ' ',
      bold('Выберите нужный раздел:'),
    ],
    rows: [
      [button('Товары', 'products', { icon: 'cart' })],
      [button('Мои покупки', 'my_purchases', { icon: 'cart' })],
      ...(isAdmin ? [[button('Панель администратора', 'admin_menu', { icon: 'lock' })]] : []),
    ],
  };
}
export function productBuyScreen(product) {
  if (!product) return productScreen(undefined);
  return {
    parts: [
      emoji('cart'),
      ' ',
      bold(product.title),
      '\n\n',
      ...(product.description ? [emoji('bullet'), ` ${product.description}\n\n`] : []),
      emoji('bullet'),
      ' Цена: ',
      ...productPriceParts(product),
      '\n\n',
      'После оплаты бот пришлёт одноразовую ссылку для входа в канал. ',
      'Она также сохранится в разделе «Мои покупки».',
    ],
    rows: [[button('Купить', `buy:${product.id}`, { icon: 'check' })], ...back('products')],
  };
}
export function paymentMethodScreen(product, { freeKassa = false, xRocket = false } = {}) {
  if (!product) return productScreen(undefined);
  const starsAvailable = isStarsAmount(product.price);
  const rows = [];
  if (freeKassa)
    rows.push([
      button(
        `Карта / СБП (${money(product.price, product.currency)})`,
        `buy_fk:${product.id}:${product.price}`,
        { icon: 'diamond' },
      ),
    ]);
  if (xRocket)
    rows.push([
      button('Криптовалюта (xRocket)', `buy_xr:${product.id}:${product.price}`, {
        icon: 'lightning',
      }),
    ]);
  if (starsAvailable)
    rows.push([
      button(
        `Telegram Stars (${starsForRub(product.price)} ⭐)`,
        `buy_stars:${product.id}:${product.price}`,
        { icon: 'star' },
      ),
    ]);
  return {
    parts: [
      emoji('cart'),
      ' ',
      bold(product.title),
      '\n\n',
      emoji('bullet'),
      ' Цена: ',
      ...productPriceParts(product),
      '\n\n',
      emoji('question'),
      rows.length
        ? ' Выберите способ оплаты:'
        : ' Сейчас оплата этого товара недоступна. Свяжитесь с администратором.',
    ],
    rows: [...rows, ...back(`product:${product.id}`)],
  };
}
export function starsInvoiceSentScreen(order) {
  return {
    parts: [
      emoji('star'),
      ' ',
      bold('Счёт отправлен'),
      '\n\n',
      `Ниже счёт на ${order.stars} ⭐ (${money(order.amount)}) за «${order.productTitle}». `,
      'Нажмите в нём кнопку оплаты, ссылка на канал придёт сразу после оплаты.',
    ],
    rows: back(`buy:${order.productId}`),
  };
}
export function freeKassaInvoiceScreen(order, url) {
  return {
    parts: [
      emoji('diamond'),
      ' ',
      bold('Ссылка на оплату готова'),
      '\n\n',
      emoji('bullet'),
      ` Товар: ${order.productTitle}\n`,
      emoji('bullet'),
      ' Сумма: ',
      bold(money(order.amount)),
      '\n\n',
      'Нажмите «Оплатить» и выберите удобный способ на странице FreeKassa. ',
      'Ссылка на канал придёт в этот чат автоматически после оплаты.',
    ],
    rows: [[urlButton('Оплатить', url, { icon: 'link' })], ...back(`buy:${order.productId}`)],
  };
}
export function cryptoInvoiceScreen(order, invoice) {
  return {
    parts: [
      emoji('lightning'),
      ' ',
      bold('Счёт на оплату готов'),
      '\n\n',
      emoji('bullet'),
      ` Товар: ${order.productTitle}\n`,
      emoji('bullet'),
      ' Сумма: ',
      bold(`${invoice.cryptoAmount} ${invoice.cryptoCurrency}`),
      ` (${money(order.amount)})\n\n`,
      'Нажмите «Оплатить» — откроется счёт в @xRocket. Оплатить можно с баланса xRocket ',
      'или пополнив его в удобной сети. Счёт действует 1 час, ',
      'ссылка на канал придёт в этот чат автоматически после оплаты.',
    ],
    rows: [
      [urlButton('Оплатить', invoice.payUrl, { icon: 'link' })],
      ...back(`buy:${order.productId}`),
    ],
  };
}
export function deliveryDelayedScreen(purchase) {
  return {
    parts: [
      emoji('hourglass'),
      ' ',
      bold('Оплата получена'),
      '\n\n',
      `Покупка №${purchase.id} («${purchase.productTitle}») оплачена, но выдать ссылку прямо сейчас не получилось. `,
      'Администратор уже получил уведомление. Ссылка придёт в этот чат, как только проблема будет решена.',
    ],
    rows: [[button('Мои покупки', 'my_purchases', { icon: 'cart' })]],
  };
}
export function duplicatePaymentText(refunded) {
  return refunded
    ? 'Этот товар у вас уже куплен, поэтому повторная оплата возвращена.'
    : 'Этот товар у вас уже куплен. Повторную оплату вернёт администратор, он уже получил уведомление.';
}
export function legacySectionText() {
  return 'Этот раздел обновлён: баланса больше нет, товары покупаются напрямую.';
}
export function purchasesScreen({ items, hasNext }, page = 0) {
  const parts = [emoji('cart'), ' Мои покупки\n\n'];
  if (!items.length)
    parts.push(
      page
        ? 'На этой странице больше нет покупок.'
        : 'У вас пока нет покупок.\nПосле оформления они появятся здесь.',
    );
  else {
    for (const purchase of items) {
      const date = new Date(purchase.purchasedAt);
      const displayDate = Number.isFinite(date.getTime())
        ? date.toLocaleString('ru-RU', {
            timeZone: 'UTC',
            dateStyle: 'short',
            timeStyle: 'short',
          }) + ' UTC'
        : purchase.purchasedAt;
      parts.push(
        emoji('bullet'),
        ` Покупка №${purchase.id}\n`,
        emoji('bullet'),
        ` ${purchase.productTitle}\n`,
        emoji('bullet'),
        ` Количество: ${purchase.quantity}\n`,
        emoji('bullet'),
        ` Сумма: ${money(purchase.total, purchase.currency)}\n`,
        emoji('bullet'),
        ` Дата: ${displayDate}\n`,
        emoji('link'),
        ' Ссылка: ',
        purchase.inviteLink ??
          (purchase.status === 'pending' ? 'выдаётся, придёт в этот чат' : 'не выдавалась'),
        '\n\n',
      );
    }
    if (items.some((purchase) => purchase.inviteLink))
      parts.push(emoji('warning'), ` ${ONE_TIME_LINK_WARNING}`);
  }
  const rows = [];
  const navigation = [];
  if (page > 0)
    navigation.push(button('Предыдущая страница', `my_purchases:${page - 1}`, { icon: 'back' }));
  if (hasNext) navigation.push(button('Следующая страница', `my_purchases:${page + 1}`));
  if (navigation.length) rows.push(navigation);
  rows.push(...back('main_menu'));
  return { parts, rows };
}
function productPriceParts(product) {
  const current = money(product.price, product.currency);
  return product.discountPercent
    ? [strikethrough(money(product.basePrice, product.currency)), ' ', bold(current)]
    : [bold(current)];
}
export function productsScreen({ items }, ownedProductIds = []) {
  const owned = new Set(ownedProductIds);
  const available = items.filter((product) => !owned.has(product.id));
  const parts = [
    emoji('cart'),
    ' ',
    bold('Товары'),
    '\n\n',
    emoji('bullet'),
    ' Выберите нужный вам товар:',
  ];
  const rows = [];
  if (!available.length) parts.push('\n\nВсе товары уже приобретены.');
  else {
    for (const product of available) {
      parts.push(
        '\n\n  ',
        emoji('fire'),
        ' ',
        bold(product.title),
        '\n  ',
        emoji('diamond'),
        ' ',
        ...productPriceParts(product),
        ...(product.discountPercent ? [` (−${product.discountPercent}%)`] : []),
      );
      const price = money(product.price, product.currency);
      const title = [...String(product.title).trim()];
      const titleBudget = Math.max(1, 64 - [...price].length - 3);
      const labelTitle =
        title.length > titleBudget
          ? `${title
              .slice(0, Math.max(1, titleBudget - 1))
              .join('')
              .trimEnd()}…`
          : title.join('');
      rows.push([button(`${labelTitle} · ${price}`, `product:${product.id}`, { icon: 'cart' })]);
    }
  }
  rows.push(...back('main_menu'));
  return { parts, rows };
}
export function purchaseCompleteScreen(result) {
  return {
    parts: [
      emoji('check'),
      ' ',
      bold('Покупка оформлена!'),
      '\n\n',
      emoji('bullet'),
      ` Товар: ${result.productTitle}\n`,
      emoji('bullet'),
      ' Оплачено: ',
      bold(money(result.total, result.currency)),
      '\n',
      emoji('bullet'),
      ` Номер покупки: ${result.purchaseId}\n\n`,
      emoji('link'),
      ' ',
      bold('Ваша ссылка для входа:'),
      '\n',
      result.inviteLink,
      '\n\n',
      emoji('warning'),
      ` ${ONE_TIME_LINK_WARNING}`,
    ],
    rows: [
      [urlButton('Перейти в канал', result.inviteLink, { icon: 'link' })],
      [button('Мои покупки', 'my_purchases', { icon: 'cart' })],
      ...back('products'),
    ],
  };
}
export function purchaseFailedText() {
  return 'Не удалось оформить заказ. Деньги не списаны. Попробуйте позже или свяжитесь с администратором.';
}
export function changedPriceText() {
  return 'Цена товара изменилась. Проверьте новую цену и нажмите «Купить» ещё раз.';
}
export function productScreen(product) {
  return {
    parts: product
      ? [
          emoji('cart'),
          ' ',
          bold(product.title),
          '\n\n',
          ...(product.description ? [emoji('bullet'), ` ${product.description}\n\n`] : []),
          emoji('bullet'),
          ' Цена: ',
          ...productPriceParts(product),
        ]
      : [emoji('warning'), ' Товар больше не доступен.'],
    rows: back('products'),
  };
}
export function errorScreen() {
  return {
    parts: [
      emoji('warning'),
      ' Не получилось выполнить действие. Попробуйте ещё раз или отправьте /start.',
    ],
    rows: back('main_menu'),
  };
}
