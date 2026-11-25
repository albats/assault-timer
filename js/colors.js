/*
 * Colores del temporizador.
 * - Paleta pastel (tipo Notion). Actividad y descanso son personalizables.
 * - Pausa, preparación, descanso entre bloques y fin: siempre gris.
 * - Tema claro: el color tal cual y texto oscuro o blanco, el que se lea mejor.
 * - Tema oscuro: el color se oscurece hasta que el texto blanco se lee bien.
 */
(function (root) {
  'use strict';

  var PALETTE = [
    { id: 'red', hex: '#EB8781' },
    { id: 'orange', hex: '#F4AC73' },
    { id: 'yellow', hex: '#F4D165' },
    { id: 'green', hex: '#74C39A' },
    { id: 'teal', hex: '#66C0B8' },
    { id: 'blue', hex: '#72A9E4' },
    { id: 'indigo', hex: '#8C97D2' },
    { id: 'purple', hex: '#AD8DDD' },
    { id: 'pink', hex: '#E99AC2' },
    { id: 'brown', hex: '#BB9A7D' }
  ];
  var GRAY = '#9EA4AA';
  var DEFAULTS = { work: '#8C97D2', rest: '#EB8781' }; // índigo y rojo
  var INK = '#121417';

  function isHex(v) { return /^#[0-9a-f]{6}$/i.test(v || ''); }

  /** Acepta "abc", "#abc", "aabbcc" o "#aabbcc". Devuelve "#AABBCC" o null. */
  function normalizeHex(v) {
    v = String(v || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.split('').map(function (c) { return c + c; }).join('');
    return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : null;
  }

  function toRgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); }); }
  function toHex(rgb) {
    return '#' + rgb.map(function (x) { var s = Math.round(Math.max(0, Math.min(255, x))).toString(16); return s.length < 2 ? '0' + s : s; }).join('').toUpperCase();
  }
  function mix(a, b, f) { // f = cantidad de b
    var A = toRgb(a), B = toRgb(b);
    return toHex(A.map(function (x, i) { return x * (1 - f) + B[i] * f; }));
  }
  function luminance(hex) {
    var c = toRgb(hex).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Fondo y texto para un color base según el tema. */
  function resolve(base, dark) {
    if (!isHex(base)) base = GRAY;
    if (dark) {
      var f = 0.35, bg = mix(base, INK, f);
      while (contrast(bg, '#FFFFFF') < 4.5 && f < 0.9) { f += 0.02; bg = mix(base, INK, f); }
      return { bg: bg, fg: '#FFFFFF' };
    }
    // Texto oscuro teñido del propio color; si no se lee bien, blanco.
    var ink = mix(base, INK, 0.8);
    if (contrast(base, ink) < 4.5) ink = '#1E2125';
    var fg = contrast(base, ink) >= contrast(base, '#FFFFFF') ? ink : '#FFFFFF';
    return { bg: base, fg: fg };
  }

  root.Colors = {
    PALETTE: PALETTE,
    GRAY: GRAY,
    DEFAULTS: DEFAULTS,
    isHex: isHex,
    normalizeHex: normalizeHex,
    resolve: resolve,
    contrast: contrast
  };
})(window);
