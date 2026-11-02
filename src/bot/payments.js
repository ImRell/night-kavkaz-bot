import { createContext } from './payments/context.js';
import { registerBuyHandlers } from './payments/buy.js';
import { registerStarsHandlers } from './payments/stars.js';
export function registerPaymentHandlers(bot, options) {
  const context = createContext(options);
  registerBuyHandlers(bot, context);
  registerStarsHandlers(bot, context);
}
