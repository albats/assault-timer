/*
 * Sonidos de Ring Timer, generados por código (sin archivos).
 *
 * Cómo suena de forma fiable en móviles:
 *  1. Cada sonido se "graba" una vez en memoria (OfflineAudioContext -> WAV)
 *     y se reproduce con un elemento <audio>. En iPhone, <audio> suena
 *     aunque el interruptor de silencio esté activado.
 *  2. Si eso falla, se reproduce en directo con Web Audio.
 *  3. Los navegadores solo permiten sonido después de un toque: Sound.unlock()
 *     se llama en el primer toque de la página y en los botones de iniciar/probar.
 */
(function (root) {
  'use strict';

  var AC = root.AudioContext || root.webkitAudioContext;
  var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
  var RATE = 32000;
  var KINDS = ['warn', 'end', 'done'];

  var ctx = null;          // contexto en directo (respaldo)
  var volume = 0.8;
  var enabled = true;
  var soundSet = 'bell';
  var cache = {};          // clave -> URL del WAV
  var players = {};        // kind -> <audio>
  var unlocked = false;
  var renderToken = 0;

  // ---------------------------------------------------------------
  // Piezas de síntesis (funcionan en contexto en directo y offline)
  // ---------------------------------------------------------------
  function env(c, gainNode, t, peak, attack, decayEnd) {
    var g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, decayEnd);
  }

  function osc(c, out, type, freq, t, peak, attack, dur) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    env(c, g, t, peak, attack, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  var noiseBuf = null;
  function noise(c, out, t, dur, peak, freq, q) {
    if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
      noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    var f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    var g = c.createGain();
    env(c, g, t, peak, 0.002, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // Campana metálica: parciales inarmónicos + golpe del martillo.
  function bell(c, out, t, f, peak, decay) {
    var partials = [[1, 1], [2.0, 0.55], [2.76, 0.45], [5.4, 0.3], [8.93, 0.16]];
    partials.forEach(function (p) {
      osc(c, out, 'sine', f * p[0], t, peak * p[1], 0.003, decay / Math.sqrt(p[0]));
    });
    noise(c, out, t, 0.03, peak * 0.5, 3500, 1.2);
  }

  // Golpe de madera (las "tablillas" del aviso de 10 s en boxeo).
  function knock(c, out, t, peak) {
    noise(c, out, t, 0.045, peak, 2400, 4);
    osc(c, out, 'sine', 1750, t, peak * 0.6, 0.002, 0.06);
  }

  function gong(c, out, t, f, peak, decay) {
    [[1, 1], [1.48, 0.6], [2.0, 0.45], [2.62, 0.3], [3.9, 0.18]].forEach(function (p) {
      osc(c, out, 'sine', f * p[0], t, peak * p[1], 0.02, decay / Math.sqrt(p[0]));
    });
  }

  function whistle(c, out, t, dur, peak) {
    var o = c.createOscillator();
    var lfo = c.createOscillator();
    var lfoGain = c.createGain();
    var g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(2900, t);
    lfo.frequency.value = 32;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.setValueAtTime(peak, t + Math.max(0.03, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    noise(c, out, t, dur, peak * 0.15, 3000, 2);
  }

  function beep(c, out, type, freq, t, dur, peak) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.setValueAtTime(peak, t + Math.max(0.015, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------
  // Juegos de sonido: aviso de 10 s, fin de fase y fin de sesión
  // ---------------------------------------------------------------
  var SETS = {
    bell: {
      warn: function (c, o, t) { knock(c, o, t, 0.9); knock(c, o, t + 0.18, 0.9); },
      end: function (c, o, t) { bell(c, o, t, 760, 0.5, 2.4); },
      done: function (c, o, t) { bell(c, o, t, 760, 0.45, 0.9); bell(c, o, t + 0.38, 760, 0.45, 0.9); bell(c, o, t + 0.76, 760, 0.5, 2.6); },
      len: { warn: 0.6, end: 2.6, done: 3.5 }
    },
    beep: {
      warn: function (c, o, t) { beep(c, o, 'sine', 1320, t, 0.12, 0.6); beep(c, o, 'sine', 1320, t + 0.2, 0.12, 0.6); },
      end: function (c, o, t) { beep(c, o, 'triangle', 660, t, 0.9, 0.8); beep(c, o, 'sine', 990, t, 0.9, 0.3); },
      done: function (c, o, t) { beep(c, o, 'triangle', 660, t, 0.25, 0.8); beep(c, o, 'triangle', 880, t + 0.35, 0.25, 0.8); beep(c, o, 'triangle', 1100, t + 0.7, 0.6, 0.8); },
      len: { warn: 0.5, end: 1.1, done: 1.5 }
    },
    whistle: {
      warn: function (c, o, t) { whistle(c, o, t, 0.12, 0.45); whistle(c, o, t + 0.22, 0.12, 0.45); },
      end: function (c, o, t) { whistle(c, o, t, 0.75, 0.5); },
      done: function (c, o, t) { whistle(c, o, t, 0.25, 0.5); whistle(c, o, t + 0.38, 0.25, 0.5); whistle(c, o, t + 0.76, 0.9, 0.5); },
      len: { warn: 0.5, end: 1.0, done: 1.8 }
    },
    gong: {
      warn: function (c, o, t) { gong(c, o, t, 440, 0.35, 0.5); gong(c, o, t + 0.25, 440, 0.35, 0.5); },
      end: function (c, o, t) { gong(c, o, t, 130, 0.6, 3.5); },
      done: function (c, o, t) { gong(c, o, t, 130, 0.55, 1.6); gong(c, o, t + 0.9, 98, 0.65, 4); },
      len: { warn: 0.9, end: 3.7, done: 5.0 }
    },
    digital: {
      warn: function (c, o, t) { beep(c, o, 'square', 2050, t, 0.06, 0.25); beep(c, o, 'square', 2050, t + 0.14, 0.06, 0.25); },
      end: function (c, o, t) { for (var i = 0; i < 3; i++) beep(c, o, 'square', 2050, t + i * 0.16, 0.08, 0.25); },
      done: function (c, o, t) { for (var i = 0; i < 3; i++) beep(c, o, 'square', 2050, t + i * 0.16, 0.08, 0.25); beep(c, o, 'square', 2050, t + 0.6, 0.7, 0.25); },
      len: { warn: 0.4, end: 0.6, done: 1.5 }
    }
  };

  function schedule(c, kind, t) {
    var master = c.createGain();
    master.gain.value = volume;
    master.connect(c.destination);
    SETS[soundSet][kind](c, master, t);
  }

  // ---------------------------------------------------------------
  // Grabación a WAV
  // ---------------------------------------------------------------
  function toWav(buffer) {
    var data = buffer.getChannelData(0);
    var len = data.length;
    var view = new DataView(new ArrayBuffer(44 + len * 2));
    function str(o, s) { for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, len * 2, true);
    for (var i = 0; i < len; i++) {
      var s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
  }

  function key(kind) { return soundSet + '|' + Math.round(volume * 100) + '|' + kind; }

  function renderOne(kind) {
    var k = key(kind);
    if (cache[k] || !OAC) return Promise.resolve(cache[k]);
    var len = SETS[soundSet].len[kind] + 0.1;
    var oc = new OAC(1, Math.ceil(RATE * len), RATE);
    schedule(oc, kind, 0.01);
    var done = oc.startRendering();
    // Safari antiguo: startRendering sin promesa
    if (!done || typeof done.then !== 'function') {
      done = new Promise(function (res) { oc.oncomplete = function (e) { res(e.renderedBuffer); }; });
    }
    return done.then(function (buf) { cache[k] = toWav(buf); return cache[k]; });
  }

  /** Prepara los 3 sonidos del juego actual (en segundo plano). */
  function prepare() {
    var token = ++renderToken;
    return KINDS.reduce(function (p, kind) {
      return p.then(function () { if (token === renderToken) return renderOne(kind); });
    }, Promise.resolve()).catch(function () { /* sin grabación: se usará Web Audio */ });
  }

  // ---------------------------------------------------------------
  // Desbloqueo y reproducción
  // ---------------------------------------------------------------
  // 50 ms de silencio, para "desbloquear" los reproductores.
  var SILENT = toWav({ sampleRate: 16000, getChannelData: function () { return new Float32Array(800); } });

  function getCtx() {
    if (!ctx && AC) ctx = new AC();
    return ctx;
  }

  /** Llamar dentro de un toque del usuario. */
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* no soportado */ }
    var c = getCtx();
    if (c && c.state !== 'running') { try { c.resume(); } catch (e) { /* ignorar */ } }
    if (unlocked) return;
    KINDS.forEach(function (kind) {
      var el = players[kind];
      if (!el) {
        el = players[kind] = new Audio();
        el.preload = 'auto';
        el.setAttribute('playsinline', '');
      }
      el.src = SILENT;
      var p = el.play();
      if (p && p.then) p.then(function () { el.pause(); unlocked = true; }).catch(function () { /* sigue bloqueado */ });
    });
  }

  function playLive(kind) {
    var c = getCtx();
    if (!c) return Promise.resolve('blocked');
    var go = function () {
      if (c.state !== 'running') return 'blocked';
      schedule(c, kind, c.currentTime + 0.05);
      return 'webaudio';
    };
    if (c.state === 'running') return Promise.resolve(go());
    var r;
    try { r = c.resume(); } catch (e) { r = null; }
    var timeout = new Promise(function (res) { setTimeout(res, 400); });
    return Promise.race([r || Promise.resolve(), timeout]).then(go, go);
  }

  /**
   * Reproduce un sonido ('warn' | 'end' | 'done').
   * Devuelve una promesa con 'audio', 'webaudio', 'off' o 'blocked'.
   */
  function play(kind) {
    if (!enabled || volume <= 0) return Promise.resolve('off');
    var url = cache[key(kind)];
    var el = players[kind];
    if (url && el && unlocked) {
      try {
        el.src = url;
        el.currentTime = 0;
        var p = el.play();
        if (p && p.then) return p.then(function () { return 'audio'; }, function () { return playLive(kind); });
        return Promise.resolve('audio');
      } catch (e) { /* respaldo */ }
    }
    return playLive(kind);
  }

  var resetCache = function () {
    Object.keys(cache).forEach(function (k) { URL.revokeObjectURL(cache[k]); });
    cache = {};
  };

  root.Sound = {
    SETS: Object.keys(SETS),
    unlock: unlock,
    play: play,
    prepare: prepare,
    setSet: function (name) {
      if (!SETS[name] || name === soundSet) return;
      soundSet = name; prepare();
    },
    setVolume: function (v) {
      v = Math.min(1, Math.max(0, v));
      if (v === volume) return;
      volume = v; resetCache(); prepare();
    },
    setEnabled: function (on) { enabled = !!on; }
  };
})(window);
