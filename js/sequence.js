/*
 * Lógica pura de la sesión: valida la configuración y la convierte en una
 * lista ordenada de fases. Sin DOM, para poder probarla aparte.
 *
 * Configuración (tiempos en segundos):
 * {
 *   countdown: 5,
 *   useBlocks: false,
 *   simple: { rounds: 3, work: 180, rest: 60 },
 *   blocks: { count: 2, blockRest: 120, groups: [{ rounds, work, rest }, ...] }
 * }
 *
 * Modos (cfg.mode):
 *  - 'intervals': rounds de actividad/descanso, con bloques opcionales.
 *  - 'emom':      cada intervalo (p. ej. cada minuto) empieza un round, sin descanso aparte.
 *  - 'amrap':     una sola cuenta atrás larga; se cuentan las rondas a mano.
 *  - 'fortime':   cronómetro hacia arriba, con tiempo límite opcional (0 = sin límite).
 *
 * Reglas de secuencia (intervalos):
 *  - Tras cada round hay descanso, salvo tras el último round de la sesión.
 *  - Al cambiar de grupo se usa el descanso del grupo que termina.
 *  - Al cambiar de bloque, el descanso entre bloques sustituye al del round.
 *  - Un descanso de 0 s se omite.
 */
(function (root) {
  'use strict';

  var LIMITS = {
    rounds: { min: 1, max: 99 },
    blocks: { min: 1, max: 20 },
    groups: { min: 1, max: 10 },
    work: { min: 1, max: 59 * 60 + 59 },
    rest: { min: 0, max: 59 * 60 + 59 },
    interval: { min: 5, max: 59 * 60 + 59 },
    amrap: { min: 10, max: 59 * 60 + 59 },
    cap: { min: 0, max: 59 * 60 + 59 },
    countdowns: [3, 5, 10, 15, 30]
  };
  var MODES = ['intervals', 'emom', 'amrap', 'fortime'];
  var OPEN = 24 * 3600; // For Time sin límite

  function clampInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  }

  function defaultConfig() {
    return {
      mode: 'intervals',
      countdown: 5,
      useBlocks: false,
      simple: { rounds: 3, work: 180, rest: 60 },
      blocks: {
        count: 2,
        blockRest: 120,
        groups: [
          { rounds: 3, work: 180, rest: 60 },
          { rounds: 3, work: 120, rest: 60 }
        ]
      },
      emom: { rounds: 10, interval: 60 },
      amrap: { duration: 12 * 60 },
      fortime: { cap: 15 * 60 }
    };
  }

  function normalizeGroup(g) {
    g = g || {};
    return {
      rounds: clampInt(g.rounds, LIMITS.rounds.min, LIMITS.rounds.max, 3),
      work: clampInt(g.work, LIMITS.work.min, LIMITS.work.max, 180),
      rest: clampInt(g.rest, LIMITS.rest.min, LIMITS.rest.max, 60)
    };
  }

  /** Devuelve una copia saneada de la configuración (nunca lanza). */
  function normalizeConfig(cfg) {
    var d = defaultConfig();
    cfg = cfg || {};
    var countdown = parseInt(cfg.countdown, 10);
    if (LIMITS.countdowns.indexOf(countdown) === -1) countdown = d.countdown;
    var blocks = cfg.blocks || {};
    var groups = Array.isArray(blocks.groups) && blocks.groups.length ? blocks.groups : d.blocks.groups;
    var emom = cfg.emom || {};
    var amrap = cfg.amrap || {};
    var fortime = cfg.fortime || {};
    return {
      mode: MODES.indexOf(cfg.mode) === -1 ? 'intervals' : cfg.mode,
      countdown: countdown,
      useBlocks: !!cfg.useBlocks,
      simple: normalizeGroup(cfg.simple || d.simple),
      blocks: {
        count: clampInt(blocks.count, LIMITS.blocks.min, LIMITS.blocks.max, d.blocks.count),
        blockRest: clampInt(blocks.blockRest, LIMITS.rest.min, LIMITS.rest.max, d.blocks.blockRest),
        groups: groups.slice(0, LIMITS.groups.max).map(normalizeGroup)
      },
      emom: {
        rounds: clampInt(emom.rounds, LIMITS.rounds.min, LIMITS.rounds.max, d.emom.rounds),
        interval: clampInt(emom.interval, LIMITS.interval.min, LIMITS.interval.max, d.emom.interval)
      },
      amrap: { duration: clampInt(amrap.duration, LIMITS.amrap.min, LIMITS.amrap.max, d.amrap.duration) },
      fortime: { cap: clampInt(fortime.cap, LIMITS.cap.min, LIMITS.cap.max, d.fortime.cap) }
    };
  }

  /**
   * Convierte la configuración en fases.
   * Cada fase: { type: 'prep'|'work'|'rest'|'blockRest', duration,
   *   round, roundsInGroup, group, groupCount, block, blockCount,
   *   roundOverall, totalRounds }
   */
  function buildPhases(rawCfg) {
    var cfg = normalizeConfig(rawCfg);
    if (cfg.mode !== 'intervals') return buildModePhases(cfg);
    var groups = cfg.useBlocks ? cfg.blocks.groups : [cfg.simple];
    var blockCount = cfg.useBlocks ? cfg.blocks.count : 1;
    var roundsPerBlock = groups.reduce(function (s, g) { return s + g.rounds; }, 0);
    var totalRounds = roundsPerBlock * blockCount;
    var phases = [];
    var overall = 0;

    if (cfg.countdown > 0) {
      phases.push({ type: 'prep', duration: cfg.countdown });
    }

    for (var b = 0; b < blockCount; b++) {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        for (var r = 0; r < g.rounds; r++) {
          overall++;
          var info = {
            round: r + 1,
            roundsInGroup: g.rounds,
            group: gi + 1,
            groupCount: groups.length,
            block: b + 1,
            blockCount: blockCount,
            roundOverall: overall,
            totalRounds: totalRounds
          };
          phases.push(Object.assign({ type: 'work', duration: g.work }, info));

          var isLastOfSession = overall === totalRounds;
          if (isLastOfSession) continue;
          var isLastOfBlock = gi === groups.length - 1 && r === g.rounds - 1;
          if (isLastOfBlock) {
            if (cfg.blocks.blockRest > 0) {
              phases.push(Object.assign({ type: 'blockRest', duration: cfg.blocks.blockRest }, info));
            }
          } else if (g.rest > 0) {
            phases.push(Object.assign({ type: 'rest', duration: g.rest }, info));
          }
        }
      }
    }
    return phases;
  }

  /** Fases de EMOM, AMRAP y For Time. */
  function buildModePhases(cfg) {
    var phases = [];
    if (cfg.countdown > 0) phases.push({ type: 'prep', duration: cfg.countdown });
    var one = { round: 1, roundsInGroup: 1, group: 1, groupCount: 1, block: 1, blockCount: 1, roundOverall: 1, totalRounds: 1 };
    if (cfg.mode === 'emom') {
      var n = cfg.emom.rounds;
      for (var i = 1; i <= n; i++) {
        phases.push({ type: 'work', duration: cfg.emom.interval, round: i, roundsInGroup: n, group: 1, groupCount: 1, block: 1, blockCount: 1, roundOverall: i, totalRounds: n });
      }
    } else if (cfg.mode === 'amrap') {
      phases.push(Object.assign({ type: 'work', duration: cfg.amrap.duration }, one));
    } else if (cfg.mode === 'fortime') {
      var cap = cfg.fortime.cap;
      phases.push(Object.assign({ type: 'work', duration: cap > 0 ? cap : OPEN, countUp: true, open: !(cap > 0) }, one));
    }
    return phases;
  }

  /** Duración total (sin contar un For Time sin límite). */
  function totalDuration(phases) {
    return phases.reduce(function (s, p) { return s + (p.open ? 0 : p.duration); }, 0);
  }

  function isOpen(phases) {
    return phases.some(function (p) { return p.open; });
  }

  /** 185 -> "3:05"; 3725 -> "1:02:05" */
  function formatTime(totalSeconds) {
    var s = Math.max(0, Math.round(totalSeconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    var ss = (sec < 10 ? '0' : '') + sec;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
    return m + ':' + ss;
  }

  var api = {
    LIMITS: LIMITS,
    defaultConfig: defaultConfig,
    normalizeConfig: normalizeConfig,
    buildPhases: buildPhases,
    totalDuration: totalDuration,
    isOpen: isOpen,
    MODES: MODES,
    formatTime: formatTime
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sequence = api;
})(typeof window !== 'undefined' ? window : this);
