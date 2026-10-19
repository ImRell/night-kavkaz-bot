import { createContext } from './admin/context.js';
import { registerNavigationHandlers } from './admin/navigation.js';
import { registerDiscountsHandlers } from './admin/discounts.js';
import { registerBroadcastStartHandlers } from './admin/broadcast-start.js';
import { registerUsersHandlers } from './admin/users.js';
import { registerBroadcastsHandlers } from './admin/broadcasts.js';
import { registerInputHandlers } from './admin/input.js';
import { registerFallbackHandlers } from './admin/fallback.js';
export function registerAdminHandlers(bot, options) {
  const context = createContext(options);
  registerNavigationHandlers(bot, context);
  registerDiscountsHandlers(bot, context);
  registerBroadcastStartHandlers(bot, context);
  registerUsersHandlers(bot, context);
  registerBroadcastsHandlers(bot, context);
  registerInputHandlers(bot, context);
  registerFallbackHandlers(bot, context);
}
