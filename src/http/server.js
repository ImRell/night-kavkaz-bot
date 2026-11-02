import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { URLSearchParams } from 'node:url';
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
export const FREEKASSA_NOTIFY_PATH = '/freekassa/notify';
export const XROCKET_NOTIFY_PATH = '/xrocket/notify';
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Слишком большой запрос.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function normalizeIp(ip) {
  const value = String(ip ?? '').trim();
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}
const LOOPBACK = new Set(['127.0.0.1', '::1']);
// Behind a local reverse proxy the socket address is the proxy itself, so the real IP comes
// from headers. Headers are trusted only from loopback, otherwise anyone could spoof them.
function clientIp(req, trustProxy) {
  const socketIp = normalizeIp(req.socket.remoteAddress);
  if (trustProxy && LOOPBACK.has(socketIp)) {
    const forwarded = req.headers['x-real-ip'] ?? req.headers['x-forwarded-for']?.split(',')[0];
    const ip = normalizeIp(forwarded);
    if (isIP(ip)) return ip;
  }
  return socketIp;
}
export function freeKassaRoute({ allowedIps, freeKassa, handle, logger }) {
  const allowed = new Set(allowedIps);
  return async (req, { ip }) => {
    if (!allowed.has(ip)) {
      logger.warn('Оповещение FreeKassa с неразрешённого IP.', { ip });
      return [403, 'Forbidden'];
    }
    const notification = freeKassa.parseNotification(new URLSearchParams(await readBody(req)));
    if (notification.error) {
      logger.warn('Отклонено оповещение FreeKassa.', { code: notification.error, ip });
      return [400, notification.error];
    }
    return (await handle(notification)) ? [200, 'YES'] : [400, 'rejected'];
  };
}
// xRocket pauses ALL app webhooks after repeated failures, so anything with a valid signature
// is acknowledged with 200; problems are logged for manual review instead of being retried.
export function xRocketRoute({ xRocket, handle, logger }) {
  return async (req, { ip }) => {
    const rawBody = await readBody(req);
    if (!xRocket.verifySignature(req.headers, rawBody)) {
      logger.warn('Отклонён вебхук xRocket: неверная подпись.', { ip });
      return [401, 'invalid signature'];
    }
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.error('Вебхук xRocket с некорректным JSON.');
      return [200, 'ok'];
    }
    const paid = xRocket.parseWebhook(event);
    if (paid.error) logger.error('Отклонён вебхук xRocket.', { code: paid.error });
    else if (!paid.ignore) await handle(paid);
    return [200, 'ok'];
  };
}
export function createWebhookServer({ http, routes, logger }) {
  async function route(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    const handler = routes[pathname];
    if (!handler) return send(res, 404, 'Not found');
    if (req.method !== 'POST') return send(res, 405, 'Method not allowed');
    const [status, body] = await handler(req, { ip: clientIp(req, http.trustProxy) });
    return send(res, status, body);
  }
  const server = createServer((req, res) => {
    route(req, res).catch((error) => {
      if (error.status !== 413)
        logger.error('Ошибка обработки вебхука.', { code: error.code ?? error.name });
      if (!res.headersSent) send(res, error.status ?? 500, 'error');
    });
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  return {
    start: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(http.port, http.host, () => {
          server.off('error', reject);
          for (const path of Object.keys(routes))
            logger.info(`Вебхук слушает http://${http.host}:${http.port}${path}`);
          resolve();
        });
      }),
    stop: () =>
      new Promise((resolve) => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
        server.closeIdleConnections();
      }),
  };
}
