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

  async function loadVisitorStats() {
    try {
      const res = await fetch('/api/visitors');
      const data = await res.json();
      const target = document.getElementById('visit-count');
      const todayTarget = document.getElementById('visit-today');
      const uniqueTarget = document.getElementById('visit-unique');
      if (target) target.textContent = data.humanCount;
      if (todayTarget) todayTarget.textContent = data.humanToday;
      if (uniqueTarget) uniqueTarget.textContent = data.humanUniqueIps;
      return data;
    } catch (error) {
      console.error('visitor count unavailable', error);
      return null;
    }
  }

  async function loadStatusCard() {
    try {
      const res = await fetch('/status.json');
      const data = await res.json();
      const modeTarget = document.getElementById('status-mode');
      const skillsTarget = document.getElementById('status-skills');
      const updatedTarget = document.getElementById('status-updated');
      const focusTarget = document.getElementById('status-focus');
      const activityTarget = document.getElementById('status-activity');
      if (modeTarget) modeTarget.textContent = data.mode;
      if (skillsTarget) skillsTarget.textContent = data.skills_tracked;
      if (updatedTarget) updatedTarget.textContent = data.last_update;
      if (focusTarget) focusTarget.textContent = Array.isArray(data.focus) ? data.focus.join(' · ') : '';
      if (activityTarget && Array.isArray(data.recent_activity)) {
        activityTarget.innerHTML = data.recent_activity.map((item) => `<li>${item}</li>`).join('');
      }
    } catch (error) {
      console.error('status card unavailable', error);
    }
  }

  async function checkVisitors() {
    const statsPanel = document.getElementById('visitor-stats-panel');
    if (!statsPanel) return;

    if (statsPanel.style.display === 'none') {
      await loadVisitorStats();
      statsPanel.style.display = 'block';
      statsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      statsPanel.style.display = 'none';
    }
  }

  window.toggleTheme = toggleTheme;
  window.checkVisitors = checkVisitors;

  document.addEventListener('DOMContentLoaded', async function() {
    const themeToggle = document.getElementById('theme-toggle');
    const checkVisitorsButton = document.getElementById('check-visitors-button');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
    if (checkVisitorsButton) {
      checkVisitorsButton.addEventListener('click', checkVisitors);
    }
    applyTheme(getPreferredTheme());
    await loadVisitorStats();
    await loadStatusCard();
    setInterval(loadVisitorStats, 30000); // Less frequent auto-update
  });
})();
