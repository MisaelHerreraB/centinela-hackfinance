# 🛡️ CENTINELA: “Antes de firmar, pregúntale”
**Presentación Oficial, Guion de Defensa para el Jurado y Bibliografía Científica**  
**HackFinance 2026 (BEST UC3M · Madrid Engineering Week)** · Patrocinadores: **MyInvestor · GPTadvisor · Anthropic (Claude) · ElevenLabs**

---

## Índice de Diapositivas (16:9 Pitch Deck)

### Diapositiva 1 — Portada Ejecutiva
- **Título:** CENTINELA · *“Antes de firmar, pregúntale.”*
- **Subtítulo:** Cortafuegos Financiero Multimodal, Auditor de Costes vía MCP y Gobernanza Programable In-App.
- **KPIs de portada:**
  - `30 / 30` Precisión en Benchmark (`100 %` en `1,2 ms/caso`).
  - `0,00 €` Alucinación matemática (*Principio Jagged Frontier*).
  - `+10.635 €` Ahorro a 10 años sobre `50.000 €` (`TER 1,80 %` vs `0,30 %`).
  - `0 € IRPF` Traspaso exento bajo Art. 94 LIRPF vía Fondo Puente.
- **Guion para el ponente (15 s):**
  > *"Buenos días al jurado. Somos el equipo Across the lake y hemos construido Centinela: el primer módulo dentro de la app de MyInvestor que actúa en el único segundo que hoy ningún banco protege: el instante exacto en que alguien presiona a un ahorrador por teléfono o en una sucursal para que firme o transfiera."*

---

### Diapositiva 2 — El Problema Real: Dos Vías de Pérdida en el Mismo Segundo Crítico
- **La historia de Carmen (68 años):**
  1. **Vía Criminal (Manipulación Psicológica / Vishing / APP Fraud):**
     - La transferencia fraudulenta media en España es de **2.347 €** (*Banco de España, 2025*) y el cliente asume el **85 %** de la pérdida en pagos autorizados bajo engaño (*EBA-BCE, 2025*).
     - El estafador induce un **secuestro del Sistema 1 (Kahneman)** usando urgencia y falsa autoridad. Los ensayos clínicos del *Behavioural Insights Team (BIT)* y la *FCA* demuestran que el **88 %** de las víctimas ignora los avisos genéricos en pantalla.
     - Además, bajo el nuevo **Reglamento Europeo PSR / PSD3**, el banco pasa a ser responsable del **100 %** del reembolso en fraudes de suplantación bancaria o fallos de verificación de titularidad (*SEPA VoP*).
  2. **Vía Legal (Comisiones Ocultas y Peaje Fiscal Evitable):**
     - En España hay **450.000–482.000 M€** en fondos de inversión (*INVERCO*), con techos legales del **2,25 %** de gestión (*CNMV*) frente al **0,12 %–0,30 %** indexado en MyInvestor.
     - Por el **Velo del Porcentaje** (*Barber, Odean & Zheng, 2005*) y el **Sesgo de Crecimiento Exponencial** (*Stango & Zinman, 2009*), el cliente ve un `1,80 %` como algo pequeño, sin saber que perderá **10.635 €** en 10 años y que puede traspasar pagando **0 € a Hacienda** (Art. 94 LIRPF).

---

### Diapositiva 3 — La Solución: Output PUSH (`Estafa / Caro / Ok`) + Gráfica 30 Años + Intercepción Explicable Sin Hard Block
- **Paso 1 — 2 Niveles de Escucha Pasiva e Ingesta Multimodal:**
  - **Nivel 1 (Bajo Demanda):** El cliente consulta puntualmente una llamada, audio, SMS o folleto DFI.
  - **Nivel 2 (Escucha Pasiva + PUSH):** En llamada activa, detecta coacción y dispara automáticamente la notificación **PUSH (`Estafa / Caro / Ok`)**.
- **Paso 2 — Output Base = PUSH + Banner In-App:**
  - En **`ESTAFA`**: **PUSH** + Banner Rojo *"Creemos que es una estafa"*.
  - En **`CARO`**: **PUSH** + Banner *"Producto Caro"* + **Gráfica In-App de Crecimiento a 30 Años (TER Caro vs. TER Barato / Índice MCP)** para que el cliente no tenga que leer texto; si pulsa la gráfica, se abre el **Drill-In** numérico.
  - En **`OK`**: **PUSH** + Sello verde verificando costes competitivos contra el índice MCP.
- **Paso 3 — Intercepción Explicable (Sin *Hard Block*) y Traspaso 0 € IRPF:**
  - En **`ESTAFA` (Sin *Hard Block*):** El banco no puede aplicar un *hard block* que quite el control al cliente. Al darle a *Enviar*, Centinela lleva a una **pantalla adicional de explicabilidad** del fraude con un botón principal amigable para abrir el **Canal Oficial en Tiempo Real (Voz / Chat)** y un botón en **rojo clarito** (*"Seguir bajo mi responsabilidad"*).
  - En **`CARO`**: Tras pulsar la gráfica a 30 años (*Drill-In*), deja pre-rellenada la **Orden de Traspaso Exento de IRPF (`0 €`)** hacia MyInvestor lista para firmar con FaceID.

---

### Diapositiva 4 — Arquitectura Técnica en 3 Capas (*Jagged Frontier*: Cero Cálculos en el LLM)
- **Capa 1 — Escucha Pasiva (2 Niveles), Percepción Multimodal y Accesibilidad Universal:**
  - `ElevenLabs Scribe (scribe_v1)` con *word-level timestamps* para medir cadencia vocal (`WPM`).
  - `Claude Sonnet 4` (Vision, documentos PDF nativos y *Tool Use*).
  - `ElevenLabs TTS (eleven_multilingual_v2)` + 3 modos en vivo: **Estándar**, **Persona Sorda** y **Baja Visión**.
- **Capa 2 — Comparador MCP a 30 Años contra Índice + Servidor MCP Propio:**
  - Conectado en tiempo real a `https://mcp.myinvestor.es/mcp` (`search_funds`) para comparar fondos a **10, 20 y 30 años en base a TER contra índice**.
  - Expone nuestro propio servidor MCP (`POST /mcp`) con las 3 herramientas nuevas para GPTadvisor: `verify_cnmv_and_iban`, `calculate_10y_fee_and_tax` (series 10–30 años + *drill-in*) y `enforce_client_contract`.
- **Capa 3 — Intercepción Explicable ("Mi Contrato") + Audit Log SHA-256 + Seguridad:**
  - Pantalla de explicabilidad sin *hard block* + Canal Oficial Voz/Chat + cadena inmutable `SHA-256` (`prev_hash` → `hash`) y blindaje de red anti-DNS Rebinding y CSRF Cross-Origin.

---

### Diapositiva 5 — Ciencia Antifraude: Los 5 Descubrimientos (2024–2026) Integrados en Código
1. **Máquina de Estados *COLD* & Benchmark *PreScam* (2025):** Mapea toda conversación en 5 fases (`F1 Trust Cultivation` → `F2 Scarcity` → `F3 Pitching` → `F4 Isolation` → `F5 Payoff`) para cortar el ataque antes del desenlace.
2. **SEPA Verification of Payee (`Reg. UE 2024/886`):** Cruza el nombre comercial anunciado (*"Quantum Ibérica"*) con el titular registral del IBAN (*"Comercializadora Puente S.L. - Cuenta Mula"*), disparando `SEPA VoP: NO_MATCH`.
3. **Detector de Extorsión de Salida y Patrón *Bait-and-Escalate* (*USENIX SOUPS / FinCEN / TRM Labs*):** Detecta el cebo de micro-retiro inicial (`100 €`) y bloquea la falsa exigencia de transferir un `15 %` previo para *"liberar ganancias o pagar IRPF"* (recordando que en España la retención del `19 %` se deduce del reembolso).
4. **Prosodia Acústica (`WPM`) y Telemetría *In-Call* (*BioCatch / Wultra*):** Mide la velocidad de habla (`188 WPM > 175 WPM`) con `ElevenLabs Scribe` y detecta la combinación de llamada activa (*Off-Hook*) + pegado de IBAN desde el portapapeles.
5. **Pregunta Diagnóstica RCT (*Behavioural Insights Team / FCA*):** En lugar de un pop-up genérico, formula la pregunta exacta que contradice el guion del estafador, forzando la transición del **Sistema 1 al Sistema 2**.

---

### Diapositiva 6 — Comparativa MCP a 30 Años (TER Caro vs. Índice) + Drill-In + Motor Fiscal
- **Gráfica Visual a 30 Años ($V_f = C_0(1+r-\text{TER})^{30}$ sobre `50.000 €` al `5 %` bruto anual):**
  - Fondo Sucursal (`1,80 % TER`): Año 10 = `67.196 €` · Año 30 = `128.165 €`
  - Cartera Indexada MyInvestor (`0,30 % TER`): Año 10 = `77.831 €` (`+10.635 €`) · Año 30 = `199.078 €` (**`+70.913 €` más patrimonio**)
  - Índice MCP `iShares Developed World` (`IE000ZYRH0Q7`, `0,06 % TER`): Año 10 = `79.699 €` (`+12.503 €`) · Año 30 = `213.649 €` (**`+85.484 €` más patrimonio**)
- **UX *Drill-In* + Saliencia Conductual ESMA (*Pain of Paying*):** El cliente ve primero la gráfica a 30 años sin texto denso y, al pulsar la gráfica, despliega el *Drill-In* con los números exactos y el drenaje mensual (**`-63 €/mes`**).
- **Matriz Fiscal Art. 94 LIRPF + Fondo Puente:**
  - Traspaso exento (`0 € IRPF`) aterrizando en el monetario puente `AXA Trésor Court Terme C` (`FR0000447823`, TER `0,05 %`), ahorrando `1.665 €` de impuestos hoy sobre una plusvalía de `8.500 €` (escala AEAT `19 %–30 %`).
  - Alerta automáticamente si el producto es un **ETF, Depósito o Seguro Unit-Linked** (no traspasables) o un **Fondo Garantizado** con penalización de salida (`4 %`).

---

### Diapositiva 7 — Demo en Vivo en 3 Actos (90 Segundos)
- **Acto 1 (40s — Falso Bróker, Escucha Pasiva y Sin *Hard Block*):** Llamada de *Quantum Ibérica* pidiendo `9.000 €` → Salta **PUSH** + **Banner Rojo *"Creemos que es una estafa"***. Al pulsar *Enviar*, abre la **pantalla adicional de explicabilidad** con botón principal al **Canal Oficial en Tiempo Real (Voz / Chat)** y botón en **rojo clarito** (*Seguir bajo mi responsabilidad*), más alerta al móvil de Daniel.
- **Acto 2 (40s — Folleto DFI Sucursal, Gráfica 30 Años y *Drill-In*):** Subida del folleto al `1,80 %` → Salta **PUSH** + **Banner *"Producto Caro"*** + **Gráfica de Crecimiento a 30 Años vs. Índice MCP** (`+85.484 €`). Al pulsar la gráfica se abre el *Drill-In* numérico y Carmen firma el traspaso exento (`0 € IRPF`) con FaceID In-App.
- **Acto 3 (10s — Accesibilidad):** Conmutación instantánea a **Modo Persona Sorda** y **Modo Baja Visión**.

---

### Diapositiva 8 — Validación Empírica: Benchmark de 30 Casos (`30/30` — `100 %`)
- **10 Casos `ESTAFA` (`10/10`):** Chiringuitos CNMV, smishing MyInvestor, falsa cuenta segura BdE, AnyDesk+OTP, IBAN lituano, extorsión de desbloqueo.
- **10 Casos `CARO` (`10/10`):** Fondos RV/Mixtos/Monetarios caros, tope legal CNMV (`2,45 %`), garantizados con `4 %` de salida, Unit-Linked y ETFs no traspasables.
- **10 Casos `ADELANTE` (`10/10`):** Fondos indexados reales del MCP de MyInvestor (`IE00BYX5NX33`, `IE000ZYRH0Q7`, `FR0000447823`, Carteras Ahorro/Indie/Metal).

---

### Diapositiva 9 — Caso de Negocio B2B (Ahorro Bancario en Fraudes) + B2C (MyInvestor Premium) & Viabilidad Legal
- **Core B2B — Reducir el Dinero que el Banco Destina a Pagar Fraudes:** Bajo el nuevo **PSR / PSD3 y SEPA VoP (`Reg. UE 2024/886`)**, el banco asume el reembolso de fraudes por suplantación o fallos de verificación de titularidad. Centinela reduce drásticamente esa partida de pérdidas bancarias con un coste marginal de `~0,50 €/usuario activo/mes`.
- **Palanca B2B de Captación vía MCP (Comparativa a 30 años contra índice):** Cada traspaso de `50.000 €` atraído por la gráfica a 30 años genera `150 €/año` recurrentes (`1.500 € LTV` a 10 años).
- **Extensión B2C Extra — Plan MyInvestor Premium:** Se ofrece como ventaja diferencial dentro de la suscripción **MyInvestor Premium** (escucha pasiva Nivel 2 con PUSH, comparador MCP a 30 años con *drill-in* y escudo familiar).
- **Viabilidad Legal (Sin *Hard Block* PSD2/PSR + MiFID II Art. 24):** No aplica un *hard block* ilegal que quite al cliente el control de su dinero, sino una pantalla de explicabilidad + canal oficial en vivo; y compara objetivamente costes ex-ante contra el índice MCP sin perfilado de idoneidad en el LLM.

---

### Diapositiva 10 — Fuentes Científicas, Papers (2005–2026) y Normativa Oficial

#### A. Papers sobre Detección de Fraude, Vishing 2.0 y Economía Conductual
1. **PreScam Benchmark (2025):** *"PreScam: A Benchmark for Predicting Scam Progression from Early Conversations"*. Modelado multi-turno de progresión de estafas y predicción temprana antes de la fase de extracción (*Payoff*).
2. **COLD Framework (2024–2025):** *"Linguistic Dynamics of Online Scam Conversations (Contextual Organization of Language in Deception)"*. Identifica las 5 etapas lingüísticas del engaño (*Trust Cultivation, Risk Fabrication, Persuasive Pitching, Compliance Induction, Exploitation*).
3. **VishGPT & Real-Time Multimodal Vishing Detection (2024–2026):** *"Automatically Detecting Voice Phishing: A Large Audio Model Approach"* (MIS Quarterly / University of Patras). Fusión de transcripción semántica (ASR) con marcadores paralingüísticos y prosódicos de urgencia (velocidad de habla en palabras por minuto `WPM` y compresión de turnos).
4. **USENIX SOUPS & FinCEN / TRM Labs / Elliptic Reports (2024–2026):** Estudios empíricos sobre el embudo transaccional de falsos brókers (*Boiler Rooms & Pig Butchering*): mecanismo de cebo con micro-retiros iniciales (*Bait-and-Escalate*) y fase de extorsión de liquidez mediante falsas tasas previas o impuestos de desbloqueo.
5. **Behavioural Insights Team (BIT), UK FCA & Payment Systems Regulator (PSR) Trials (2024–2025):** Ensayos Controlados Aleatorizados (RCTs) sobre *Friction-by-Design* en pagos autorizados (APP Fraud), demostrando la eficacia de las preguntas diagnósticas de contradicción frente a los avisos pasivos para forzar la transición del **Sistema 1 al Sistema 2** (*Kahneman, 2011: Thinking, Fast and Slow*).
6. **Active Call & Behavioral Biometrics Coercion Telemetry (BioCatch / Wultra / OneSpan, 2024–2025):** Detección contextual de coacción bancaria combinando estado de llamada activa (*Off-Hook*) con eventos de pegado de IBAN desde el portapapeles (*Clipboard Paste*).

#### B. Papers sobre Finanzas Conductuales (Comisiones) y Fuentes Regulatorias
7. **Barber, B. M., Odean, T., & Zheng, L. (2005):** *"Out of Sight, Out of Mind: The Effects of Expenses on Mutual Fund Flows"*, *The Journal of Business*, 78(6), 2095–2120. Demuestra la baja saliencia cognitiva de las comisiones anuales expresadas en porcentaje (*Percentage Veil*).
8. **Stango, V., & Zinman, J. (2009):** *"Exponential Growth Bias and Household Finance"*, *The Journal of Finance*, 64(6), 2807–2849. Demuestra por qué los hogares subestiman sistemáticamente el efecto compuesto a largo plazo.
9. **Fisch, J. E., & Wilkinson-Ryan, T. / ESMA Cost Disclosure Studies:** Evidencia experimental sobre *Fee Salience*: traducir porcentajes TER a unidades monetarias tangibles (coste mensual/diario y pérdida acumulada en euros a 10 años) incrementa significativamente la sensibilidad del inversor minorista.
10. **Banco de España (2025) & EBA-BCE (2025):** Informes de supervisión sobre fraude en pagos autorizados en España (`2.347 €` importe medio por transferencia fraudulenta; `85 %` de pérdida soportada por el cliente).
11. **Reglamento (UE) 2024/886 (SEPA Instant Payments — Verification of Payee) & Propuesta Europea PSR / PSD3:** Obligación de verificar la coincidencia entre el nombre del beneficiario y el titular del IBAN (`MATCH / NO_MATCH`) y régimen de responsabilidad del proveedor de servicios de pago en estafas de suplantación bancaria.
12. **Ley 35/2006 del IRPF (Art. 94 y Escala del Ahorro AEAT 2025–2026), CNMV e INVERCO:** Régimen de diferimiento fiscal en traspasos entre Instituciones de Inversión Colectiva (`0 €` peaje fiscal) y límites máximos legales de comisiones de gestión (`2,25 %`) y depósito (`0,20 %`) en España.
