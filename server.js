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

function countVisits() {
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  return Math.max(0, lines.length - 1);
}

app.use('/data', express.static(dataDir));
app.use(express.static(rootDir));

app.get('/api/visitors', (req, res) => {
  res.json({ count: countVisits() });
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    const timestamp = new Date().toISOString();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
    const userAgent = (req.get('User-Agent') || 'unknown').replace(/"/g, "'");
    const referrer = (req.get('Referer') || 'direct').replace(/"/g, "'");
    const requestPath = req.path.replace(/"/g, "'");
    fs.appendFileSync(logFile, `${timestamp},${ip},"${userAgent}","${referrer}","${requestPath}"\n`);
  }

  const cleanPath = req.path === '/' ? '/index.html' : req.path;
  const target = path.join(rootDir, cleanPath);

  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return res.sendFile(target);
  }

  return res.status(404).sendFile(path.join(rootDir, '404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Yui landing page server running on port ${PORT}`);
});
