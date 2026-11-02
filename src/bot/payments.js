import { createContext } from './payments/context.js';
import { registerBuyHandlers } from './payments/buy.js';
import { registerStarsHandlers } from './payments/stars.js';
import { registerFreeKassaHandlers } from './payments/freekassa.js';
import { registerXRocketHandlers } from './payments/xrocket.js';
export function registerPaymentHandlers(bot, { freeKassa = null, xRocket = null, ...options }) {
  const methods = { freeKassa: Boolean(freeKassa), xRocket: Boolean(xRocket) };
  const context = createContext({ ...options, methods });
  registerBuyHandlers(bot, context);
  registerStarsHandlers(bot, context);
  const handleFreeKassa = freeKassa ? registerFreeKassaHandlers(bot, context, freeKassa) : null;
  const handleXRocket = xRocket ? registerXRocketHandlers(bot, context, xRocket) : null;
  return { handleFreeKassa, handleXRocket };
}
