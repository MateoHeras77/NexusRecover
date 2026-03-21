### Fase 1: Fundamentos de Datos (Data & Schemas)
El objetivo es crear la única fuente de la verdad para todo el sistema. Sin una API ni interfaz, solo modelos de datos y el escenario simulado.

* **¿Qué se va a crear?**
  * Modelos de datos (clases en Pydantic o interfaces de TypeScript) para Aeropuertos, Vuelos, Conexiones y Reglas de Costo.
  * El archivo estático `mock_data.json` que contiene el escenario base (Estado Nominal) y el escenario alterado (Tormenta en YYZ).
* **Pruebas a ejecutar:**
  * Test de validación de esquema: Un script simple debe cargar el JSON y confirmar que todos los tipos de datos (strings, integers, arrays) son correctos.
* **Criterios de Aprobación (DoD):**
  * [ ] El JSON contiene al menos 1 aeropuerto Hub (YYZ), 1 aeropuerto alterno, 3 vuelos de llegada y 3 de salida.
  * [ ] Al menos un vuelo de llegada tiene un bloque `connections` válido que apunta a un vuelo de salida.
  * [ ] El archivo pasa la validación de Pydantic sin arrojar errores.

---

### Fase 2: El Cerebro Matemático (Solver OR-Tools)
El objetivo es construir la lógica pura. Se desarrolla como un script de Python aislado que entra por la terminal y sale por la terminal.

* **¿Qué se va a crear?**
  * Archivo `optimizer.py`.
  * La función de costo objetivo que minimiza gastos (retrasos vs. conexiones perdidas).
  * La implementación de restricciones suaves (Soft Constraints) para evitar colapsos lógicos.
* **Pruebas a ejecutar:**
  * **Unit Test de Rentabilidad:** Pasar un caso donde dejar pasajeros botados cueste $5,000 y retrasar el avión cueste $1,000. El script debe decidir retrasar.
  * **Unit Test de Inviabilidad:** Pasar un caso donde sea físicamente imposible aterrizar. El script no debe fallar con error del sistema, sino devolver un JSON con el estado de vuelo "CANCELLED" y el costo de penalización sumado.
* **Criterios de Aprobación (DoD):**
  * [ ] El script se ejecuta localmente (`python optimizer.py`) en menos de 3 segundos.
  * [ ] Lee el `mock_data.json` y escupe un `recovery_plan.json` válido.
  * [ ] El costo total calculado tiene sentido matemático demostrable según las reglas del JSON inicial.

---

### Fase 3: Capa de Servicios y API (Backend FastAPI)
El objetivo es envolver el motor matemático en un servidor web y preparar el terreno para la IA.

* **¿Qué se va a crear?**
  * Servidor web en FastAPI.
  * Endpoints REST: `GET /api/network/state`, `POST /api/network/disrupt`, `POST /api/network/optimize`.
  * Integración inicial del cliente LLM (Vertex AI o Gemini API) en un endpoint `/api/ai/ask`.
* **Pruebas a ejecutar:**
  * Tests de integración (usando `pytest` y `TestClient` de FastAPI) para hacer llamadas HTTP a los endpoints y verificar códigos de estado (200 OK, 400 Bad Request).
* **Criterios de Aprobación (DoD):**
  * [ ] Swagger UI (documentación autogenerada de FastAPI) carga correctamente en el navegador.
  * [ ] Hacer un POST a `/optimize` con el JSON del desastre devuelve el plan de recuperación correcto a través de HTTP.
  * [ ] Hacer un POST a `/ai/ask` devuelve una respuesta de texto coherente generada por el LLM basada en los datos enviados.

---

### Fase 4: Motor Visual y Renderizado (Frontend Core)
El objetivo es levantar la interfaz de usuario y visualizar los datos estáticos del backend. Aún sin interactividad compleja.

* **¿Qué se va a crear?**
  * Proyecto en React (Vite).
  * Implementación de la librería `deck.gl` para el mapa 2.5D.
  * Conexión base: El frontend hace un `GET` a la API al cargar y dibuja los aeropuertos y arcos de vuelo.
* **Pruebas a ejecutar:**
  * Revisión de consola del navegador (cero warnings o errores de red).
  * Pruebas de renderizado: Verificar que `deck.gl` no está duplicando capas de WebGL.
* **Criterios de Aprobación (DoD):**
  * [ ] El mapa de Norteamérica se renderiza con el *Pitch* (inclinación) correcto en modo oscuro.
  * [ ] Los aeropuertos se dibujan en sus coordenadas geográficas reales.
  * [ ] Las parábolas de los vuelos se renderizan y conectan correctamente los nodos origen/destino.

---

### Fase 5: Interactividad, Estado y Copiloto IA (Frontend Polish)
El objetivo es conectar todas las piezas, orquestar la simulación y darle vida a la demostración.

* **¿Qué se va a crear?**
  * Gestor de estado global (Zustand/Context).
  * Componentes UI: Controlador de tiempo (Botones de estado), Tablero de KPIs, Tablas de itinerarios, Panel de chat IA.
  * Coreografía: Que al presionar "Optimizar", el mapa, la tabla y los KPIs reaccionen a la misma respuesta de la API simultáneamente.
* **Pruebas a ejecutar:**
  * **End-to-End (E2E):** Simular el flujo completo del usuario haciendo clic en cada botón.
  * **Stress Test Visual:** Cambiar rápidamente entre el estado nominal y el estado de desastre para asegurar que el mapa no se congele ni deje arcos "fantasma".
  * **AI Guardrail Test:** Preguntarle al chat de la UI un dato falso (ej. "¿Por qué cancelaste el vuelo a París?" cuando París no existe en los datos). La IA debe negarse a responder o corregir amablemente.
* **Criterios de Aprobación (DoD):**
  * [ ] El flujo completo de la historia (Estado Nominal -> Tormenta -> Recuperación Nexus) se ejecuta sin necesidad de refrescar el navegador.
  * [ ] Los cambios de estado (Verde -> Rojo -> Amarillo/Verde) se reflejan de inmediato en los arcos del mapa y las filas de la tabla.
  * [ ] El usuario puede preguntar a la IA sobre un vuelo específico y recibir una respuesta basada 100% en los costos calculados.
