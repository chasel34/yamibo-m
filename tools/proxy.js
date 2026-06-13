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

// Single in-memory cookie jar (one dev session).
const jar = new Map();
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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/__reset') { jar.clear(); res.writeHead(200); res.end('ok'); return; }

  const target = new URL(req.url, TARGET);
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

server.listen(PORT, () => {
  console.log(`[yamibo proxy] forwarding ${TARGET} on http://localhost:${PORT}`);
});
