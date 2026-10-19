import { createContext } from './payments/context.js';
import { registerStarsHandlers } from './payments/stars.js';
export function registerPaymentHandlers(bot, options) {
  const context = createContext(options);
  registerStarsHandlers(bot, context);
}
