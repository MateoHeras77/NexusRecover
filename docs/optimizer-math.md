# NexusRecover — Optimizer: Fórmulas y Lógica Matemática

Este documento explica las decisiones matemáticas detrás del optimizador CP-SAT de NexusRecover, con fragmentos de código relevantes.

---

## 1. Problema a resolver

Dado un banco de vuelos en YYZ durante una disrupción (tormenta), el sistema debe decidir:

- ¿Cuántos minutos retrasar cada vuelo de **salida**?
- ¿Qué vuelos de **entrada** deben ser desviados a aeropuertos alternos (YTZ, YHM)?

El objetivo es **minimizar el costo total** de la operación de recuperación.

---

## 2. Variables de decisión

| Variable | Tipo | Descripción |
|---|---|---|
| `delay[i]` | Entero `[0, 180]` | Minutos de retraso aplicados al vuelo de salida `i` |
| `cancel[i]` | Booleano | `1` si el vuelo de salida `i` es cancelado |
| `land_yyz[k]` | Booleano | `1` si el vuelo de entrada `k` aterriza en YYZ |
| `divert_ytz[k]` | Booleano | `1` si el vuelo de entrada `k` es desviado a YTZ |
| `divert_yhm[k]` | Booleano | `1` si el vuelo de entrada `k` es desviado a YHM |
| `conn[j]` | Booleano | `1` si el grupo de pasajeros `j` hace su conexión |

### Restricción de exclusividad por vuelo entrante

Cada vuelo de entrada debe aterrizar en **exactamente un** aeropuerto:

```
land_yyz[k] + divert_ytz[k] + divert_yhm[k] = 1   ∀ k
```

```python
model.add(
    land_yyz_vars[inb.flight_id]
    + divert_ytz_vars[inb.flight_id]
    + divert_yhm_vars[inb.flight_id] == 1
)
```

---

## 3. Función objetivo — Minimizar costo total

```
Minimizar:
  Σᵢ  delay_cost(i)           [costo operacional por retraso]
+ Σⱼ  stranded_cost(j)        [costo por pasajeros varados]
+ Σᵢ  cancel_penalty(i)       [penalización por cancelación]
+ Σₖ  diversion_transport(k)  [transporte a aeropuerto alterno]
+ Σ   soft_violations         [penalización enorme por violar curfew/capacidad]
```

```python
model.minimize(sum(objective_terms))
```

---

## 4. Costo de retraso operacional

El costo por minuto varía según el tipo de aeronave (aviones más grandes = más caros):

| Aeronave | $/min |
|---|---|
| Boeing 777 | $145 |
| Boeing 737 | $82 |
| Airbus A320 | $78 |
| Dash-8 | $38 |

### Fórmula

```
delay_cost(i) = delay[i] × cost_per_min(aircraft_type[i])
```

**Ejemplo — AC301 (B777) retenido 68 minutos:**
```
delay_cost = 68 × $145 = $9,860
```

```python
for out in scenario.outbound_flights:
    ac = ac_map[out.aircraft_type]
    cost_per_min_scaled = int(ac.cost_per_min_usd * SCALE)
    objective_terms.append(cost_per_min_scaled * delay_vars[out.flight_id])
```

> **Nota:** CP-SAT opera con enteros. Todos los costos se multiplican por `SCALE = 100` (centavos) antes de entrar al modelo y se dividen al extraer resultados.

---

## 5. Costo de pasajeros varados

Si un grupo de pasajeros no puede hacer su conexión (`conn[j] = 0`), se genera un costo que incluye hotel, compensación y rebooking:

| Clase | Costo por PAX |
|---|---|
| Business | $1,765 |
| Economy | $465 |

### Fórmula

```
stranded_cost(j) = count(j) × penalty(tier[j]) × (1 - conn[j])
```

El optimizador lo encode como:

```
+ count × penalty          ← siempre suma el peor caso
- count × penalty × conn   ← si conn=1, se cancela (se ahorra el costo)
```

```python
for pg in scenario.pax_groups:
    penalty = (
        gc.business_stranded_cost_usd if pg.tier == "business"
        else gc.economy_stranded_cost_usd
    )
    total_stranded_scaled = int(pg.count * penalty * SCALE)
    objective_terms.append(total_stranded_scaled)
    objective_terms.append(-total_stranded_scaled * conn_vars[pg.group_id])
```

### ¿Por qué vale la pena esperar 68 minutos por 33 PAX de AC418?

```
Costo de esperar:   68 min × $145/min           =  $9,860
Costo de varar:     33 pax × $465 (economy min) = $15,345
                    33 pax × $1,765 (business)  = $58,245

→ Esperar siempre es más barato que varar.
```

El optimizador elige retrasar AC301 exactamente 68 minutos porque ese es el **mínimo necesario** para que los 33 pasajeros de AC418 completen su conexión con MCT incluido.

---

## 6. Ventana de conexión y MCT

La condición para que un pasajero haga su conexión es:

```
STD_out + delay[out] − ETA_inb ≥ MCT
```

Donde **MCT** (Minimum Connection Time) depende del tipo de vuelo:

| Tipo | MCT en YYZ |
|---|---|
| Doméstico | 45 min |
| Internacional | 75 min |

### Encoding Big-M

CP-SAT no puede evaluar desigualdades condicionales directamente. Se usa el truco **Big-M** para forzar `conn[j] = 1` solo si la ventana es suficiente:

```
window[j] = STD_out[j] + delay[out[j]] − ETA_inb[j]

conn[j] = 1  →  window[j] ≥ MCT
```

Esto se expresa como:

```
window[j] ≥ MCT − M × (1 − conn[j])
```

Si `conn[j] = 1`: `window ≥ MCT` (restricción activa)
Si `conn[j] = 0`: `window ≥ MCT − M` (siempre satisfecha, M es grande)

```python
window_var = model.new_int_var(-MAX_DELAY, MAX_DELAY + 300, f"win_{pg.group_id}")
model.add(window_var == out.std_min + delay_vars[out.flight_id] - inb.eta_min)

# conn=1 requires window >= mct (big-M encoding)
model.add(window_var >= mct - (MAX_DELAY + 300) * (1 - conn_vars[pg.group_id]))
```

---

## 7. Capacidad aeroportuaria — ventanas de 30 minutos

Durante la tormenta, YYZ reduce su capacidad de **12 arr/hr** a **4 arr/hr**, lo que equivale a **2 slots por ventana de 30 minutos**.

### Agrupamiento por bucket

```
bucket(k) = floor(ETA[k] / 30)
```

Todos los vuelos cuyo ETA cae en el mismo bucket de 30 minutos compiten por los mismos 2 slots.

```python
def _build_capacity_windows(inbound_flights, window_size_min=30):
    windows = {}
    for i, f in enumerate(inbound_flights):
        bucket = f.eta_min // window_size_min
        windows.setdefault(bucket, []).append(i)
    return windows
```

### Restricción soft de capacidad

Si hay más vuelos que slots en un bucket, el modelo puede violar la capacidad, pero a un **costo astronómico** (`$10,000,000`). Esto garantiza que la solución siempre sea factible, y el optimizador preferirá desviar un vuelo antes que pagar la penalización.

```
Σₖ∈bucket  land_yyz[k]  ≤  max_slots + |bucket| × cap_soft[bucket]
```

```python
max_slots_per_window = hub_airport.slots_per_hour_storm // 2   # = 2

for bucket, indices in cap_windows.items():
    if len(indices) <= max_slots_per_window:
        continue
    cap_soft_vars[bucket] = model.new_bool_var(f"cap_soft_{bucket}")
    yyz_landings = [land_yyz_vars[scenario.inbound_flights[i].flight_id] for i in indices]
    model.add(
        sum(yyz_landings) <= max_slots_per_window + len(indices) * cap_soft_vars[bucket]
    )
```

---

## 8. Costo de desvío a aeropuerto alterno

Cuando un vuelo es desviado, todos sus pasajeros deben ser transportados de regreso a YYZ. El costo incluye transporte + hotel:

| Alterno | Transporte/PAX | Tiempo traslado |
|---|---|---|
| YTZ Billy Bishop | $45/pax | 20 min |
| YHM Hamilton | $95/pax | 75 min |

### Fórmula

```
diversion_cost(k) = total_pax[k] × transport_cost(alterno)
```

```python
for inb in scenario.inbound_flights:
    if "YTZ" in alt_map:
        ytz_cost = int(inb.total_pax * alt_map["YTZ"].transport_cost_per_pax_usd * SCALE)
        objective_terms.append(ytz_cost * divert_ytz_vars[inb.flight_id])
    if "YHM" in alt_map:
        yhm_cost = int(inb.total_pax * alt_map["YHM"].transport_cost_per_pax_usd * SCALE)
        objective_terms.append(yhm_cost * divert_yhm_vars[inb.flight_id])
```

### Capacidad de los alternos (restricción hard)

```
Σₖ  divert_ytz[k]  ≤  max_slots_ytz    (= 1)
Σₖ  divert_yhm[k]  ≤  max_slots_yhm    (= 3)
```

```python
model.add(sum(divert_ytz_vars.values()) <= alt_map["YTZ"].max_diversion_slots)
model.add(sum(divert_yhm_vars.values()) <= alt_map["YHM"].max_diversion_slots)
```

---

## 9. Cálculo del ahorro (Savings)

El ahorro se calcula comparando el escenario **sin intervención** (baseline) contra el plan optimizado:

```
savings = baseline_cost − optimized_cost
```

El baseline asume que todos los vuelos salen en horario y ninguna capacidad aeroportuaria es respetada. Los pasajeros que no alcanzan su conexión por timing puro son varados al costo completo.

```python
baseline = compute_baseline(scenario)

return OptimizeResult(
    baseline_cost_usd=baseline.baseline_cost_usd,
    optimized_cost_usd=total_cost,
    savings_usd=max(0.0, baseline.baseline_cost_usd - total_cost),
    ...
)
```

---

## 10. Solver — parámetros de ejecución

| Parámetro | Valor | Razón |
|---|---|---|
| `max_time_in_seconds` | 5s | Decisiones en tiempo real, no puede esperar |
| `num_search_workers` | 4 | Paralelismo para explorar el espacio de soluciones |
| Fallback | `compute_baseline()` | Si no hay solución factible, retorna el baseline |

```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = SOLVER_TIMEOUT_S
solver.parameters.num_search_workers = 4
status = solver.solve(model)

if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    return compute_baseline(scenario)
```

El solver retorna `OPTIMAL` (solución perfecta) o `FEASIBLE` (mejor encontrada en 5s). En el escenario YYZ con ~11 vuelos, típicamente retorna `OPTIMAL` en menos de 1 segundo.
