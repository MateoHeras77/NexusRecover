# NexusRecover — N8N Workflows

Dos workflows listos para importar en tu instancia N8N:

1. **NexusRecover-Authorities.json** — Notifica a ATC, airport ops, y alternos sobre diversiones
2. **NexusRecover-Hospitality.json** — Notifica a hoteles, transporte, y YYZ sobre PAX varados

---

## Cómo importar

1. En tu N8N (`https://tu-vps.com/home/workflows`)
2. Arriba a la derecha → **Import**
3. Pega el contenido del JSON (o copia el archivo)
4. N8N detecta automáticamente los nodos y conexiones

---

## Qué necesito de ti

Antes de activar los workflows, debo configurar:

### 1. Credencial Gmail

**¿Por qué?** Los workflows envían email vía Gmail SMTP.

**Pasos:**
1. Ve a tu cuenta Google → [myaccount.google.com/security](https://myaccount.google.com/security)
2. Activa 2-factor authentication (si no lo tienes)
3. En **App passwords** (en el mismo sitio), crea una password de aplicación para "Mail" / "Windows Computer"
4. Google te da una password de 16 caracteres — cópiala

**Qué necesito:**
```
- Tu correo: example@gmail.com
- App password: xxxx xxxx xxxx xxxx
```

### 2. Emails destinatarios

Cada workflow envía a múltiples direcciones. Dime quiénes deben recibir cada notificación:

**Authorities:**
- ATC/Tower (YYZ)
- Airport Ops (YYZ)
- Dispatch (Air Canada)
- Otros stakeholders

**Hospitality:**
- Hoteles contratados
- Proveedor de transporte
- Servicio al cliente (Air Canada)
- Equipo de hospitalidad

---

## Configuración en N8N

Una vez importados los workflows:

### Paso 1 — Credencial Gmail SMTP

1. En N8N → **Settings** → **Credentials**
2. **Create new** → **SMTP**
3. Configura:
   ```
   Host: smtp.gmail.com
   Port: 587
   Email: tu-email@gmail.com
   Password: [App password de Google — 16 caracteres]
   TLS: activado
   ```
4. **Save** → nombre: `gmail_smtp`

### Paso 2 — Editar workflows

En cada workflow:

1. Nodo **"Send Email to Authorities"** (o Hospitality)
2. En **"From Email"**, reemplaza `YOUR_GMAIL@gmail.com`
3. En **"To List"**, reemplaza los emails con los actuales
4. **Save**

### Paso 3 — Activar

1. Abre el workflow → arriba a la derecha, toggle **Active**
2. N8N genera la URL del webhook automáticamente (debajo del nodo Webhook)

---

## Obtener las URLs de webhook

Una vez activos los workflows:

1. Abre **NexusRecover-Authorities** → click en el nodo **Webhook Authorities**
2. Verás la URL: `https://vps22776.cubepath.net/webhook/authorities`
3. Repite para **NexusRecover-Hospitality** → URL: `https://vps22776.cubepath.net/webhook/hospitality`

---

## Guardar las URLs en NexusRecover

Ve a Dokploy → Environment → actualiza:

```
VITE_WEBHOOK_AUTHORITIES=https://vps22776.cubepath.net/webhook/authorities
VITE_WEBHOOK_HOSPITALITY=https://vps22776.cubepath.net/webhook/hospitality
```

**Save** → **Redeploy con rebuild** (obligatorio — son variables VITE_*)

---

## Probar

1. Abre NexusRecover en el navegador
2. Llega al paso 3 (Nexus Plan) con el optimizer ejecutado
3. Clic en **Notify Authorities** o **Notify Hospitality**
4. En N8N → **Executions** deberías ver el webhook recibido
5. Revisa tu email para confirmar que llegó

---

## Estructura del workflow

```
Webhook (recibe POST)
    ↓
Code Node (formatea email en HTML)
    ↓
Email Node (envía vía Gmail SMTP)
```

- **Authorities**: parsea `diversion_orders`, `hold_orders`, y `alternate_airports_activated`
- **Hospitality**: parsea `alternate_airport_ops`, `stranded_pax_at_hub`, y `yyz_hub_requirements`

---

## Troubleshooting

**❌ "SMTP Error 535: Invalid credentials"**
→ La app password es incorrecta o no está configurada. Revisa en Google myaccount.

**❌ Webhook recibido pero email no llega**
→ Revisa el **Execution** en N8N para ver el error específico.

**❌ "Email node not found"**
→ N8N puede tener versiones distintas. El tipo podría ser:
  - `n8n-nodes-base.emailSend` (SMTP genérico)
  - `n8n-nodes-base.gmailSend` (Gmail API)

Usa `emailSend` con credencial SMTP configurada.

---

¿Listo? Dime:
1. Tu correo de Gmail
2. App password (16 caracteres)
3. Emails destinatarios para cada notificación

Y configuro todo en N8N por ti.
