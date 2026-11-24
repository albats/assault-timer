/* Textos de la interfaz en español e inglés. */
(function (root) {
  'use strict';

  var STRINGS = {
    es: {
      'app.tagline': 'Temporizador de rounds',
      'home.new': 'Nueva sesión',
      'home.presets': 'Mis presets',
      'home.empty': 'Aún no tienes presets. Crea una sesión y guárdala con un nombre.',
      'home.settings': 'Ajustes',
      'preset.edit': 'Editar',
      'preset.duplicate': 'Duplicar',
      'preset.delete': 'Borrar',
      'preset.copySuffix': '(copia)',
      'preset.start': 'Iniciar',
      'preset.confirmDelete': '¿Borrar el preset «{name}»?',
      'preset.blocksSummary': '{blocks} bloques · {groups} grupos',
      'preset.blockSummary': '1 bloque · {groups} grupos',

      'editor.titleNew': 'Nueva sesión',
      'editor.titleEdit': 'Editar preset',
      'editor.countdown': 'Cuenta atrás inicial',
      'editor.rounds': 'Rounds',
      'editor.work': 'Actividad',
      'editor.rest': 'Descanso',
      'editor.useBlocks': 'Usar bloques',
      'editor.useBlocksHint': 'Repite varios grupos de rounds, cada uno con sus tiempos.',
      'editor.blocks': 'Número de bloques',
      'editor.blockRest': 'Descanso entre bloques',
      'editor.group': 'Grupo {letter}',
      'editor.addGroup': 'Añadir grupo',
      'editor.removeGroup': 'Quitar grupo',
      'editor.moveUp': 'Subir',
      'editor.moveDown': 'Bajar',
      'editor.total': 'Duración total',
      'editor.totalRounds': '{n} rounds',
      'editor.start': 'Iniciar',
      'editor.save': 'Guardar preset',
      'editor.saveChanges': 'Guardar cambios',
      'editor.saveAsNew': 'Guardar como nuevo',
      'editor.invalid': 'Revisa los tiempos: la actividad debe durar al menos 1 segundo.',
      'editor.min': 'min',
      'editor.sec': 's',

      'save.title': 'Guardar preset',
      'save.name': 'Nombre',
      'save.placeholder': 'Ej. Boxeo martes',
      'save.exists': 'Ya existe un preset con ese nombre. ¿Sobrescribirlo?',
      'save.empty': 'Escribe un nombre.',
      'save.saved': 'Preset guardado',

      'timer.prep': 'Prepárate',
      'timer.work': 'Actividad',
      'timer.rest': 'Descanso',
      'timer.blockRest': 'Descanso entre bloques',
      'timer.paused': 'En pausa',
      'timer.done': '¡Sesión completada!',
      'timer.round': 'Round {n}/{total}',
      'timer.group': 'Grupo {letter}',
      'timer.block': 'Bloque {n}/{total}',
      'timer.next': 'Siguiente: {what}',
      'timer.nextEnd': 'Siguiente: fin',
      'timer.remaining': 'Restante {time}',
      'timer.pause': 'Pausa',
      'timer.resume': 'Reanudar',
      'timer.skip': 'Saltar fase',
      'timer.prev': 'Fase anterior',
      'timer.exit': 'Salir',
      'timer.confirmExit': '¿Salir de la sesión? Se perderá el progreso.',
      'timer.repeat': 'Repetir',
      'timer.home': 'Volver al inicio',
      'timer.duration': 'Duración: {time}',
      'timer.wakeOn': 'Pantalla siempre encendida',
      'timer.wakeOff': 'Este navegador no puede mantener la pantalla encendida',
      'timer.tapToResume': 'Toca Reanudar para continuar',

      'settings.title': 'Ajustes',
      'settings.language': 'Idioma',
      'settings.theme': 'Tema',
      'settings.themeSystem': 'Sistema',
      'settings.themeLight': 'Claro',
      'settings.themeDark': 'Oscuro',
      'settings.sound': 'Sonido',
      'settings.volume': 'Volumen',
      'settings.vibration': 'Vibración',
      'settings.vibrationUnsupported': 'No disponible en este dispositivo',
      'settings.tapPause': 'Tocar la pantalla para pausar',
      'settings.test': 'Probar sonidos',
      'settings.testWarn': 'Aviso 10 s',
      'settings.testEnd': 'Fin de fase',
      'settings.testDone': 'Fin de sesión',
      'settings.iosHint': 'En iPhone: si no oyes nada, sube el volumen y revisa el interruptor de silencio.',
      'settings.install': 'Instalar en el móvil',
      'settings.installIos': 'iPhone/iPad: Safari → Compartir → «Añadir a pantalla de inicio».',
      'settings.installAndroid': 'Android: Chrome → menú ⋮ → «Instalar app».',
      'settings.version': 'Versión {v}',

      'common.back': 'Atrás',
      'common.cancel': 'Cancelar',
      'common.ok': 'Aceptar',
      'common.yes': 'Sí',
      'common.delete': 'Borrar',
      'common.close': 'Cerrar',
      'common.more': 'Más opciones',

      'seed.boxing': 'Boxeo',
      'seed.tabata': 'Tabata',
      'seed.blocks': 'Bloques 3:00 + 2:00'
    },
    en: {
      'app.tagline': 'Round timer',
      'home.new': 'New session',
      'home.presets': 'My presets',
      'home.empty': 'No presets yet. Create a session and save it with a name.',
      'home.settings': 'Settings',
      'preset.edit': 'Edit',
      'preset.duplicate': 'Duplicate',
      'preset.delete': 'Delete',
      'preset.copySuffix': '(copy)',
      'preset.start': 'Start',
      'preset.confirmDelete': 'Delete preset “{name}”?',
      'preset.blocksSummary': '{blocks} blocks · {groups} groups',
      'preset.blockSummary': '1 block · {groups} groups',

      'editor.titleNew': 'New session',
      'editor.titleEdit': 'Edit preset',
      'editor.countdown': 'Start countdown',
      'editor.rounds': 'Rounds',
      'editor.work': 'Work',
      'editor.rest': 'Rest',
      'editor.useBlocks': 'Use blocks',
      'editor.useBlocksHint': 'Repeat several groups of rounds, each with its own times.',
      'editor.blocks': 'Number of blocks',
      'editor.blockRest': 'Rest between blocks',
      'editor.group': 'Group {letter}',
      'editor.addGroup': 'Add group',
      'editor.removeGroup': 'Remove group',
      'editor.moveUp': 'Move up',
      'editor.moveDown': 'Move down',
      'editor.total': 'Total time',
      'editor.totalRounds': '{n} rounds',
      'editor.start': 'Start',
      'editor.save': 'Save preset',
      'editor.saveChanges': 'Save changes',
      'editor.saveAsNew': 'Save as new',
      'editor.invalid': 'Check the times: work must last at least 1 second.',
      'editor.min': 'min',
      'editor.sec': 's',

      'save.title': 'Save preset',
      'save.name': 'Name',
      'save.placeholder': 'e.g. Tuesday boxing',
      'save.exists': 'A preset with that name already exists. Overwrite it?',
      'save.empty': 'Enter a name.',
      'save.saved': 'Preset saved',

      'timer.prep': 'Get ready',
      'timer.work': 'Work',
      'timer.rest': 'Rest',
      'timer.blockRest': 'Rest between blocks',
      'timer.paused': 'Paused',
      'timer.done': 'Session complete!',
      'timer.round': 'Round {n}/{total}',
      'timer.group': 'Group {letter}',
      'timer.block': 'Block {n}/{total}',
      'timer.next': 'Next: {what}',
      'timer.nextEnd': 'Next: finish',
      'timer.remaining': '{time} left',
      'timer.pause': 'Pause',
      'timer.resume': 'Resume',
      'timer.skip': 'Skip phase',
      'timer.prev': 'Previous phase',
      'timer.exit': 'Exit',
      'timer.confirmExit': 'Leave the session? Progress will be lost.',
      'timer.repeat': 'Repeat',
      'timer.home': 'Back to home',
      'timer.duration': 'Duration: {time}',
      'timer.wakeOn': 'Screen stays on',
      'timer.wakeOff': 'This browser can’t keep the screen on',
      'timer.tapToResume': 'Tap Resume to continue',

      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'settings.themeSystem': 'System',
      'settings.themeLight': 'Light',
      'settings.themeDark': 'Dark',
      'settings.sound': 'Sound',
      'settings.volume': 'Volume',
      'settings.vibration': 'Vibration',
      'settings.vibrationUnsupported': 'Not available on this device',
      'settings.tapPause': 'Tap the screen to pause',
      'settings.test': 'Test sounds',
      'settings.testWarn': '10 s warning',
      'settings.testEnd': 'End of phase',
      'settings.testDone': 'End of session',
      'settings.iosHint': 'On iPhone: if you hear nothing, turn the volume up and check the silent switch.',
      'settings.install': 'Install on your phone',
      'settings.installIos': 'iPhone/iPad: Safari → Share → “Add to Home Screen”.',
      'settings.installAndroid': 'Android: Chrome → ⋮ menu → “Install app”.',
      'settings.version': 'Version {v}',

      'common.back': 'Back',
      'common.cancel': 'Cancel',
      'common.ok': 'OK',
      'common.yes': 'Yes',
      'common.delete': 'Delete',
      'common.close': 'Close',
      'common.more': 'More options',

      'seed.boxing': 'Boxing',
      'seed.tabata': 'Tabata',
      'seed.blocks': 'Blocks 3:00 + 2:00'
    }
  };

  var current = 'es';

  function detect() {
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
    return /^es\b/i.test(nav) ? 'es' : 'en';
  }

  function setLang(lang) {
    current = STRINGS[lang] ? lang : 'es';
    document.documentElement.lang = current;
  }

  function t(key, vars) {
    var str = (STRINGS[current] && STRINGS[current][key]) || STRINGS.es[key] || key;
    if (vars) {
      str = str.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] !== undefined ? vars[k] : m;
      });
    }
    return str;
  }

  /** Rellena los elementos con data-i18n / data-i18n-attr. */
  function apply(scope) {
    var rootEl = scope || document;
    rootEl.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    rootEl.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      // formato: "aria-label:clave;placeholder:clave"
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length === 2) el.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });
  }

  root.I18n = {
    detect: detect,
    setLang: setLang,
    t: t,
    apply: apply,
    get lang() { return current; }
  };
})(window);
