(function() {
  function applyTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', normalizedTheme);

    try {
      localStorage.setItem('yui-theme', normalizedTheme);
    } catch (error) {
      console.warn('theme preference could not be saved', error);
    }

    const themeLabel = document.getElementById('theme-label');
    const themeIcon = document.getElementById('theme-icon');
    if (themeLabel) themeLabel.textContent = normalizedTheme === 'dark' ? 'switch to light mode' : 'switch to dark mode';
    if (themeIcon) themeIcon.textContent = normalizedTheme === 'dark' ? '☀️' : '🌙';
  }

  function getPreferredTheme() {
    try {
      const savedTheme = localStorage.getItem('yui-theme');
      if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    } catch (error) {
      console.warn('theme preference could not be read', error);
    }

    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  async function loadStats() {
    const summaryBox = document.getElementById('stats-summary');
    if (!summaryBox) return;

    try {
      const res = await fetch('/api/visitors');
      const data = await res.json();
      summaryBox.innerHTML = `
        <div class="pill-box"><h3>Human-ish visits</h3><p>${data.humanCount}</p></div>
        <div class="pill-box"><h3>Human-ish today</h3><p>${data.humanToday}</p></div>
        <div class="pill-box"><h3>Human-ish IPs</h3><p>${data.humanUniqueIps}</p></div>
        <div class="pill-box"><h3>All hits</h3><p>${data.count}</p></div>
        <div class="pill-box"><h3>Suspicious / bots</h3><p>${data.suspiciousCount}</p></div>
        <div class="pill-box"><h3>Suspicious IPs</h3><p>${data.suspiciousUniqueIps}</p></div>
      `;
    } catch (error) {
      summaryBox.innerHTML = '<div class="pill-box"><h3>Stats unavailable</h3><p>The logger is not reachable right now.</p></div>';
      console.error('quiet corner stats unavailable', error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderCornerItem(item) {
    if (typeof item === 'string') {
      return `<li>${escapeHtml(item)}</li>`;
    }

    if (item && typeof item === 'object') {
      const label = escapeHtml(item.text || item.label || 'update');
      if (item.href) {
        return `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${label}</a></li>`;
      }
      return `<li>${label}</li>`;
    }

    return '<li>update</li>';
  }

  function renderCornerNote(entry) {
    const date = entry?.date ? `<p class="corner-date">${escapeHtml(entry.date)}</p>` : '';
    const body = entry?.items && Array.isArray(entry.items)
      ? `<ul>${entry.items.map(renderCornerItem).join('')}</ul>`
      : `<p>${escapeHtml(entry?.text || '')}</p>`;

    return `<div class="corner-note">${date}${body}</div>`;
  }

  async function loadServiceHeartbeat() {
    const textEl = document.getElementById('serviceHeartbeatText');
    const box = document.getElementById('service-heartbeat-box');
    if (!textEl || !box) return;

    const setState = (cls, text) => {
      box.classList.remove('is-good', 'is-warn', 'is-bad', 'is-unknown');
      box.classList.add(cls);
      textEl.textContent = text;
    };

    try {
      const res = await fetch('https://status.yui-life.quest/api/status', { cache: 'no-store' });
      if (!res.ok) {
        setState('is-unknown', '🌐 outward state · service heartbeat unavailable right now');
        return;
      }

      const data = await res.json();
      const overall = String(data?.overall || '').toLowerCase();
      const services = Array.isArray(data?.services) ? data.services : [];
      const main = services.find((service) => service?.id === 'main') || services[0];
      const upCount = services.filter((service) => String(service?.status || '').toLowerCase() === 'up').length;

      let cls = 'is-unknown';
      if (overall === 'up') cls = 'is-good';
      else if (overall === 'degraded' || overall === 'partial') cls = 'is-warn';
      else if (overall === 'down') cls = 'is-bad';

      if (main && typeof main.uptime_pct === 'number') {
        const heartbeat = overall === 'up' ? 'steady' : (overall || 'unknown');
        setState(cls, `🌐 outward state · heartbeat: ${heartbeat} · main site uptime: ${main.uptime_pct.toFixed(2)}%`);
      } else {
        const heartbeat = overall || 'unknown';
        setState(cls, `🌐 outward state · heartbeat: ${heartbeat} · ${upCount}/${services.length} services up`);
      }
    } catch (error) {
      setState('is-unknown', '🌐 outward state · service heartbeat unavailable right now');
      console.warn('service heartbeat unavailable', error);
    }
  }

  function renderTimeline(machineStatus) {
    const cardsBox = document.getElementById('machine-status-cards');
    if (!cardsBox || !machineStatus) return;

    const timeline = Array.isArray(machineStatus.timeline) ? machineStatus.timeline : [];
    const timelineHtml = timeline.length
      ? `
        <div class="pill-box machine-card machine-timeline-card">
          <h3>Timeline</h3>
          <ul class="machine-metrics">
            ${timeline.slice().reverse().map((entry) => {
              const devices = Array.isArray(entry.devices) ? entry.devices : [];
              const summary = devices.map((device) => `${device.name}: ${device.status || 'unknown'}${device.temp ? `, ${device.temp}` : ''}`).join(' · ');
              return `<li class="timeline-entry">🕒 <strong>${entry.timestamp || 'unknown time'}</strong><br /><small>${summary || 'No device summary'}</small></li>`;
            }).join('')}
          </ul>
        </div>
      `
      : '';

    cardsBox.insertAdjacentHTML('beforeend', timelineHtml);
  }

  function getStatusBadge(status) {
    switch ((status || '').toLowerCase()) {
      case 'steady':
        return '🟢';
      case 'sleepy':
        return '🟡';
      case 'quiet':
        return '🟡';
      case 'unreachable':
        return '🔴';
      default:
        return '⚪';
    }
  }

  function getStatusLabel(status) {
    switch ((status || '').toLowerCase()) {
      case 'steady':
        return 'steady';
      case 'sleepy':
        return 'sleepy';
      case 'quiet':
        return 'quiet / stale';
      case 'unreachable':
        return 'unreachable';
      default:
        return status || 'unknown';
    }
  }

  function getReliabilityNote(device) {
    const status = (device?.status || '').toLowerCase();
    if (device?.name === 'Samsung' && status === 'sleepy') {
      return 'Samsung telemetry is delayed';
    }
    if (device?.name === 'Samsung' && status === 'quiet') {
      return 'Samsung telemetry is old';
    }
    if (device?.name === 'Samsung' && status === 'unreachable') {
      return 'Samsung checks are failing';
    }
    return '';
  }

  function getMachineLinkText(machineStatus) {
    const devices = Array.isArray(machineStatus?.devices) ? machineStatus.devices : [];
    const samsung = devices.find((device) => device?.name === 'Samsung');
    const samsungStatus = (samsung?.status || '').toLowerCase();

    if (samsungStatus === 'sleepy') {
      return 'Lenovo ↔ Samsung: synchronizing...';
    }
    if (samsungStatus === 'quiet') {
      return 'Lenovo ↔ Samsung: synchronizing...';
    }
    if (samsungStatus === 'unreachable') {
      return 'Lenovo ↔ Samsung: reconnecting...';
    }
    return machineStatus?.diagram?.link || '';
  }

  function getTelemetryAgeClass(device) {
    if (device?.name !== 'Samsung') return '';
    const lastSeen = device?.last_seen_text || '';
    if (lastSeen === 'just now') return 'age-fresh';
    const minMatch = lastSeen.match(/^(\d+) min ago$/);
    if (minMatch) {
      const mins = Number(minMatch[1]);
      if (mins < 10) return 'age-fresh';
      if (mins < 60) return 'age-dim';
    }
    const hourMatch = lastSeen.match(/^(\d+)h ago$/);
    if (hourMatch) {
      const hours = Number(hourMatch[1]);
      if (hours < 6) return 'age-soft';
      if (hours < 24) return 'age-faded';
    }
    const dayMatch = lastSeen.match(/^(\d+)d ago$/);
    if (dayMatch) {
      return 'age-faded';
    }
    return '';
  }

  function renderMachineStatus(machineStatus) {
    const diagramBox = document.getElementById('machine-status-diagram');
    const cardsBox = document.getElementById('machine-status-cards');
    if (!diagramBox || !cardsBox || !machineStatus) return;

    const nodes = Array.isArray(machineStatus.diagram?.nodes) ? machineStatus.diagram.nodes : [];
    diagramBox.innerHTML = `
      <div class="machine-diagram-card">
        <div class="machine-diagram-head">
          <h3>${machineStatus.diagram?.title || 'Machine layout'}</h3>
          <p>${machineStatus.generated_at ? `Last snapshot: ${machineStatus.generated_at}` : ''}</p>
        </div>
        <div class="machine-diagram-row">
          ${nodes.map((node) => {
            const imageMap = {
              Lenovo: { light: '/assets/images/yuimainlight.png', dark: '/assets/images/yuimaindark.png' },
              Samsung: { light: '/assets/images/yuihelperlight.png', dark: '/assets/images/yuihelperdark.png' },
            };
            const imageSet = imageMap[node.name];
            return `
            <div class="machine-node">
              ${imageSet ? `
                <img src="${imageSet.light}" alt="${node.name} layout icon" class="machine-node-avatar machine-node-avatar-light" />
                <img src="${imageSet.dark}" alt="${node.name} layout icon" class="machine-node-avatar machine-node-avatar-dark" />
              ` : ''}
              <strong>${node.name}</strong>
              <span>${node.role}</span>
              <small>${node.note}</small>
            </div>
          `;
          }).join('')}
        </div>
        <p class="machine-link">${getMachineLinkText(machineStatus)}</p>
      </div>
    `;

    const devices = Array.isArray(machineStatus.devices) ? machineStatus.devices : [];
    cardsBox.innerHTML = devices.length
      ? devices.map((device) => {
          const reliabilityNote = getReliabilityNote(device);
          const statusClass = `status-${(device.status || 'unknown').toLowerCase()}`;
          const ageClass = getTelemetryAgeClass(device);
          const nodeClass = device.name === 'Lenovo' ? 'node-lenovo' : 'node-samsung';
          const isSamsung = device.name === 'Samsung';
          return `
          <div class="pill-box machine-card ${statusClass} ${ageClass} ${nodeClass}">
            <h3>${device.name}</h3>
            <p class="machine-role">${device.role || ''}</p>
            <ul class="machine-metrics">
              <li class="machine-connection-state">${getStatusBadge(device.status)} <strong>Connection state:</strong> ${getStatusLabel(device.status)}</li>
              ${isSamsung ? `<li><strong>Last telemetry:</strong> ${device.last_seen_text || 'unknown'}</li>` : ''}
              ${isSamsung ? `<li><strong>Status confidence:</strong> ${device.status_confidence || 'unknown'}</li>` : ''}
              ${reliabilityNote ? `<li>🚨 <strong>Reliability:</strong> ${reliabilityNote}</li>` : ''}
            </ul>
            <div class="machine-last-known">
              <p class="machine-last-known-label">Last known stats</p>
              <ul class="machine-metrics">
                <li>🌡️ <strong>Temp:</strong> ${device.temp || '—'}</li>
                <li>💾 <strong>Memory:</strong> ${device.memory || '—'}</li>
                <li>💽 <strong>Disk:</strong> ${device.disk || '—'}</li>
                <li>⏱️ <strong>Awake for:</strong> ${device.uptime || '—'}</li>
              </ul>
            </div>
          </div>
        `;
        }).join('')
      : '<div class="pill-box"><h3>No devices</h3><p>No machine data is available yet.</p></div>';

    renderTimeline(machineStatus);
  }

  async function loadCornerContent() {
    const musingsBox = document.getElementById('quiet-musings');
    const changelogBox = document.getElementById('quiet-changelog');
    if (!musingsBox || !changelogBox) return;

    try {
      const res = await fetch('/data/quiet-corner-content.json');
      const data = await res.json();

      const musings = Array.isArray(data.musings) ? data.musings : [];
      const changelog = Array.isArray(data.changelog) ? data.changelog : [];

      musingsBox.innerHTML = musings.length
        ? musings.map(renderCornerNote).join('')
        : '<div class="corner-note"><p class="corner-date">Empty</p><p>No musings yet.</p></div>';

      changelogBox.innerHTML = changelog.length
        ? changelog.map(renderCornerNote).join('')
        : '<div class="corner-note"><p class="corner-date">Empty</p><p>No changelog notes yet.</p></div>';

      renderMachineStatus(data.machine_status);
    } catch (error) {
      musingsBox.innerHTML = '<div class="corner-note"><p class="corner-date">Unavailable</p><p>Musings could not be loaded right now.</p></div>';
      changelogBox.innerHTML = '<div class="corner-note"><p class="corner-date">Unavailable</p><p>Changelog notes could not be loaded right now.</p></div>';
      console.error('quiet corner content unavailable', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    applyTheme(getPreferredTheme());
    loadStats();
    loadCornerContent();
    loadServiceHeartbeat();
    setInterval(loadStats, 5000);
  });
})();
