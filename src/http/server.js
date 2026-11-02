import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { URLSearchParams } from 'node:url';
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
export const FREEKASSA_NOTIFY_PATH = '/freekassa/notify';
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
export function createWebhookServer({ http, allowedIps, freeKassa, handleFreeKassa, logger }) {
  const allowed = new Set(allowedIps);
  async function route(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== FREEKASSA_NOTIFY_PATH) return send(res, 404, 'Not found');
    if (req.method !== 'POST') return send(res, 405, 'Method not allowed');
    const ip = clientIp(req, http.trustProxy);
    if (!allowed.has(ip)) {
      logger.warn('Оповещение FreeKassa с неразрешённого IP.', { ip });
      return send(res, 403, 'Forbidden');
    }
    const notification = freeKassa.parseNotification(new URLSearchParams(await readBody(req)));
    if (notification.error) {
      logger.warn('Отклонено оповещение FreeKassa.', { code: notification.error, ip });
      return send(res, 400, notification.error);
    }
    const accepted = await handleFreeKassa(notification);
    return accepted ? send(res, 200, 'YES') : send(res, 400, 'rejected');
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
          logger.info(
            `Вебхук FreeKassa слушает http://${http.host}:${http.port}${FREEKASSA_NOTIFY_PATH}`,
          );
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
