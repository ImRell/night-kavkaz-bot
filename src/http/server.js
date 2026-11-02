import { createServer } from 'node:http';
import { isIP } from 'node:net';
const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}
export function readBody(req) {
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
