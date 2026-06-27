#!/usr/bin/env node
/*
 * Dev-only CORS + cookie proxy for the 百合会 Discuz mobile API.
 *
 * The browser cannot call bbs.yamibo.com directly (CORS) and cannot set the
 * Cookie header itself. This proxy forwards every request to the forum, keeps
 * an in-memory cookie jar (auth / saltkey / sid / acw_tc …), and adds permissive
 * CORS headers so the Expo web build can drive the real API.
 *
 * Native (Android) talks to bbs.yamibo.com directly and lets the OS manage
 * cookies, so this proxy is only needed for `npm run web`.
 *
 *   node tools/proxy.js   (or: npm run proxy)
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const TARGET = 'https://bbs.yamibo.com';
const PORT = process.env.PROXY_PORT || 8089;
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 yamibo-m/1.0';
const ALLOWED_PROXY_ORIGINS = new Set([TARGET]);
const EXTRA_CORS_ORIGINS = (process.env.PROXY_CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_CORS_ORIGINS = new Set(EXTRA_CORS_ORIGINS);
const LOOPBACK_CORS_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Single in-memory cookie jar (one dev session).
const jar = new Map();
if (process.env.YAMIBO_AUTH && process.env.YAMIBO_SALTKEY) {
  const prefix = process.env.YAMIBO_COOKIEPRE || 'EeqY_2132_';
  jar.set(`${prefix}auth`, process.env.YAMIBO_AUTH);
  jar.set(`${prefix}saltkey`, process.env.YAMIBO_SALTKEY);
}
function cookieHeader() {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}
function storeSetCookies(list) {
  (list || []).forEach((line) => {
    const pair = line.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq < 0) return;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (!k) return;
    if (v === 'deleted' || v === '') jar.delete(k);
    else jar.set(k, v);
  });
}

function parseHttpUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch (e) {
    return null;
  }
}

function isAllowedProxyUrl(input) {
  const url = typeof input === 'string' ? parseHttpUrl(input) : input;
  return !!url && ALLOWED_PROXY_ORIGINS.has(url.origin);
}

function resolveAllowedProxyTarget(reqUrl) {
  try {
    const target = new URL(reqUrl, TARGET);
    return isAllowedProxyUrl(target) ? target : null;
  } catch (e) {
    return null;
  }
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_CORS_ORIGINS.has(origin)) return true;
  const url = parseHttpUrl(origin);
  return !!url && LOOPBACK_CORS_HOSTS.has(url.hostname);
}

function writeInvalidUrl(res, message) {
  res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost:8081');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function pipeImage(imageUrl, res, redirectsLeft = 3) {
  const targetImage = parseHttpUrl(imageUrl);
  if (!isAllowedProxyUrl(targetImage)) {
    writeInvalidUrl(res, 'image URL is not allowed');
    return;
  }
  const client = targetImage.protocol === 'https:' ? https : http;
  const headers = {
    'User-Agent': UA,
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Referer': targetImage.origin + '/',
  };
  if (targetImage.origin === TARGET && jar.size) headers.Cookie = cookieHeader();
  const imageReq = client.get(targetImage, { headers }, (imageRes) => {
    const location = imageRes.headers.location;
    if (location && imageRes.statusCode >= 300 && imageRes.statusCode < 400 && redirectsLeft > 0) {
      imageRes.resume();
      const next = parseHttpUrl(new URL(location, targetImage).toString());
      if (!isAllowedProxyUrl(next)) writeInvalidUrl(res, 'redirect URL is not allowed');
      else pipeImage(next.toString(), res, redirectsLeft - 1);
      return;
    }
    res.writeHead(imageRes.statusCode || 502, {
      'Content-Type': imageRes.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    });
    imageRes.pipe(res);
  });
  imageReq.on('error', (e) => {
    res.writeHead(502);
    res.end(String(e));
  });
}

function resolveUrl(input, res, redirectsLeft = 5) {
  const target = parseHttpUrl(input);
  if (!isAllowedProxyUrl(target)) {
    writeInvalidUrl(res, 'URL is not allowed');
    return;
  }
  const client = target.protocol === 'https:' ? https : http;
  const headers = { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Referer': TARGET + '/' };
  if (target.origin === TARGET && jar.size) headers.Cookie = cookieHeader();
  const r = client.get(target, { headers }, (upstream) => {
    storeSetCookies(upstream.headers['set-cookie']);
    const location = upstream.headers.location;
    if (location && upstream.statusCode >= 300 && upstream.statusCode < 400 && redirectsLeft > 0) {
      upstream.resume();
      const next = parseHttpUrl(new URL(location, target).toString());
      if (!isAllowedProxyUrl(next)) writeInvalidUrl(res, 'redirect URL is not allowed');
      else resolveUrl(next.toString(), res, redirectsLeft - 1);
      return;
    }
    upstream.resume();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ url: target.toString() }));
  });
  r.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e) }));
  });
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/__reset') { jar.clear(); res.writeHead(200); res.end('ok'); return; }

  if (req.url.startsWith('/__image?')) {
    const imageUrl = new URL(req.url, 'http://localhost').searchParams.get('url');
    if (!imageUrl || !isAllowedProxyUrl(imageUrl)) {
      writeInvalidUrl(res, 'invalid image URL');
      return;
    }
    pipeImage(imageUrl, res);
    return;
  }

  if (req.url.startsWith('/__resolve?')) {
    const input = new URL(req.url, 'http://localhost').searchParams.get('url');
    if (!input || !isAllowedProxyUrl(input)) {
      writeInvalidUrl(res, 'invalid URL');
      return;
    }
    resolveUrl(input, res);
    return;
  }

  const target = resolveAllowedProxyTarget(req.url);
  if (!target) {
    writeInvalidUrl(res, 'URL is not allowed');
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Accept-Encoding': 'identity',
      'Referer': TARGET + '/',
      'Origin': TARGET,
    };
    if (jar.size) headers['Cookie'] = cookieHeader();
    if (req.method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const preq = https.request(target, { method: req.method, headers }, (pres) => {
      storeSetCookies(pres.headers['set-cookie']);
      const out = [];
      pres.on('data', (d) => out.push(d));
      pres.on('end', () => {
        const buf = Buffer.concat(out);
        res.writeHead(pres.statusCode || 502, { 'Content-Type': pres.headers['content-type'] || 'application/json; charset=utf-8' });
        res.end(buf);
      });
    });
    preq.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    });
    if (body.length) preq.write(body);
    preq.end();
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[yamibo proxy] forwarding ${TARGET} on http://localhost:${PORT}`);
  });
}

module.exports = {
  TARGET,
  ALLOWED_CORS_ORIGINS,
  parseHttpUrl,
  isAllowedProxyUrl,
  isAllowedCorsOrigin,
  resolveAllowedProxyTarget,
  setCorsHeaders,
  server,
};
