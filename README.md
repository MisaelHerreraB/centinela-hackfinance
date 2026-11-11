# 🛡️ Centinela: Antes de firmar, pregúntale

**HackFinance 2026 (BEST UC3M · Madrid Engineering Week) · Equipo *Across the lake***

> **En una frase:** Dentro de la app de **MyInvestor**, enseñas a **Centinela** lo que te están ofreciendo (una llamada en altavoz, un audio, un SMS o el folleto DFI del banco) y en segundos te dice si es **Estafa**, si es **Caro** o si puedes seguir (**Adelante**), ejecutando tus propias reglas de protección (**Mi Contrato**).

---

## 🎯 Problemática y Valor Diferencial

Un ahorrador pierde dinero de dos formas en el mismo instante crítico —**cuando alguien le presiona por teléfono o en una sucursal para que firme o transfiera**—:
1. **Vía Ilegal (Estafa por manipulación / *Vishing* y *Smishing*):** La transferencia fraudulenta media en España es de **2.347 €** (Banco de España, 2025) y el cliente soporta el **85 % de las pérdidas** cuando él mismo autoriza la orden bajo engaño (EBA-BCE, 2025).
2. **Vía Legal (Productos caros e ilíquidos):** En España hay **450.000–482.000 M€** en fondos de inversión (INVERCO), donde la banca tradicional cobra medias del **1,20 %–1,85 % TER** (con techos legales de gestión del **2,25 %**, CNMV) frente al **0,12 %–0,30 %** de los fondos y carteras indexadas de **MyInvestor**, sin que el cliente calcule la pérdida compuesta a 10 años ni sepa que puede cambiar por **traspaso pagando 0 € en IRPF** (Art. 94 LIRPF).

### Cómo actúa Centinela (`Escucha Pasiva 2 Niveles → PUSH → Pantalla In-App`)
1. **2 Niveles de Invasividad + Ingesta Multimodal:**
   * **Nivel 1 (Bajo Demanda):** El cliente consulta puntualmente una llamada en altavoz, captura de SMS o foto/PDF del Documento de Datos Fundamentales (DFI).
   * **Nivel 2 (Escucha Pasiva + PUSH):** En llamada activa, detecta señales de coacción y dispara automáticamente una notificación **PUSH (`Estafa` / `Caro` / `Ok`)**.
2. **Output PUSH + Experiencia Visual Determinista (Cero Alucinación):**
   * 🔴 **ESTAFA (`PUSH + Banner Rojo "Creemos que es una estafa"`):** Detecta manipulación psicológica (5 fases *COLD / PreScam*), cruza la entidad con la **lista de alertas de la CNMV**, verifica discrepancia titular/IBAN (**SEPA VoP Reg. UE 2024/886**) y mide presión vocal (`WPM`).
   * 🟠 **CARO (`PUSH + Banner "Producto Caro" + Gráfica de Crecimiento a 30 Años + Drill-In`):** Extrae el TER y comisiones de salida del folleto, consulta en tiempo real el **MCP de MyInvestor (`https://mcp.myinvestor.es/mcp`)** y dibuja una **Gráfica de Crecimiento a 30 Años (TER Caro vs. TER Barato / Índice MCP)** ($V_f = C_0(1+r-\text{TER})^{30}$, mostrando cómo `50.000 €` pasan de `128.636 €` al `1,80 %` a `212.423 €` en el índice MCP al `0,06 %`: **`+83.787 €`**). Al **pulsar la gráfica**, se despliega el panel **Drill-In** con los números a 10, 20 y 30 años y la exención fiscal (**0 € IRPF** vía fondo puente `FR0000447823` *AXA Trésor Court Terme*).
   * 🟢 **OK / ADELANTE (`PUSH + Sello Verde`):** Sin alertas en CNMV y con comisiones competitivas frente al índice MCP.
3. **Gobernanza y Salida In-App ("Mi Contrato" — Sin *Hard Block*):**
   * **En `ESTAFA` (Intercepción Explicable Sin *Hard Block*):** El banco no aplica un *hard block* que quite el control al cliente. Al darle a *Enviar*, abre una **pantalla adicional de explicabilidad** de por qué parece fraude con:
     1. Botón principal amigable: **`🎧 Consultar en Canal Oficial MyInvestor (Voz / Chat en vivo)`**.
     2. Botón secundario en **rojo clarito** (*"Seguir bajo mi responsabilidad — No recomendado"*), más alerta al **Familiar de Confianza (Daniel)**.
   * **En `CARO`:** Tras pulsar la gráfica a 30 años (*Drill-In*), deja la orden de **Traspaso Exento de IRPF (0 €)** lista para **Firma In-App con FaceID**.
   * **Caso de Negocio B2B + B2C (MyInvestor Premium):** El núcleo **B2B** reduce el dinero que el banco destina a reembolsar fraudes (PSR/PSD3) y capta patrimonio vía MCP a 30 años; como extra **B2C**, se integra en el **Plan MyInvestor Premium**.
   * **Presentación y Documentación para el Equipo:** En la carpeta [`presentacion/`](./presentacion/) se incluyen el Pitch Deck de 10 diapositivas (`CENTINELA_PRESENTACION_PITCH_DECK.pdf`), el One-Pager Técnico (`CENTINELA_ONE_PAGER_TECNICO.pdf`) y el guion completo con bibliografía de papers (`CENTINELA_GUION_Y_PRESENTACION.md`).

---

## ⚙️ Requisitos

* **Opción A (Ejecución directa local):** **Node.js >= 18** (probado en Node v22 / v24). Cero dependencias pesadas externas para arranque instantáneo.
* **Opción B (Contenedor Docker):** **Docker** y **Docker Compose**.

---

## 🚀 Instalación, Configuración y Ejecución

### 1. Clonar o descomprimir el proyecto
```bash
cd centinela-hackfinance
```

### 2. Configuración (`.env` opcional)
El proyecto funciona **100 % listo para demostración nada más arrancar**, conectándose directamente en tiempo real al servidor MCP público de MyInvestor (`https://mcp.myinvestor.es/mcp`). Opcionalmente puedes copiar `.env.example` a `.env` (o introducir las claves desde el botón **🔑 API Keys** de la interfaz web) para activar **Claude Sonnet Vision** y **ElevenLabs Multilingual v2**:
```bash
cp .env.example .env
```

### 3. Ejecución Directa (Recomendada para Demo Rápida)
```bash
npm start
```
Abre en tu navegador: **http://localhost:3000**

### 4. Ejecución con Docker Compose
```bash
docker compose up --build
```
Abre en tu navegador: **http://localhost:3000**

---

## 🧪 Pruebas y Validación (Benchmark de 30 Casos + Demo de 3 Minutos)

### A. Ejecutar la Batería Automatizada de 30 Casos por Consola
Evalúa 10 casos de `ESTAFA`, 10 casos de `CARO` y 10 casos de `ADELANTE`, midiendo precisión y latencia en milisegundos:
```bash
npm run eval
```

### B. Probar los 3 Escenarios de la Demo en Vivo en el Navegador (`http://localhost:3000`)
En la barra superior de la aplicación encontrarás los **3 botones oficiales de la demo de 3 minutos**:
1. **`🔴 1. Falso Bróker (Estafa 9.000 €)`:** Simula la llamada en altavoz de *Quantum Ibérica* prometiendo un 12 % garantizado. Verás avanzar la transcripción, encenderse las alertas de CNMV e IBAN reportado, a **Mi Contrato** reteniendo los 9.000 € y la notificación llegando en vivo al **móvil de Daniel** en la columna derecha.
2. **`🟠 2. Fondo Caro en Oficina (TER 1,8%)`:** Analiza el DFI de un fondo tradicional de renta variable global al 1,80 %, consulta en vivo el **MCP de MyInvestor (`https://mcp.myinvestor.es/mcp`)**, calcula los **10.635 €** perdidos a 10 años frente a una cartera al 0,30 % (para 50.000 € al 5 % bruto) y deja preparado el traspaso exento de IRPF para **Firma In-App**.
3. **`♿ 3. Accesibilidad (10s) / Adelante`:** Alterna entre **Voz + Texto**, **Modo Persona Sorda** y **Modo Baja Visión**.
4. **Servidor MCP propio (`/mcp`):** Puedes consultar las 3 herramientas MCP nuevas (`verify_cnmv_and_iban`, `calculate_10y_fee_and_tax`, `enforce_client_contract`) mediante JSON-RPC en `POST http://localhost:3000/mcp`.

### C. Tests de regresión y diagnóstico del MCP
```bash
npm test          # tests de regresión sin red: extracción real de documentos, detector, cliente MCP (con servidores simulados) y endpoints
npm run check:mcp # comprueba con red real si la app usa el MCP de MyInvestor en vivo o tira de la copia guardada
```

---

## 🔎 Transparencia: qué es real y qué es de demostración

| Elemento | Estado en esta versión |
| --- | --- |
| Cálculo de comisiones, IRPF y traspasos | Real (motor determinista en código) |
| Catálogo de fondos | MCP de MyInvestor en vivo; si no hay conexión, copia guardada (la app lo indica) |
| Lectura de folletos | Claude (con clave) para fotos y PDF; sin clave, solo PDF con texto. Si no se encuentra la comisión, la app la pregunta: no la supone |
| Transcripción de audio | ElevenLabs Scribe (con clave). Sin clave no se transcribe nada |
| Lista de alertas CNMV e IBAN denunciados | **Ficticios, de demostración** (marcados en la app). En producción: lista oficial de la CNMV y verificación VoP del banco |
| Velocidad del habla (WPM) | Medida con Scribe en audios reales; en el Acto 1 es un valor **simulado** y declarado |
| Telemetría de llamada activa | No se mide en la web (requiere la app nativa) |
| ISIN de los fondos de ejemplo del banco | Ficticios (`XX0000DEMO01`, `XX0000DEMO02`) |
