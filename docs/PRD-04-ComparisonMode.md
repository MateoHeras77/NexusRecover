# PRD-04 — Comparison Mode: Baseline vs Nexus Plan

## Resumen
Vista split que muestra el Sankey diagram en dos versiones simultáneas: izquierda "Without Intervention" (baseline — todos los pasajeros varados) y derecha "Nexus Plan" (resultado optimizado). La diferencia visual es dramática e instantánea. Disponible únicamente en step 3.

---

## Problema que resuelve

El impacto del optimizer es difícil de apreciar cuando solo se ve el estado final. Al mostrar ambos mundos lado a lado — el caos sin intervención vs el plan recuperado — el valor del sistema queda demostrado sin palabras. Es el argumento visual más poderoso de la demo.

---

## Usuarios objetivo

- Jueces de hackathon (comprensión inmediata del valor)
- Operadores que necesitan justificar la intervención ante supervisores

---

## Funcionalidad requerida

### F1 — Toggle de activación

Un botón `"Compare"` (o ícono de split-view) aparece en la barra superior al llegar a step 3. Al activarlo, la zona central se divide en dos paneles iguales.

```
┌─────────────────────┬─────────────────────┐
│   WITHOUT           │   NEXUS PLAN        │
│   INTERVENTION      │   (Optimized)       │
│                     │                     │
│  [Sankey — todos    │  [Sankey — plan     │
│   rojo/stranded]    │   verde/protected]  │
│                     │                     │
│  Cost: $XXX,XXX     │  Cost: $XX,XXX      │
└─────────────────────┴─────────────────────┘
```

### F2 — Panel izquierdo: "Without Intervention"

Muestra el Sankey con `timelineStep = 2` (chaos) y `optimizeResult = null`. Todos los flujos de pasajeros que no alcanzan conexión por timing se marcan como `stranded` (rojo). Header con badge rojo: `NO INTERVENTION`.

Sub-métricas bajo el Sankey:
- `Total cost: $XXX,XXX`
- `PAX stranded: XX`
- `Flights cancelled: X`

### F3 — Panel derecho: "Nexus Plan"

Muestra el Sankey con `timelineStep = 3` y el `optimizeResult` real. Los flujos protegidos están en verde. Header con badge verde: `NEXUS PLAN ACTIVE`.

Sub-métricas bajo el Sankey:
- `Total cost: $XX,XXX`
- `PAX protected: XX`
- `Savings: $XX,XXX ✓`

### F4 — Divider central con ahorro total

En el centro entre los dos paneles, un divisor vertical con el badge de ahorro:

```
      ───── SAVINGS ─────
           $XX,XXX
         ↓ 67% reduction
```

En verde brillante, como el punto de atención de toda la vista.

### F5 — Animación de entrada al activar Compare

Al hacer click en "Compare", la vista actual se anima partiendo en dos: la mitad izquierda se desvanece a rojo y la derecha mantiene el estado verde actual. Duración: 500ms.

### F6 — Cierre del modo comparación

Botón `✕` o `"Exit Compare"` regresa a la vista normal del Sankey.

---

## Fuente de datos

### Panel izquierdo (baseline)
El estado baseline se calcula en el frontend a partir del escenario sin optimizer. Requiere una función auxiliar que simule qué conexiones se pierden sin intervención:

```js
// frontend/src/lib/baseline.js
function computeBaselineConnections(scenario) {
  // Para cada grupo de PAX, verificar si STD_out - ETA_inb >= MCT
  // sin ningún delay aplicado al outbound
  // Retorna un array de { group_id, connection_made: boolean }
  return scenario.pax_groups.map(pg => {
    const inb = scenario.inbound_flights.find(f => f.flight_id === pg.inbound_flight_id)
    const out = scenario.outbound_flights.find(f => f.flight_id === pg.outbound_flight_id)
    const mct = pg.is_international ? 75 : 45
    return {
      group_id: pg.group_id,
      connection_made: (out.std_min - inb.eta_min) >= mct
    }
  })
}
```

### Panel derecho (nexus plan)
Directamente `optimizeResult` del store.

---

## Diseño visual

### Layout en modo comparación
- Los sidebars (FlightPanel izquierdo y derecho) se ocultan temporalmente para maximizar el espacio del split view
- Cada panel tiene `width: 50%` y `min-width: 380px`
- El Sankey en cada panel es una instancia independiente del mismo componente con props diferentes

### Colores de headers por panel

```
Panel izquierdo: bg-red-950/40 border-red-800/40
  Badge: bg-red-500/20 text-red-400 — "NO INTERVENTION"

Panel derecho: bg-green-950/40 border-green-800/40
  Badge: bg-green-500/20 text-green-400 — "NEXUS PLAN"
```

### Divider central

```
bg-slate-700/30 | w-px | altura completa
Encima: badge flotante con el savings amount
```

---

## Dependencias técnicas

Ninguna nueva. Usa componentes existentes (`SankeyDiagram`, `buildSankeyData`) con props distintas.

La clave es parametrizar `buildSankeyData` para aceptar un `optimizeResult` opcional — si es `null`, todos los PAX que no alcanzan conexión por timing se marcan como `stranded`.

---

## Archivos a crear / modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/CompareView.jsx` | **NUEVO** — layout split con dos instancias de Sankey |
| `frontend/src/lib/baseline.js` | **NUEVO** — `computeBaselineConnections()` |
| `frontend/src/lib/sankey.js` | **MODIFICAR** — hacer que `buildSankeyData` acepte `null` como `optimizeResult` y use baseline connections |
| `frontend/src/App.jsx` | Añadir estado `compareMode` y botón "Compare" en header |
| `frontend/src/store/useStore.js` | Añadir `compareMode` + `toggleCompareMode` |

---

## Estados del sistema

| Step | Botón Compare | Comportamiento |
|------|--------------|----------------|
| 0, 1, 2 | Oculto | No disponible hasta tener resultado |
| 3 (sin Compare) | Visible | Click activa el split view |
| 3 (Compare activo) | "Exit Compare" | Click regresa a vista normal |

---

## Criterios de aceptación

- [ ] El botón "Compare" solo aparece en step 3 con `optimizeResult` disponible
- [ ] El split view muestra dos Sankeys lado a lado con datos distintos
- [ ] Panel izquierdo tiene mayoría de flujos en rojo (stranded)
- [ ] Panel derecho tiene mayoría de flujos en verde (protected)
- [ ] El badge de ahorro en el divider central es correcto matemáticamente
- [ ] Los sidebars (FlightPanel) se ocultan al activar Compare
- [ ] El botón "Exit Compare" regresa correctamente a la vista normal

---

## Prioridad hackathon: ALTA
**Por qué:** Es el feature más "demo-friendly" de todos. En 3 segundos, cualquier juez entiende el valor del sistema sin leer nada. El contraste visual rojo-vs-verde es poderoso y memorable. Ideal para el momento climático de la presentación.
