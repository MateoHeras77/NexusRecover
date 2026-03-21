# PRD-01 — Mapa Geográfico Hub + Alternos

## Resumen
Panel de mapa interactivo que muestra el aeropuerto hub (YYZ) y los alternos (YTZ, YHM) con líneas de vuelo animadas. Hace el problema de IRROPS inmediatamente comprensible de forma visual y geográfica.

---

## Problema que resuelve

Actualmente el sistema no tiene contexto espacial. Un juez que no conoce la industria no entiende de inmediato *por qué* se desvían vuelos, ni *qué tan lejos* están los alternos. El mapa convierte datos abstractos en geografía real.

---

## Usuarios objetivo

- Operadores de IRROPS en sala de operaciones (pantalla grande)
- Jueces de hackathon evaluando comprensibilidad

---

## Funcionalidad requerida

### F1 — Mapa base estático
- Renderizar un mapa centrado en el área de Toronto
- Mostrar tres aeropuertos como marcadores:
  - **YYZ Toronto Pearson** — círculo grande, color según estado
  - **YTZ Billy Bishop** — círculo mediano
  - **YHM Hamilton** — círculo mediano
- Labels con código IATA + nombre del aeropuerto

### F2 — Estado visual por step

| Step | YYZ | YTZ / YHM | Líneas de vuelo |
|------|-----|-----------|-----------------|
| 0 — Normal | Verde | Gris (inactivo) | Arcos entrantes en azul |
| 1 — Storm | Rojo parpadeante | Sin cambio | Arcos entrantes en rojo/naranja |
| 2 — Chaos | Rojo + ícono tormenta | Sin cambio | Arcos saturados, más gruesos |
| 3 — Nexus Plan | Amber | Amber si recibe desvío | Arcos de desvío en amber punteados |

### F3 — Arcos de vuelos entrantes
- Cada vuelo inbound se representa como un arco curvo desde su ciudad de origen hasta YYZ
- Grosor del arco proporcional al número de pasajeros
- En step 3: vuelos desviados muestran el arco cortado con bifurcación hacia YTZ/YHM
- Animación suave al cambiar de step (transición de 600ms)

### F4 — Tooltip en hover
Al hacer hover en un arco o marcador de aeropuerto:
- Nombre del vuelo + origen + delay
- PAX conectando en ese vuelo
- Estado actual (on time / delayed / diverted)

### F5 — Sincronización con selección activa
Si el usuario selecciona un vuelo en el panel lateral (FlightPanel), el arco correspondiente se resalta y los demás se atenúan. Mismo patrón que el Sankey actual.

---

## Fuente de datos

Todos los datos vienen del store existente — no requiere cambios al backend.

```js
// Datos necesarios del store
const { scenario, optimizeResult, timelineStep, selectedFlightId } = useStore()

// Coordenadas fijas (hardcoded — son aeropuertos reales)
const AIRPORTS = {
  YYZ: { lat: 43.6777, lng: -79.6248, name: 'Toronto Pearson' },
  YTZ: { lat: 43.6275, lng: -79.3962, name: 'Billy Bishop' },
  YHM: { lat: 43.1736, lng: -79.9350, name: 'John C. Munro Hamilton' },
}

// Coordenadas de orígenes (derivados de scenario.inbound_flights[].origin)
// Requiere un mapa estático de códigos IATA → coordenadas para los ~5 orígenes del escenario
```

---

## Diseño visual

### Layout
Reemplaza el espacio central actual (actualmente solo el SankeyDiagram ocupa esa área) con un layout split o con el mapa en un panel colapsable arriba del Sankey.

**Opción A (recomendada):** Tab switcher en el centro — "Flow View" (Sankey) / "Map View" (mapa). El usuario alterna entre ambas visualizaciones.

**Opción B:** Mapa compacto fijo encima del Sankey (altura ~200px).

### Paleta de colores (consistente con el sistema existente)
- Hub nominal: `#22c55e` (green-500)
- Hub storm: `#ef4444` (red-500) con `animate-pulse`
- Hub diversion plan: `#f59e0b` (amber-400)
- Arcos nominales: `#3b82f6` (blue-500)
- Arcos delayed: `#f87171` (red-400)
- Arcos desviados: `#fbbf24` (amber-400) con stroke-dasharray

---

## Dependencias técnicas

| Biblioteca | Propósito | Ya instalada |
|-----------|-----------|-------------|
| `react-leaflet` | Mapa base (OpenStreetMap) | ❌ — requiere `npm install react-leaflet leaflet` |
| `d3` (ya disponible) | Proyección geográfica para arcos SVG sobre el mapa | ✅ |

**Alternativa sin nueva dependencia:** Usar un SVG estático con posiciones hardcoded basadas en un mapa de fondo PNG de Ontario. Más frágil pero sin instalación.

---

## Archivos a crear / modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/GeoMap.jsx` | **NUEVO** — componente completo del mapa |
| `frontend/src/lib/airports.js` | **NUEVO** — coordenadas IATA para los orígenes del escenario |
| `frontend/src/App.jsx` | Añadir tab switcher "Flow / Map" en la zona central |

---

## Criterios de aceptación

- [ ] El mapa se renderiza correctamente en la resolución target (1440px+)
- [ ] Los tres aeropuertos Toronto-área son visibles con sus labels
- [ ] Cambiar de step 0 → 1 cambia el color de YYZ a rojo con pulso
- [ ] En step 3, los vuelos desviados muestran arcos bifurcados hacia YTZ/YHM
- [ ] Hovering en un arco muestra tooltip con datos del vuelo
- [ ] Seleccionar un vuelo en FlightPanel resalta su arco en el mapa
- [ ] La transición entre steps es animada (no instantánea)

---

## Prioridad hackathon: ALTA
**Por qué:** Es el feature con mayor impacto visual inmediato. Un juez que ve el mapa entiende el problema en segundos sin necesidad de leer documentación. Ideal para la demo en vivo.
