export function registerMembershipHandlers(bot, context) {
  const { store, logger } = context;
  // Runs before the access middleware, which would otherwise re-create the user's profile.
  bot.on('my_chat_member', (ctx) => {
    const { chat, new_chat_member: member } = ctx.myChatMember;
    if (chat.type !== 'private' || member.status !== 'kicked') return;
    const { status } = store.removeBlockedUser(chat.id);
    logger.info('Пользователь заблокировал бота.', { userId: chat.id, status });
  });
}
