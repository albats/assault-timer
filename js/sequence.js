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
 * Reglas de secuencia:
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
    countdowns: [3, 5, 10, 15, 30]
  };

  function clampInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  }

  function defaultConfig() {
    return {
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
      }
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
    return {
      countdown: countdown,
      useBlocks: !!cfg.useBlocks,
      simple: normalizeGroup(cfg.simple || d.simple),
      blocks: {
        count: clampInt(blocks.count, LIMITS.blocks.min, LIMITS.blocks.max, d.blocks.count),
        blockRest: clampInt(blocks.blockRest, LIMITS.rest.min, LIMITS.rest.max, d.blocks.blockRest),
        groups: groups.slice(0, LIMITS.groups.max).map(normalizeGroup)
      }
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

  function totalDuration(phases) {
    return phases.reduce(function (s, p) { return s + p.duration; }, 0);
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
    formatTime: formatTime
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sequence = api;
})(typeof window !== 'undefined' ? window : this);
