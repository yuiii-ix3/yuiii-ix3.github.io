const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const logFile = path.join(dataDir, 'visitors.csv');

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, 'timestamp,ip,user_agent,referrer,path\n');
}

function readDataLines() {
  return fs
    .readFileSync(logFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function parseCsvRow(row) {
  const match = row.match(/^([^,]*),([^,]*),"([\s\S]*)","([\s\S]*)","([\s\S]*)"$/);
  if (!match) return null;
  const [, timestamp, ip, userAgent, referrer, requestPath] = match;
  return { timestamp, ip, userAgent, referrer, requestPath };
}

function getVisitEntries() {
  return readDataLines()
    .filter((line) => !line.startsWith('timestamp,'))
    .map(parseCsvRow)
    .filter(Boolean);
}

function isBotLike(userAgent = '') {
  return /bot|spider|crawler|scan|curl|wget|python|axios|httpclient|go-http-client|node-fetch|headless|leakix/i.test(userAgent);
}

function isSuspiciousPath(requestPath = '') {
  return /^\/(\.env|wp-admin|wp-login|xmlrpc\.php|boaform|cgi-bin|actuator|vendor|phpmyadmin|manager|server-status|config|\.git)/i.test(requestPath);
}

function isHumanLikeVisit(entry) {
  if (!entry) return false;
  if (isBotLike(entry.userAgent)) return false;
  if (isSuspiciousPath(entry.requestPath)) return false;
  return entry.requestPath === '/' || entry.requestPath === '/index.html';
}

function summarizeVisits(entries) {
  const today = new Date().toISOString().slice(0, 10);
  const totalUniqueIps = new Set();
  const humanUniqueIps = new Set();
  const suspiciousUniqueIps = new Set();
  let todayCount = 0;
  let humanCount = 0;
  let humanToday = 0;
  let suspiciousCount = 0;

  for (const entry of entries) {
    if (!entry) continue;
    if (entry.ip) totalUniqueIps.add(entry.ip);
    if (entry.timestamp && entry.timestamp.startsWith(today)) todayCount += 1;

    if (isHumanLikeVisit(entry)) {
      humanCount += 1;
      if (entry.ip) humanUniqueIps.add(entry.ip);
      if (entry.timestamp && entry.timestamp.startsWith(today)) humanToday += 1;
      continue;
    }

    if (isBotLike(entry.userAgent) || isSuspiciousPath(entry.requestPath)) {
      suspiciousCount += 1;
      if (entry.ip) suspiciousUniqueIps.add(entry.ip);
    }
  }

  return {
    count: entries.length,
    today: todayCount,
    uniqueIps: totalUniqueIps.size,
    humanCount,
    humanToday,
    humanUniqueIps: humanUniqueIps.size,
    suspiciousCount,
    suspiciousUniqueIps: suspiciousUniqueIps.size
  };
}

app.use('/data', express.static(dataDir));

const staticAssetExtensions = new Set([
  '.css',
  '.js',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.json',
  '.txt'
]);

app.get('/api/visitors', (req, res) => {
  const entries = getVisitEntries();
  res.json(summarizeVisits(entries));
});

app.get('*', (req, res) => {
  const extension = path.extname(req.path).toLowerCase();
  const cleanPath = req.path === '/' ? '/index.html' : req.path;
  const target = path.join(rootDir, cleanPath);

  if (extension && staticAssetExtensions.has(extension)) {
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      return res.sendFile(target);
    }
    return res.status(404).sendFile(path.join(rootDir, '404.html'));
  }

  const timestamp = new Date().toISOString();
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
  const userAgent = (req.get('User-Agent') || 'unknown').replace(/"/g, "'");
  const referrer = (req.get('Referer') || 'direct').replace(/"/g, "'");
  const requestPath = req.path.replace(/"/g, "'");
  fs.appendFileSync(logFile, `${timestamp},${ip},"${userAgent}","${referrer}","${requestPath}"\n`);

  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return res.sendFile(target);
  }

  if (!extension) {
    return res.status(404).sendFile(path.join(rootDir, '404.html'));
  }

  return res.status(404).sendFile(path.join(rootDir, '404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Yui landing page server running on port ${PORT}`);
});
