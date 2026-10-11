import { createContext } from './payments/context.js';
import { registerCardHandlers } from './payments/card.js';
import { registerStarsHandlers } from './payments/stars.js';
export function registerPaymentHandlers(bot, options) {
  const context = createContext(options);
  registerCardHandlers(bot, context);
  registerStarsHandlers(bot, context);
}
