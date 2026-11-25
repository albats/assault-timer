/*
 * Ring Timer — lógica de la interfaz.
 * Pantallas: inicio, editor, temporizador, ajustes.
 */
(function () {
  'use strict';

  const APP_VERSION = '1.3.0'; // Ring Timer
  const S = window.Sequence;
  const I18n = window.I18n;
  const t = I18n.t;
  const Sound = window.Sound;
  const Colors = window.Colors;

  const KEYS = {
    settings: 'asalto.settings',
    presets: 'asalto.presets',
    last: 'asalto.lastConfig',
    seeded: 'asalto.seeded',
    seedVersion: 'asalto.seedVersion',
    history: 'asalto.history'
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
    trashSm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
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
  // Solo se admiten colores de la paleta (un color propio antiguo vuelve al predeterminado).
  const inPalette = (hex) => Colors.PALETTE.some((c) => c.hex === hex);
  ['work', 'rest'].forEach((k) => { if (!inPalette(settings.colors[k])) settings.colors[k] = Colors.DEFAULTS[k]; });
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

  const seed = (nameKey, cfg) => ({ id: uid(), name: t(nameKey), config: S.normalizeConfig(cfg) });

  /**
   * Presets de ejemplo. seedVersion permite añadir ejemplos nuevos a quien
   * ya tenía la app sin tocar los presets que haya creado o editado.
   */
  function seedPresets() {
    let version = load(KEYS.seedVersion, load(KEYS.seeded, false) ? 1 : 0);
    if (version < 1) {
      presets = presets.concat([
        seed('seed.boxing', { countdown: 10, simple: { rounds: 12, work: 180, rest: 60 } }),
        seed('seed.tabata', { countdown: 5, simple: { rounds: 8, work: 20, rest: 10 } }),
        seed('seed.blocks', {
          countdown: 5, useBlocks: true,
          blocks: { count: 2, blockRest: 120, groups: [{ rounds: 3, work: 180, rest: 60 }, { rounds: 3, work: 120, rest: 60 }] }
        })
      ]);
    } else if (version === 1) {
      // Boxeo pasa de 3 a 12 rounds, solo si el preset sigue como venía.
      presets.forEach((p) => {
        const c = p.config;
        if (['Boxeo', 'Boxing'].indexOf(p.name) !== -1 && c && (c.mode || 'intervals') === 'intervals' && !c.useBlocks &&
            c.simple && c.simple.rounds === 3 && c.simple.work === 180 && c.simple.rest === 60) {
          c.simple.rounds = 12;
        }
      });
    }
    if (version < 2) {
      presets = presets.concat([
        seed('seed.emom', { mode: 'emom', countdown: 10, emom: { rounds: 10, interval: 60 } }),
        seed('seed.amrap', { mode: 'amrap', countdown: 10, amrap: { duration: 12 * 60 } }),
        seed('seed.fortime', { mode: 'fortime', countdown: 10, fortime: { cap: 15 * 60 } })
      ]);
    }
    savePresets();
    save(KEYS.seeded, true);
    save(KEYS.seedVersion, 2);
  }

  function describeConfig(cfg) {
    cfg = S.normalizeConfig(cfg);
    const total = S.formatTime(S.totalDuration(S.buildPhases(cfg)));
    if (cfg.mode === 'emom') return 'EMOM · ' + cfg.emom.rounds + ' × ' + S.formatTime(cfg.emom.interval) + ' · ' + total;
    if (cfg.mode === 'amrap') return 'AMRAP · ' + S.formatTime(cfg.amrap.duration);
    if (cfg.mode === 'fortime') {
      return 'For Time · ' + (cfg.fortime.cap > 0 ? t('preset.cap', { time: S.formatTime(cfg.fortime.cap) }) : t('preset.noCap'));
    }
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
        el('button', { class: 'preset-main', type: 'button', onclick: () => startSession(p.config, p.name) }, [
          el('span', { class: 'preset-name', text: p.name }),
          el('span', { class: 'preset-detail', text: describeConfig(p.config) })
        ]),
        el('button', {
          class: 'icon-btn', type: 'button', 'aria-label': t('common.more') + ': ' + p.name,
          html: ICONS.more, onclick: () => openPresetMenu(p)
        }),
        el('button', {
          class: 'preset-play', type: 'button', 'aria-label': t('preset.start') + ': ' + p.name,
          html: ICONS.play, onclick: () => startSession(p.config, p.name)
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
  const SCREENS = ['home', 'editor', 'timer', 'settings', 'history'];

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
    if (target === 'editor' || target === 'settings' || target === 'history') showScreen(target);
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

    // Tipo de sesión
    const modes = $('#mode-options');
    modes.innerHTML = '';
    S.MODES.forEach((m) => {
      modes.appendChild(el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(cfg.mode === m), text: t('mode.' + m),
        onclick: () => { cfg.mode = m; renderEditor(); }
      }));
    });
    const intervals = cfg.mode === 'intervals';

    // Campos de EMOM, AMRAP y For Time
    const mf = $('#mode-fields');
    mf.innerHTML = '';
    mf.hidden = intervals;
    if (cfg.mode === 'emom') {
      mf.appendChild(el('div', { class: 'fields-grid' }, [
        field(t('editor.emomRounds'), stepper({ label: t('editor.emomRounds'), value: cfg.emom.rounds, min: L.rounds.min, max: L.rounds.max, onChange: (v) => { cfg.emom.rounds = v; updateSummary(); } })),
        field(t('editor.emomInterval'), timeInput({ label: t('editor.emomInterval'), value: cfg.emom.interval, min: L.interval.min, max: L.interval.max, onChange: (v) => { cfg.emom.interval = v; updateSummary(); } }))
      ]));
      mf.appendChild(el('p', { class: 'hint', text: t('editor.emomHint') }));
    } else if (cfg.mode === 'amrap') {
      mf.appendChild(el('div', { class: 'fields-grid' }, [
        field(t('editor.amrapDuration'), timeInput({ label: t('editor.amrapDuration'), value: cfg.amrap.duration, min: L.amrap.min, max: L.amrap.max, onChange: (v) => { cfg.amrap.duration = v; updateSummary(); } }))
      ]));
      mf.appendChild(el('p', { class: 'hint', text: t('editor.amrapHint') }));
    } else if (cfg.mode === 'fortime') {
      mf.appendChild(el('div', { class: 'fields-grid' }, [
        field(t('editor.fortimeCap'), timeInput({ label: t('editor.fortimeCap'), value: cfg.fortime.cap, min: L.cap.min, max: L.cap.max, onChange: (v) => { cfg.fortime.cap = v; updateSummary(); } }))
      ]));
      mf.appendChild(el('p', { class: 'hint', text: t('editor.fortimeHint') }));
    }

    // Modo simple
    const simple = $('#simple-fields');
    simple.innerHTML = '';
    simple.appendChild(groupFields(cfg.simple));
    simple.hidden = !intervals || cfg.useBlocks;

    $('#blocks-toggle-card').hidden = !intervals;
    $('#use-blocks').checked = cfg.useBlocks;
    $('#blocks-fields').hidden = !intervals || !cfg.useBlocks;

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
    if (cfg.mode === 'emom') return cfg.emom.interval >= S.LIMITS.interval.min && cfg.emom.rounds >= 1;
    if (cfg.mode === 'amrap') return cfg.amrap.duration >= S.LIMITS.amrap.min;
    if (cfg.mode === 'fortime') return true;
    const groups = cfg.useBlocks ? cfg.blocks.groups : [cfg.simple];
    return groups.every((g) => g.work >= 1 && g.rounds >= 1);
  }

  function updateSummary() {
    const valid = editorIsValid();
    const phases = S.buildPhases(editor.config);
    const rounds = phases.filter((p) => p.type === 'work').length;
    const cfg = editor.config;
    $('#summary-total').textContent = S.isOpen(phases) ? t('preset.noCap') : S.formatTime(S.totalDuration(phases));
    $('#summary-rounds').textContent = (cfg.mode === 'intervals' || cfg.mode === 'emom') ? t('editor.totalRounds', { n: rounds }) : '';
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
    const preset = editor.presetId ? presets.find((p) => p.id === editor.presetId) : null;
    startSession(editor.config, preset ? preset.name : null);
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
    lastRender: '',
    count: 0,        // AMRAP: rondas contadas
    laps: [],        // For Time: segundos acumulados en cada vuelta
    finalTime: 0,    // For Time: tiempo final
    capReached: false,
    name: null,          // nombre del preset (para el historial)
    workStartedAt: 0,    // hora real (ms) en que empezó la primera fase tras la cuenta atrás
    pausedMs: 0,         // tiempo en pausa desde entonces
    pauseWall: 0,
    recorded: false
  };

  const mode = () => (timer.config ? timer.config.mode : 'intervals');

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

  function startSession(config, name) {
    Sound.unlock(); // tiene que ocurrir dentro del toque del usuario
    const cfg = S.normalizeConfig(clone(config));
    save(KEYS.last, cfg);
    timer.config = cfg;
    timer.phases = S.buildPhases(cfg);
    timer.phases.forEach((p) => { p.baseDuration = p.duration; });
    timer.count = 0;
    timer.laps = [];
    timer.finalTime = 0;
    timer.capReached = false;
    timer.name = name || null;
    timer.workStartedAt = 0;
    timer.pausedMs = 0;
    timer.pauseWall = 0;
    timer.recorded = false;
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
    // Para el historial: el tiempo entrenado empieza tras la cuenta atrás.
    if (!timer.workStartedAt && p.type !== 'prep') {
      timer.workStartedAt = Date.now() - Math.max(0, now() - startTime);
      timer.pausedMs = 0;
      if (timer.paused) timer.pauseWall = Date.now();
    }
    // Sin aviso de 10 s en la cuenta atrás inicial, en fases de 10 s o menos
    // ni en un For Time sin límite.
    timer.warned = p.type === 'prep' || p.duration <= 10 || !!p.open;
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
      if (timer.idx === timer.phases.length - 1) {
        if (timer.phases[timer.idx].countUp) timer.capReached = true;
        finish();
        return;
      }
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
    const cur = timer.phases[timer.idx];
    if (cur && cur.countUp) timer.finalTime = Math.min(Math.max(0, elapsedSec()), cur.duration);
    timer.finished = true;
    recordSession(true);
    clearInterval(timer.interval);
    releaseWake();
    Sound.play('done');
    vibrate([200, 100, 200, 100, 400]);
    flash();
    $('#t-controls').hidden = true;
    $('#t-adjust').hidden = true;
    $('#t-mode-actions').hidden = true;
    $('#t-done-actions').hidden = false;
    render(true);
  }

  function togglePause() {
    if (!timer.active || timer.finished) return;
    if (timer.paused) {
      Sound.unlock();
      timer.phaseStart += now() - timer.pausedAt;
      if (timer.pauseWall) timer.pausedMs += Date.now() - timer.pauseWall;
      timer.pauseWall = 0;
      timer.paused = false;
      requestWake();
    } else {
      timer.pausedAt = now();
      timer.pauseWall = Date.now();
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

  /** Vuelve a empezar la fase actual desde su tiempo completo. */
  function restartPhase() {
    if (!timer.active || timer.finished) return;
    const p = timer.phases[timer.idx];
    p.duration = p.baseDuration;
    if (p.type === 'work' && mode() === 'amrap') timer.count = 0;
    if (p.type === 'work' && mode() === 'fortime') timer.laps = [];
    enterPhase(timer.idx, now());
    render(true);
  }

  function addRound() {
    if (!timer.active || timer.finished || timer.phases[timer.idx].type !== 'work') return;
    timer.count++;
    vibrate(40);
    render(true);
  }

  function addLap() {
    if (!timer.active || timer.finished || timer.phases[timer.idx].type !== 'work') return;
    timer.laps.push(Math.max(0, elapsedSec()));
    vibrate(40);
    render(true);
  }

  function finishNow() {
    if (!timer.active || timer.finished) return;
    finish();
  }

  function stopTimer() {
    // Una sesión abandonada se guarda como incompleta si duró al menos 2 minutos.
    if (timer.active && !timer.finished && !timer.recorded && activeSeconds() >= 120) recordSession(false);
    timer.active = false;
    timer.finished = false;
    timer.paused = false;
    clearInterval(timer.interval);
    releaseWake();
  }

  function phaseName(type) {
    if (type === 'work' && mode() !== 'intervals') return t('mode.' + mode());
    return t({ prep: 'timer.prep', work: 'timer.work', rest: 'timer.rest', blockRest: 'timer.blockRest' }[type]);
  }

  /** Tiempos de cada vuelta de For Time (diferencia entre vueltas). */
  function splits() {
    return timer.laps.map((v, i) => S.formatTime(Math.floor(v - (i ? timer.laps[i - 1] : 0))));
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
      let doneTime = S.formatTime(total);
      let doneRound = t('editor.totalRounds', { n: rounds });
      let doneNext = '';
      let doneExtra = '';
      if (mode() === 'amrap') {
        const work = timer.phases.find((x) => x.type === 'work');
        doneTime = S.formatTime(work ? work.duration : total);
        doneRound = t('timer.roundsResult', { n: timer.count });
      } else if (mode() === 'fortime') {
        doneTime = S.formatTime(Math.floor(timer.finalTime));
        doneRound = t('timer.laps', { n: timer.laps.length });
        if (timer.laps.length) doneNext = t('timer.splits', { list: splits().slice(-8).join(' · ') });
        if (timer.capReached) doneExtra = t('timer.capReached');
      }
      $('#t-phase').textContent = t('timer.done');
      timeEl.textContent = doneTime;
      timeEl.classList.toggle('long', doneTime.length > 5);
      $('#t-round').textContent = doneRound;
      $('#t-block').textContent = '';
      $('#t-group').textContent = '';
      $('#t-next').textContent = doneNext;
      $('#t-remaining').textContent = doneExtra;
      $('#t-progress').style.width = '100%';
      $('#t-wake').hidden = true;
      timer.lastRender = 'done';
      updateThemeColor();
      return;
    }

    const p = timer.phases[timer.idx];
    const elapsed = Math.max(0, elapsedSec());
    const remaining = Math.max(0, p.duration - elapsed);
    // For Time cuenta hacia arriba; el resto, hacia atrás.
    const shown = p.countUp ? Math.floor(elapsed) : Math.ceil(remaining - 1e-6);
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

    const m = mode();
    const info = roundInfo(timer.idx);
    const isWork = p.type === 'work';
    $('#t-mode-actions').hidden = !(isWork && (m === 'amrap' || m === 'fortime'));
    $('#btn-count').hidden = m !== 'amrap';
    $('#btn-lap').hidden = m !== 'fortime';
    $('#btn-finish').hidden = m !== 'fortime';
    $('#t-adjust').hidden = m === 'fortime' && isWork;
    if (m === 'emom' && info) {
      const key = timer.config.emom.interval === 60 ? 'timer.minute' : 'timer.interval';
      $('#t-round').textContent = t(key, { n: info.roundOverall, total: info.totalRounds });
      $('#t-block').textContent = '';
      $('#t-group').textContent = '';
    } else if (m === 'amrap') {
      $('#t-round').textContent = isWork ? t('timer.roundsCount', { n: timer.count }) : '';
      $('#t-block').textContent = '';
      $('#t-group').textContent = '';
    } else if (m === 'fortime') {
      const sp = splits();
      $('#t-round').textContent = isWork && timer.laps.length
        ? t('timer.laps', { n: timer.laps.length }) + ' · ' + t('timer.lastLap', { time: sp[sp.length - 1] })
        : '';
      $('#t-block').textContent = '';
      $('#t-group').textContent = '';
    } else if (info) {
      const multi = info.groupCount > 1 || info.blockCount > 1;
      $('#t-round').textContent = multi
        ? t('timer.round', { n: info.round, total: info.roundsInGroup })
        : t('timer.round', { n: info.roundOverall, total: info.totalRounds });
      $('#t-block').textContent = info.blockCount > 1 ? t('timer.block', { n: info.block, total: info.blockCount }) : '';
      $('#t-group').textContent = info.groupCount > 1 ? t('timer.group', { letter: letter(info.group) }) : '';
    }

    const next = timer.phases[timer.idx + 1];
    if (m === 'fortime' && isWork) {
      $('#t-next').textContent = p.open ? t('timer.noCap') : t('timer.cap', { time: S.formatTime(p.duration) });
    } else {
      $('#t-next').textContent = next
        ? t('timer.next', { what: phaseName(next.type) + ' ' + (next.open ? '' : S.formatTime(next.duration)) }).trim()
        : t('timer.nextEnd');
    }

    if (S.isOpen(timer.phases)) {
      $('#t-remaining').textContent = '';
    } else {
      let totalLeft = remaining;
      for (let i = timer.idx + 1; i < timer.phases.length; i++) totalLeft += timer.phases[i].duration;
      $('#t-remaining').textContent = t('timer.remaining', { time: S.formatTime(Math.ceil(totalLeft - 1e-6)) });
    }

    $('#t-progress').style.width = (p.open ? 0 : Math.min(100, (elapsed / p.duration) * 100)) + '%';

    const pauseBtn = $('#btn-pause');
    pauseBtn.setAttribute('aria-label', t(timer.paused ? 'timer.resume' : 'timer.pause'));

    if (phaseChanged) updateThemeColor();
  }

  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-skip').addEventListener('click', skipPhase);
  $('#btn-prev').addEventListener('click', prevPhase);
  $('#btn-restart').addEventListener('click', restartPhase);
  $('#btn-count').addEventListener('click', addRound);
  $('#btn-lap').addEventListener('click', addLap);
  $('#btn-finish').addEventListener('click', finishNow);
  $('#btn-minus10').addEventListener('click', () => adjustPhase(-10));
  $('#btn-plus10').addEventListener('click', () => adjustPhase(10));
  $('#btn-repeat').addEventListener('click', () => startSession(timer.config, timer.name));
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
  // Historial de sesiones (solo en este dispositivo)
  // ---------------------------------------------------------------
  const HISTORY_MAX = 500;
  let sessionLog = load(KEYS.history, []);
  if (!Array.isArray(sessionLog)) sessionLog = [];
  const saveHistory = () => save(KEYS.history, sessionLog);

  /** Segundos entrenados: desde el fin de la cuenta atrás, sin pausas. */
  function activeSeconds() {
    if (!timer.workStartedAt) return 0;
    const pausedNow = timer.paused && timer.pauseWall ? Date.now() - timer.pauseWall : 0;
    return Math.max(0, (Date.now() - timer.workStartedAt - timer.pausedMs - pausedNow) / 1000);
  }

  function recordSession(complete) {
    if (timer.recorded || !timer.config) return;
    const secs = Math.round(activeSeconds());
    if (secs < 1) return;
    const m = mode();
    const workIdx = timer.phases.map((p, i) => (p.type === 'work' ? i : -1)).filter((i) => i >= 0);
    const roundsDone = workIdx.filter((i) => (complete ? i <= timer.idx : i < timer.idx)).length;
    sessionLog.unshift({
      id: uid(),
      at: timer.workStartedAt,
      name: timer.name,
      mode: m,
      duration: secs,
      rounds: roundsDone,
      totalRounds: workIdx.length,
      count: timer.count,
      finalTime: Math.floor(timer.finalTime),
      complete: !!complete
    });
    if (sessionLog.length > HISTORY_MAX) sessionLog.length = HISTORY_MAX;
    timer.recorded = true;
    saveHistory();
  }

  function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7; // lunes = 0
    x.setDate(x.getDate() - day);
    return x;
  }

  function sessionDetail(h) {
    const parts = [];
    const date = new Date(h.at);
    const loc = I18n.lang === 'es' ? 'es-ES' : 'en-GB';
    parts.push(date.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
      date.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }));
    parts.push(S.formatTime(h.duration));
    if (h.mode === 'amrap') parts.push(t('timer.roundsResult', { n: h.count }));
    else if (h.mode === 'fortime') parts.push(t('history.time', { time: S.formatTime(h.finalTime) }));
    else parts.push(h.rounds === 1 ? '1 round' : t('editor.totalRounds', { n: h.rounds }));
    return parts.join(' · ');
  }

  function renderHistory() {
    const now_ = new Date();
    const weekStart = startOfWeek(now_);
    const lastStart = new Date(weekStart); lastStart.setDate(lastStart.getDate() - 7);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    const loc = I18n.lang === 'es' ? 'es-ES' : 'en-GB';

    const days = [0, 0, 0, 0, 0, 0, 0];
    let wCount = 0, wSecs = 0, lCount = 0, lSecs = 0;
    sessionLog.forEach((h) => {
      if (h.at >= weekStart.getTime() && h.at < weekEnd.getTime()) {
        wCount++; wSecs += h.duration;
        days[(new Date(h.at).getDay() + 6) % 7] += h.duration;
      } else if (h.at >= lastStart.getTime() && h.at < weekStart.getTime()) {
        lCount++; lSecs += h.duration;
      }
    });
    const sunday = new Date(weekEnd); sunday.setDate(sunday.getDate() - 1);
    const fmtDay = (d) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
    $('#week-range').textContent = fmtDay(weekStart) + ' – ' + fmtDay(sunday);
    $('#week-sessions').textContent = wCount;
    $('#week-sessions-label').textContent = t(wCount === 1 ? 'history.session' : 'history.sessions');
    $('#week-minutes').textContent = Math.round(wSecs / 60);
    $('#week-compare').textContent = t('history.lastWeek', {
      sessions: lCount, label: t(lCount === 1 ? 'history.session' : 'history.sessions'), minutes: Math.round(lSecs / 60)
    });

    const bars = $('#week-bars');
    bars.innerHTML = '';
    const labels = t('history.days').split(',');
    const maxMin = Math.max(1, ...days.map((v) => v / 60));
    const today = (now_.getDay() + 6) % 7;
    days.forEach((secs, i) => {
      const mins = Math.round(secs / 60);
      const bar = el('div', { class: 'bar' + (i === today ? ' today' : '') });
      bar.style.height = Math.max(3, (secs / 60 / maxMin) * 80) + 'px';
      bars.appendChild(el('div', { class: 'bar-col' }, [
        el('span', { class: 'bar-val', text: mins ? String(mins) : '' }),
        bar,
        el('span', { class: 'bar-day' + (i === today ? ' today' : ''), text: labels[i] })
      ]));
    });

    const list = $('#history-list');
    list.innerHTML = '';
    $('#history-empty').hidden = sessionLog.length > 0;
    $('#btn-clear-history').hidden = sessionLog.length === 0;
    sessionLog.forEach((h) => {
      const name = el('span', { class: 'history-name', text: h.name || t('mode.' + (h.mode || 'intervals')) });
      if (!h.complete) name.appendChild(el('span', { class: 'tag', text: t('history.incomplete') }));
      list.appendChild(el('li', { class: 'history-item' }, [
        el('div', { class: 'history-main' }, [name, el('span', { class: 'history-detail', text: sessionDetail(h) })]),
        el('button', {
          type: 'button', class: 'icon-btn', html: ICONS.trashSm, 'aria-label': t('history.delete'),
          onclick: async () => {
            if (!(await confirmDialog(t('history.confirmDelete'), t('common.delete'), true))) return;
            sessionLog = sessionLog.filter((x) => x.id !== h.id);
            saveHistory();
            renderHistory();
          }
        })
      ]));
    });
  }

  $('#btn-open-history').addEventListener('click', () => { renderHistory(); navigate('history'); });
  $('#btn-clear-history').addEventListener('click', async () => {
    if (!(await confirmDialog(t('history.confirmClear'), t('history.clear'), true))) return;
    sessionLog = [];
    saveHistory();
    renderHistory();
    toast(t('history.cleared'));
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

    box.appendChild(grid);
    updateColorPicker(target);
  }

  function updateColorPicker(target) {
    const ui = pickers[target];
    if (!ui) return;
    const hex = settings.colors[target];
    ui.swatches.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hex === hex)));
  }

  function setColor(target, hex) {
    if (!inPalette(hex)) return;
    settings.colors[target] = hex;
    saveSettings();
    updateColorPicker(target);
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
    if (currentScreen === 'history') renderHistory();
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
