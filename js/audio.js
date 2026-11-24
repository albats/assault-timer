/*
 * Pitidos generados con Web Audio (sin archivos de sonido).
 * Los navegadores móviles solo permiten sonido tras un toque del usuario:
 * llama a Sound.unlock() dentro del manejador del botón «Iniciar».
 */
(function (root) {
  'use strict';

  var ctx = null;
  var volume = 0.8;
  var enabled = true;

  function getCtx() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  /** Activa el audio. Debe llamarse desde un gesto del usuario. */
  function unlock() {
    // Safari 17+: reproduce aunque el interruptor de silencio esté activado.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* no soportado */ }
    var c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    // Un buffer vacío "despierta" el audio en iOS.
    try {
      var buf = c.createBuffer(1, 1, 22050);
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch (e) { /* ignorar */ }
  }

  function tone(freq, start, duration, type, peak) {
    var c = getCtx();
    if (!c) return;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    var level = Math.max(0.0001, (peak || 1) * volume);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.015);
    gain.gain.setValueAtTime(level, start + Math.max(0.02, duration - 0.06));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function play(kind) {
    if (!enabled || volume <= 0) return;
    var c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    var t0 = c.currentTime + 0.02;
    switch (kind) {
      case 'warn': // aviso de 10 s: dos pitidos cortos y agudos
        tone(1320, t0, 0.12, 'sine', 0.7);
        tone(1320, t0 + 0.2, 0.12, 'sine', 0.7);
        break;
      case 'end': // fin de fase: un pitido largo y más grave
        tone(660, t0, 0.9, 'triangle', 1);
        tone(990, t0, 0.9, 'sine', 0.35);
        break;
      case 'done': // fin de sesión: tres pitidos ascendentes
        tone(660, t0, 0.25, 'triangle', 1);
        tone(880, t0 + 0.35, 0.25, 'triangle', 1);
        tone(1100, t0 + 0.7, 0.6, 'triangle', 1);
        break;
    }
  }

  root.Sound = {
    unlock: unlock,
    play: play,
    setVolume: function (v) { volume = Math.min(1, Math.max(0, v)); },
    setEnabled: function (on) { enabled = !!on; }
  };
})(window);
