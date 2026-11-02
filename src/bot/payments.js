import { createContext } from './payments/context.js';
import { registerStarsHandlers } from './payments/stars.js';
import { registerFreeKassaHandlers } from './payments/freekassa.js';
export function registerPaymentHandlers(bot, { freeKassa = null, ...options }) {
  const context = createContext(options);
  registerStarsHandlers(bot, context);
  const handleFreeKassa = freeKassa ? registerFreeKassaHandlers(bot, context, freeKassa) : null;
  return { handleFreeKassa };
}
