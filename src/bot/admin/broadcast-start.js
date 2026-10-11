export function registerBroadcastStartHandlers(bot, context) {
  const { drafts, discountOffers, admin, deny, startInput, showBroadcastMenu } = context;
  bot.action('admin_broadcasts', (ctx) => showBroadcastMenu(ctx));
  bot.action('admin_broadcast', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    drafts.delete(String(ctx.from.id));
    discountOffers.delete(String(ctx.from.id));
    await startInput(
      ctx,
      'broadcast',
      'Новая рассылка',
      'Отправьте текст для зарегистрированных пользователей. Максимум 3500 символов. Перед отправкой будет предпросмотр.',
      { cancelData: 'admin_broadcasts' },
    );
  });
}
