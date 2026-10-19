import { emoji, button, urlButton, bold, strikethrough } from './emoji.js';
import {
  TOP_UP_AMOUNTS,
  RUB_PER_STAR,
  MIN_TOP_UP_AMOUNT,
  MAX_TOP_UP_AMOUNT,
  isTopUpAmount,
  starsForRub,
} from '../bot/top-up-options.js';
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
      [button('Профиль', 'profile', { icon: 'profile' })],
      ...(isAdmin ? [[button('Панель администратора', 'admin_menu', { icon: 'lock' })]] : []),
    ],
  };
}
export function profileScreen(user, record) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'не указано';
  return {
    parts: [
      emoji('profile'),
      ' ',
      bold('Ваш профиль:'),
      '\n\n',
      emoji('star'),
      ' ',
      bold('Информация о покупках:'),
      '\n',
      emoji('diamond'),
      ' Баланс: ',
      bold(money(record.balance ?? 0)),
      '\n',
      emoji('cart'),
      ' Покупок: ',
      bold(String(record.purchaseCount ?? 0)),
      '\n\n',
      emoji('star'),
      ' ',
      bold('Информация о пользователе:'),
      '\n',
      emoji('question'),
      ' ID пользователя: ',
      bold(String(user.id)),
      '\n',
      emoji('question'),
      ' Имя: ',
      bold(name),
      '\n',
      emoji('question'),
      ' Username: ',
      bold(user.username ? `@${user.username}` : 'не указан'),
    ],
    rows: [
      [button('Пополнить баланс', 'top_up', { icon: 'lightning' })],
      [button('Мои покупки', 'my_purchases', { icon: 'cart' })],
      ...back('main_menu'),
    ],
  };
}
export function topUpScreen(record) {
  const amounts = TOP_UP_AMOUNTS.map((amount) => button(`${amount}₽`, `top_up_amount:${amount}`));
  return {
    parts: [
      emoji('lightning'),
      ' Пополнение баланса\n\n',
      emoji('diamond'),
      ` Текущий баланс: ${money(record.balance)}\n\n`,
      emoji('question'),
      ' На какую сумму пополнить баланс?\n\n',
      emoji('bullet'),
      ' Оплата только через Telegram Stars.',
    ],
    rows: [
      amounts.slice(0, 2),
      amounts.slice(2, 4),
      amounts.slice(4),
      [button('Ввести свою сумму', 'top_up_custom', { icon: 'lightning' })],
      ...back('profile'),
    ],
  };
}
export function topUpMethodScreen(record, amount) {
  if (!isTopUpAmount(amount)) throw new TypeError('Недоступная сумма пополнения.');
  const stars = starsForRub(amount);
  return {
    parts: [
      emoji('lightning'),
      ' Пополнение баланса\n\n',
      emoji('check'),
      ' Сумма: ',
      bold(money(amount)),
      '\n',
      emoji('star'),
      ` В Telegram Stars: ${stars} ⭐ (1 ⭐ = ${String(RUB_PER_STAR).replace('.', ',')} ₽)\n`,
      emoji('diamond'),
      ` Текущий баланс: ${money(record.balance)}\n\n`,
      emoji('question'),
      ' Оплата только через Telegram Stars. Подтвердите сумму:',
    ],
    rows: [
      [button(`Telegram Stars (${stars} ⭐)`, `top_up_stars:${amount}`, { icon: 'star' })],
      ...back('top_up'),
    ],
  };
}
export function customTopUpScreen(invalid = false) {
  return {
    parts: [
      emoji('star'),
      ' ',
      bold('Введите свою сумму'),
      '\n\n',
      ...(invalid ? ['Некорректная сумма. ', '\n\n'] : []),
      `Отправьте целое число от ${MIN_TOP_UP_AMOUNT} до ${MAX_TOP_UP_AMOUNT} — сумму пополнения в рублях, без копеек и обозначения валюты.\n\n`,
      `Оплата только через Telegram Stars: 1 ⭐ = ${String(RUB_PER_STAR).replace('.', ',')} ₽. Количество звёзд округляется вверх.\n\n`,
      'Например: 500. Для отмены нажмите кнопку ниже или отправьте /cancel.',
    ],
    rows: [[button('Отмена', 'top_up', { icon: 'cancel' })]],
  };
}
export function starsInvoiceSentScreen(amount) {
  return {
    parts: [
      emoji('star'),
      ' ',
      bold('Счёт отправлен'),
      '\n\n',
      `Ниже счёт на ${starsForRub(amount)} ⭐ (${money(amount)}). Нажмите в нём кнопку оплаты. `,
      'Баланс пополнится сразу после оплаты.',
    ],
    rows: back(`top_up_amount:${amount}`),
  };
}
export function starsCreditedScreen(result) {
  return {
    parts: [
      emoji('check'),
      ' ',
      bold('Баланс пополнен!'),
      '\n\n',
      emoji('bullet'),
      ' Зачислено: ',
      bold(money(result.amount)),
      ` (${result.stars} ⭐)\n`,
      emoji('diamond'),
      ' Текущий баланс: ',
      bold(money(result.balance)),
    ],
    rows: [
      [button('Товары', 'products', { icon: 'cart' })],
      [button('Профиль', 'profile', { icon: 'profile' })],
    ],
  };
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
        purchase.inviteLink ?? 'не выдавалась',
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
  rows.push(...back('profile'));
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
        '\n\n',
        bold(product.title),
        '\n',
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
export function purchaseConfirmScreen(product, balance) {
  if (!product) return productScreen(undefined);
  return {
    parts: [
      emoji('question'),
      ' ',
      bold('Подтвердить покупку?'),
      '\n\n',
      emoji('bullet'),
      ` Товар: ${product.title}\n`,
      emoji('bullet'),
      ' Цена: ',
      ...productPriceParts(product),
      '\n',
      emoji('bullet'),
      ` Текущий баланс: ${money(balance)}\n\n`,
      'Средства будут списаны с баланса. После оплаты вы получите одноразовую ссылку для входа в канал, ',
      'она также сохранится в разделе «Мои покупки».',
    ],
    rows: [
      [
        button('Подтвердить оплату', `confirm_purchase:${product.id}:${product.price}`, {
          icon: 'check',
        }),
      ],
      ...back('products'),
    ],
  };
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
      bold(money(result.price, result.currency)),
      '\n',
      emoji('bullet'),
      ' Новый баланс: ',
      bold(money(result.balance)),
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
  return 'Не удалось купить товар. Деньги не списаны. Попробуйте позже или свяжитесь с администратором.';
}
export function insufficientFundsText(result) {
  return `Недостаточно средств.\nТекущий баланс: ${money(result.balance)}\nСтоимость товара: ${money(result.price)}`;
}
export function changedPriceText() {
  return 'Цена товара изменилась. Проверьте новую цену и подтвердите покупку ещё раз.';
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
