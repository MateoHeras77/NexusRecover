# Guía de despliegue — NexusRecover en Dokploy

## Arquitectura

```
Internet
   │
   ▼
[Traefik] ← Dokploy lo gestiona automáticamente
   │
   ▼
[frontend — Nginx :80]
   ├── / → sirve el bundle Vite (SPA)
   └── /api/* → proxy → [backend — uvicorn :8000]
                              │
                              └── Gemini API (externo)
```

- **Frontend**: imagen multi-stage — Node 20 compila, Nginx 1.27 sirve
- **Backend**: Python 3.12-slim + FastAPI + OR-Tools + uvicorn
- **No base de datos** — el escenario se carga desde `data/mock_scenario.json`

---

## Prerrequisitos

- Servidor con Dokploy instalado
- Repositorio en GitHub/GitLab accesible desde Dokploy
- API Key de Google Gemini ([obtener aquí](https://aistudio.google.com/app/apikey))
- Opcional: URLs de webhooks N8N configurados

---

## Paso 1 — Preparar variables de entorno

Copia `.env.example` como referencia. En Dokploy las variables se configuran
en la UI (no se sube el archivo `.env` al repo).

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `GOOGLE_API_KEY` | ✅ | Gemini API key para el copilot |
| `GEMINI_MODEL` | No | Modelo a usar (default: `gemini-2.0-flash`) |
| `VITE_WEBHOOK_AUTHORITIES` | No | URL del webhook N8N para autoridades |
| `VITE_WEBHOOK_HOSPITALITY` | No | URL del webhook N8N para hospitalidad |

> ⚠️ **Importante**: Las variables `VITE_*` se hornean en el bundle de JavaScript
> en tiempo de build. Si las cambias, debes hacer un nuevo deploy (rebuild).

---

## Paso 2 — Configurar el proyecto en Dokploy

1. En Dokploy, crear un nuevo proyecto → **"Docker Compose"**
2. Conectar el repositorio de GitHub
3. Seleccionar la rama (`main`)
4. El archivo que Dokploy debe usar: `docker-compose.yml` (está en la raíz)

### Configurar variables de entorno en Dokploy

En la sección **Environment** del proyecto, añadir:

```
GOOGLE_API_KEY=tu_api_key_aqui
GEMINI_MODEL=gemini-2.0-flash
VITE_WEBHOOK_AUTHORITIES=https://tu-n8n.com/webhook/authorities
VITE_WEBHOOK_HOSPITALITY=https://tu-n8n.com/webhook/hospitality
```

### Build args para el frontend

Dokploy pasa automáticamente las variables de entorno como build args
cuando están declaradas en el `docker-compose.yml`. Las `VITE_*` están
configuradas como `args` en el `build` del servicio `frontend` — no requiere
configuración adicional.

---

## Paso 3 — Configurar dominio (Traefik)

En Dokploy, en la pestaña **Domains** del servicio `frontend`:

1. Añadir tu dominio (ej. `nexusrecover.tudominio.com`)
2. Activar **HTTPS** (Let's Encrypt automático)
3. Puerto interno: `80`

El backend **no necesita dominio público** — solo es accesible internamente
a través del proxy de Nginx.

---

## Paso 4 — Deploy

1. Hacer clic en **Deploy** en Dokploy
2. Dokploy ejecuta `docker compose up --build -d`
3. El build del frontend tarda ~2 min (instala node_modules + compila Vite)
4. El backend tarda ~3 min (descarga `ortools` que pesa ~150 MB)
5. El healthcheck confirma que el backend está listo antes de arrancar Nginx

Verificar que todo funciona:
```
https://nexusrecover.tudominio.com/        → frontend
https://nexusrecover.tudominio.com/api/health → {"status":"ok"}
```

---

## Paso 5 — Re-deploy tras cambios

### Cambios de código (sin cambio de env vars)
```bash
git push origin main
# En Dokploy → "Redeploy"
```

### Cambios en variables de entorno runtime (`GOOGLE_API_KEY`, `GEMINI_MODEL`)
1. Actualizar en Dokploy → Environment
2. "Redeploy" (solo reconstruye los contenedores, no el bundle)

### Cambios en `VITE_*` (webhooks N8N)
1. Actualizar en Dokploy → Environment
2. **"Redeploy with rebuild"** — obligatorio, las vars se hornean en el JS

---

## Probar localmente con Docker Compose

```bash
# 1. Crear el archivo de variables
cp .env.example .env
# Editar .env y añadir GOOGLE_API_KEY

# 2. Build y arrancar
docker compose up --build

# 3. Abrir en el navegador
open http://localhost
```

Para parar:
```bash
docker compose down
```

Para ver logs:
```bash
docker compose logs -f backend    # logs del API
docker compose logs -f frontend   # logs de Nginx
```

---

## Troubleshooting

### El copilot no responde / error 502
- Verificar que `GOOGLE_API_KEY` está bien configurada
- Ver logs: `docker compose logs backend`
- Probar directamente: `curl http://localhost/api/health`

### Los botones de webhook no funcionan
- Las variables `VITE_WEBHOOK_*` requieren rebuild
- Verificar que las URLs N8N son accesibles desde el navegador del usuario
- Probar con el servidor Python local (ver sección Testing Webhooks abajo)

### El mapa geográfico no carga
- El mapa usa tiles de CartoDB (gratuitos, sin API key)
- Verificar conectividad a `basemaps.cartocdn.com` desde el servidor
- Si hay firewall, abrir egress a `*.cartocdn.com`

### OR-Tools falla al instalar en Docker
- OR-Tools requiere Linux x86_64 — no funciona en Mac ARM nativo sin emulación
- En Dokploy (servidor Linux) funciona correctamente
- Para desarrollo local en Mac ARM: usar `--platform linux/amd64`
  ```bash
  docker compose build --build-arg TARGETPLATFORM=linux/amd64
  ```

---

## Testing de webhooks N8N en local

Antes de tener N8N configurado, se puede verificar que los payloads llegan
correctamente con este servidor Python de un solo comando:

```bash
python3 - << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))
        target = body.get('notification_target', 'UNKNOWN')
        print(f"\n{'='*60}\n  WEBHOOK → {target}\n{'='*60}")
        print(json.dumps(body, indent=2, ensure_ascii=False))
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'{"ok": true}')

    def log_message(self, *args): pass

print("Receiver listening on http://localhost:4000")
HTTPServer(('', 4000), Handler).serve_forever()
EOF
```

Configurar en `.env`:
```
VITE_WEBHOOK_AUTHORITIES=http://localhost:4000
VITE_WEBHOOK_HOSPITALITY=http://localhost:4000
```
