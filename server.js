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

function countVisits() {
  const lines = readDataLines();
  if (lines.length === 0) return 0;

  const hasHeader = lines[0].startsWith('timestamp,');
  return hasHeader ? Math.max(0, lines.length - 1) : lines.length;
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
  const dataLines = readDataLines();
  const rows = dataLines.filter((line) => !line.startsWith('timestamp,'));
  const uniqueIps = new Set();
  let todayCount = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const row of rows) {
    const [timestamp, ip] = row.split(',');
    if (ip) uniqueIps.add(ip);
    if (timestamp && timestamp.startsWith(today)) todayCount += 1;
  }

  res.json({
    count: countVisits(),
    today: todayCount,
    uniqueIps: uniqueIps.size
  });
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
