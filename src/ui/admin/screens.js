import { button, bold, emoji } from '../emoji.js';
const backRow = () => [[button('Назад', 'admin_menu', { icon: 'back' })]];
const usersBackRow = () => [[button('Назад', 'admin_users', { icon: 'back' })]];
export function adminMenuScreen(maintenanceMode = false) {
  return {
    parts: [
      emoji('lock'),
      ' ',
      bold('Панель администратора'),
      '\nУправление ботом и пользователями.',
      '\n\n',
      ...(maintenanceMode
        ? [emoji('warning'), ' ', bold('Техработы включены: бот закрыт для пользователей.')]
        : [emoji('check'), ' Бот работает в обычном режиме.']),
    ],
    rows: [
      [button('Рассылки', 'admin_broadcasts', { icon: 'ellipsis' })],
      [
        button('Администраторы', 'admin_list', { icon: 'lock' }),
        button('Пользователи', 'admin_users', { icon: 'eyes' }),
      ],
      [button('Скидки', 'admin_discounts', { icon: 'star' })],
      [
        button(
          maintenanceMode ? 'Выключить техработы' : 'Включить техработы',
          'admin_maintenance_toggle',
          {
            icon: maintenanceMode ? 'check' : 'warning',
            style: maintenanceMode ? 'success' : 'danger',
          },
        ),
      ],
      [button('В главное меню', 'main_menu', { icon: 'back' })],
    ],
  };
}
function displayDate(value) {
  if (!value) return 'нет данных';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `${date.toLocaleString('ru-RU', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC`
    : 'нет данных';
}
export function adminUsersScreen(
  { items, page, pageSize, total, hasPrev, hasNext },
  buyersOnly = false,
) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const parts = [
    emoji('eyes'),
    ' ',
    bold(buyersOnly ? 'Покупатели' : 'Пользователи'),
    '\n',
    emoji('bullet'),
    ` Всего: ${total}\n`,
    emoji('bullet'),
    ` Страница ${page + 1} из ${pageCount}\n\n`,
  ];
  if (!items.length) {
    parts.push(
      buyersOnly
        ? 'Пока нет пользователей с покупками.'
        : 'Пока нет зарегистрированных пользователей.',
    );
  } else {
    items.forEach((user, index) => {
      const ordinal = page * pageSize + index + 1;
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'не указано';
      parts.push(
        emoji('star'),
        ` № ${ordinal}\n`,
        emoji('question'),
        ` ID: ${user.telegramId}\n`,
        emoji('question'),
        ` Username: ${user.username ? `@${user.username}` : 'не указан'}\n`,
        emoji('question'),
        ` Full name: ${fullName}\n`,
        emoji('question'),
        ` Покупок: ${user.purchaseCount}\n`,
        emoji('question'),
        ` Регистрация: ${displayDate(user.registeredAt)}\n`,
      );
      if (user.bannedAt) parts.push(emoji('lock'), ' ', bold('Заблокирован'), '\n');
      if (index < items.length - 1) parts.push('\n────────────\n\n');
    });
  }
  const rows = [];
  const navigation = [];
  const pageRoute = buyersOnly ? 'admin_buyers' : 'admin_users';
  if (hasPrev) navigation.push(button('← Назад', `${pageRoute}:${page - 1}`, { icon: 'back' }));
  if (hasNext) navigation.push(button('Далее →', `${pageRoute}:${page + 1}`));
  if (navigation.length) rows.push(navigation);
  if (pageCount > 1) {
    rows.push([
      button('Перейти к странице', `admin_users_goto:${page}:${buyersOnly ? 1 : 0}`, {
        icon: 'question',
      }),
    ]);
  }
  rows.push([
    button(
      buyersOnly ? 'Показать всех пользователей' : 'Показать покупателей',
      buyersOnly ? 'admin_users:0' : 'admin_buyers:0',
      { icon: buyersOnly ? 'eyes' : 'cart' },
    ),
  ]);
  rows.push(
    [
      button('Проверить пользователя', 'admin_lookup', { icon: 'question' }),
      button('Выдать товар', 'admin_grant', { icon: 'diamond' }),
    ],
    [
      button('Забанить', 'admin_ban', { icon: 'cancel', style: 'danger' }),
      button('Разбанить', 'admin_unban', { icon: 'check' }),
    ],
    [button('Очистить заблокировавших', 'admin_users_cleanup', { icon: 'warning' })],
  );
  rows.push(
    [
      button('Обновить', `${buyersOnly ? 'admin_buyers' : 'admin_users'}_refresh:${page}`, {
        icon: 'lightning',
      }),
    ],
    [button('Назад', 'admin_menu', { icon: 'back' })],
  );
  return { parts, rows };
}
export function adminActionResultScreen(message) {
  return {
    parts: [
      emoji(message.includes('удалён') || message.includes('добавлен') ? 'check' : 'warning'),
      ' ',
      message,
    ],
    rows: backRow(),
  };
}
export function adminPromptScreen(title, instructions, cancelData = 'admin_cancel') {
  return {
    parts: [emoji('question'), ' ', bold(title), '\n\n', emoji('bullet'), ' ', instructions],
    rows: [[button('Отмена', cancelData, { icon: 'cancel' })]],
  };
}
export function adminAdminsScreen(data, canManage = false, notice = '') {
  const result = Array.isArray(data)
    ? {
        items: data.slice(0, 5),
        page: 0,
        pageSize: 5,
        total: data.length,
        hasPrev: false,
        hasNext: data.length > 5,
      }
    : data;
  const { items, page, pageSize, total, hasPrev, hasNext } = result;
  const parts = [
    emoji('lock'),
    ' ',
    bold(`Администраторы (${total})`),
    '\n',
    emoji('bullet'),
    ` Страница ${page + 1} из ${Math.max(1, Math.ceil(total / pageSize))}\n\n`,
  ];
  if (notice) parts.push(emoji('check'), ' ', notice, '\n\n');
  if (!items.length) parts.push('Список пуст.');
  else
    items.forEach((admin, index) => {
      const ordinal = page * pageSize + index + 1;
      const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || 'не указано';
      parts.push(
        emoji('star'),
        ` № ${ordinal}\n`,
        emoji('question'),
        ` ID: ${admin.telegramId}\n`,
        emoji('question'),
        ` Username: ${admin.username ? `@${admin.username}` : 'не указан'}\n`,
        emoji('question'),
        ` Full name: ${fullName}\n`,
        emoji('question'),
        ` Регистрация: ${displayDate(admin.registeredAt)}\n`,
        emoji('question'),
        ` Администратор с: ${displayDate(admin.addedAt)}\n`,
        emoji('question'),
        ` Добавил: ${admin.addedBy ?? 'системная настройка'}\n`,
        emoji('question'),
        ` Покупок: ${admin.purchaseCount ?? 0}\n`,
      );
      if (index < items.length - 1) parts.push('\n────────────\n\n');
    });
  const rows = [];
  const nav = [];
  if (hasPrev) nav.push(button('← Назад', `admin_admins:${page - 1}`, { icon: 'back' }));
  if (hasNext) nav.push(button('Далее →', `admin_admins:${page + 1}`));
  if (nav.length) rows.push(nav);
  if (Math.max(1, Math.ceil(total / pageSize)) > 1) {
    rows.push([button('Перейти к странице', `admin_admins_goto:${page}`, { icon: 'question' })]);
  }
  if (canManage) {
    rows.push(
      [button('Добавить администратора', `admin_add:${page}`, { icon: 'profile' })],
      [button('Удалить администратора', `admin_remove:${page}`, { icon: 'cancel' })],
    );
  }
  rows.push(
    [button('Обновить', `admin_admins_refresh:${page}`, { icon: 'lightning' })],
    ...backRow(),
  );
  return { parts, rows };
}
export function adminLookupScreen(user, query) {
  const parts = [emoji('question'), ' ', bold(`Проверка пользователя: ${query}`), '\n\n'];
  if (!user) parts.push('Такой пользователь не зарегистрирован в базе данных.');
  else {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'не указано';
    parts.push(emoji('check'), ' Зарегистрирован\n');
    parts.push(emoji('question'), ` ID: ${user.telegramId}\n`);
    parts.push(
      emoji('question'),
      ` Username: ${user.username ? `@${user.username}` : 'не указан'}\n`,
    );
    parts.push(emoji('question'), ` Full name: ${fullName}\n`);
    parts.push(emoji('question'), ` Покупок: ${user.purchaseCount}\n`);
    parts.push(emoji('question'), ` Регистрация: ${displayDate(user.registeredAt)}\n`);
    parts.push(
      ...(user.bannedAt
        ? [emoji('lock'), ' Статус: ', bold('заблокирован'), ` с ${displayDate(user.bannedAt)}\n`]
        : [emoji('check'), ' Статус: активен\n']),
    );
  }
  return { parts, rows: usersBackRow() };
}
export function adminCleanupConfirmScreen(count) {
  if (!count)
    return {
      parts: [
        emoji('check'),
        ' Проверять некого: все пользователи — покупатели, админы или забаненные.',
      ],
      rows: usersBackRow(),
    };
  return {
    parts: [
      emoji('warning'),
      ' ',
      bold('Очистка заблокировавших'),
      '\n\n',
      `Проверю пользователей без покупок: ${count}. Те, кто заблокировал бота или удалил аккаунт, будут удалены из базы без возможности восстановления.\n\n`,
      'Покупатели, администраторы и забаненные не затрагиваются. Пользователи ничего не увидят.',
    ],
    rows: [
      [
        button('Проверить и удалить', 'admin_users_cleanup_run', {
          icon: 'check',
          style: 'danger',
        }),
      ],
      [button('Отмена', 'admin_users', { icon: 'cancel' })],
    ],
  };
}
export function adminCleanupProgressScreen(count) {
  return {
    parts: [
      emoji('hourglass'),
      ' ',
      bold('Проверка запущена'),
      '\n\n',
      `Пользователей к проверке: ${count}. Когда закончу, здесь появится итог.`,
    ],
    rows: [],
  };
}
export function adminCleanupResultScreen({ checked, removed, kept, failed }) {
  return {
    parts: [
      emoji('check'),
      ' ',
      bold('Очистка завершена'),
      '\n\n',
      emoji('bullet'),
      ` Проверено: ${checked}\n`,
      emoji('bullet'),
      ` Удалено: ${removed}\n`,
      ...(kept
        ? [emoji('bullet'), ` Оставлено из-за открытого заказа или новой покупки: ${kept}\n`]
        : []),
      ...(failed
        ? [emoji('warning'), ` Не удалось проверить: ${failed}. Они не удалены, повторите позже.\n`]
        : []),
    ],
    rows: usersBackRow(),
  };
}
export function adminGrantProductsScreen(user, query, products, ownedProductIds = []) {
  if (!user)
    return {
      parts: [emoji('warning'), ` Пользователь ${query} не зарегистрирован в базе данных.`],
      rows: usersBackRow(),
    };
  const owned = new Set(ownedProductIds);
  const available = products.filter((product) => !owned.has(product.id));
  const parts = [
    emoji('diamond'),
    ' ',
    bold('Выдать товар'),
    '\n\n',
    emoji('bullet'),
    ` Пользователь: ${userLabel(user.telegramId, user)}\n\n`,
    available.length
      ? 'Выберите товар. Бот создаст покупку и пришлёт пользователю одноразовую ссылку.'
      : 'У пользователя уже есть все товары.',
  ];
  const rows = available.map((product) => [
    button(product.title.slice(0, 60), `admin_grant:${user.telegramId}:${product.id}`, {
      icon: 'cart',
    }),
  ]);
  return { parts, rows: [...rows, ...usersBackRow()] };
}
export function adminGrantResultScreen(result) {
  const delivered = result.delivery?.status === 'delivered';
  const messages = {
    user_not_found: `Пользователь ${result.telegramId} не зарегистрирован в базе данных.`,
    unavailable: 'Товар недоступен или снят с продажи.',
    already_owned: `У пользователя уже есть «${result.productTitle}».`,
    forbidden: 'Недостаточно прав.',
  };
  if (result.status !== 'granted' && result.status !== 'redeliver')
    return {
      parts: [emoji('warning'), ' ', messages[result.status] ?? 'Не удалось выдать товар.'],
      rows: usersBackRow(),
    };
  return {
    parts: [
      emoji(delivered ? 'check' : 'warning'),
      ' ',
      bold(delivered ? 'Товар выдан.' : 'Ссылку выдать не удалось.'),
      '\n\n',
      emoji('bullet'),
      ` Пользователь: ${result.telegramId}\n`,
      emoji('bullet'),
      ` Товар: ${result.productTitle}\n`,
      emoji('bullet'),
      ` Покупка №${result.purchaseId}\n\n`,
      delivered
        ? 'Пользователь получил одноразовую ссылку в чате с ботом.'
        : `Причина: ${result.delivery?.reason ?? 'покупка уже обрабатывается'}. Покупка сохранена, повторите выдачу позже.`,
    ],
    rows: usersBackRow(),
  };
}
export function adminBanResultScreen(result, query) {
  const target = result.telegramId ?? query;
  const label = userLabel(target, result.user);
  if (result.status === 'banned') {
    return {
      parts: [
        emoji('lock'),
        ' ',
        bold('Пользователь заблокирован.'),
        '\n\n',
        emoji('bullet'),
        ` Пользователь: ${label}\n`,
        emoji('bullet'),
        ' Доступ к боту закрыт, рассылки ему не приходят.',
      ],
      rows: usersBackRow(),
    };
  }
  if (result.status === 'unbanned') {
    return {
      parts: [
        emoji('check'),
        ' ',
        bold('Пользователь разблокирован.'),
        '\n\n',
        emoji('bullet'),
        ` Пользователь: ${label}\n`,
        emoji('bullet'),
        ' Доступ к боту снова открыт.',
      ],
      rows: usersBackRow(),
    };
  }
  const messages = {
    not_found: `Пользователь ${query} не зарегистрирован в базе данных. Изменения не внесены.`,
    already_banned: `Пользователь ${label} уже заблокирован.`,
    not_banned: `Пользователь ${label} не заблокирован.`,
    is_admin: `Нельзя заблокировать администратора ${label}. Сначала удалите его из администраторов.`,
    self: 'Нельзя заблокировать самого себя.',
    forbidden: 'Недостаточно прав. Изменения не внесены.',
  };
  return {
    parts: [emoji('warning'), ' ', messages[result.status] ?? 'Не удалось выполнить операцию.'],
    rows: usersBackRow(),
  };
}
export function adminBroadcastPreviewScreen(message, recipientCount) {
  return {
    parts: [
      emoji('warning'),
      ' ',
      bold('Проверьте рассылку'),
      '\n',
      emoji('bullet'),
      ` Получателей: ${recipientCount}\n\n`,
      message,
    ],
    rows: [
      [
        button('Отправить всем', 'admin_broadcast_confirm', { icon: 'check' }),
        button('Отмена', 'admin_broadcast_cancel', { icon: 'cancel' }),
      ],
    ],
  };
}
const userLabel = (id, user) => {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return `${id}${user?.username ? ` (@${user.username})` : ''}${name ? `, ${name}` : ''}`;
};
