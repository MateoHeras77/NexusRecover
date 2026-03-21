# PRD-06 — Passenger Journey Cards

## Resumen
Panel lateral deslizable que muestra el resultado de recuperación para cada grupo de pasajeros como tarjetas individuales con iconografía clara. Humaniza los datos del optimizer convirtiendo `pax_results[]` en historias de viajeros concretos.

---

## Problema que resuelve

Los KPIs actuales tratan a los pasajeros como números agregados ("312 PAX protected"). Las Passenger Journey Cards muestran *quiénes* son esos pasajeros, *por qué* pudieron conectar o no, y *qué les costó* a la aerolínea. Es el feature que conecta emocionalmente al jurado con el problema.

---

## Usuarios objetivo

- Jueces de hackathon evaluando Utilidad y Experiencia de Usuario
- Operadores de IRROPS que necesitan comunicar el impacto a jefes de cabina / supervisores

---

## Funcionalidad requerida

### F1 — Panel de tarjetas

Un panel deslizable (slide-in desde la derecha o como overlay) con scroll vertical. Cada grupo de PAX del escenario tiene una tarjeta.

**Trigger de apertura:**
- Botón `"Passengers"` en el header (step 2 y 3)
- Click en un flujo (link) del Sankey abre el panel filtrado por ese grupo

### F2 — Estructura de cada tarjeta

```
┌─────────────────────────────────────────────────┐
│  [✓] PG-01                          BUSINESS    │
│                                                  │
│  ✈ AC418 → ✈ AC301                              │
│  33 pax arriving YYZ  →  connecting to Toronto  │
│                                                  │
│  ETA 09:14  ·  ETD 10:02  ·  MCT 75min          │
│  Window: 48min  ✗ → 68min  ✓ (after hold)       │
│                                                  │
│  Outcome: CONNECTION MADE                        │
│  Cost avoided: $58,245                           │
└─────────────────────────────────────────────────┘
```

Campos de cada tarjeta:

| Campo | Fuente |
|-------|--------|
| Group ID | `pax_groups[].group_id` |
| Tier badge | `pax_groups[].tier` (Business / Economy) |
| PAX count | `pax_groups[].count` |
| Inbound flight | `pax_groups[].inbound_flight_id` → vuelo entrante |
| Outbound flight | `pax_groups[].outbound_flight_id` → vuelo saliente |
| ETA del inbound | `inbound_flights[].eta_min` → convertido a clock |
| ETD del outbound | `optimizeResult.flight_decisions[].etd_final_min` → clock |
| MCT | Derivado del tipo de vuelo (75min internacional, 45min doméstico) |
| Window antes/después | Calculado: `std_min - eta_min` vs `(std_min + delay) - eta_min` |
| Connection status | `optimizeResult.pax_results[].connection_made` |
| Cost avoided / Cost stranded | `pax_results[].cost_stranded_usd` |

### F3 — Estados visuales por outcome

**CONNECTION MADE (verde):**
```css
border: border-green-800/40
background: bg-green-950/20
header badge: bg-green-500/20 text-green-400  "✓ CONNECTED"
icon: ✓ verde
```

**STRANDED (rojo):**
```css
border: border-red-800/40
background: bg-red-950/20
header badge: bg-red-500/20 text-red-400  "✗ STRANDED"
icon: ✗ rojo
cost displayed: stranded cost (hotel + rebooking)
```

**AT RISK — solo en step 2 (amber):**
```css
border: border-amber-800/40
background: bg-amber-950/20
header badge: bg-amber-500/20 text-amber-400  "⚠ AT RISK"
```

### F4 — Indicador de "por qué pudo conectar"

En tarjetas de grupo CONNECTED que requirieron acción del optimizer, mostrar el motivo:

```
Why connected:
  AC301 held +68min  →  window grew 48m → 116m  ✓
```

En tarjetas STRANDED:
```
Why stranded:
  AC205 not held (cost $24,600 > saving $13,950)
  Optimizer chose not to delay
```

### F5 — Sorting y filtrado

Controles en el header del panel:
- Sort: "Business first" / "At risk first" / "Cost descending"
- Filter: mostrar solo CONNECTED / STRANDED / ALL

### F6 — Vinculación con Sankey (bidireccional)

- Al hacer hover en una tarjeta, el flujo correspondiente en el Sankey se resalta
- Al hacer click en un flujo del Sankey, el panel de cards se abre y hace scroll hasta la tarjeta correspondiente

Implementado a través de `selectedFlightId` ya existente en el store + nuevo `selectedGroupId`.

### F7 — Header del panel con resumen

```
┌──────────────────────────────────────────┐
│  Passenger Journey Results          [✕] │
│  ────────────────────────────────────   │
│  ✓ 8 groups connected  ·  ✗ 2 stranded │
│  $73,590 stranded cost avoided           │
└──────────────────────────────────────────┘
```

---

## Fuente de datos

```js
// En PassengerJourneyCards.jsx
const { scenario, optimizeResult, timelineStep } = useStore()

// Construir tarjetas enriquecidas
const cards = scenario.pax_groups.map(pg => {
  const inb = scenario.inbound_flights.find(f => f.flight_id === pg.inbound_flight_id)
  const out = scenario.outbound_flights.find(f => f.flight_id === pg.outbound_flight_id)
  const fd = optimizeResult?.flight_decisions.find(f => f.flight_id === pg.outbound_flight_id)
  const pr = optimizeResult?.pax_results.find(r => r.group_id === pg.group_id)

  const mct = /* derivar de tipo de vuelo */ 75
  const windowBefore = out.std_min - inb.eta_min
  const windowAfter = fd ? (out.std_min + fd.delay_applied_min) - inb.eta_min : windowBefore

  return {
    ...pg,
    inbound: inb,
    outbound: out,
    flightDecision: fd,
    paxResult: pr,
    mct,
    windowBefore,
    windowAfter,
    connectionMade: pr?.connection_made ?? (windowBefore >= mct),
  }
})
```

---

## Diseño visual

### Panel contenedor

```
position: fixed right-0 top-0 bottom-0
width: 360px
bg-slate-900 border-l border-slate-700/50
z-index: 40 (debajo del chat)
transform: translateX(100%) → translateX(0) (slide-in animation)
transition: 300ms ease-out
```

### Tarjeta individual

```
Padding: px-4 py-3
Margin: mb-2
Border-radius: rounded-lg
Border: 1px border-slate-700/40 (default) o color por estado
Font sizes: text-xs para todo el contenido
```

### Tier badge

```
BUSINESS: bg-purple-500/20 text-purple-300 text-[10px] px-1.5 rounded
ECONOMY:  bg-blue-500/20 text-blue-300 text-[10px] px-1.5 rounded
```

### Ícono de status (esquina superior izquierda de la tarjeta)

```
CONNECTED: <CheckCircle size={14} className="text-green-400" />
STRANDED:  <XCircle size={14} className="text-red-400" />
AT RISK:   <AlertTriangle size={14} className="text-amber-400" />
```

---

## Dependencias técnicas

Ninguna nueva. Usa `lucide-react` (ya instalado) para los íconos y Tailwind para el styling.

---

## Archivos a crear / modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/PassengerJourneyCards.jsx` | **NUEVO** — panel completo con cards |
| `frontend/src/store/useStore.js` | Añadir `journeyPanelOpen`, `toggleJourneyPanel`, `selectedGroupId`, `setSelectedGroup` |
| `frontend/src/App.jsx` | Añadir botón "Passengers" en header y `<PassengerJourneyCards />` en layout |
| `frontend/src/components/SankeyDiagram.jsx` | Click en link → `setSelectedGroup(link.group_id)` + abrir panel |

---

## Comportamiento por step

| Step | Estado del panel |
|------|-----------------|
| 0 | No disponible |
| 1, 2 | Disponible (muestra estado "at risk" — sin resultado real) |
| 3 | Disponible con datos completos del optimizer |

---

## Criterios de aceptación

- [ ] El panel se abre con animación slide-in desde la derecha
- [ ] Cada grupo de PAX del escenario tiene una tarjeta
- [ ] Tarjetas CONNECTED tienen borde verde y muestran "Cost avoided: $X"
- [ ] Tarjetas STRANDED tienen borde rojo y muestran "Stranded cost: $X"
- [ ] La sección "Why connected/stranded" explica la lógica del optimizer
- [ ] Hovering en una tarjeta resalta el flujo en el Sankey
- [ ] Click en un flujo del Sankey abre el panel y hace scroll a la tarjeta
- [ ] El sort "Business first" funciona correctamente
- [ ] El panel se puede cerrar con el botón ✕

---

## Prioridad hackathon: MEDIA
**Por qué:** Es el feature que más humaniza la app. Las otras visualizaciones son técnicas (Sankey, waterfall, mapa); las Journey Cards hablan de *personas*. En el criterio de Experiencia de Usuario es posiblemente el de mayor impacto emocional. Complementa perfectamente al Comparison Mode para la narrativa de la demo.
