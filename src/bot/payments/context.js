import { answerCallback } from '../transport.js';
import { isTopUpAmount } from '../top-up-options.js';
import { welcomeScreen } from '../../ui/screens.js';
const STARS_PAYLOAD = /^stars:([1-9]\d{0,4}):([1-9]\d{0,19})$/;
export function createContext({ store, transport, rulesVersion, logger = console }) {
  const agreed = (id) => {
    const record = store.get(id);
    return record?.acceptedAt && record.rulesVersion === rulesVersion ? record : null;
  };
  async function requireAgreement(ctx) {
    const record = agreed(ctx.from.id);
    if (record) return record;
    await answerCallback(ctx, 'Сначала подтвердите возраст и согласие с правилами.');
    await transport.show(ctx, welcomeScreen());
    return null;
  }
  function amountFrom(ctx) {
    const amount = Number(ctx.match[1]);
    return isTopUpAmount(amount) ? amount : null;
  }
  function parseStarsPayload(payload) {
    const match = STARS_PAYLOAD.exec(payload ?? '');
    if (!match) return null;
    const amount = Number(match[1]);
    return isTopUpAmount(amount) ? { amount, userId: match[2] } : null;
  }
  return { store, transport, logger, agreed, requireAgreement, amountFrom, parseStarsPayload };
}
