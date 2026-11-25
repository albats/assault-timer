# Ring Timer

Temporizador de rounds gratuito para entrenar: tiempo de actividad y de descanso, bloques de rounds, cuenta atrás inicial, presets con nombre, modo claro/oscuro y español/inglés. Es una web instalable (PWA): no necesita tienda de apps ni servidor.

## Funcionalidades (v1.3.0)

- **Tipos de sesión:** intervalos, EMOM (cada intervalo empieza un round), AMRAP (cuenta atrás con contador de rondas) y For Time (cronómetro hacia arriba con vueltas y tiempo límite opcional).
- **Sesión simple:** rounds (1–99), actividad y descanso en mm:ss.
- **Bloques (opcional):** N bloques (1–20), cada uno con varios grupos de rounds (cada grupo con sus propios tiempos) y descanso entre bloques.
- **Cuenta atrás inicial:** 3, 5 (por defecto), 10, 15 o 30 s.
- **Sonidos:** campana de boxeo por defecto. También hay pitido, silbato, gong y digital, que se eligen en Ajustes. Suena un aviso a los 10 s, otro al terminar cada fase y otro al terminar la sesión.
- **Colores:** paleta pastel de 10 colores para la pantalla de actividad (índigo por defecto) y la de descanso (rojo por defecto), con botón para restablecer (solo colores de la paleta). La pausa, la preparación, el descanso entre bloques y el final van siempre en gris. En tema oscuro los colores se oscurecen solos y el texto pasa a blanco.
- **Destello de pantalla** al cambiar de fase.
- **Botones −10 s / +10 s** para ajustar la fase en curso y botón para **reiniciar la fase** desde su tiempo completo.
- **Presets de ejemplo:** Boxeo (12 × 3:00/1:00), Tabata, bloques, EMOM 10 min, AMRAP 12 min y For Time con límite de 15 min.
- **Pantalla siempre encendida** mientras el temporizador corre (Screen Wake Lock).
- **Controles:** pausa/reanudar, saltar fase, fase anterior (si la fase lleva más de 3 s, la reinicia) y salir con confirmación.
- **Presets con nombre:** guardar, editar, duplicar y borrar. Se guardan en el propio dispositivo.
- **Ajustes:** idioma, tema (sistema/claro/oscuro), sonido y volumen, vibración (solo Android) y "tocar la pantalla para pausar".
- **Diseño adaptable:** móvil y tablet, en vertical y en horizontal.
- **Historial y resumen semanal** (botón de perfil en el inicio): cada sesión terminada se guarda con fecha, duración real sin pausas y rondas o tiempo. Las sesiones abandonadas a partir de 2 minutos se guardan como incompletas. Muestra sesiones y minutos de la semana (de lunes a domingo), un gráfico por día y la comparación con la semana pasada. Se guarda solo en el dispositivo.
- **Funciona sin conexión** una vez cargada (service worker).

### Reglas de secuencia

- Tras cada round hay descanso, salvo tras el último round de la sesión.
- Al cambiar de grupo se usa el descanso del grupo que termina.
- Al cambiar de bloque, el descanso entre bloques **sustituye** al del round.
- Un descanso de 0:00 se omite.

Ejemplo: 2 bloques × (3 rounds de 3:00/1:00 + 3 rounds de 2:00/1:00), con 2:00 entre bloques y 5 s de cuenta atrás, dura **42:05** en total.

## Estructura

```
index.html              Pantallas (inicio, editor, temporizador, ajustes)
css/styles.css          Estilos, temas y colores de fase
js/sequence.js          Lógica pura: configuración -> lista de fases
js/i18n.js              Textos ES/EN
js/audio.js             Sonidos generados por código (campana, pitido, silbato, gong, digital)
js/colors.js            Paleta, contraste del texto y modo oscuro
js/app.js               Interfaz, presets, motor del temporizador
sw.js                   Modo offline (sube CACHE al publicar cambios)
manifest.webmanifest    Nombre, icono y modo app instalable
icons/                  Iconos (SVG + PNG)
```

## Probar en el ordenador

El modo offline y la instalación necesitan `http://localhost` o `https`. Con Python instalado:

```bash
python -m http.server 8000
```

Después abre http://localhost:8000. También funciona abriendo `index.html` con doble clic, pero sin modo offline.

## Publicar gratis con GitHub Pages

1. Sube el código a un repositorio de GitHub (por ejemplo `assault-timer`):
   ```bash
   git add .
   git commit -m "Ring Timer v1.1.2"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/assault-timer.git
   git push -u origin main
   ```
2. En GitHub, ve a **Settings → Pages → Build and deployment**. En *Source* elige **Deploy from a branch** y en *Branch* elige **main**, carpeta **/(root)**.
3. En un minuto estará en `https://TU_USUARIO.github.io/assault-timer/`.

### Publicar cambios

Cambia el número de `CACHE` en `sw.js` (por ejemplo `ring-timer-v1.1.3`), `APP_VERSION` en `js/app.js` y el `?v=` de los archivos en `index.html`. Después haz commit y push. Los móviles reciben la versión nueva al abrir la app.

## Instalar en el móvil

- **iPhone/iPad:** abre el enlace en Safari → Compartir → **Añadir a pantalla de inicio**.
- **Android:** abre el enlace en Chrome → menú ⋮ → **Instalar app**.

## Notas

- **iPhone:** la pantalla encendida en la app instalada requiere iOS 18.4 o superior. En Safari funciona desde iOS 16.4.
- **Sonido:** se activa al pulsar «Iniciar». Si en iPhone no suena, sube el volumen y revisa el interruptor de silencio.
- **Vibración:** iOS no permite vibrar desde una web.
- **Segundo plano:** si sales de la app o bloqueas el móvil a mano, el sonido puede no oírse. Al volver, el reloj se pone al día solo.
- **Cambiar el nombre:** edita `<title>` y los `apple-mobile-web-app-title` de `index.html`, `.brand-name` en el mismo archivo y `name`/`short_name` en `manifest.webmanifest`.

## Ideas para siguientes versiones

- Compartir un preset por enlace.
- Sonido de campana de boxeo.
- Historial de sesiones.
