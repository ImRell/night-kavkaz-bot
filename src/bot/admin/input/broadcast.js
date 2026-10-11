import { adminPromptScreen, adminBroadcastPreviewScreen } from '../../../ui/admin/screens.js';
export async function handleBroadcastInput(ctx, context, { actor, state, text }) {
  const { store, clock, inputs, drafts, showInputResult, MAX_BROADCAST_LENGTH } = context;
  if (state.type === 'broadcast') {
    if (!text || text.length > MAX_BROADCAST_LENGTH || text.startsWith('/')) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Новая рассылка',
          `Текст пустой или длиннее ${MAX_BROADCAST_LENGTH} символов. Отправьте обычный текст или /cancel.`,
        ),
      );
      return;
    }
    inputs.delete(actor);
    const recipients = store.listOrdinaryUserIds();
    drafts.set(actor, { text, recipients, createdAt: clock() });
    await showInputResult(ctx, state, adminBroadcastPreviewScreen(text, recipients.length));
    return;
  }
}
