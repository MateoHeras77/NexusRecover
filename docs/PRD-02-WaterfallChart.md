# PRD-02 — Waterfall Chart: Desglose de Costos

## Resumen
Gráfica de barras tipo waterfall que descompone visualmente cómo el optimizer transforma el costo baseline en el costo optimizado. Muestra el valor exacto de cada decisión (cuánto ahorra cada vuelo retenido, cada desvío) de forma narrativa y secuencial.

---

## Problema que resuelve

Los KPIs actuales muestran el resultado final ("ahorraste $X") pero no explican el *proceso*. Un juez técnico quiere entender qué parte del ahorro vino de cada decisión. El waterfall chart convierte el optimizer en una historia visual de decisiones.

---

## Usuarios objetivo

- Jueces técnicos evaluando la lógica del optimizer
- Operadores que quieren justificar cada decisión operativa ante sus superiores

---

## Funcionalidad requerida

### F1 — Estructura del waterfall

El gráfico tiene esta secuencia de columnas:

```
[Baseline] → [-delay AC301] → [-delay AC205] → [-divert AC418] → ... → [Optimized]
```

Cada columna intermedia representa el costo delta de una decisión del optimizer. Las columnas pueden ser positivas (costos que se evitan = ahorro, color verde) o negativas (costos que se incurren = gasto, color rojo/amber).

**Tipos de columnas:**

| Tipo | Color | Descripción |
|------|-------|-------------|
| Baseline | Rojo oscuro | Costo total sin intervención |
| Delay cost | Amber | Costo operacional del retraso aplicado |
| PAX saved | Verde | Ahorro por pasajeros que sí conectaron |
| Diversion cost | Naranja | Costo de transporte al alterno |
| Optimized | Azul | Costo total final |

### F2 — Datos mostrados por columna

Al hacer hover en una barra:
- Nombre de la decisión (ej. "AC301 held +68min")
- Costo delta en USD (ej. "-$9,860")
- Descripción corta (ej. "Operational delay cost for B777")

### F3 — Animación de entrada
Las barras se dibujan secuencialmente de izquierda a derecha con un delay de 100ms entre cada una, simulando que el optimizer está "tomando" cada decisión en orden. Solo se activa cuando el usuario llega a step 3 por primera vez.

### F4 — Línea de baseline
Una línea horizontal punteada gris marca el nivel del baseline a lo largo de toda la gráfica, haciendo visual cuánto se bajó el costo total.

### F5 — Tooltip con contexto del optimizer
El tooltip de cada barra de "PAX saved" también muestra:
- Cuántos PAX protegió esa decisión
- Tier (business/economy) y costo evitado por PAX

---

## Fuente de datos

Requiere construir la serie waterfall a partir de `optimizeResult`:

```js
// Función a crear en frontend/src/lib/waterfall.js
function buildWaterfallSeries(optimizeResult) {
  const steps = []
  let running = optimizeResult.baseline_cost_usd

  // Paso 1: baseline
  steps.push({ label: 'Baseline', value: running, type: 'baseline' })

  // Paso 2: por cada decisión de vuelo con delay > 0
  for (const fd of optimizeResult.flight_decisions) {
    if (fd.delay_applied_min > 0) {
      const delta = -fd.cost_delay_usd  // negativo = costo
      steps.push({ label: fd.flight_id, delta, type: 'delay_cost', ... })
      running += delta
    }
  }

  // Paso 3: por cada grupo de PAX que conectó
  for (const pr of optimizeResult.pax_results) {
    if (pr.connection_made) {
      const delta = pr.cost_stranded_usd  // positivo = ahorro
      steps.push({ label: pr.group_id, delta, type: 'pax_saved', ... })
      running += delta
    }
  }

  // Paso 4: costos de desvío
  for (const id of optimizeResult.inbound_decisions) {
    if (id.diverted_to) {
      const delta = -id.diversion_cost_usd
      steps.push({ label: id.flight_id, delta, type: 'diversion', ... })
      running += delta
    }
  }

  // Final: optimized total
  steps.push({ label: 'Optimized', value: optimizeResult.optimized_cost_usd, type: 'result' })
  return steps
}
```

---

## Diseño visual

### Dimensiones
- Ancho: 100% del contenedor
- Alto: ~220px — compacto para no dominar el layout

### Layout
El WaterfallChart se muestra en un panel que aparece debajo del SankeyDiagram en step 3, o como una pestaña adicional en la zona central. Tiene un header: `"Cost Breakdown — How the optimizer saved $X,XXX"`.

### Escala del eje Y
- Eje Y en USD (formato `$XX,XXX`)
- Las barras de ahorro van hacia arriba desde la línea del running total
- Las barras de costo van hacia abajo

### Colores por tipo
```css
baseline:    #ef4444  /* red-500 */
delay_cost:  #f59e0b  /* amber-400 — costo necesario */
pax_saved:   #22c55e  /* green-500 — ahorro generado */
diversion:   #f97316  /* orange-500 — costo de alternos */
result:      #3b82f6  /* blue-500 — resultado final */
```

---

## Dependencias técnicas

| Opción | Biblioteca | Pros | Contras |
|--------|-----------|------|---------|
| A (recomendada) | `recharts` | Fácil, React-native, animaciones built-in | Nueva dependencia (`npm install recharts`) |
| B | `d3` (ya instalado) | Sin nueva dependencia | Más código, SVG manual |

Con Recharts, el waterfall se puede implementar usando `ComposedChart` con barras apiladas (la técnica estándar para waterfalls en Recharts).

---

## Archivos a crear / modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/WaterfallChart.jsx` | **NUEVO** — componente completo |
| `frontend/src/lib/waterfall.js` | **NUEVO** — función `buildWaterfallSeries()` |
| `frontend/src/App.jsx` | Mostrar `<WaterfallChart />` en step 3 (debajo del Sankey o en tab) |

---

## Comportamiento por step

| Step | Estado del componente |
|------|-----------------------|
| 0, 1, 2 | No renderiza (o muestra estado vacío con mensaje "Run optimizer to see cost breakdown") |
| 3 | Renderiza con animación de entrada secuencial |

---

## Criterios de aceptación

- [ ] El gráfico aparece únicamente en step 3 después de correr el optimizer
- [ ] La suma de todos los deltas + baseline = optimized cost (matemáticamente consistente)
- [ ] Hovering en cada barra muestra el tooltip con detalle de la decisión
- [ ] La animación de entrada es secuencial (no todas las barras de golpe)
- [ ] La línea de baseline es visible como referencia horizontal
- [ ] Los colores distinguen claramente costos (rojo/amber) de ahorros (verde)

---

## Prioridad hackathon: ALTA
**Por qué:** Los jueces técnicos van a querer entender el valor del optimizer. Este chart convierte una caja negra en una narrativa de decisiones comprensible. Es el feature que mejor demuestra la implementación técnica sin necesidad de leer código.
