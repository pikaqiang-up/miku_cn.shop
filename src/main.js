(function () {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

  /* ---------------------------------------------------------- 年份 */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------ 顶栏、进度与导航态 */
  const header = $('.site-header');
  const progress = $('#readingProgress');
  const navLinks = $$('.main-nav a');
  const sections = navLinks.map(link => $(link.getAttribute('href'))).filter(Boolean);
  let ticking = false;

  function updateScrollUI() {
    const top = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (header) header.classList.toggle('is-scrolled', top > 8);
    if (progress) progress.style.width = (max > 0 ? Math.min(1, top / max) * 100 : 0) + '%';

    let current = '';
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= window.innerHeight * 0.4) current = '#' + section.id;
    });
    navLinks.forEach(link => {
      const active = link.getAttribute('href') === current;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; window.requestAnimationFrame(updateScrollUI); }
  }, { passive: true });
  updateScrollUI();

  /* ---------------------------------------------------------- 手机导航 */
  const menuToggle = $('#menuToggle');
  const mainNav = $('#mainNav');
  function closeMenu() {
    if (!menuToggle || !mainNav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开导航菜单');
    mainNav.classList.remove('is-open');
  }
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
      mainNav.classList.toggle('is-open', open);
    });
    navLinks.forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 900) closeMenu(); }, { passive: true });
  }

  /* ------------------------------------------- 主题：跟随系统 / 手动指定 */
  const themeToggle = $('#themeToggle');
  const metaTheme = $('#metaThemeColor');
  const themeChoiceButtons = $$('[data-theme-set]');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const THEME_KEY = 'miku-space-theme';
  const THEME_NAMES = { system: '跟随系统', light: '浅色', dark: '深色' };
  const THEME_COLORS = { light: '#f8fbfa', dark: '#091311' };

  function storedTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch (_) { return 'system'; /* 私密模式可能禁用存储 */ }
  }
  function themeState() {
    return root.getAttribute('data-theme-state') || 'system';
  }
  function effectiveTheme(state) {
    if (state !== 'system') return state;
    return darkScheme.matches ? 'dark' : 'light';
  }
  let themeFadeTimer = 0;
  function fadeTheme() {
    if (reduceMotion) return;
    root.classList.add('theme-fade');
    window.clearTimeout(themeFadeTimer);
    themeFadeTimer = window.setTimeout(() => root.classList.remove('theme-fade'), 420);
  }
  function applyTheme(state, options) {
    const opts = options || {};
    const appearance = effectiveTheme(state);
    const dark = appearance === 'dark';

    root.setAttribute('data-theme-state', state);
    root.setAttribute('data-theme', appearance);
    if (metaTheme) metaTheme.setAttribute('content', THEME_COLORS[appearance]);

    if (themeToggle) {
      const next = dark ? '浅色模式' : '深色模式';
      const where = state === 'system'
        ? `跟随系统（当前${THEME_NAMES[appearance]}）`
        : `当前${THEME_NAMES[state]}`;
      const label = `${where}，点击切换为${next}`;
      themeToggle.setAttribute('aria-pressed', String(dark));
      themeToggle.setAttribute('aria-label', label);
      themeToggle.setAttribute('title', label);
    }
    themeChoiceButtons.forEach(button => {
      const active = button.getAttribute('data-theme-set') === state;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });

    if (opts.persist) {
      try {
        if (state === 'system') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, state);
      } catch (_) { /* 存储不可用时，本次会话内仍然生效 */ }
    }
    if (opts.animate) fadeTheme();
  }

  applyTheme(storedTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const dark = effectiveTheme(themeState()) === 'dark';
      applyTheme(dark ? 'light' : 'dark', { persist: true, animate: true });
    });
  }
  themeChoiceButtons.forEach(button => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-theme-set');
      if (next === themeState()) return;
      applyTheme(next, { persist: true, animate: true });
      if (next === 'system') showToast(`已切换为跟随系统 · 当前为${THEME_NAMES[effectiveTheme('system')]}模式`);
    });
  });

  /* 系统或浏览器主题变化时实时跟随，但用户手动指定过就不再打扰 */
  const onSchemeChange = () => {
    if (themeState() === 'system') applyTheme('system', { animate: true });
  };
  if (typeof darkScheme.addEventListener === 'function') darkScheme.addEventListener('change', onSchemeChange);
  else if (typeof darkScheme.addListener === 'function') darkScheme.addListener(onSchemeChange); /* 旧版 Safari */

  /* 同一浏览器的多个标签页之间保持一致 */
  window.addEventListener('storage', event => {
    if (event.key === THEME_KEY || event.key === null) applyTheme(storedTheme(), { animate: true });
  });

  /* --------------------------------------------------------- 滚动显现 */
  const revealItems = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.delay || 0);
        entry.target.style.transitionDelay = delay + 'ms';
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    revealItems.forEach(item => io.observe(item));
    /* 兜底：任何情况下都不让内容停留在不可见状态 */
    window.addEventListener('load', () => {
      window.setTimeout(() => revealItems.forEach(item => item.classList.add('is-visible')), 1600);
    });
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  /* ------------------------------------------------ 首屏"声音圆盘"均衡器 */
  (function buildEq() {
    const eq = $('#heroEq');
    if (!eq) return;
    const count = window.innerWidth < 620 ? 15 : 21;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('i');
      const u = count > 1 ? i / (count - 1) : 0.5;
      const envelope = Math.pow(Math.sin(Math.PI * u), 0.5);
      const height = 12 + envelope * (56 + Math.random() * 118);
      bar.style.setProperty('--h', height.toFixed(0) + 'px');
      bar.style.setProperty('--dur', (2.1 + Math.random() * 1.9).toFixed(2) + 's');
      bar.style.setProperty('--d', (Math.random() * -3).toFixed(2) + 's');
      frag.appendChild(bar);
    }
    eq.appendChild(frag);
  })();

  /* ------------------------------------------------------ 时间线横向轨 */
  (function initRail() {
    const rails = $$('.rail[data-rail-panel]');
    if (!rails.length) return;
    const fill = $('#railFill');
    const buttons = $$('.rail-btn');
    const tabs = $$('[data-rail-tab]');
    const note = $('#railPanelNote');
    const PANEL_NOTES = { versions: 'SOFTWARE / 2007 — 2026', live: 'STAGE / 2009 — 2020' };
    let active = rails.find(rail => !rail.hidden) || rails[0];
    let railSwapTimer = 0;

    function ratioOf(rail) {
      const max = rail.scrollWidth - rail.clientWidth;
      return { max, ratio: max > 0 ? rail.scrollLeft / max : 0 };
    }
    function render() {
      if (!active) return;
      const { max, ratio } = ratioOf(active);
      active.classList.toggle('is-scrollable', max > 1);
      if (fill) fill.style.width = Math.max(6, ratio * 100).toFixed(2) + '%';
      buttons.forEach(btn => {
        const dir = Number(btn.dataset.rail);
        btn.disabled = dir < 0 ? active.scrollLeft <= 2 : active.scrollLeft >= max - 2;
      });
    }
    function step(rail, dir) {
      const first = rail.querySelector('.t-card');
      const cardW = first ? first.getBoundingClientRect().width : 300;
      const gap = parseFloat(getComputedStyle(rail).columnGap || '18') || 18;
      rail.scrollBy({ left: dir * (cardW + gap), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    rails.forEach(rail => {
      let drag = null;
      let swallowUntil = 0; // 刚拖过就吞掉紧随其后的那次点击

      rail.addEventListener('scroll', () => { if (rail === active) render(); }, { passive: true });
      rail.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); step(rail, 1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); step(rail, -1); }
      });

      /* 按住即可横向拖动。触屏交给系统原生滚动，这里只接管鼠标与触控笔。 */
      rail.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' || event.button !== 0) return;
        if (rail.scrollWidth <= rail.clientWidth) return;
        drag = {
          id: event.pointerId,
          startX: event.clientX,
          startScroll: rail.scrollLeft,
          moved: 0,
          captured: false
        };
      });

      rail.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.startX;
        drag.moved = Math.max(drag.moved, Math.abs(dx));
        if (drag.moved <= 3) return;

        if (!drag.captured) {
          // 确认是拖动而不是点击后才接管指针，避免吃掉卡片上的点击
          drag.captured = true;
          rail.classList.add('is-dragging');
          rail.style.scrollBehavior = 'auto';
          try { rail.setPointerCapture(drag.id); } catch (err) {}
          // 按下瞬间浏览器可能已经开始选字，拖动时清掉
          const selection = window.getSelection && window.getSelection();
          if (selection && selection.rangeCount) selection.removeAllRanges();
        }
        event.preventDefault();
        rail.scrollLeft = drag.startScroll - dx;
      });

      function endDrag(event) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        const dragged = drag.moved > 3;
        if (drag.captured) {
          try { rail.releasePointerCapture(drag.id); } catch (err) {}
          rail.classList.remove('is-dragging');
          rail.style.scrollBehavior = '';
        }
        drag = null;
        if (!dragged) return;
        // 拖动结束后吸附回最近一张卡；顺带屏蔽掉这次误触的点击
        swallowUntil = Date.now() + 260;
      }
      rail.addEventListener('pointerup', endDrag);
      rail.addEventListener('pointercancel', endDrag);
      rail.addEventListener('click', event => {
        if (Date.now() > swallowUntil) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      rail.addEventListener('dragstart', event => event.preventDefault());
    });

    buttons.forEach(btn => btn.addEventListener('click', () => {
      if (active) step(active, Number(btn.dataset.rail));
    }));

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const next = rails.find(rail => rail.dataset.railPanel === tab.dataset.railTab);
        if (!next || next === active) return;
        tabs.forEach(item => {
          const on = item === tab;
          item.classList.toggle('is-active', on);
          item.setAttribute('aria-pressed', String(on));
        });
        const swap = () => {
          rails.forEach(rail => { rail.hidden = rail !== next; });
          active = next;
          next.scrollLeft = 0;
          if (note) note.textContent = PANEL_NOTES[next.dataset.railPanel] || '';
          window.requestAnimationFrame(render);
        };
        // 两条轨道互换时也走一次淡出淡入，接住高度的突变
        const wrap = next.closest('.rail-wrap');
        if (reduceMotion || !wrap) { swap(); return; }
        window.clearTimeout(railSwapTimer);
        wrap.classList.add('is-swapping');
        railSwapTimer = window.setTimeout(() => {
          swap();
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => wrap.classList.remove('is-swapping'));
          });
        }, 130);
      });
    });

    window.addEventListener('resize', render, { passive: true });
    render();
  })();

  /* ------------------------------------------- 筛选：作品 / 人 / 词条 */
  (function initFilters() {
    function setup(config) {
      const buttons = $$(config.buttonSelector);
      const items = $$(config.itemSelector);
      const counter = $(config.counterSelector);
      if (!buttons.length || !items.length) return;
      const total = items.length;
      const scope = items[0].parentElement;
      let swapTimer = 0;

      function commit(value, silent) {
        let shown = 0;
        items.forEach(item => {
          const match = value === 'all' || item.getAttribute(config.itemKey) === value;
          item.classList.toggle('is-hidden', !match);
          if (match) {
            shown += 1;
            // 筛选后重新出现的项要直接到位；初次渲染交给滚动显现，别抢跑
            if (!silent) item.classList.add('is-visible');
          }
        });
        buttons.forEach(btn => {
          const on = btn.getAttribute(config.buttonKey) === value;
          btn.classList.toggle('is-active', on);
          btn.setAttribute('aria-pressed', String(on));
        });
        if (counter) counter.textContent = shown + ' / ' + total;
        const bar = buttons[0] && buttons[0].closest('.chips');
        if (bar) bar.dispatchEvent(new CustomEvent('chips:update'));
        // 筛过之后可见条目变了，"全部展开 / 收起"的文案要跟着重算
        document.dispatchEvent(new CustomEvent('content:filtered'));
      }

      // 先让整块淡出，换完再淡入：直接 display:none 会"啪"地一下跳掉
      function apply(value, silent) {
        if (silent || reduceMotion || !scope) { commit(value, silent); return; }
        window.clearTimeout(swapTimer);
        scope.classList.add('is-swapping');
        swapTimer = window.setTimeout(() => {
          commit(value, false);
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => scope.classList.remove('is-swapping'));
          });
        }, 140);
      }

      buttons.forEach(btn => btn.addEventListener('click', () => {
        apply(btn.getAttribute(config.buttonKey));
      }));
      apply('all', true);
    }

    // 只认筛选条上的胶囊。作品、词条卡自己也带 data-era / data-gloss，
    // 用裸属性选择器会把卡片一起当成按钮，点开一条词条就顺手筛了一次。
    setup({ buttonSelector: '.chip[data-era]', buttonKey: 'data-era', itemSelector: '.song[data-era]', itemKey: 'data-era', counterSelector: '#songCount' });
    setup({ buttonSelector: '.chip[data-role-filter]', buttonKey: 'data-role-filter', itemSelector: '.person[data-role]', itemKey: 'data-role', counterSelector: '#peopleCount' });
    setup({ buttonSelector: '.chip[data-gloss]', buttonKey: 'data-gloss', itemSelector: '.gloss[data-gloss]', itemKey: 'data-gloss', counterSelector: '#glossCount' });
  })();

  /* ---------------------------------------- 筛选条：横滑时两端渐隐 */
  (function initChipFade() {
    const groups = $$('.chips');
    if (!groups.length) return;

    function update(el) {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) { el.removeAttribute('data-fade'); return; }
      const atStart = el.scrollLeft <= 2;
      const atEnd = el.scrollLeft >= max - 2;
      el.setAttribute('data-fade', atStart && atEnd ? 'none' : (atStart ? 'end' : (atEnd ? 'start' : 'both')));
    }
    function updateAll() { groups.forEach(update); }

    groups.forEach(el => {
      update(el);
      el.addEventListener('scroll', () => update(el), { passive: true });
      el.addEventListener('chips:update', () => update(el));
    });
    window.addEventListener('resize', updateAll, { passive: true });
    window.addEventListener('load', updateAll);
  })();

  /* ------------------------------------------ 词条：单条展开 / 全部展开 */
  (function initGlossToggle() {
    const toggle = $('#glossToggle');
    const items = $$('.gloss');
    if (!toggle || !items.length) return;

    function setItem(item, open) {
      item.classList.toggle('is-open', open);
      const trigger = item.querySelector('.gloss-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', String(open));
    }
    function isOpen(item) { return item.classList.contains('is-open'); }
    function visibleItems() { return items.filter(item => !item.classList.contains('is-hidden')); }
    function syncMaster() {
      const list = visibleItems();
      const allOpen = list.length > 0 && list.every(isOpen);
      toggle.setAttribute('aria-expanded', String(allOpen));
      toggle.textContent = allOpen ? '全部收起' : '全部展开';
    }

    items.forEach(item => {
      const trigger = item.querySelector('.gloss-trigger');
      if (!trigger) return;
      trigger.addEventListener('click', () => {
        setItem(item, !isOpen(item));
        syncMaster();
      });
    });
    document.addEventListener('content:filtered', syncMaster);
    syncMaster();

    toggle.addEventListener('click', () => {
      const list = visibleItems();
      const expand = !(list.length > 0 && list.every(isOpen));
      // 展开时按行依次打开，像翻一页词典；收起就直接收，不拖时间
      list.forEach((item, index) => {
        if (!expand || reduceMotion) { setItem(item, expand); return; }
        window.setTimeout(() => setItem(item, true), Math.min(index * 32, 300));
      });
      toggle.setAttribute('aria-expanded', String(expand));
      toggle.textContent = expand ? '全部收起' : '全部展开';
    });
  })();

  /* -------------------------------------------- 声场实验室（Canvas 声纹） */
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
    const modeButtons = $$('[data-mode]');

    const W = 900, H = 520;
    let mode = 'wave', amplitude = 58, detail = 48, raf = 0;
    const labels = { wave: '波形 / FLOW FIELD', ring: '环状 / RESONANCE', spectrum: '频谱 / FREQUENCY' };

    function setup() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function grid() {
      ctx.strokeStyle = 'rgba(126, 190, 180, .08)';
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
          const env = Math.pow(Math.sin(Math.PI * u), 0.7);
          const y = H / 2
            + Math.sin(u * (3.5 + detail * 0.06) * Math.PI * 2 + t * 0.75 + layer * 0.42) * amp * env
            + Math.sin(u * 17 + t * 0.3 + layer) * (amplitude * 0.12) * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer === 0 ? 'rgba(122, 232, 221, .92)' : 'rgba(79, 210, 199, ' + (0.16 + 0.4 * (1 - layer / lines)) + ')';
        ctx.lineWidth = layer === 0 ? 2.2 : 1;
        ctx.stroke();
      }
      const x = W * (0.5 + 0.43 * Math.sin(t * 0.28));
      ctx.strokeStyle = 'rgba(240, 160, 182, .4)';
      ctx.setLineDash([4, 9]);
      ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, 420); ctx.stroke();
      ctx.setLineDash([]);
    }
    function rings(t) {
      const cx = W / 2, cy = H / 2, count = Math.max(5, Math.round(detail / 5));
      for (let i = count; i >= 1; i--) {
        const radius = 24 + i * (7 + amplitude * 0.18) + Math.sin(t * 0.45 + i * 0.28) * (3 + amplitude * 0.035);
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(240, 160, 182, .55)' : 'rgba(100, 226, 213, ' + (0.1 + 0.56 * (1 - i / (count + 1))) + ')';
        ctx.lineWidth = i % 4 === 0 ? 2 : 1;
        ctx.stroke();
      }
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2 + t * 0.05;
        const r = 48 + Math.sin(i * 1.9 + t) * amplitude * 0.65 + detail * 0.4;
        const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
        ctx.fillStyle = i % 5 === 0 ? '#f0a0b6' : '#6fd9ce';
        ctx.globalAlpha = 0.25 + (0.7 * (i % 4)) / 4;
        ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 3 : 1.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 5 + amplitude * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(122, 232, 221, .9)'; ctx.fill();
    }
    function spectrum(t) {
      const bars = Math.max(18, Math.round(detail * 0.78));
      const gap = 5, barWidth = (W - 100 - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const u = i / Math.max(1, bars - 1);
        const v = Math.abs(Math.sin(i * 0.63 + t * 0.4) * 0.48 + Math.cos(i * 0.19 - t * 0.22) * 0.34 + Math.sin(i * 0.11) * 0.18);
        const envelope = 0.32 + 0.68 * Math.pow(Math.sin(Math.PI * u), 0.55);
        const h = (18 + v * (90 + amplitude * 2.25)) * envelope;
        const x = 50 + i * (barWidth + gap), y = (H - h) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, 'rgba(240, 160, 182, .85)');
        grad.addColorStop(0.48, 'rgba(111, 217, 206, .9)');
        grad.addColorStop(1, 'rgba(57, 197, 187, .25)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = Math.min(5, barWidth / 2);
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, barWidth, h, r);
        else ctx.rect(x, y, barWidth, h);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(126, 190, 180, .2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, H / 2); ctx.lineTo(W - 30, H / 2); ctx.stroke();
    }
    function draw(time = 0) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#08120f';
      ctx.fillRect(0, 0, W, H);
      grid();
      const t = reduceMotion ? 0 : time * 0.001;
      if (mode === 'wave') wave(t);
      else if (mode === 'ring') rings(t);
      else spectrum(t);
      if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(draw);
    }
    function updateLabels() {
      if (amountValue) amountValue.value = String(amplitude);
      if (densityValue) densityValue.value = String(detail);
      if (readout) readout.textContent = 'A ' + String(amplitude).padStart(3, '0') + ' · D ' + String(detail).padStart(3, '0');
      if (modeLabel) modeLabel.textContent = labels[mode];
      modeButtons.forEach(button => {
        const active = button.dataset.mode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    function renderOnce() { cancelAnimationFrame(raf); draw(performance.now()); }

    setup(); updateLabels();
    raf = requestAnimationFrame(draw);
    if (amount) amount.addEventListener('input', () => { amplitude = Number(amount.value); updateLabels(); if (reduceMotion) renderOnce(); });
    if (density) density.addEventListener('input', () => { detail = Number(density.value); updateLabels(); if (reduceMotion) renderOnce(); });
    modeButtons.forEach(button => button.addEventListener('click', () => {
      if (button.dataset.mode === mode) return;
      mode = button.dataset.mode;
      updateLabels();
      // 画布内容换掉的那一瞬淡一下，避免图形硬切
      if (!reduceMotion) {
        canvas.classList.add('is-morph');
        window.setTimeout(() => canvas.classList.remove('is-morph'), 170);
      }
      if (reduceMotion) renderOnce();
    }));
    const reset = $('#resetLab');
    if (reset) reset.addEventListener('click', () => {
      const fromA = amplitude, fromD = detail;
      mode = 'wave';
      if (reduceMotion) {
        amplitude = 58; detail = 48;
        if (amount) amount.value = String(amplitude);
        if (density) density.value = String(detail);
        updateLabels();
        renderOnce();
        return;
      }
      // 数值滚回默认值，滑块和读数一起走，不是"啪"地跳回去
      const start = performance.now(), dur = 320;
      (function roll(now) {
        const p = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        amplitude = Math.round(fromA + (58 - fromA) * e);
        detail = Math.round(fromD + (48 - fromD) * e);
        if (amount) amount.value = String(amplitude);
        if (density) density.value = String(detail);
        updateLabels();
        if (p < 1) window.requestAnimationFrame(roll);
      })(start);
    });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(draw);
    });
  })();

  /* ------------------------------------------------------- 灵感短句 */
  const lines = [
    '有一段旋律，你到现在还记得。',
    '某个熟悉的声音，也许会成为新作品的起点。',
    '副歌前的几秒，值得再听一遍。',
    '把脑海里的想法记下来，创作可以从这里开始。',
    '同一首歌听了很多遍，每次仍会注意到新的细节。',
    '一段声音经过不同的人，也会产生不同的表达。'
  ];
  const inspireBtn = $('#inspirationButton');
  const inspireOut = $('#inspirationOutput');
  let lastLine = -1;
  if (inspireBtn && inspireOut) inspireBtn.addEventListener('click', () => {
    let next = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && next === lastLine) next = (next + 1) % lines.length;
    lastLine = next;
    const text = '“' + lines[next] + '”';
    if (reduceMotion) { inspireOut.textContent = text; return; }
    // 换句之前先淡下去，读起来像换了一张卡片，而不是文字被替换
    inspireOut.classList.add('is-fading');
    window.setTimeout(() => {
      inspireOut.textContent = text;
      inspireOut.classList.remove('is-fading');
    }, 180);
  });

  /* ------------------------------------------------- 留言（仅本地保存） */
  const noteForm = $('#noteForm');
  const noteInput = $('#personalNote');
  const noteCount = $('#noteCount');
  const savedNote = $('#savedNote');
  const savedText = $('#savedNoteText');
  const clearNote = $('#clearNote');
  const toast = $('#toast');
  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }
  let savedTimer = 0;
  function renderSaved(value, instant) {
    if (!savedNote || !savedText) return;
    window.clearTimeout(savedTimer);
    if (value) {
      savedText.textContent = value;
      savedNote.hidden = false;
      savedNote.classList.remove('is-show');
      if (instant || reduceMotion) { savedNote.classList.add('is-show'); return; }
      // 先让它以透明状态进入布局，下一帧再淡进来
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => savedNote.classList.add('is-show'));
      });
    } else {
      savedNote.classList.remove('is-show');
      const hide = () => { savedNote.hidden = true; savedText.textContent = ''; };
      if (reduceMotion) hide();
      else savedTimer = window.setTimeout(hide, 240);
    }
  }
  function updateCount() {
    if (noteCount && noteInput) noteCount.textContent = noteInput.value.length + ' / 160';
  }
  let existing = '';
  try { existing = localStorage.getItem('miku-space-note') || ''; } catch (_) { /* 允许临时编辑 */ }
  renderSaved(existing, true);
  if (noteInput) noteInput.addEventListener('input', updateCount);
  updateCount();

  if (noteForm && noteInput) noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = noteInput.value.trim();
    if (!value) { showToast('请先写下一句话，再保存。'); noteInput.focus(); return; }
    try {
      localStorage.setItem('miku-space-note', value);
      renderSaved(value);
      noteInput.value = '';
      updateCount();
      showToast('留言已保存在当前设备。');
    } catch (_) {
      showToast('当前浏览器不允许本地存储。请复制留言内容并自行保存。');
    }
  });
  if (clearNote) clearNote.addEventListener('click', () => {
    try { localStorage.removeItem('miku-space-note'); } catch (_) { /* 忽略 */ }
    renderSaved('');
    showToast('本地留言已清除。');
  });
})();
