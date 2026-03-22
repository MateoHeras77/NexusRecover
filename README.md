# NexusRecover

**IRROPS Decision Support System** — Sistema de soporte de decisiones para la recuperación de operaciones irregulares en aeropuertos.

> Proyecto presentado a la **Hackatón CubePath 2026**
> *Crea un proyecto y despliégalo en CubePath para ganar increíbles premios.*

**Autor:** Wilmer Mateo Heras Vera

---

## ¿Qué es NexusRecover?

Cuando una tormenta golpea un aeropuerto hub, los operadores de IRROPS tienen minutos para tomar decisiones que afectan a cientos de pasajeros y millones de dólares. Sin herramientas adecuadas, esas decisiones se toman a intuición.

**NexusRecover** convierte ese caos en un plan concreto. El sistema:

1. **Ingiere el escenario** — vuelos entrantes con retrasos, restricciones de capacidad y grupos de pasajeros en conexión
2. **Ejecuta un optimizador CP-SAT** — calcula el mejor plan de recuperación minimizando pasajeros varados y costo total
3. **Visualiza el resultado** — Sankey de flujos de pasajeros, mapa geográfico interactivo, waterfall de costos
4. **Notifica automáticamente** — envía payloads estructurados a N8N para alertar a autoridades aeroportuarias y servicios de hospitalidad vía email

### Escenario demo — Tormenta YYZ

El escenario de demostración simula una tormenta de nieve en Toronto Pearson (YYZ) que reduce la capacidad de llegadas de **12 a 4 vuelos/hora**. Once vuelos inbound con más de 1.100 pasajeros en conexión compiten por slots limitados. El optimizador calcula en segundos qué vuelos retener en gate, cuáles desviar a los alternos (YTZ — Billy Bishop, YHM — Hamilton) y cuáles cancelar.

---

## Funcionalidades

| Feature | Descripción |
|---------|-------------|
| **Timeline de 4 pasos** | Normal Ops → Tormenta → Caos → Plan Nexus |
| **Sankey interactivo** | Flujo de pasajeros inbound → outbound, clicable por vuelo y grupo |
| **Mapa geográfico** | deck.gl + MapLibre — arcos de vuelos desde origen hasta hub/alternos |
| **KPI Bar** | Ahorro vs baseline, PAX protegidos, retrasos totales en tiempo real |
| **Airport Status Bar** | Capacidad por slot, estado de aeropuertos alternos |
| **Passenger Journey Cards** | Panel lateral por grupo de pasajeros — MCT, ventana de conexión, outcome |
| **Compare View** | Baseline (sin acción) vs Plan Nexus lado a lado |
| **Waterfall de costos** | Desglose visual del ahorro por categoría |
| **Copilot AI** | Chat con Gemini contextualizado con el escenario y resultado del optimizador |
| **Notify Authorities** | Webhook → N8N con payload operacional completo para autoridades |
| **Notify Hospitality** | Webhook → N8N con payload logístico para hoteles y transporte |
| **Reporte PDF-ready** | Vista de reporte exportable con resumen ejecutivo |

---

## Stack tecnológico

### Frontend
| Tecnología | Uso |
|-----------|-----|
| **React 19** | UI |
| **Vite 8** | Build tool |
| **Tailwind CSS 4** | Estilos |
| **Zustand** | Estado global |
| **D3 + d3-sankey** | Diagrama Sankey |
| **deck.gl** | Mapa 3D de arcos de vuelo |
| **MapLibre GL** | Tiles de mapa (Carto Dark, sin API key) |
| **react-map-gl** | Wrapper React para MapLibre |
| **Lucide React** | Iconos |
| **react-markdown** | Renderizado del copilot |

### Backend
| Tecnología | Uso |
|-----------|-----|
| **FastAPI** | API REST |
| **uvicorn** | Servidor ASGI |
| **Google OR-Tools (CP-SAT)** | Optimizador combinatorio |
| **Gemini API (gemini-2.0-flash)** | Copilot de operaciones con contexto de escenario |
| **httpx** | Cliente HTTP async para Gemini |
| **Pydantic v2** | Validación de schemas |

### Infraestructura
| Componente | Tecnología |
|-----------|-----------|
| **Contenedores** | Docker + Docker Compose |
| **Servidor de aplicación** | VPS CubePath — frontend (Nginx) + backend (uvicorn) |
| **Notificaciones** | N8N en instancia separada de CubePath |
| **Reverse proxy** | Traefik (gestionado por Dokploy) |
| **TLS** | Let's Encrypt automático vía Traefik |

---

## Arquitectura de despliegue

```
                        ┌─────────────────────────────────┐
                        │   VPS CubePath #1 — App          │
                        │                                 │
Internet ──► Traefik ──►│  Nginx :80                      │
              (TLS)     │   ├── /        → React SPA      │
                        │   └── /api/*   → uvicorn :8000  │
                        │         │                       │
                        │         └── FastAPI + CP-SAT    │
                        └─────────────────────────────────┘
                                       │
                              Webhook POST (JSON)
                                       │
                        ┌─────────────────────────────────┐
                        │   VPS CubePath #2 — N8N          │
                        │                                 │
                        │  Webhook trigger (Authorities)  │
                        │   └── IF diversion → email ATC  │
                        │   └── IF diversion → email YTZ  │
                        │   └── IF diversion → email YHM  │
                        │                                 │
                        │  Webhook trigger (Hospitality)  │
                        │   └── email Hotel + transporte  │
                        │   └── email lounge YYZ          │
                        └─────────────────────────────────┘
                                       │
                                  Gemini API
                              (Google Cloud — externo)
```

### Por qué dos instancias CubePath

- **Instancia 1 (App):** Corre el stack principal — Nginx + FastAPI + OR-Tools. OR-Tools es intensivo en CPU durante la optimización; tenerlo aislado garantiza que los picos no afecten a N8N.
- **Instancia 2 (N8N):** N8N gestiona todos los flujos de notificación. Al estar en una instancia separada, los workflows de email/Slack/WhatsApp son independientes del ciclo de vida de la app — se pueden actualizar sin afectar al sistema de decisiones.

---

## Despliegue rápido

### Requisitos
- Docker y Docker Compose instalados
- API Key de Google Gemini ([obtener aquí](https://aistudio.google.com/app/apikey))

### Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/NexusRecover.git
cd NexusRecover

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env y añadir GOOGLE_API_KEY

# 3. Arrancar
docker compose up --build

# 4. Abrir
open http://localhost
```

### Producción en CubePath (Dokploy)

Ver la guía completa en [`docs/DEPLOY.md`](docs/DEPLOY.md).

**Resumen de 5 pasos:**

1. Crear proyecto en Dokploy → **Docker Compose** → conectar repo GitHub
2. Añadir variables de entorno en la UI de Dokploy:
   ```
   GOOGLE_API_KEY=...
   VITE_WEBHOOK_AUTHORITIES=https://n8n.tu-instancia-cubepath.com/webhook/authorities
   VITE_WEBHOOK_HOSPITALITY=https://n8n.tu-instancia-cubepath.com/webhook/hospitality
   ```
3. Asignar dominio al servicio `frontend` → TLS automático vía Traefik
4. Deploy → el healthcheck espera a que el backend esté listo antes de levantar Nginx
5. Verificar: `https://tu-dominio.com/api/health` → `{"status":"ok"}`

### Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `GOOGLE_API_KEY` | ✅ | API key de Gemini |
| `GEMINI_MODEL` | No | Modelo (default: `gemini-2.0-flash`) |
| `VITE_WEBHOOK_AUTHORITIES` | No | URL webhook N8N — autoridades |
| `VITE_WEBHOOK_HOSPITALITY` | No | URL webhook N8N — hospitalidad |

> ⚠️ Las variables `VITE_*` se hornean en el bundle JS en tiempo de build.
> Si las cambias, debes hacer un **redeploy con rebuild**.

---

## Estructura del repositorio

```
NexusRecover/
├── backend/
│   ├── data/
│   │   └── mock_scenario.json      # Escenario YYZ snowstorm
│   ├── solver/
│   │   └── optimizer.py            # CP-SAT optimizer (OR-Tools)
│   ├── main.py                     # FastAPI app
│   ├── schemas.py                  # Pydantic models
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   ├── image.png               # Logo header
│   │   └── tebas.png               # Easter egg hover
│   ├── src/
│   │   ├── components/             # React components
│   │   ├── lib/                    # sankey, airports, notify, waterfall
│   │   └── store/
│   │       └── useStore.js         # Zustand global store
│   ├── nginx.conf
│   └── Dockerfile
├── docs/
│   └── DEPLOY.md                   # Guía completa de despliegue
├── docker-compose.yml
└── .env.example
```

---

## Licencia

MIT — Wilmer Mateo Heras Vera, 2026
