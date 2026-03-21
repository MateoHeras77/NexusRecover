***

# Product Requirements Document (PRD): NexusRecover
**Nivel:** Estrategia, Arquitectura y Requisitos de Producto
**Tipo de Aplicación:** Sistema de Soporte de Decisiones (DSS) para Operaciones Irregulares (IRROPS) de Aerolíneas.

---

## I. Aspectos Generales y de Negocio

### 1. Visión del Proyecto
**NexusRecover** transforma la gestión de desastres operativos en la aviación. En lugar de depender de la intuición humana bajo presión, el sistema utiliza un motor de optimización matemática determinista para recalcular itinerarios en milisegundos, minimizando el impacto financiero y protegiendo a los pasajeros en conexión. A esto se suma una capa de Inteligencia Artificial (LLM) que actúa como un "Copiloto", traduciendo las decisiones matemáticas complejas a un lenguaje natural y auditable para el operador humano.

### 2. Objetivos Core
* **Optimización Financiera:** El sistema debe encontrar el equilibrio matemático exacto entre el costo operativo de retrasar un avión y el costo comercial de dejar a pasajeros en conexión varados (hoteles, reubicación).
* **Integridad del "Connecting Bank":** Priorizar el flujo de pasajeros a través de los *hubs* principales, analizando la red como un todo y no como vuelos aislados.
* **Explicabilidad (XAI):** Eliminar el efecto "Caja Negra" de los algoritmos de optimización. El operador debe poder interrogar al sistema sobre por qué se tomó una decisión.

### 3. Escenario de Uso Principal (El Pitch)
* **El Estado Nominal:** Una red de vuelos simulada operando a tiempo hacia y desde un hub principal (ej. Toronto Pearson - YYZ).
* **La Disrupción:** El usuario inyecta un evento de "Tormenta de Nieve" en YYZ. La capacidad de procesamiento de la pista cae drásticamente.
* **El Conflicto:** Los vuelos de llegada (*Inbound*) sufren retrasos. Los pasajeros que vienen en esos vuelos corren el riesgo de perder sus vuelos de salida (*Outbound*).
* **La Resolución:** El usuario ejecuta el Optimizador. El sistema retrasa estratégicamente ciertos vuelos de salida para esperar a grupos grandes de pasajeros, y despacha a tiempo otros vuelos donde el costo de espera supera al de los pasajeros afectados.

### 4. Reglas de Negocio y Casos Borde (Aviation Logic)
* **Jerarquía de Pasajeros:** 100 pasajeros en conexión pesan más en la ecuación financiera que 1 pasajero.
* **Rotación de Aeronaves (Tail Tracking):** El sistema asume que el mismo avión físico que llega es el que sale. Un retraso en la llegada fuerza matemáticamente un retraso en la salida de esa aeronave específica.
* **Restricciones Físicas (Toques de Queda y Tripulación):** El sistema contempla límites absolutos. Si un retraso empuja un vuelo más allá de las horas legales de la tripulación o del toque de queda del aeropuerto destino, el costo de esa acción se vuelve prohibitivo, forzando la cancelación o el desvío.

---

## II. Especificaciones del Frontend (Interfaz y Experiencia)

La interfaz debe comunicar control, modernidad y claridad durante el caos operativo. Debe manejar el espacio geoespacial y el tiempo sin sobrecargar al usuario.

### 1. Arquitectura Visual (El Mapa 2.5D)
* **Perspectiva:** El mapa base de Norteamérica no debe ser 2D plano ni 3D rotativo completo. Utilizará una perspectiva "Pitch" (inclinada a 45 grados).
* **Nodos y Arcos:** Los aeropuertos son puntos estáticos en el suelo. Los vuelos se representan como parábolas volumétricas (Arcos) que se elevan desde el origen hacia el destino.
* **Código de Colores Estricto:**
    * Verde/Blanco: Operación nominal / A tiempo.
    * Rojo (Pulsante): Vuelo afectado por disrupción / En riesgo de perder conexiones.
    * Amarillo: Vuelo desviado o reprogramado por el optimizador.

### 2. Manejo del Tiempo (Timeline Scrubber)
* **No hay "Play" continuo.** Para evitar problemas de renderizado y mantener el control de la demostración, el tiempo se maneja por estados discretos.
* **Controlador de Eventos:** Una barra inferior permitirá al usuario saltar instantáneamente entre hitos: *1. Operación Normal -> 2. Inyección de Tormenta -> 3. Caos y Retrasos -> 4. Solución Nexus Aplicada.*

### 3. Sincronización Global de UI
* Todos los componentes (Mapa, Tabla de Datos, KPIs) deben estar conectados a un único estado global (ej. Zustand o Redux).
* **Interacción Cruzada:** Al hacer clic en un vuelo en la tabla lateral, el mapa debe hacer un *zoom/pan* automático hacia ese arco y atenuar el resto de la red (mitigando el "efecto telaraña" visual).

### 4. Feedback Visual de Carga
* Dado que el modelo matemático en el backend puede tardar unos segundos en resolver la red, el frontend debe bloquear las interacciones y mostrar un estado de "Calculando miles de rutas posibles..." para evitar clics múltiples que saturen la API.

---

## III. Especificaciones del Backend (Lógica, Datos e IA)

El backend actúa como el orquestador. Debe ser extremadamente rápido, determinista en sus cálculos de red y altamente restringido en sus respuestas de inteligencia artificial.

### 1. El Motor Matemático (El Solver Determinista)
* **Tecnología:** Basado en Programación Lineal Entera Mixta (MILP), utilizando herramientas como Google OR-Tools.
* **La Función Objetivo:** El código debe minimizar matemáticamente una ecuación: `Costo Total = (Minutos de Retraso * Costo Operativo) + (Pasajeros Varados * Costo de Penalización) + (Cancelaciones * Multa Fija)`.
* **Obligación de Restricciones Suaves (Soft Constraints):** Es una regla estricta de arquitectura que el Solver **nunca** debe fallar con un estado `INFEASIBLE`. Todas las restricciones físicas (ej. capacidad de pista) deben modelarse permitiendo su violación a cambio de una multa económica astronómica (ej. $10,000,000). Esto garantiza que la API siempre devuelva un plan, por más catastrófico que sea el escenario.
* **Time-out de Seguridad:** El solver debe estar configurado para abortar la búsqueda a los 3-5 segundos y devolver "la mejor solución encontrada" para garantizar una respuesta rápida en la aplicación web.

### 2. El Copiloto de Inteligencia Artificial (Explicabilidad)
* **Rol:** Un chatbot integrado que recibe el JSON con los resultados del modelo matemático y responde preguntas del usuario.
* **Prevención de Alucinaciones Financieras (Guardrails):** El LLM tiene estrictamente prohibido calcular, sumar, restar o inferir costos. Su *System Prompt* debe obligarlo a leer y citar **únicamente** las cifras exactas provistas por la salida del motor matemático. Si un dato no existe en el contexto, debe declarar desconocimiento.
* **Filtrado de Contexto:** El backend no debe enviar la base de datos entera al LLM. Debe filtrar el JSON y enviar solo el nodo del vuelo por el que pregunta el usuario y sus conexiones inmediatas, evitando saturar la ventana de tokens.

### 3. Estructura Conceptual de Datos (Diccionario de Datos)
El sistema fluye a través de un estado estático (JSON) que se modifica por fases. Debe contener:
* **Costos Globales:** Variables base de penalización (hotel por pasajero, costo por minuto de retraso de aeronave).
* **Aeropuertos (Nodos):** Coordenadas, estado del clima y capacidades operativas (nominales vs. actuales).
* **Vuelos de Llegada (Inbound):** Origen, destino, tiempos programados (STA) y tiempos estimados/retrasados (ETA). Crucialmente, un mapeo exacto de cuántos pasajeros conectan con qué vuelo de salida.
* **Vuelos de Salida (Outbound):** Los vuelos que esperan en el hub. Contienen tiempos programados (STD), tiempos de salida modificados por el optimizador (ETD) y su estado final de recuperación.

---

## IV. Plan de Ejecución Sugerido (Para Asistentes de Código)

Para mantener la integridad del proyecto, el desarrollo debe fluir de adentro hacia afuera, respetando este orden estricto:

1.  **Fase de Datos:** Creación de los modelos de datos (esquemas) y el archivo de simulación inicial (Mock Data) con vuelos de llegada, salidas y mapeo de conexiones.
2.  **Fase de Optimización:** Desarrollo del script aislado del motor matemático (Solver) asegurando que consuma los datos, aplique las restricciones suaves y encuentre el costo mínimo.
3.  **Fase de API (Backend):** Envolver el Solver funcional en un servidor web (RESTful) y conectar la ruta del LLM para el Copiloto IA.
4.  **Fase Visual (Frontend Core):** Inicializar la aplicación web, dibujar el mapa base 2.5D y consumir los datos nominales de la API.
5.  **Fase de Interacción (Frontend Polish):** Conectar el controlador de tiempo (Scrubber), el panel de KPIs financieros, las tablas de itinerarios y la interfaz del chat interactivo.

***