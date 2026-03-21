# PRD-05 — Animated Timeline con Reloj Simulado

## Resumen
Un reloj digital que muestra la hora de simulación corriendo en tiempo real mientras el usuario avanza por los steps. Cada step representa un momento específico en la cronología del incidente IRROPS. Crea urgencia operacional y hace que la demo se sienta como una sala de operaciones real.

---

## Problema que resuelve

La UI actual es estática — el usuario hace click en los steps pero no hay sensación de tiempo ni urgencia. En un incidente IRROPS real, cada minuto que pasa sin decisión cuesta dinero. El reloj simulado crea esa presión y hace que el demo cuente una *historia en tiempo real*.

---

## Usuarios objetivo

- Jueces en una demo en vivo (efecto dramático)
- Operadores que necesitan internalizar que IRROPS es time-sensitive

---

## Cronología del escenario YYZ

| Step | Nombre | Hora simulada | Evento |
|------|--------|--------------|--------|
| 0 | Normal Ops | 07:30 | Operaciones normales. Vuelos en ruta. |
| 1 | Storm Hits | 08:15 | Tormenta declarada. GDP activo. |
| 2 | Chaos | 09:45 | Vuelos acumulados. Capacidad saturada. |
| 3 | Nexus Plan | 10:02 | Optimizer ejecutado. Plan en marcha. |

*(La hora base `sim_start_clock` del escenario es configurable desde el backend.)*

---

## Funcionalidad requerida

### F1 — Reloj digital en el header

Display principal de la hora simulada, ubicado en el header de la aplicación junto al nombre del hub y el badge de estado.

**Formato:** `HH:MM` en fuente monospaced grande (24px+)
**Sub-label:** Fecha simulada: `"Thu 21 Nov · YYZ OCC"`

### F2 — Transición de reloj entre steps

Al hacer click en un step del Timeline:
1. El reloj actual se congela brevemente (200ms)
2. Un contador animado avanza rápidamente desde la hora del step anterior hasta la hora del nuevo step (efecto "rolling digits" — como un odómetro)
3. El proceso completo dura 800ms

**Técnica:** Animar con `requestAnimationFrame` interpolando entre los dos valores de minutos totales.

### F3 — Tick en tiempo real (modo idle)

Cuando el usuario está viendo un step sin hacer nada, el reloj avanza 1 minuto simulado cada 4 segundos reales. Esto crea la sensación de que el tiempo está corriendo en background.

Regla: Solo corre mientras se está *dentro* del step actual. Al cambiar de step, el reloj salta instantáneamente (con animación rolling) a la hora exacta del step destino.

### F4 — Badge de estado vinculado a la hora

El badge de estado del header (ya existente) debe actualizarse en sincronía con el reloj:

| Rango de hora | Badge |
|--------------|-------|
| antes de 08:15 | `● NORMAL OPS` (verde) |
| 08:15 – 09:44 | `▲ GDP ACTIVE` (naranja, animate-pulse) |
| 09:45 – 10:01 | `⚠ CRITICAL` (rojo, animate-pulse rápido) |
| 10:02+ | `✓ PLAN ACTIVE` (amber) |

### F5 — Indicador "Time Since Disruption"

Bajo el reloj principal, un contador secundario en rojo/naranja que muestra cuánto tiempo lleva la disrupción:

```
  10:02
  ──────────────────
  T+1h 47m since GDP declared
```

Al llegar a step 3, cambia a:
```
  Recovery decision made in < 1 min
```

### F6 — Urgency pulse en step 2

En el step "Chaos" (step 2), el fondo del reloj tiene un pulso rojo muy sutil (`bg-red-900/10`) que late sincronizado con el animate-pulse del badge. Crea la sensación de alerta crítica antes de que el optimizer resuelva el problema.

---

## Fuente de datos

```js
// Constantes del escenario (pueden derivarse de sim_start_clock)
const STEP_TIMES = {
  0: { hour: 7,  minute: 30, label: 'Normal Ops' },
  1: { hour: 8,  minute: 15, label: 'Storm Hits' },
  2: { hour: 9,  minute: 45, label: 'Chaos' },
  3: { hour: 10, minute: 2,  label: 'Nexus Plan' },
}

// Tiempo de GDP declarado (step 1)
const GDP_DECLARED_MINUTES = 8 * 60 + 15  // 08:15

// Estado actual del store
const { timelineStep } = useStore()
```

---

## Diseño visual

### Reloj principal

```
┌──────────────────────────────────┐
│  ✈ NexusRecover      [10:02]     │
│  YYZ · snowstorm     Thu 21 Nov  │
└──────────────────────────────────┘
```

El `[10:02]` es el componente del reloj:
- Fuente: `font-mono` (ya disponible con sistema actual)
- Tamaño: `text-2xl font-bold`
- Color: blanco en step 0/3, amber en step 1, rojo en step 2
- Los dos dígitos de los minutos tienen la animación rolling al cambiar de step

### Indicador secundario

```css
text-xs text-slate-400    /* "T+X:XX since GDP" */
text-xs text-green-400    /* "Recovery decision made in < 1 min" */
```

---

## Dependencias técnicas

Ninguna nueva. Solo React hooks (`useState`, `useEffect`, `useRef`) para la animación del reloj.

La animación rolling se implementa con CSS `transform: translateY()` en un contenedor overflow-hidden, animando 10 números del 0–9 en un scroll vertical.

---

## Archivos a crear / modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/SimClock.jsx` | **NUEVO** — componente del reloj con animación |
| `frontend/src/App.jsx` | Integrar `<SimClock />` en el header, reemplazar/extender el badge existente |

---

## Comportamiento por step

| Step → Step | Animación del reloj |
|------------|---------------------|
| 0 → 1 | +45 minutos (07:30 → 08:15), rolling de dígitos |
| 1 → 2 | +90 minutos (08:15 → 09:45), rolling de dígitos |
| 2 → 3 | +17 minutos (09:45 → 10:02), rolling de dígitos, luego badge cambia a verde |
| Cualquier → anterior | Rolling reverso (scroll hacia arriba) |

---

## Criterios de aceptación

- [ ] El reloj muestra la hora correcta para cada step
- [ ] La transición entre steps tiene animación rolling de dígitos (800ms)
- [ ] El reloj avanza en tiempo real 1min/4s cuando el usuario está idle en un step
- [ ] El color del reloj cambia según la fase (blanco/amber/rojo)
- [ ] El indicador "T+Xh Xm since GDP" es correcto en cada step
- [ ] En step 3, el indicador cambia a "Recovery decision made in < 1 min"

---

## Prioridad hackathon: MEDIA-ALTA
**Por qué:** Impacto desproporcionado en el criterio de Creatividad y Experiencia de Usuario. Cuesta relativamente poco implementar (solo CSS + JS) pero transforma completamente la sensación de la demo. En una presentación en vivo, el reloj corriendo en background hace que los jueces *sientan* la urgencia del problema aunque no sepan nada de IRROPS.
