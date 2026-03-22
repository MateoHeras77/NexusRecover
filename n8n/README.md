# NexusRecover — N8N Workflows

Dos workflows **listos para importar y activar**. Sin configuración de credenciales. Solo reciben webhooks y guardan notificaciones en archivos de texto plano.

## Workflows Incluidos

| Workflow | Propósito |
|----------|-----------|
| **NexusRecover-Authorities.json** | Recibe notificaciones para autoridades, ATC, y operaciones aeroportuarias |
| **NexusRecover-Hospitality.json** | Recibe notificaciones para hoteles, transporte, y servicios al cliente |

---

## Cómo Importar

### Opción A — Importar desde archivo

1. Ve a tu N8N (`https://tu-vps.com/home/workflows`)
2. Arriba a la derecha → **+ New** → **Import from file**
3. Sube `NexusRecover-Authorities.json`
4. Repite para `NexusRecover-Hospitality.json`

### Opción B — Copiar-pegar JSON

1. En N8N → **+ New** → **Import from URL** o copy-paste
2. Pega el contenido del archivo JSON
3. N8N lo importa automáticamente

---

## Estructura de los Workflows

Cada workflow tiene 3 nodos:

```
┌─ Webhook ─────────────────────────────────────────┐
│ Recibe POST con payload de NexusRecover           │
│ Path: /webhook/authorities o /webhook/hospitality │
└──────────────────────────────┬──────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────┐
│ Format Text (Code Node)                             │
│ Convierte payload JSON a texto plano legible        │
│ con emojis, bordes, y formato visual                │
└──────────────────────────────┬──────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────┐
│ Write to File (Binary File)                         │
│ Guarda a: /tmp/nexusrecover_[type]_[timestamp].txt │
│ Ejm: /tmp/nexusrecover_authorities_2026-03-21_...  │
└──────────────────────────────────────────────────────┘
```

---

## Configurar el Nodo Webhook

⚠️ **PASO CRÍTICO**: Antes de activar, asegúrate de que el nodo Webhook esté configurado para **POST**:

1. En N8N, abre **NexusRecover — Authorities Notification**
2. Haz clic en el nodo **Webhook** (el primero del flow)
3. En el panel derecho, busca **HTTP Method**
4. Cambia de **GET** a **POST** ✅
5. Repite para **NexusRecover — Hospitality**

## Activar los Workflows

1. Arriba a la derecha → toggle **Active** (verde = activo)
2. **Save workflow** (Ctrl+S)
3. Repite para **NexusRecover — Hospitality**

---

## Obtener las URLs de Webhook

Una vez que ambos workflows estén **Active**:

1. Abre **NexusRecover — Authorities**
2. Click en el nodo **Webhook**
3. Debajo del editor verás la URL completa:
   ```
   https://tu-vps.com/webhook/authorities
   ```
4. Repite para el de Hospitality
   ```
   https://tu-vps.com/webhook/hospitality
   ```

---

## Configurar en NexusRecover

En **Dokploy** → proyecto → **Environment**:

```
WEBHOOK_AUTHORITIES=https://tu-vps.com/webhook/authorities
WEBHOOK_HOSPITALITY=https://tu-vps.com/webhook/hospitality
```

**Save** → **Redeploy** (sin rebuild — son variables del backend)

---

## Probar los Workflows

### Desde NexusRecover

1. Abre la app
2. Llega al **Paso 3: Nexus Plan** (corre el optimizer)
3. Haz clic en **Notify Authorities**
4. En N8N, abre el workflow → pestaña **Executions**
5. Deberías ver la ejecución completada ✅

### Ver los archivos generados

En la terminal del servidor N8N:

```bash
# Listar archivos
ls -lah /tmp/nexusrecover_*.txt

# Ver contenido del más reciente
cat /tmp/nexusrecover_authorities_*.txt | tail -100
```

---

## Formato de Salida

Cada archivo contiene:

✅ **Para Authorities:**
- Contexto de la disrupción (hub, event, capacidad)
- Resumen del optimizador (costos, PAX, acciones)
- Órdenes de diversion detalladas (flight, destino, PAX, contactos)
- Órdenes de hold para departures (timing, PAX, acciones en gate)
- Estado de aeropuertos alternos

✅ **Para Hospitality:**
- Resumen de disrupción
- Operaciones en aeropuertos alternos (vuelos, PAX, transporte, requisitos on-site)
- Pasajeros varados en hub (hotel, vouchers)
- Requisitos en YYZ hub (lounge, desks, rebooking, script)
- Resumen de costos

---

## Almacenamiento Persistente

Los archivos en `/tmp/` se borran al reiniciar el servidor. Para persistencia:

1. En N8N, abre el nodo **Write to File**
2. Cambia la ruta:
   ```
   De:  /tmp/nexusrecover_authorities_{{$now.toFormat('yyyy-MM-dd_HH-mm-ss')}}.txt
   A:   /opt/n8n/webhooks/nexusrecover_authorities_{{$now.toFormat('yyyy-MM-dd_HH-mm-ss')}}.txt
   ```
3. Asegúrate de que el directorio `/opt/n8n/webhooks/` existe y tiene permisos de escritura
4. **Save**

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| **"This webhook is not registered for POST requests"** | ⚠️ El nodo Webhook está en GET. Abre el nodo Webhook → cambia **HTTP Method** a **POST** |
| **"The requested webhook is not registered"** | El workflow no está **Active**. Abre el workflow → toggle **Active** debe estar verde |
| **Workflow inactivo** | Abre el workflow → toggle **Active** debe estar verde |
| **Webhook no recibe requests** | Verifica en **Executions** que el workflow esté activo; comprueba la URL en Dokploy |
| **Archivos no se crean** | Revisa que `/tmp/` sea escribible (`ls -ld /tmp/`) |
| **Archivos vacíos** | El Code Node puede tener errores; abre **Executions** y revisa los logs |

---

## Notas

- Los workflows se guardan en **borrador** hasta que actives el toggle
- Cada ejecución genera un archivo con timestamp único
- No hay dependencias de credenciales — es plug-and-play
- Los Code Nodes usan JavaScript puro (N8N ejecuta en Node.js)

---

¡Listo para desplegar! 🚀
