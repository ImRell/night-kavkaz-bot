import { randomBytes, randomInt } from 'node:crypto';
import { welcomeScreen, captchaScreen, captchaLockedScreen } from '../ui/screens.js';
const MAX_FAILS = 3;
const LOCK_MS = 5 * 60 * 1000;
const STATE_TTL_MS = 60 * 60 * 1000;
function createChallenge() {
  const a = randomInt(2, 10);
  const b = randomInt(2, 10);
  const answer = a + b;
  const options = new Set([answer]);
  while (options.size < 4) {
    const candidate = answer + randomInt(-5, 6);
    if (candidate > 0) options.add(candidate);
  }
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // The nonce makes buttons of an already replaced example stale.
  return { a, b, answer, options: shuffled, nonce: randomBytes(4).toString('hex') };
}
// Single source of truth for "may this user use the shop": rules accepted and captcha passed.
export function createAccessGate({ store, rulesVersion, clock = Date.now }) {
  const states = new Map();
  const hasAccepted = (record) =>
    Boolean(record?.acceptedAt && record.rulesVersion === rulesVersion);
  const isAllowed = (record) => hasAccepted(record) && Boolean(record.captchaPassedAt);
  function stateOf(userId) {
    const id = String(userId);
    const now = clock();
    for (const [key, state] of states) {
      if (state.touchedAt + STATE_TTL_MS < now && state.lockedUntil <= now) states.delete(key);
    }
    let state = states.get(id);
    if (!state) {
      state = { challenge: createChallenge(), fails: 0, lockedUntil: 0, touchedAt: now };
      states.set(id, state);
    }
    if (state.lockedUntil && state.lockedUntil <= now) {
      state.challenge = createChallenge();
      state.fails = 0;
      state.lockedUntil = 0;
    }
    state.touchedAt = now;
    return state;
  }
  function renderCaptcha(state) {
    return state.lockedUntil > clock()
      ? captchaLockedScreen(Math.ceil((state.lockedUntil - clock()) / 60000))
      : captchaScreen(state.challenge);
  }
  // Screen a user who is not allowed yet must see: the rules first, then the captcha.
  function screenFor(userId) {
    return hasAccepted(store.get(userId)) ? renderCaptcha(stateOf(userId)) : welcomeScreen();
  }
  function noticeFor(userId) {
    return hasAccepted(store.get(userId))
      ? 'Сначала решите пример, чтобы подтвердить, что вы не бот.'
      : 'Сначала подтвердите возраст и согласие с правилами.';
  }
  function answer(userId, nonce, value) {
    const state = stateOf(userId);
    if (state.lockedUntil > clock()) return { status: 'locked', screen: renderCaptcha(state) };
    if (state.challenge.nonce !== nonce) return { status: 'stale', screen: renderCaptcha(state) };
    if (value === state.challenge.answer) {
      states.delete(String(userId));
      store.passCaptcha(userId);
      return { status: 'passed' };
    }
    state.fails += 1;
    state.challenge = createChallenge();
    if (state.fails >= MAX_FAILS) {
      state.lockedUntil = clock() + LOCK_MS;
      return { status: 'locked', screen: renderCaptcha(state) };
    }
    return { status: 'wrong', screen: renderCaptcha(state) };
  }
  return { hasAccepted, isAllowed, screenFor, noticeFor, answer };
}
