/*
 * Ring Timer — lógica de la interfaz.
 * Pantallas: inicio, editor, temporizador, ajustes.
 */
(function () {
  'use strict';

  const APP_VERSION = '1.1.2'; // Ring Timer
  const S = window.Sequence;
  const I18n = window.I18n;
  const t = I18n.t;
  const Sound = window.Sound;
  const Colors = window.Colors;

  const KEYS = {
    settings: 'asalto.settings',
    presets: 'asalto.presets',
    last: 'asalto.lastConfig',
    seeded: 'asalto.seeded'
  };

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const letter = (n) => String.fromCharCode(64 + n); // 1 -> A
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sin almacenamiento */ }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      });
    }
    (children || []).forEach((c) => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  const ICONS = {
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" class="fill"/><circle cx="12" cy="12" r="1.6" class="fill"/><circle cx="19" cy="12" r="1.6" class="fill"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" class="fill"/></svg>'
  };

  let toastTimer = null;
  function toast(msg) {
    const box = $('#toast');
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 2200);
  }

  // ---------------------------------------------------------------
  // Ajustes
  // ---------------------------------------------------------------
  const settings = Object.assign({
    lang: I18n.detect(),
    theme: 'system',
    sound: true,
    volume: 80,
    soundSet: 'bell',
    vibration: true,
    tapPause: false
  }, load(KEYS.settings, {}));
  // Colores personalizados (actividad y descanso)
  settings.colors = Object.assign({}, Colors.DEFAULTS, settings.colors || {});
  ['work', 'rest'].forEach((k) => { if (!Colors.isHex(settings.colors[k])) settings.colors[k] = Colors.DEFAULTS[k]; });
  if (Sound.SETS.indexOf(settings.soundSet) === -1) settings.soundSet = 'bell';

  function saveSettings() { save(KEYS.settings, settings); }

  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function applyTheme() {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && darkQuery && darkQuery.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (timer.active) render(true);
    renderColorPreview();
    updateThemeColor();
  }

  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

  /** Colores de una fase: actividad y descanso personalizables, el resto gris. */
  function phaseColors(type, paused) {
    let base = Colors.GRAY;
    if (!paused && type === 'work') base = settings.colors.work;
    else if (!paused && type === 'rest') base = settings.colors.rest;
    return Colors.resolve(base, isDark());
  }

  function updateThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const timerEl = $('#screen-timer');
    const src = currentScreen === 'timer' ? timerEl : document.body;
    // Espera a que se apliquen los estilos.
    requestAnimationFrame(() => {
      meta.setAttribute('content', getComputedStyle(src).backgroundColor);
    });
  }

  function applySoundSettings() {
    Sound.setEnabled(settings.sound);
    Sound.setSet(settings.soundSet);
    Sound.setVolume(settings.volume / 100);
    Sound.prepare();
  }

  // Los navegadores solo dejan sonar tras un toque: aprovechamos cualquiera.
  document.addEventListener('pointerdown', () => Sound.unlock(), true);

  // ---------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------
  let presets = load(KEYS.presets, []);
  if (!Array.isArray(presets)) presets = [];

  function savePresets() { save(KEYS.presets, presets); }

  function seedPresets() {
    if (load(KEYS.seeded, false)) return;
    presets = presets.concat([
      { id: uid(), name: t('seed.boxing'), config: S.normalizeConfig({ countdown: 10, simple: { rounds: 3, work: 180, rest: 60 } }) },
      { id: uid(), name: t('seed.tabata'), config: S.normalizeConfig({ countdown: 5, simple: { rounds: 8, work: 20, rest: 10 } }) },
      { id: uid(), name: t('seed.blocks'), config: S.normalizeConfig({
        countdown: 5, useBlocks: true,
        blocks: { count: 2, blockRest: 120, groups: [{ rounds: 3, work: 180, rest: 60 }, { rounds: 3, work: 120, rest: 60 }] }
      }) }
    ]);
    savePresets();
    save(KEYS.seeded, true);
  }

  function describeConfig(cfg) {
    const total = S.formatTime(S.totalDuration(S.buildPhases(cfg)));
    if (!cfg.useBlocks) {
      const s = cfg.simple;
      return s.rounds + ' × ' + S.formatTime(s.work) + ' / ' + S.formatTime(s.rest) + ' · ' + total;
    }
    const b = cfg.blocks;
    const key = b.count === 1 ? 'preset.blockSummary' : 'preset.blocksSummary';
    return t(key, { blocks: b.count, groups: b.groups.length }) + ' · ' + total;
  }

  function renderHome() {
    const list = $('#preset-list');
    list.innerHTML = '';
    $('#preset-empty').hidden = presets.length > 0;
    presets.forEach((p) => {
      const li = el('li', { class: 'preset' }, [
        el('button', { class: 'preset-main', type: 'button', onclick: () => startSession(p.config) }, [
          el('span', { class: 'preset-name', text: p.name }),
          el('span', { class: 'preset-detail', text: describeConfig(p.config) })
        ]),
        el('button', {
          class: 'icon-btn', type: 'button', 'aria-label': t('common.more') + ': ' + p.name,
          html: ICONS.more, onclick: () => openPresetMenu(p)
        }),
        el('button', {
          class: 'preset-play', type: 'button', 'aria-label': t('preset.start') + ': ' + p.name,
          html: ICONS.play, onclick: () => startSession(p.config)
        })
      ]);
      list.appendChild(li);
    });
  }

  async function openPresetMenu(p) {
    $('#dlg-menu-title').textContent = p.name;
    const action = await showDialog($('#dlg-menu'));
    if (action === 'edit') {
      openEditor(p.config, p.id);
    } else if (action === 'duplicate') {
      const copy = { id: uid(), name: uniqueName(p.name + ' ' + t('preset.copySuffix')), config: clone(p.config) };
      presets.splice(presets.indexOf(p) + 1, 0, copy);
      savePresets();
      renderHome();
    } else if (action === 'delete') {
      const ok = await confirmDialog(t('preset.confirmDelete', { name: p.name }), t('common.delete'), true);
      if (ok) {
        presets = presets.filter((x) => x.id !== p.id);
        savePresets();
        renderHome();
      }
    }
  }

  function uniqueName(base) {
    let name = base;
    let i = 2;
    const taken = (n) => presets.some((p) => p.name.toLowerCase() === n.toLowerCase());
    while (taken(name)) name = base + ' ' + i++;
    return name;
  }

  // ---------------------------------------------------------------
  // Diálogos
  // ---------------------------------------------------------------
  function showDialog(dlg) {
    return new Promise((resolve) => {
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue || 'cancel');
      };
      dlg.returnValue = '';
      dlg.addEventListener('close', onClose);
      dlg.showModal();
    });
  }

  async function confirmDialog(text, okLabel, danger) {
    $('#dlg-confirm-text').textContent = text;
    const ok = $('#dlg-confirm-ok');
    ok.textContent = okLabel || t('common.ok');
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    return (await showDialog($('#dlg-confirm'))) === 'ok';
  }

  function askPresetName(initial) {
    const dlg = $('#dlg-save');
    const input = $('#save-name');
    const err = $('#save-error');
    input.value = initial || '';
    err.hidden = true;
    return new Promise((resolve) => {
      const onSubmit = (e) => {
        const submitter = e.submitter;
        if (submitter && submitter.value === 'cancel') return; // cierra normal
        if (!input.value.trim()) {
          e.preventDefault();
          err.textContent = t('save.empty');
          err.hidden = false;
          input.focus();
        }
      };
      const onKey = (e) => {
        // Enter = aceptar (por defecto el primer botón sería «Cancelar»).
        if (e.key === 'Enter') { e.preventDefault(); $('#save-ok').click(); }
      };
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        $('#form-save').removeEventListener('submit', onSubmit);
        input.removeEventListener('keydown', onKey);
        resolve(dlg.returnValue === 'ok' ? input.value.trim() : null);
      };
      dlg.returnValue = '';
      $('#form-save').addEventListener('submit', onSubmit);
      input.addEventListener('keydown', onKey);
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      setTimeout(() => { input.focus(); input.select(); }, 50);
    });
  }

  // ---------------------------------------------------------------
  // Navegación (con soporte del botón «atrás» del móvil)
  // ---------------------------------------------------------------
  let currentScreen = 'home';
  const SCREENS = ['home', 'editor', 'timer', 'settings'];

  function showScreen(name) {
    SCREENS.forEach((s) => { $('#screen-' + s).hidden = s !== name; });
    currentScreen = name;
    if (name === 'home') renderHome();
    window.scrollTo(0, 0);
    updateThemeColor();
  }

  function navigate(name) {
    if (name === 'home') {
      if (history.state && history.state.screen && history.state.screen !== 'home') {
        history.back(); // popstate mostrará el inicio
        return;
      }
      showScreen('home');
      return;
    }
    if (currentScreen === 'home') history.pushState({ screen: name }, '');
    else history.replaceState({ screen: name }, '');
    showScreen(name);
  }

  window.addEventListener('popstate', async (e) => {
    if (currentScreen === 'timer' && timer.active && !timer.finished) {
      history.pushState({ screen: 'timer' }, '');
      if (await confirmDialog(t('timer.confirmExit'), t('timer.exit'), true)) {
        stopTimer();
        navigate('home');
      }
      return;
    }
    const target = e.state && e.state.screen;
    if (target === 'editor' || target === 'settings') showScreen(target);
    else {
      if (timer.active) stopTimer();
      showScreen('home');
    }
  });

  document.querySelectorAll('[data-action="back"]').forEach((b) => b.addEventListener('click', () => navigate('home')));

  // ---------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------
  const editor = { config: null, presetId: null };

  function openEditor(config, presetId) {
    editor.config = S.normalizeConfig(clone(config || load(KEYS.last, null) || S.defaultConfig()));
    editor.presetId = presetId || null;
    renderEditor();
    navigate('editor');
  }

  function stepper(opts) {
    const input = el('input', {
      type: 'number', inputmode: 'numeric', pattern: '[0-9]*',
      min: opts.min, max: opts.max, value: opts.value, 'aria-label': opts.label
    });
    const set = (v, commit) => {
      let n = parseInt(v, 10);
      if (isNaN(n)) { if (!commit) return; n = opts.min; }
      if (commit) n = Math.min(opts.max, Math.max(opts.min, n));
      input.value = n;
      opts.onChange(n);
    };
    input.addEventListener('input', () => set(input.value, false));
    input.addEventListener('blur', () => set(input.value, true));
    input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
    const btn = (delta, icon, label) => el('button', {
      type: 'button', html: icon, 'aria-label': label,
      onclick: () => set((parseInt(input.value, 10) || 0) + delta, true)
    });
    return el('div', { class: 'stepper' }, [btn(-1, ICONS.minus, '−1'), input, btn(1, ICONS.plus, '+1')]);
  }

  function timeInput(opts) {
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const mm = el('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 2, 'aria-label': opts.label + ' (' + t('editor.min') + ')' });
    const ss = el('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 2, 'aria-label': opts.label + ' (' + t('editor.sec') + ')' });
    const show = (sec) => { mm.value = pad(Math.floor(sec / 60)); ss.value = pad(sec % 60); };
    const read = () => {
      const m = Math.min(59, parseInt(mm.value.replace(/\D/g, ''), 10) || 0);
      const s = Math.min(59, parseInt(ss.value.replace(/\D/g, ''), 10) || 0);
      return m * 60 + s;
    };
    show(opts.value);
    [mm, ss].forEach((inp) => {
      inp.addEventListener('focus', () => setTimeout(() => inp.select(), 0));
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '');
        opts.onChange(read());
        if (inp === mm && inp.value.length === 2) ss.focus(); // salta a los segundos
      });
      inp.addEventListener('blur', () => {
        // Al salir de ambos campos, normaliza el valor.
        setTimeout(() => {
          if (document.activeElement === mm || document.activeElement === ss) return;
          const v = Math.min(opts.max, Math.max(opts.min, read()));
          show(v);
          opts.onChange(v);
        }, 0);
      });
    });
    return el('div', { class: 'time-input' }, [mm, el('span', { class: 'colon', text: ':' }), ss]);
  }

  function field(label, control) {
    return el('div', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
  }

  function groupFields(g) {
    const L = S.LIMITS;
    return el('div', { class: 'fields-grid' }, [
      field(t('editor.rounds'), stepper({ label: t('editor.rounds'), value: g.rounds, min: L.rounds.min, max: L.rounds.max, onChange: (v) => { g.rounds = v; updateSummary(); } })),
      field(t('editor.work'), timeInput({ label: t('editor.work'), value: g.work, min: L.work.min, max: L.work.max, onChange: (v) => { g.work = v; updateSummary(); } })),
      field(t('editor.rest'), timeInput({ label: t('editor.rest'), value: g.rest, min: L.rest.min, max: L.rest.max, onChange: (v) => { g.rest = v; updateSummary(); } }))
    ]);
  }

  function renderEditor() {
    const cfg = editor.config;
    const L = S.LIMITS;
    $('#editor-title').textContent = t(editor.presetId ? 'editor.titleEdit' : 'editor.titleNew');
    $('#btn-save-preset').textContent = t(editor.presetId ? 'editor.saveChanges' : 'editor.save');

    // Cuenta atrás
    const cd = $('#countdown-options');
    cd.innerHTML = '';
    L.countdowns.forEach((sec) => {
      cd.appendChild(el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(cfg.countdown === sec), text: sec + ' s',
        onclick: () => { cfg.countdown = sec; renderEditor(); }
      }));
    });

    // Modo simple
    const simple = $('#simple-fields');
    simple.innerHTML = '';
    simple.appendChild(groupFields(cfg.simple));
    simple.hidden = cfg.useBlocks;

    $('#use-blocks').checked = cfg.useBlocks;
    $('#blocks-fields').hidden = !cfg.useBlocks;

    // Bloques
    const countField = $('#blocks-count-field');
    countField.innerHTML = '';
    countField.appendChild(el('div', { class: 'field-row' }, [
      el('span', { class: 'field-label', text: t('editor.blocks') }),
      stepper({ label: t('editor.blocks'), value: cfg.blocks.count, min: L.blocks.min, max: L.blocks.max, onChange: (v) => { cfg.blocks.count = v; updateSummary(); } })
    ]));

    const list = $('#group-list');
    list.innerHTML = '';
    const groups = cfg.blocks.groups;
    groups.forEach((g, i) => {
      const move = (dir) => {
        const j = i + dir;
        [groups[i], groups[j]] = [groups[j], groups[i]];
        renderEditor();
      };
      list.appendChild(el('div', { class: 'card group-card' }, [
        el('div', { class: 'group-head' }, [
          el('h3', { text: t('editor.group', { letter: letter(i + 1) }) }),
          el('div', { class: 'group-tools' }, [
            el('button', { type: 'button', class: 'icon-btn', html: ICONS.up, 'aria-label': t('editor.moveUp'), disabled: i === 0, onclick: () => move(-1) }),
            el('button', { type: 'button', class: 'icon-btn', html: ICONS.down, 'aria-label': t('editor.moveDown'), disabled: i === groups.length - 1, onclick: () => move(1) }),
            el('button', { type: 'button', class: 'icon-btn', html: ICONS.trash, 'aria-label': t('editor.removeGroup'), disabled: groups.length <= 1, onclick: () => { groups.splice(i, 1); renderEditor(); } })
          ])
        ]),
        groupFields(g)
      ]));
    });
    $('#btn-add-group').disabled = groups.length >= L.groups.max;

    const restField = $('#block-rest-field');
    restField.innerHTML = '';
    restField.appendChild(el('div', { class: 'field-row' }, [
      el('span', { class: 'field-label', text: t('editor.blockRest') }),
      timeInput({ label: t('editor.blockRest'), value: cfg.blocks.blockRest, min: L.rest.min, max: L.rest.max, onChange: (v) => { cfg.blocks.blockRest = v; updateSummary(); } })
    ]));

    updateSummary();
  }

  function editorIsValid() {
    const cfg = editor.config;
    const groups = cfg.useBlocks ? cfg.blocks.groups : [cfg.simple];
    return groups.every((g) => g.work >= 1 && g.rounds >= 1);
  }

  function updateSummary() {
    const valid = editorIsValid();
    const phases = S.buildPhases(editor.config);
    const rounds = phases.filter((p) => p.type === 'work').length;
    $('#summary-total').textContent = S.formatTime(S.totalDuration(phases));
    $('#summary-rounds').textContent = t('editor.totalRounds', { n: rounds });
    const err = $('#editor-error');
    err.hidden = valid;
    err.textContent = valid ? '' : t('editor.invalid');
    $('#btn-start').disabled = !valid;
    $('#btn-save-preset').disabled = !valid;
  }

  $('#use-blocks').addEventListener('change', (e) => {
    editor.config.useBlocks = e.target.checked;
    renderEditor();
  });

  $('#btn-add-group').addEventListener('click', () => {
    const groups = editor.config.blocks.groups;
    const last = groups[groups.length - 1];
    groups.push(clone(last || { rounds: 3, work: 180, rest: 60 }));
    renderEditor();
  });

  $('#btn-start').addEventListener('click', () => {
    if (!editorIsValid()) return;
    startSession(editor.config);
  });

  $('#btn-save-preset').addEventListener('click', async () => {
    if (!editorIsValid()) return;
    const editing = editor.presetId ? presets.find((p) => p.id === editor.presetId) : null;
    const name = await askPresetName(editing ? editing.name : '');
    if (!name) return;
    const cfg = S.normalizeConfig(clone(editor.config));
    const clash = presets.find((p) => p.name.toLowerCase() === name.toLowerCase() && (!editing || p.id !== editing.id));
    if (clash) {
      if (!(await confirmDialog(t('save.exists'), t('common.yes')))) return;
      clash.config = cfg;
      editor.presetId = clash.id;
    } else if (editing) {
      editing.name = name;
      editing.config = cfg;
    } else {
      const p = { id: uid(), name: name, config: cfg };
      presets.push(p);
      editor.presetId = p.id;
    }
    savePresets();
    renderEditor();
    toast(t('save.saved'));
  });

  $('#btn-new-session').addEventListener('click', () => openEditor(null, null));

  // ---------------------------------------------------------------
  // Pantalla siempre encendida (Screen Wake Lock)
  // ---------------------------------------------------------------
  let wakeLock = null;
  const wakeSupported = 'wakeLock' in navigator;

  function setWakeIndicator(on) {
    const w = $('#t-wake');
    w.classList.toggle('off', !on);
    w.title = t(on ? 'timer.wakeOn' : 'timer.wakeOff');
    w.setAttribute('aria-label', w.title);
  }

  async function requestWake() {
    if (!wakeSupported) { setWakeIndicator(false); return; }
    try {
      if (wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      setWakeIndicator(true);
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      setWakeIndicator(false);
    }
  }

  function releaseWake() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  // ---------------------------------------------------------------
  // Motor del temporizador
  // El tiempo se calcula con el reloj real (performance.now), no sumando
  // ticks, así no se desfasa aunque el navegador vaya lento.
  // ---------------------------------------------------------------
  const timer = {
    active: false,
    finished: false,
    paused: false,
    config: null,
    phases: [],
    idx: 0,
    phaseStart: 0,
    pausedAt: 0,
    warned: false,
    interval: null,
    lastRender: ''
  };

  const now = () => performance.now();

  function vibrate(pattern) {
    if (settings.vibration && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignorar */ }
    }
  }

  function flash() {
    const f = $('#t-flash');
    f.classList.remove('on');
    void f.offsetWidth; // reinicia la animación
    f.classList.add('on');
  }

  /** Suma o resta segundos a la fase actual (mínimo 1 s restante). */
  function adjustPhase(delta) {
    if (!timer.active || timer.finished) return;
    const p = timer.phases[timer.idx];
    const elapsed = elapsedSec();
    p.duration = Math.max(Math.ceil(elapsed) + 1, p.duration + delta);
    const remaining = p.duration - elapsed;
    timer.warned = p.type === 'prep' || remaining <= 10;
    render(true);
  }

  function startSession(config) {
    Sound.unlock(); // tiene que ocurrir dentro del toque del usuario
    const cfg = S.normalizeConfig(clone(config));
    save(KEYS.last, cfg);
    timer.config = cfg;
    timer.phases = S.buildPhases(cfg);
    timer.active = true;
    timer.finished = false;
    timer.paused = false;
    enterPhase(0, now());
    $('#t-done-actions').hidden = true;
    $('#t-controls').hidden = false;
    $('#t-adjust').hidden = false;
    navigate('timer');
    requestWake();
    clearInterval(timer.interval);
    timer.interval = setInterval(tick, 100);
    render(true);
  }

  function enterPhase(i, startTime) {
    timer.idx = i;
    timer.phaseStart = startTime;
    if (timer.paused) timer.pausedAt = startTime;
    const p = timer.phases[i];
    // Sin aviso de 10 s en la cuenta atrás inicial ni en fases de 10 s o menos.
    timer.warned = p.type === 'prep' || p.duration <= 10;
  }

  function elapsedSec() {
    const ref = timer.paused ? timer.pausedAt : now();
    return (ref - timer.phaseStart) / 1000;
  }

  function tick() {
    if (!timer.active || timer.finished || timer.paused) return;
    let elapsed = elapsedSec();
    let changed = false;
    while (elapsed >= timer.phases[timer.idx].duration) {
      const end = timer.phaseStart + timer.phases[timer.idx].duration * 1000;
      if (timer.idx === timer.phases.length - 1) { finish(); return; }
      enterPhase(timer.idx + 1, end);
      elapsed = elapsedSec();
      changed = true;
    }
    if (changed) {
      Sound.play('end');
      vibrate(400);
      flash();
    }
    const remaining = timer.phases[timer.idx].duration - elapsed;
    if (!timer.warned && remaining <= 10) {
      timer.warned = true;
      Sound.play('warn');
      vibrate([80, 80, 80]);
    }
    render(changed);
  }

  function finish() {
    timer.finished = true;
    clearInterval(timer.interval);
    releaseWake();
    Sound.play('done');
    vibrate([200, 100, 200, 100, 400]);
    flash();
    $('#t-controls').hidden = true;
    $('#t-adjust').hidden = true;
    $('#t-done-actions').hidden = false;
    render(true);
  }

  function togglePause() {
    if (!timer.active || timer.finished) return;
    if (timer.paused) {
      Sound.unlock();
      timer.phaseStart += now() - timer.pausedAt;
      timer.paused = false;
      requestWake();
    } else {
      timer.pausedAt = now();
      timer.paused = true;
      releaseWake();
    }
    render(true);
  }

  function skipPhase() {
    if (!timer.active || timer.finished) return;
    if (timer.idx >= timer.phases.length - 1) { finish(); return; }
    enterPhase(timer.idx + 1, now());
    flash();
    render(true);
  }

  function prevPhase() {
    if (!timer.active || timer.finished) return;
    // Como en un reproductor: si la fase lleva más de 3 s, la reinicia;
    // si no, vuelve a la anterior.
    if (elapsedSec() > 3 || timer.idx === 0) enterPhase(timer.idx, now());
    else enterPhase(timer.idx - 1, now());
    render(true);
  }

  function stopTimer() {
    timer.active = false;
    timer.finished = false;
    timer.paused = false;
    clearInterval(timer.interval);
    releaseWake();
  }

  function phaseName(type) {
    return t({ prep: 'timer.prep', work: 'timer.work', rest: 'timer.rest', blockRest: 'timer.blockRest' }[type]);
  }

  /** Datos de round a mostrar: en la cuenta atrás, los del primer round. */
  function roundInfo(i) {
    const p = timer.phases[i];
    if (p.type !== 'prep') return p;
    return timer.phases.find((x) => x.type === 'work');
  }

  function applyPhaseColors(screen, type, paused) {
    const c = phaseColors(type, paused);
    screen.style.setProperty('--phase', c.bg);
    screen.style.setProperty('--ph-text', c.fg);
  }

  function render(force) {
    const screen = $('#screen-timer');
    const timeEl = $('#t-time');

    if (timer.finished) {
      const total = S.totalDuration(timer.phases);
      const rounds = timer.phases.filter((p) => p.type === 'work').length;
      screen.dataset.phase = 'done';
      screen.classList.remove('is-paused');
      applyPhaseColors(screen, 'done', false);
      $('#t-phase').textContent = t('timer.done');
      timeEl.textContent = S.formatTime(total);
      timeEl.classList.remove('long');
      $('#t-round').textContent = t('editor.totalRounds', { n: rounds });
      $('#t-block').textContent = '';
      $('#t-group').textContent = '';
      $('#t-next').textContent = '';
      $('#t-remaining').textContent = '';
      $('#t-progress').style.width = '100%';
      $('#t-wake').hidden = true;
      timer.lastRender = 'done';
      updateThemeColor();
      return;
    }

    const p = timer.phases[timer.idx];
    const elapsed = Math.max(0, elapsedSec());
    const remaining = Math.max(0, p.duration - elapsed);
    const shown = Math.ceil(remaining - 1e-6);
    const timeText = S.formatTime(shown);

    // Evita tocar el DOM si no ha cambiado nada visible.
    const key = timer.idx + '|' + shown + '|' + timer.paused + '|' + Math.floor(elapsed * 4);
    if (!force && key === timer.lastRender) return;
    timer.lastRender = key;

    const phaseChanged = screen.dataset.phase !== p.type || screen.classList.contains('is-paused') !== timer.paused;
    screen.dataset.phase = p.type;
    screen.classList.toggle('is-paused', timer.paused);
    applyPhaseColors(screen, p.type, timer.paused);
    $('#t-wake').hidden = false;

    $('#t-phase').textContent = timer.paused ? t('timer.paused') + ' · ' + phaseName(p.type) : phaseName(p.type);
    timeEl.textContent = timeText;
    timeEl.classList.toggle('long', timeText.length > 4);
    timeEl.setAttribute('aria-label', timeText);

    const info = roundInfo(timer.idx);
    if (info) {
      const multi = info.groupCount > 1 || info.blockCount > 1;
      $('#t-round').textContent = multi
        ? t('timer.round', { n: info.round, total: info.roundsInGroup })
        : t('timer.round', { n: info.roundOverall, total: info.totalRounds });
      $('#t-block').textContent = info.blockCount > 1 ? t('timer.block', { n: info.block, total: info.blockCount }) : '';
      $('#t-group').textContent = info.groupCount > 1 ? t('timer.group', { letter: letter(info.group) }) : '';
    }

    const next = timer.phases[timer.idx + 1];
    $('#t-next').textContent = next
      ? t('timer.next', { what: phaseName(next.type) + ' ' + S.formatTime(next.duration) })
      : t('timer.nextEnd');

    let totalLeft = remaining;
    for (let i = timer.idx + 1; i < timer.phases.length; i++) totalLeft += timer.phases[i].duration;
    $('#t-remaining').textContent = t('timer.remaining', { time: S.formatTime(Math.ceil(totalLeft - 1e-6)) });

    $('#t-progress').style.width = Math.min(100, (elapsed / p.duration) * 100) + '%';

    const pauseBtn = $('#btn-pause');
    pauseBtn.setAttribute('aria-label', t(timer.paused ? 'timer.resume' : 'timer.pause'));

    if (phaseChanged) updateThemeColor();
  }

  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-skip').addEventListener('click', skipPhase);
  $('#btn-prev').addEventListener('click', prevPhase);
  $('#btn-minus10').addEventListener('click', () => adjustPhase(-10));
  $('#btn-plus10').addEventListener('click', () => adjustPhase(10));
  $('#btn-repeat').addEventListener('click', () => startSession(timer.config));
  $('#btn-home').addEventListener('click', () => { stopTimer(); navigate('home'); });
  $('#btn-exit').addEventListener('click', async () => {
    if (timer.finished || (await confirmDialog(t('timer.confirmExit'), t('timer.exit'), true))) {
      stopTimer();
      navigate('home');
    }
  });

  // Tocar la pantalla para pausar (opcional)
  $('#timer-main').addEventListener('click', (e) => {
    if (!settings.tapPause || e.target.closest('button')) return;
    togglePause();
  });

  // Teclado (útil en tablet con teclado u ordenador)
  document.addEventListener('keydown', (e) => {
    if (currentScreen !== 'timer' || document.querySelector('dialog[open]')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    else if (e.key === 'ArrowRight') skipPhase();
    else if (e.key === 'ArrowLeft') prevPhase();
  });

  // Al volver a la app: recupera la pantalla encendida y pone el reloj al día.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer.active && !timer.finished && !timer.paused) {
      requestWake();
      tick();
    }
  });

  // ---------------------------------------------------------------
  // Pantalla de ajustes
  // ---------------------------------------------------------------
  function setSegmented(group, value) {
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === value)));
  }

  function renderSettings() {
    setSegmented($('#opt-language'), settings.lang);
    setSegmented($('#opt-theme'), settings.theme);
    $('#opt-sound').checked = settings.sound;
    $('#opt-volume').value = settings.volume;
    $('#opt-volume').disabled = !settings.sound;
    const canVibrate = typeof navigator.vibrate === 'function';
    $('#opt-vibration').checked = settings.vibration && canVibrate;
    $('#opt-vibration').disabled = !canVibrate;
    $('#vibration-hint').hidden = canVibrate;
    $('#opt-tap-pause').checked = settings.tapPause;
    $('#app-version').textContent = t('settings.version', { v: APP_VERSION });
    renderSoundSets();
    renderColorPicker('work');
    renderColorPicker('rest');
    renderColorPreview();
  }

  function renderSoundSets() {
    const box = $('#opt-sound-set');
    box.innerHTML = '';
    Sound.SETS.forEach((name) => {
      box.appendChild(el('button', {
        type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(settings.soundSet === name),
        text: t('sound.' + name),
        onclick: () => {
          settings.soundSet = name;
          saveSettings();
          applySoundSettings();
          renderSoundSets();
          Sound.unlock();
          testSound('end');
        }
      }));
    });
  }

  // ---------------------------------------------------------------
  // Colores (actividad y descanso)
  // ---------------------------------------------------------------
  const pickers = {};

  function renderColorPicker(target) {
    const box = $('#color-' + target);
    box.innerHTML = '';
    const ui = pickers[target] = { swatches: [] };

    const grid = el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t(target === 'work' ? 'settings.colorWork' : 'settings.colorRest') });
    Colors.PALETTE.forEach((c) => {
      const b = el('button', {
        type: 'button', class: 'swatch', role: 'radio',
        'aria-label': t('color.' + c.id) + ' ' + c.hex,
        title: t('color.' + c.id),
        onclick: () => setColor(target, c.hex)
      });
      b.style.background = c.hex;
      b.style.color = Colors.resolve(c.hex, false).fg;
      b.dataset.hex = c.hex;
      ui.swatches.push(b);
      grid.appendChild(b);
    });

    ui.picker = el('input', { type: 'color', 'aria-label': t('settings.colorCustom') });
    ui.hex = el('input', { type: 'text', class: 'hex-input', maxlength: 7, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': t('settings.colorHex') });
    ui.error = el('p', { class: 'error', hidden: true, text: t('settings.colorInvalid') });
    ui.row = el('div', { class: 'custom-row' }, [ui.picker, ui.hex, el('span', { class: 'custom-label', text: t('settings.colorCustom') })]);

    ui.picker.addEventListener('input', () => setColor(target, ui.picker.value));
    ui.hex.addEventListener('input', () => {
      const v = Colors.normalizeHex(ui.hex.value);
      ui.hex.setAttribute('aria-invalid', String(!v));
      ui.error.hidden = !!v || ui.hex.value.replace('#', '').length < 6;
      if (v) setColor(target, v, true);
    });
    ui.hex.addEventListener('blur', () => {
      ui.hex.removeAttribute('aria-invalid');
      ui.error.hidden = true;
      updateColorPicker(target);
    });

    box.appendChild(grid);
    box.appendChild(ui.row);
    box.appendChild(ui.error);
    updateColorPicker(target);
  }

  function updateColorPicker(target, typing) {
    const ui = pickers[target];
    if (!ui) return;
    const hex = settings.colors[target];
    const inPalette = Colors.PALETTE.some((c) => c.hex === hex);
    ui.swatches.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hex === hex)));
    ui.picker.value = hex.toLowerCase();
    if (!typing) ui.hex.value = hex;
    ui.row.classList.toggle('is-active', !inPalette);
  }

  function setColor(target, hex, typing) {
    hex = Colors.normalizeHex(hex);
    if (!hex) return;
    settings.colors[target] = hex;
    saveSettings();
    updateColorPicker(target, typing);
    renderColorPreview();
  }

  function renderColorPreview() {
    document.querySelectorAll('[data-preview]').forEach((tile) => {
      const kind = tile.dataset.preview;
      const c = kind === 'gray' ? phaseColors('prep', true) : phaseColors(kind, false);
      tile.style.background = c.bg;
      tile.style.color = c.fg;
    });
  }

  $('#btn-reset-colors').addEventListener('click', () => {
    settings.colors = Object.assign({}, Colors.DEFAULTS);
    saveSettings();
    renderColorPicker('work');
    renderColorPicker('rest');
    renderColorPreview();
    toast(t('settings.colorsResetDone'));
  });

  $('#btn-open-settings').addEventListener('click', () => { renderSettings(); navigate('settings'); });

  $('#opt-language').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings.lang = b.dataset.value;
    saveSettings();
    applyLanguage();
  });

  $('#opt-theme').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings.theme = b.dataset.value;
    saveSettings();
    applyTheme();
    renderSettings();
  });

  $('#opt-sound').addEventListener('change', (e) => {
    settings.sound = e.target.checked;
    saveSettings(); applySoundSettings(); renderSettings();
  });
  $('#opt-volume').addEventListener('input', (e) => {
    settings.volume = parseInt(e.target.value, 10);
    saveSettings();
  });
  // Al soltar el control se vuelven a preparar los sonidos con el volumen nuevo.
  $('#opt-volume').addEventListener('change', () => { applySoundSettings(); testSound('end'); });
  $('#opt-vibration').addEventListener('change', (e) => { settings.vibration = e.target.checked; saveSettings(); });
  $('#opt-tap-pause').addEventListener('change', (e) => { settings.tapPause = e.target.checked; saveSettings(); });

  /** Reproduce un sonido de prueba y avisa si no puede sonar. */
  function testSound(kind) {
    Sound.play(kind).then((result) => {
      if (result === 'off') toast(t('settings.soundOff'));
      else if (result === 'blocked') toast(t('settings.soundBlocked'));
    });
    vibrate(kind === 'warn' ? [80, 80, 80] : kind === 'end' ? 400 : [200, 100, 200, 100, 400]);
  }

  document.querySelectorAll('[data-test-sound]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    testSound(b.dataset.testSound);
  }));

  if (darkQuery) {
    const onScheme = () => { if (settings.theme === 'system') applyTheme(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onScheme);
    else if (darkQuery.addListener) darkQuery.addListener(onScheme);
  }

  // ---------------------------------------------------------------
  // Idioma
  // ---------------------------------------------------------------
  function applyLanguage() {
    I18n.setLang(settings.lang);
    I18n.apply();
    renderSettings();
    renderHome();
    if (editor.config) renderEditor();
    if (timer.active) render(true);
    setWakeIndicator(!!wakeLock);
  }

  // ---------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------
  I18n.setLang(settings.lang);
  I18n.apply();
  applyTheme();
  applySoundSettings();
  seedPresets();
  history.replaceState({ screen: 'home' }, '');
  showScreen('home');

  // Modo offline / instalable (solo en https o localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
    });
  }

  // Acceso para pruebas automáticas
  window.__asalto = { timer, settings, presets: () => presets, S };
})();
