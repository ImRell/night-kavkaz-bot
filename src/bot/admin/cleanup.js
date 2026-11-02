const REQUEST_DELAY_MS = 40;
const MAX_ATTEMPTS = 5;
// Unref'd so a long Telegram rate-limit pause never delays bot shutdown.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref());
function isUnreachable(error) {
  const code = error.response?.error_code;
  return (
    code === 403 || (code === 400 && /chat not found/i.test(error.response?.description ?? ''))
  );
}
export function createUserCleanup({ store, logger }) {
  let running = false;
  // sendChatAction shows the user nothing, but fails if the bot is blocked or the account is gone.
  async function probe(telegram, id) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await telegram.sendChatAction(id, 'typing');
        return 'reachable';
      } catch (error) {
        if (isUnreachable(error)) return 'unreachable';
        const retryAfter = error.response?.parameters?.retry_after;
        if (error.response?.error_code !== 429 || attempt === MAX_ATTEMPTS) return 'failed';
        await sleep((retryAfter ?? 1) * 1000);
      }
    }
    return 'failed';
  }
  async function run(telegram) {
    running = true;
    const result = { checked: 0, removed: 0, kept: 0, failed: 0 };
    try {
      for (const id of store.listCleanupCandidateIds()) {
        const state = await probe(telegram, id);
        result.checked += 1;
        if (state === 'failed') result.failed += 1;
        if (state === 'unreachable') {
          if (store.removeBlockedUser(id).status === 'removed') result.removed += 1;
          else result.kept += 1;
        }
        await sleep(REQUEST_DELAY_MS);
      }
      logger.info('Очистка пользователей завершена.', result);
      return result;
    } finally {
      running = false;
    }
  }
  return { run, isRunning: () => running };
}
