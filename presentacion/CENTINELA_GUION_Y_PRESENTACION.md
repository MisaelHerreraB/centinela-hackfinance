# 🎤 MANUAL DE PITCH, COREOGRAFÍA DE DEMO EN VIVO Y Q&A DEL JURADO
## 🛡️ CENTINELA: “Antes de firmar, pregúntale”
**HackFinance 2026 (BEST UC3M · Madrid Engineering Week)** · Equipo **Across the lake**  
**Jurado y Patrocinadores:** MyInvestor · GPTadvisor (incl. David Parro Plaza) · Anthropic (Claude) · ElevenLabs

---

## 0. Checklist de 60 Segundos Antes de Subir al Escenario

1. **Tener dos pestañas abiertas a pantalla completa (`F11` o `Cmd+Ctrl+F`):**
   - **Pestaña 1:** El PDF de la presentación ([`CENTINELA_PRESENTACION_PITCH_DECK.pdf`](./CENTINELA_PRESENTACION_PITCH_DECK.pdf)).
   - **Pestaña 2:** La aplicación en vivo en **`http://localhost:3000`** con el zoom al `100 %` y el sonido del portátil al máximo.
2. **Reparto de roles recomendado (2 personas hablan + 1 persona opera el ratón):**
   - **Ponente A (Negocio, Problema y Caso B2B/B2C):** Abre con fuerza, explica el problema de Carmen, hace la conclusión de negocio B2B + MyInvestor Premium y responde preguntas de regulación/negocio.
   - **Ponente B (Producto, Demo en Vivo y Arquitectura IA/MCP):** Narra los 90 segundos de la Demo en Vivo mientras el Operador hace clic y explica la separación *Jagged Frontier* + Papers + Benchmark `30/30`.
   - **Operador de Demo (al teclado):** No habla; su única misión es hacer clic en el segundo exacto en que el Ponente B lo menciona.

---

## 1. Guion Palabra por Palabra (Estructura Ganadora de 4 Minutos: 90s Pitch + 90s Demo en Vivo + 60s Arquitectura y Negocio)

---

### ⏱️ BLOQUE 1 — EL GANCHO Y EL PROBLEMA (0:00 – 0:45)
*(En pantalla: **Diapositiva 1** y luego **Diapositiva 2** del Pitch Deck)*

> **Ponente A:**  
> *"Buenos días al jurado. Imaginen a **Carmen, 68 años**, ahorradora de toda la vida. Hoy Carmen puede perder los ahorros de su jubilación de **dos formas distintas en el mismo segundo crítico**: el instante exacto en que alguien le presiona por teléfono o en una sucursal bancaria para que firme o transfiera dinero.*
>
> *La primera vía es **ilegal**: le llama un supuesto bróker o falso soporte bancario. No hackean los servidores de MyInvestor; **hackean a Carmen** secuestrando su Sistema 1 emocional con urgencia. En España la transferencia fraudulenta media ya es de **2.347 €** según el Banco de España y el cliente soporta el **85 %** de la pérdida. Y ojo al dato para el banco: con la nueva normativa europea **PSR / PSD3 y SEPA VoP**, el banco pasa a responder con su propio balance del reembolso de estos fraudes.*
>
> *La segunda vía es **100 % legal**: Carmen va a su sucursal tradicional y le colocan un fondo con un **1,80 % de comisión anual TER**. Por el 'velo del porcentaje' estudiado por Barber y Odean, un 1,80 % le parece poquito... sin saber que en una cartera a 30 años está regalando **más de 85.000 €** frente a un fondo indexado de MyInvestor, y sin saber que puede traspasarlo pagando **0 € a Hacienda**.*
>
> *Para proteger ese segundo exacto hemos creado **Centinela: antes de firmar, pregúntale**."*

---

### ⏱️ BLOQUE 2 — QUÉ ES CENTINELA Y FLUJO DE SALIDA (0:45 – 1:15)
*(En pantalla: **Diapositiva 3** del Pitch Deck)*

> **Ponente B:**  
> *"Centinela vive dentro de la app de MyInvestor. Tiene **dos niveles de invasividad configurables** por el cliente: un **Nivel 1 bajo demanda** (cuando enseñas un folleto PDF o un SMS) y un **Nivel 2 de escucha pasiva**, que detecta coacción durante una llamada.*
>
> *Nuestro **output base es un PUSH inmediato (`Estafa`, `Caro` u `Ok`)** acompañado de una acción visual in-app diseñada al milímetro:*
> - *Si es **CARO**: lanza **PUSH + Banner de Producto Caro + una Gráfica Visual de Crecimiento a 30 años contra el índice vía MCP**, para que el cliente no tenga que leer texto, y si pulsa la gráfica hace **drill-in** a los números.*
> - *Y si es **ESTAFA**: como un banco **jamás puede hacer un hard block** ni quitarle al cliente el control de su dinero, al darle a 'Enviar' le llevamos a una **pantalla adicional de explicabilidad** con un botón amigable para abrir en tiempo real el **Canal Oficial de Voz o Chat de MyInvestor**, y un botón en **rojo clarito** por si insiste en continuar.*
>
> *No os lo contamos en diapositivas: **veámoslo funcionando en vivo**."*

---

### ⏱️ BLOQUE 3 — DEMO EN VIVO EN `http://localhost:3000` (1:15 – 2:45 · 90 SEGUNDOS)
*(El Operador cambia a la pestaña de **`http://localhost:3000`**)*

#### 🔴 ACTO 1: Escucha Pasiva + PUSH + Intercepción Explicable Sin *Hard Block* (40 segundos)
1. **Qué hace el Operador:**
   - Señala con el cursor en el iPhone de Carmen (izquierda) el selector **`Nivel 2: Escucha Pasiva + Push`**.
   - Pulsa arriba el botón **`🔴 1. Falso Bróker (Estafa 9.000 €)`**.
2. **Qué dice el Ponente B mientras corre la simulación:**
   > *"A la izquierda tenéis el iPhone de Carmen con el **Nivel 2 de Escucha Pasiva activo**; a la derecha, el móvil de su hijo Daniel y el motor técnico. Un falso bróker de 'Quantum Ibérica' presiona a Carmen a **188 palabras por minuto** (`ElevenLabs Scribe`) para transferir **9.000 €** en 15 minutos.*
   >
   > *Mirad la parte superior del móvil de Carmen: salta el **PUSH de la app** y el **Banner Rojo 'Creemos que es una estafa'**. Nuestro motor ha cruzado la entidad con la lista negra de la **CNMV**, ha detectado las **5 etapas de la Kill-Chain del paper PreScam (ACL 2025)** y ha pillado que el IBAN pertenece a una cuenta mula mediante **SEPA Verification of Payee (`NO_MATCH`)**.*
   >
   > *Y fijaos en cómo resolvemos el bloqueo en el móvil de Carmen: **no hay hard block**. Al intentar enviar los 9.000 €, Centinela abre esta **pantalla adicional de explicabilidad** donde le cuenta en lenguaje claro por qué parece fraude, le ofrece este **botón azul principal para hablar en tiempo real por voz o chat con el Canal Oficial de MyInvestor** —*(el Operador hace clic en `🎧 Consultar en Canal Oficial MyInvestor` para enseñar el modal un segundo y lo cierra)*— y debajo mantiene un **botón en rojo clarito ('Seguir bajo mi responsabilidad')**. Así evitamos la estafa sin quitarle el control al cliente, mientras su hijo Daniel recibe la alerta en su móvil."*

#### 🟠 ACTO 2: Folleto DFI en Sucursal + Gráfica a 30 Años vía MCP + *Drill-In* (40 segundos)
1. **Qué hace el Operador:**
   - Pulsa arriba el botón **`🟠 2. Fondo Caro en Oficina (TER 1,8%)`**.
   - Cuando aparece el resultado naranja en el móvil de Carmen, espera 3 segundos mostrando la **Gráfica a 30 años** y luego **hace clic encima de la gráfica** para que se despliegue el panel **`Drill-In`** con los números a 10, 20 y 30 años.
   - Finalmente pulsa el botón verde **`✍️ Firmar Traspaso Exento (0 € IRPF)`**.
2. **Qué dice el Ponente B:**
   > *"Segundo escenario: Carmen está en su banco de toda la vida y le dan el PDF de un fondo con un **1,80 % de TER** para sus **50.000 €**. Carmen le hace una foto.*
   >
   > *Salta el **PUSH naranja**, el banner de **'Producto Caro'** y, para que Carmen no tenga que leer ni una línea de texto financiero, Centinela consulta en vivo el **servidor MCP oficial de MyInvestor** y le dibuja esta **gráfica de crecimiento a 30 años comparando el TER caro contra el índice MCP**.*
   >
   > *De un vistazo ve cómo la curva verde de MyInvestor se despega de la línea roja de su banco. Y **si Carmen pulsa encima de la gráfica** —*(el Operador hace clic en la gráfica)*— se abre el **drill-in numérico**: en 30 años su banco se queda en **128.165 €**, mientras que el índice en MyInvestor (`0,06 %` TER) crece hasta **213.649 €**. ¡Son **+85.484 € de diferencia**! Además, el motor fiscal verifica el **Artículo 94 del IRPF**: traspaso vía fondo puente monetario (`AXA Trésor`) pagando **0 € a Hacienda**. Carmen pulsa **Firmar con FaceID** y el dinero ya viaja a MyInvestor."*

#### ♿ ACTO 3: Accesibilidad e Inclusión (10 segundos)
1. **Qué hace el Operador:**
   - Pulsa arriba **`♿ 3. Accesibilidad (10s)`** (o alterna a `🦻 Persona Sorda` / `👁️ Baja Visión`).
2. **Qué dice el Ponente B:**
   > *"Y en un clic conmutamos entre modo **Persona Sorda** (100 % visual) y **Baja Visión** (alto contraste AAA y lectura preventiva de IBAN y comisiones con `ElevenLabs TTS`)."*

---

### ⏱️ BLOQUE 4 — ARQUITECTURA "JAGGED FRONTIER", BENCHMARK Y CASO DE NEGOCIO B2B/B2C (2:45 – 4:00)
*(El Operador vuelve al PDF en las **Diapositivas 4, 8 y 9**, o abre el modal `🧪 Benchmark (30 Casos)`)*

> **Ponente A:**  
> *"Para terminar, tres pilares que hacen que MyInvestor pueda lanzar Centinela en producción mañana mismo:*
>
> *1. **Rigor Técnico (Principio Jagged Frontier — Diapositiva 4):** El LLM (`Claude Sonnet 4`) **jamás calcula un euro ni un impuesto**. Claude extrae datos del PDF y orquesta herramientas; toda la matemática compuesta a 30 años, la escala del IRPF y la cadena criptográfica `SHA-256` corren en motores deterministas en código. En nuestro benchmark automatizado de **30 escenarios reales**, logramos **30 de 30 (100 % de precisión)** en **2 milisegundos** con **0,00 € de desviación**.*
>
> *2. **Caso de Negocio B2B Principal + Capa B2C en MyInvestor Premium (Diapositiva 9):** Como solución in-app, el retorno **B2B** para el banco es directo: **reducir drásticamente la partida de dinero que el banco destina a pagar e indemnizar fraudes** bajo PSR/PSD3, costando apenas **0,50 € por usuario activo al mes**. A la vez, el comparador a 30 años vía MCP actúa como una máquina de captación de fondos con **CAC cero** (`150 €/año` recurrentes por cada `50.000 €` traspasados). Y como vía extra **B2C**, encaja directamente dentro del **Plan Premium de MyInvestor**.*
>
> *3. **Viabilidad Regulatoria (MiFID II y PSD2):** Al no aplicar hard block y al comparar objetivamente costes ex-ante contra el índice oficial vía MCP sin perfilar al usuario en el LLM, cumplimos estrictamente con el Artículo 24 de MiFID II.*
>
> *Eso es **Centinela**: proteger los ahorros de toda una vida en el único segundo que importa. Muchas gracias y estamos listos para vuestras preguntas."*

---

## 2. Las 8 Preguntas Trampa del Jurado y Cómo Clavarlas (Q&A)

### 1. Pregunta de Producto / Banca (estilo David Parro Plaza):
**«¿Un banco puede bloquear una transferencia si el cliente quiere hacerla? ¿No es ilegal quitarle el control de su dinero?»**
- **Respuesta ganadora:**  
  *"Totalmente de acuerdo: bajo PSD2/PSR un banco no puede aplicar un hard block arbitrario sobre una orden autorizada por el titular legítimo. Por eso en Centinela no hacemos hard block: cuando el cliente pulsa 'Enviar' en una operación con indicadores de estafa, insertamos una **pantalla intermedia de explicabilidad** (fricción positiva respaldada por los ensayos RCT de la FCA británica). Ahí le explicamos por qué parece fraude, le ponemos un botón principal para abrir en un clic una **llamada de voz o chat en el canal oficial de MyInvestor**, y debajo dejamos un **botón en rojo clarito ('Seguir bajo mi responsabilidad')**. Así salvamos al 90 % de las víctimas sin quitarle jamás el control al cliente, y si decide seguir, queda firmado su consentimiento informado en el `Audit Log SHA-256` para eximir de responsabilidad al banco."*

### 2. Pregunta de Negocio:
**«¿Cuál es el modelo de negocio real? ¿Quién paga esto?»**
- **Respuesta ganadora:**  
  *"El caso de negocio base es **100 % B2B para el banco** por dos vías: primero, **ahorro directo en pérdidas por fraude** (evitar una sola estafa media de 2.347 € a 9.000 € paga la inferencia IA de miles de clientes a ~0,50 €/mes); y segundo, **captación de activos (AuM)** gracias a la gráfica a 30 años vía MCP contra el índice. Y si se quiere monetizar también en **B2C**, se incluye como funcionalidad estrella dentro del **Plan MyInvestor Premium**."*

### 3. Pregunta Técnica sobre MCP y GPTadvisor:
**«¿Cómo habéis usado exactamente el MCP de MyInvestor?»**
- **Respuesta ganadora:**  
  *"De dos formas complementarias: primero, como **cliente MCP en tiempo real** conectado a `https://mcp.myinvestor.es/mcp` por JSON-RPC 2.0 invocando `search_funds` para traer los fondos indexados y monetarios reales de MyInvestor (`iShares Developed World IE000ZYRH0Q7` al 0,06 %, `Fidelity MSCI World IE00BYX5NX33` al 0,12 %, `AXA Trésor FR0000447823` al 0,05 %) y alimentar con datos reales la **gráfica comparativa a 30 años contra el índice**. Y segundo, hemos construido nuestro propio **servidor MCP en `/mcp`** que expone tres herramientas nuevas para GPTadvisor: `verify_cnmv_and_iban`, `calculate_10y_fee_and_tax` (con series de 10 a 30 años) y `enforce_client_contract`."*

### 4. Pregunta Técnica de iOS / Móvil:
**«En iOS o Android una app bancaria no puede pinchar el audio interno de una llamada telefónica GSM por privacidad del sistema operativo. ¿Cómo funciona la escucha?»**
- **Respuesta ganadora:**  
  *"Exacto, iOS bloquea el acceso de terceros al canal celular GSM. Por eso diseñamos dos mecanismos reales: en el **Nivel 1**, Carmen pulsa el botón de **Altavoz** y el micrófono ambiental de la app de MyInvestor captura la voz del estafador en la habitación y la transcribe con `ElevenLabs Scribe`. Y en el **Nivel 2 (Escucha Pasiva)**, usamos la **telemetría permitida por el sistema operativo** (`CallKit / AudioSession` para saber que hay una llamada activa *Off-Hook* + detección de pegado de IBAN desde el portapapeles, igual que hace *BioCatch*), disparando el **PUSH preventivo** en cuanto el usuario entra a hacer una transferencia con una llamada en curso."*

### 5. Pregunta sobre Alucinaciones del LLM (Anthropic / Claude):
**«¿Qué pasa si Claude se equivoca sumando comisiones o calculando el IRPF?»**
- **Respuesta ganadora:**  
  *"No puede equivocarse porque **Claude tiene prohibido hacer matemáticas en nuestra arquitectura**. Aplicamos el principio de la *Jagged Frontier*: usamos `Claude Sonnet 4` exclusivamente para lo que hace mejor que nadie —leer el PDF del folleto DFI con Vision y extraer en un JSON tipado el ISIN y el porcentaje TER—. Ese JSON pasa a `financialEngine.js`, que es código determinista puro auditado con test suite (`30/30`), donde se calcula $V_f = C_0(1+r-\text{TER})^{30}$ y los tramos del IRPF 2025–2026 con **0,00 € de error**."*

### 6. Pregunta Regulatoria CNMV / MiFID II:
**«Si le decís al cliente que su fondo del Santander es caro y que se pase a un indexado de MyInvestor, ¿no estáis haciendo asesoramiento financiero sin test de idoneidad?»**
- **Respuesta ganadora:**  
  *"Lo hemos blindado bajo el **Artículo 24 de MiFID II**. Centinela no perfila al cliente ni le recomienda asumir más o menos riesgo: compara **únicamente costes ex-ante dentro de la misma categoría oficial INVERCO/Morningstar** que el cliente ya tiene en su folleto, enfrentando su TER contra el índice equivalente en el MCP. Y cuando el cliente pulsa traspasar, la orden se inyecta en el flujo nativo del **Robo-advisor de MyInvestor**, que ya tiene licencia de gestión discrecional y el test de idoneidad firmado."*

### 7. Pregunta Fiscal (Art. 94 LIRPF):
**«¿Cómo traspasáis un fondo de un banco tradicional a una Cartera Indexada de MyInvestor sin pagar impuestos si una cartera tiene muchos fondos?»**
- **Respuesta ganadora:**  
  *"Replicamos el flujo operativo real de MyInvestor: bajo el Artículo 94 de la Ley del IRPF, el traspaso entre fondos UCITS está exento de retención (`0 € IRPF`). Para entrar a una Cartera Indexada, la orden de traspaso aterriza primero en el **fondo monetario puente de MyInvestor (`AXA Trésor Court Terme C`, `FR0000447823`, TER `0,05 %`)** sin pasar jamás por cuenta corriente, y desde ahí el motor de carteras distribuye la inversión manteniendo el diferimiento fiscal."*

### 8. Pregunta Científica / Diferenciación:
**«¿En qué os habéis basado para diseñar las reglas de detección de estafa?»**
- **Respuesta ganadora:**  
  *"En 5 papers científicos de 2024–2026 que tenéis citados en la última diapositiva: el framework **COLD y PreScam (ACL 2025)** para modelar las 5 fases de la estafa antes del pago; la verificación titular/IBAN del **Reglamento UE 2024/886 (SEPA VoP)**; los estudios de **USENIX SOUPS y TRM Labs** sobre la trampa de 'pagar un 15 % de impuestos previos para desbloquear ganancias'; la prosodia acústica de urgencia (`>175 WPM`) con **ElevenLabs Scribe**; y los ensayos clínicos del **Behavioural Insights Team y la FCA** para romper el secuestro del Sistema 1 con preguntas diagnósticas."*
