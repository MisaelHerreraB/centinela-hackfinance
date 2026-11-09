# 🛡️ Centinela: Antes de firmar, pregúntale

**HackFinance 2026 (BEST UC3M · Madrid Engineering Week) · Equipo *Across the lake***

> **En una frase:** Dentro de la app de **MyInvestor**, enseñas a **Centinela** lo que te están ofreciendo (una llamada en altavoz, un audio, un SMS o el folleto DFI del banco) y en segundos te dice si es **Estafa**, si es **Caro** o si puedes seguir (**Adelante**), ejecutando tus propias reglas de protección (**Mi Contrato**).

---

## 🎯 Problemática y Valor Diferencial

Un ahorrador pierde dinero de dos formas en el mismo instante crítico —**cuando alguien le presiona por teléfono o en una sucursal para que firme o transfiera**—:
1. **Vía Ilegal (Estafa por manipulación / *Vishing* y *Smishing*):** La transferencia fraudulenta media en España es de **2.347 €** (Banco de España, 2025) y el cliente soporta el **85 % de las pérdidas** cuando él mismo autoriza la orden bajo engaño (EBA-BCE, 2025).
2. **Vía Legal (Productos caros e ilíquidos):** En España hay **450.000–482.000 M€** en fondos de inversión (INVERCO), donde la banca tradicional cobra medias del **1,20 %–1,85 % TER** (con techos legales de gestión del **2,25 %**, CNMV) frente al **0,12 %–0,30 %** de los fondos y carteras indexadas de **MyInvestor**, sin que el cliente calcule la pérdida compuesta a 10 años ni sepa que puede cambiar por **traspaso pagando 0 € en IRPF** (Art. 94 LIRPF).

### Cómo actúa Centinela en 3 pasos (`Enseñar → Veredicto → Actuar`)
1. **Enseñar:** Llamada en altavoz (sorteando el bloqueo GSM de iOS), captura de SMS o foto/PDF del Documento de Datos Fundamentales (DFI).
2. **Veredicto Determinista (Cero Alucinación):**
   * 🔴 **ESTAFA:** Detecta señales de manipulación psicológica, cruza la entidad con la **lista de alertas de la CNMV**, verifica si el supuesto producto existe en el **MCP real de MyInvestor (`https://mcp.myinvestor.es/mcp`)** y comprueba si el **IBAN** tiene reportes.
   * 🟠 **CARO:** Extrae el TER y comisiones de salida del folleto, consulta en tiempo real el **MCP de MyInvestor** para obtener productos de la **misma categoría oficial (MiFID II Art. 24)**, calcula con un motor matemático propio cuántos euros se pierden a 10 años ($V_f = C_0(1+r-\text{TER})^{10}$) y verifica si es **traspasable sin tributar en IRPF** (distinguiendo fondos armonizados —que entran a Carteras MyInvestor vía su fondo monetario puente `FR0000447823` *AXA Trésor Court Terme*— frente a ETFs, depósitos o *Unit-Linked*).
   * 🟢 **ADELANTE:** Sin alertas en CNMV y con comisiones competitivas.
3. **Actuar ("Mi Contrato"):**
   * Si es **Estafa**, **Mi Contrato** retiene preventivamente la transferencia, envía una notificación push al **Familiar de Confianza (Daniel)** y ofrece el botón **Deshabilitar operativa (*Kill-Switch*)**.
   * Si es **Caro**, deja la orden de **Traspaso Exento de IRPF (0 €)** pre-rellenada y lista para la **Firma In-App**.
   * Todo se oye y se lee a la vez, con **Modo Persona Sorda** (solo texto/visual) y **Modo Baja Visión** (lectura preventiva de importe, comisiones e IBAN antes de firmar).

---

## ⚙️ Requisitos

* **Opción A (Ejecución directa local):** **Node.js >= 18** (probado en Node v22 / v24). Cero dependencias pesadas externas para arranque instantáneo.
* **Opción B (Contenedor Docker):** **Docker** y **Docker Compose**.

---

## 🚀 Instalación, Configuración y Ejecución

### 1. Clonar o descomprimir el proyecto
```bash
cd centinela-app
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
