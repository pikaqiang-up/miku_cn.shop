(function () {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  /* 当前年份 */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* 顶部阅读进度与导航状态 */
  const header = $('.site-header');
  const progress = $('#readingProgress');
  const navLinks = $$('.main-nav a');
  const sections = navLinks.map(link => $(link.getAttribute('href'))).filter(Boolean);
  let scrollTicking = false;
  function updateScrollUI() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (header) header.classList.toggle('scrolled', scrollTop > 24);
    if (progress) progress.style.width = (maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0) + '%';
    let current = '';
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= window.innerHeight * .42) current = '#' + section.id;
    });
    navLinks.forEach(link => {
      const active = link.getAttribute('href') === current;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollTicking = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(updateScrollUI);
      scrollTicking = true;
    }
  }, { passive: true });
  updateScrollUI();

  /* 手机导航 */
  const menuToggle = $('#menuToggle');
  const mainNav = $('#mainNav');
  function closeMenu() {
    if (!menuToggle || !mainNav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开导航');
    mainNav.classList.remove('open');
  }
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
      mainNav.classList.toggle('open', open);
    });
    navLinks.forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu(); }, { passive: true });
  }

  /* 夜间模式：优先读取本机偏好 */
  const themeToggle = $('#themeToggle');
  let storedTheme = null;
  try { storedTheme = localStorage.getItem('miku-space-theme'); } catch (_) { /* 私密浏览模式可能禁用存储 */ }
  if (storedTheme === 'dark' || storedTheme === 'light') root.setAttribute('data-theme', storedTheme);
  function syncThemeButton() {
    const dark = root.getAttribute('data-theme') === 'dark';
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(dark));
      themeToggle.setAttribute('aria-label', dark ? '切换日间模式' : '切换夜间模式');
    }
    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', dark ? '#0b1b1b' : '#f5fbfa');
  }
  syncThemeButton();
  if (themeToggle) themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('miku-space-theme', next); } catch (_) { /* 不影响主题切换 */ }
    syncThemeButton();
  });

  /* 滚动显现：不支持 IntersectionObserver 时不隐藏内容 */
  const revealItems = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.delay || 0);
        entry.target.style.transitionDelay = delay + 'ms';
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -4% 0px' });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('visible'));
  }

  /* 首屏粒子：只在首屏绘制，暂停后台标签页，移动端减少数量 */
  (function initParticles() {
    const canvas = $('#heroParticles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    let width = 0, height = 0, dpr = 1, particles = [], raf = 0, resizeTimer = 0, initialized = false;
    const sprites = [];
    function makeSprite(color) {
      const sprite = document.createElement('canvas');
      sprite.width = sprite.height = 40;
      const g = sprite.getContext('2d');
      const gradient = g.createRadialGradient(20, 20, 0, 20, 20, 20);
      gradient.addColorStop(0, `rgba(${color},.78)`);
      gradient.addColorStop(.32, `rgba(${color},.22)`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gradient;
      g.fillRect(0, 0, 40, 40);
      return sprite;
    }
    sprites.push(makeSprite('57,197,187'), makeSprite('244,184,202'));
    function makeParticle() {
      const mobile = window.innerWidth < 700;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: (mobile ? 2 : 2.7) + Math.random() * (mobile ? 3 : 5),
        speed: .07 + Math.random() * .18,
        alpha: .2 + Math.random() * .42,
        phase: Math.random() * Math.PI * 2,
        sway: .2 + Math.random() * .5,
        sprite: Math.random() < .14 ? sprites[1] : sprites[0]
      };
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* 移动端约为桌面端的一半，减少绘制与合成成本。 */
      const count = window.innerWidth < 700 ? 21 : 42;
      particles = Array.from({ length: count }, makeParticle);
    }
    function draw(time) {
      if (document.hidden) return;
      ctx.clearRect(0, 0, width, height);
      const t = time * .001;
      particles.forEach(p => {
        p.y -= p.speed;
        if (p.y < -22) { p.y = height + 18; p.x = Math.random() * width; }
        const x = p.x + Math.sin(t * .34 + p.phase) * p.sway * 12;
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(p.sprite, x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        ctx.globalAlpha = p.alpha * .72;
        ctx.drawImage(p.sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      });
      ctx.globalAlpha = 1;
    }
    function initialize() {
      if (initialized) return;
      initialized = true;
      resize();
      if (reduceMotion) drawStatic();
      else if (!document.hidden) raf = requestAnimationFrame(draw);
    }
    /* 首屏先完成文字与弧线绘制，粒子在浏览器空闲时再初始化。 */
    if ('requestIdleCallback' in window) window.requestIdleCallback(initialize, { timeout: 900 });
    else window.setTimeout(initialize, 360);
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!initialized) return;
        resize();
        if (reduceMotion) drawStatic();
      }, 180);
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!initialized || document.hidden) return;
      if (reduceMotion) drawStatic();
      else raf = requestAnimationFrame(draw);
    });
  })();

  /* 声场实验室：Canvas 生成波形、同心声纹与频谱图 */
  (function initVisualizer() {
    const canvas = $('#soundCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const amount = $('#waveAmount');
    const density = $('#waveDensity');
    const amountValue = $('#waveAmountValue');
    const densityValue = $('#waveDensityValue');
    const readout = $('#visualReadout');
    const modeLabel = $('#visualModeLabel');
    const modeButtons = $$('.mode-button');
    const W = 900, H = 520;
    let mode = 'wave', amplitude = 58, detail = 48, frame = 0, raf = 0;
    const labels = { wave: 'SINE / FLOW FIELD', ring: 'RING / RESONANCE', spectrum: 'SPECTRUM / FREQUENCY' };
    function setupCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function grid() {
      ctx.strokeStyle = 'rgba(116,190,180,.09)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    function wave(t) {
      const lines = Math.max(3, Math.round(detail / 7));
      for (let layer = lines - 1; layer >= 0; layer--) {
        const amp = (24 + amplitude * 1.02) * (1 - layer / (lines * 1.45));
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const u = x / W;
          const env = Math.pow(Math.sin(Math.PI * u), .7);
          const y = H / 2 + Math.sin(u * (3.5 + detail * .06) * Math.PI * 2 + t * .75 + layer * .42) * amp * env
            + Math.sin(u * 17 + t * .3 + layer) * (amplitude * .12) * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer === 0 ? 'rgba(112,225,214,.92)' : `rgba(57,197,187,${.18 + .42 * (1 - layer / lines)})`;
        ctx.lineWidth = layer === 0 ? 2.2 : 1;
        ctx.stroke();
      }
      const x = W * (.5 + .43 * Math.sin(t * .28));
      ctx.strokeStyle = 'rgba(244,184,202,.46)';
      ctx.setLineDash([4, 9]); ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, 420); ctx.stroke(); ctx.setLineDash([]);
    }
    function rings(t) {
      const cx = W / 2, cy = H / 2, count = Math.max(5, Math.round(detail / 5));
      for (let i = count; i >= 1; i--) {
        const radius = 24 + i * (7 + amplitude * .18) + Math.sin(t * .45 + i * .28) * (3 + amplitude * .035);
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(244,184,202,.65)' : `rgba(92,220,207,${.12 + .56 * (1 - i / (count + 1))})`;
        ctx.lineWidth = i % 4 === 0 ? 2 : 1; ctx.stroke();
      }
      for (let i = 0; i < 36; i++) {
        const angle = i / 36 * Math.PI * 2 + t * .05;
        const r = 48 + Math.sin(i * 1.9 + t) * amplitude * .65 + detail * .4;
        const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
        ctx.fillStyle = i % 5 === 0 ? '#f4b8ca' : '#72d9ce';
        ctx.globalAlpha = .25 + .7 * (i % 4) / 4;
        ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 3 : 1.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 5 + amplitude * .07, 0, Math.PI * 2); ctx.fillStyle = 'rgba(104,224,212,.9)'; ctx.fill();
    }
    function spectrum(t) {
      const bars = Math.max(18, Math.round(detail * .78));
      const gap = 5, barWidth = (W - 100 - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const u = i / Math.max(1, bars - 1);
        const v = Math.abs(Math.sin(i * .63 + t * .4) * .48 + Math.cos(i * .19 - t * .22) * .34 + Math.sin(i * .11) * .18);
        const envelope = .32 + .68 * Math.pow(Math.sin(Math.PI * u), .55);
        const h = (18 + v * (90 + amplitude * 2.25)) * envelope;
        const x = 50 + i * (barWidth + gap), y = (H - h) / 2;
        const gradient = ctx.createLinearGradient(0, y, 0, y + h);
        gradient.addColorStop(0, 'rgba(244,184,202,.88)');
        gradient.addColorStop(.48, 'rgba(108,222,210,.88)');
        gradient.addColorStop(1, 'rgba(57,197,187,.28)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        const r = Math.min(5, barWidth / 2);
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, barWidth, h, r);
        else ctx.rect(x, y, barWidth, h);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(116,190,180,.24)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, H / 2); ctx.lineTo(W - 30, H / 2); ctx.stroke();
    }
    function draw(time = 0) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0c2422'; ctx.fillRect(0, 0, W, H);
      grid();
      const t = reduceMotion ? 0 : time * .001;
      if (mode === 'wave') wave(t);
      else if (mode === 'ring') rings(t);
      else spectrum(t);
      frame++;
      if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(draw);
    }
    function updateLabels() {
      if (amountValue) amountValue.value = String(amplitude);
      if (densityValue) densityValue.value = String(detail);
      if (readout) readout.textContent = `A ${String(amplitude).padStart(3, '0')} · D ${String(detail).padStart(3, '0')}`;
      if (modeLabel) modeLabel.textContent = labels[mode];
      modeButtons.forEach(button => {
        const active = button.dataset.mode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    function renderOnce() { cancelAnimationFrame(raf); draw(performance.now()); }
    setupCanvas(); updateLabels();
    if (reduceMotion) draw(0);
    else raf = requestAnimationFrame(draw);
    if (amount) amount.addEventListener('input', () => { amplitude = Number(amount.value); updateLabels(); if (reduceMotion) renderOnce(); });
    if (density) density.addEventListener('input', () => { detail = Number(density.value); updateLabels(); if (reduceMotion) renderOnce(); });
    modeButtons.forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.mode;
      updateLabels();
      if (reduceMotion) renderOnce();
    }));
    const reset = $('#resetLab');
    if (reset) reset.addEventListener('click', () => {
      amplitude = 58; detail = 48; mode = 'wave';
      if (amount) amount.value = String(amplitude);
      if (density) density.value = String(detail);
      updateLabels();
      if (reduceMotion) renderOnce();
    });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(draw);
    });
  })();

  /* 灵感短句：均为本站原创 */
  const inspirationLines = [
    '如果一段旋律有颜色，它会停在哪个季节？',
    '把今天没有说出口的话，交给明天的声音。',
    '想象一座只在耳机里出现的城市。',
    '让一个微小的念头，慢慢长成一片星海。',
    '如果沉默也有频率，你会听见什么？',
    '为尚未发生的相遇，留下一小段前奏。'
  ];
  const inspirationButton = $('#inspirationButton');
  const inspirationOutput = $('#inspirationOutput');
  let lastInspiration = -1;
  if (inspirationButton && inspirationOutput) inspirationButton.addEventListener('click', () => {
    let next = Math.floor(Math.random() * inspirationLines.length);
    if (inspirationLines.length > 1 && next === lastInspiration) next = (next + 1) % inspirationLines.length;
    lastInspiration = next;
    inspirationOutput.textContent = '“' + inspirationLines[next] + '”';
  });

  /* 留言只保存在当前设备，不发送网络请求 */
  const noteForm = $('#noteForm');
  const noteInput = $('#personalNote');
  const noteCount = $('#noteCount');
  const savedNote = $('#savedNote');
  const savedNoteText = $('#savedNoteText');
  const clearNote = $('#clearNote');
  const toast = $('#toast');
  let toastTimer = 0;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function renderSavedNote(value) {
    if (!savedNote || !savedNoteText) return;
    if (value) {
      savedNoteText.textContent = value;
      savedNote.hidden = false;
    } else {
      savedNote.hidden = true;
      savedNoteText.textContent = '';
    }
  }
  function updateCount() {
    if (noteCount && noteInput) noteCount.textContent = `${noteInput.value.length} / 160`;
  }
  let existingNote = '';
  try { existingNote = localStorage.getItem('miku-space-note') || ''; } catch (_) { /* 存储不可用时仍允许临时编辑 */ }
  renderSavedNote(existingNote);
  if (noteInput) noteInput.addEventListener('input', updateCount);
  updateCount();
  if (noteForm && noteInput) noteForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = noteInput.value.trim();
    if (!value) { showToast('先写下一句话，再保存吧。'); noteInput.focus(); return; }
    try {
      localStorage.setItem('miku-space-note', value);
      renderSavedNote(value);
      noteInput.value = '';
      updateCount();
      showToast('这句话已保存在当前浏览器。');
    } catch (_) {
      showToast('当前浏览器不允许本地保存，请复制并自行留存。');
    }
  });
  if (clearNote) clearNote.addEventListener('click', () => {
    try { localStorage.removeItem('miku-space-note'); } catch (_) { /* 忽略 */ }
    renderSavedNote('');
    showToast('本地留言已清除。');
  });
})();
