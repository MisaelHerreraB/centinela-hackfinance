# 🛡️ Centinela: Antes de firmar, pregúntale (Master Spec Definitivo)

**Hack Finance 2026 · Equipo Across the lake · Documento Maestro Verificado (8-nov-2026)**

---

## 1. La Idea en una Frase

Dentro de la app de **MyInvestor**, enseñas a **Centinela** lo que te están ofreciendo (una llamada en altavoz, un audio, un SMS o el folleto/DFI de un banco) y en segundos te da una segunda opinión verificada: si es **Estafa**, si es **Caro** o si puedes seguir (**Adelante**), ejecutando tus propias reglas de protección (**Mi Contrato**).

---

## 2. El Problema Real (Con Fuentes Oficiales Verificadas)

A un ahorrador le quitan dinero de dos formas en el mismo instante crítico —**cuando alguien le presiona para que firme o transfiera**—: la **ilegal** (estafa por manipulación) y la **legal** (un producto financiero caro o ilíquido cuya letra pequeña no entiende). Hoy nadie le da una segunda opinión inmediata y conectada a su banco en ese segundo.

### Datos Oficiales Verificados para el Pitch y el PDF:
1. **Fraude por manipulación (Banco de España y EBA-BCE, 2025):**
   * La transferencia fraudulenta media en España es de **2.347 €**, y la causa principal ya no es el hackeo técnico, sino la **manipulación psicológica del propio cliente** (*ingeniería social / vishing*) para que autorice la operación.
   * Los usuarios soportan el **85 % de las pérdidas** por transferencias fraudulentas autorizadas en Europa (Informe conjunto EBA-BCE).
2. **Patrimonio en fondos y comisiones en España (INVERCO y CNMV, 2025–2026):**
   * En España hay entre **450.000 y 482.000 millones de euros** en fondos de inversión domésticos (estadísticas oficiales de **INVERCO**), lo que representa ya cerca del **17 % del ahorro financiero de las familias españolas**.
   * La **CNMV** fija el límite máximo legal de la comisión de gestión en el **2,25 % anual** sobre el patrimonio (+ **0,20 %** máximo de comisión de depósito). En la banca tradicional, los fondos de gestión activa de renta variable y mixtos cobran habitualmente entre un **1,20 % y un 1,85 % TER**, frente al **0,12 %–0,30 %** de los fondos indexados y carteras automatizadas de **MyInvestor**.

---

## 3. Cómo Funciona: 3 Pasos en un Solo Gesto

| Paso | Qué hace el usuario / sistema | Tecnología y Guardarraíl Determinista |
| :--- | :--- | :--- |
| **1. Enseñar** | Pone la llamada en altavoz, sube un audio/SMS o hace una foto/PDF al folleto (DFI) del banco. **Una sola entrada multimodal.** | **ElevenLabs Scribe** (STT en tiempo real) + **Claude Vision & Tool Use** + **ElevenLabs TTS** (respuesta de voz de baja latencia). |
| **2. Veredicto** | Clasifica en 1 de 3 estados:<br>• 🔴 **ESTAFA:** Detecta señales de manipulación psicológica, entidad en la lista de alertas de la **CNMV**, producto inexistente o **IBAN** con reportes.<br>• 🟠 **CARO:** Extrae las comisiones reales del documento (TER, gestión, depósito, reembolso), calcula el **coste exacto en euros a 10 años** frente a un producto de la misma categoría oficial en el catálogo de **MyInvestor**, y verifica si es **traspasable sin pagar IRPF**.<br>• 🟢 **ADELANTE:** Sin alertas en CNMV ni sobrecostes anómalos. | • **Servidor MCP real de MyInvestor** (consulta de catálogo oficial por categoría).<br>• **Lista oficial de alertas CNMV** cacheada.<br>• **Motor cuantitativo determinista propio** (Python/TS): *ninguna cifra matemática ni fiscal sale del LLM* (*Jagged Frontier* de Ethan Mollick). |
| **3. Actuar** | **Mi Contrato** (reglas predefinidas por el cliente: importe máximo, productos permitidos y familiar de confianza) actúa:<br>• Si es **Estafa**: retiene la transferencia, avisa al familiar de confianza y ofrece *Deshabilitar operativa*.<br>• Si es **Caro**: deja la orden de **Traspaso de Fondos (exenta de IRPF)** pre-rellenada y lista para la *Firma In-App*. | • Reglas deterministas en código.<br>• Log inmutable de auditoría.<br>• Conexión con el flujo de traspaso (incluyendo **fondo puente** para carteras indexadas de MyInvestor). |

### Accesibilidad Nativa (Criterio 15% + 15%)
* **Doble canal simultáneo (Voz + Texto visual resaltado):** Mientras Centinela habla, encuadra en pantalla el dato exacto (ej. subraya en rojo el 1,80 % de comisión en el PDF o la frase de presión en la transcripción).
* **Modo Persona Sorda:** 100 % visual con alertas hápticas/visuales de alto contraste y transcripción enriquecida en vivo.
* **Modo Baja Visión / Senior:** 100 % guiado por voz natural (ElevenLabs), leyendo en voz alta importe, comisiones, beneficiario e impacto fiscal antes de cualquier firma.
* **Principio de No Intrusión:** Centinela nunca te llama por teléfono (evitando educar al usuario a confiar en llamadas entrantes); el cliente lo abre en su app y las alertas al familiar son notificaciones seguras *in-app*.

---

## 4. Qué lo Hace Único (Factor Novedoso y Competitivo)

1. **Más allá de los detectores de voz (como *Guardian Labs / Guardião*, ganador en Hamburgo 2026):** Las apps antiestafa solo escuchan y avisan; **no están conectadas al supervisor (CNMV), ni al catálogo regulado (MCP MyInvestor), ni calculan costes compuestos, ni pueden retener una orden bancaria real mediante un contrato programable**.
2. **Más allá del MCP conversacional actual de MyInvestor:** El MCP actual de MyInvestor + GPTadvisor responde cuando un usuario experto sabe qué fondo buscar. **Centinela actúa de forma defensiva cuando alguien te presiona para firmar en una sucursal o por teléfono.**
3. **Gobernanza del Cliente ("Mi Contrato"):** Por primera vez, el ahorrador define reglas de seguridad intergeneracionales sobre su patrimonio y sus transferencias, no solo límites de tarjeta.

---

## 5. Viabilidad Financiera y Regulatoria (Por qué MyInvestor y GPTadvisor Pagarían)

1. **Captación directa de patrimonio (LTV >> CAC):**
   * Cada **50.000 €** que un cliente decide traspasar desde un fondo caro de banca tradicional a una cartera indexada de MyInvestor (~0,30 % de coste total) genera **~150 €/año** de ingresos recurrentes para la entidad, frente a un CAC medio en fintech de **61–163 $**.
   * Convierte la presión comercial de la banca tradicional en un canal de adquisición de activos para MyInvestor.
2. **Reducción de Fraude antes del nuevo Reglamento Europeo PSR / PSD3:**
   * La nueva normativa europea de servicios de pago amplía la responsabilidad de los bancos en estafas de suplantación y manipulación. Centinela actúa como cortafuegos preventivo con registro de auditoría (*audit log*).
3. **Unit Economics:** Coste estimado de **~0,50 € por usuario activo/mes** combinando caché de CNMV/MCP y llamadas puntuales a Claude + ElevenLabs.
4. **Encaje Regulatorio Impecable (MiFID II y LIRPF):**
   * **MiFID II (Art. 24 Directiva 2014/65/UE):** Centinela realiza una **comparativa objetiva de costes y gastos ex-ante** entre productos de la misma categoría oficial (sin emitir recomendación personalizada fuera de flujo). La contratación o traspaso final se completa dentro del flujo regulado de la app de MyInvestor.
   * **Fiscalidad verificada (Art. 94 Ley IRPF y Tramos Ahorro AEAT 2025–2026):**
     * El motor aplica los tramos oficiales vigentes de la base del ahorro en España: **19 %** (hasta 6.000 €), **21 %** (6.000–50.000 €), **23 %** (50.000–200.000 €), **27 %** (200.000–300.000 €) y **30 %** (>300.000 €).
     * El motor distingue automáticamente qué activos permiten **diferimiento fiscal por traspaso** (Fondo de inversión armonizado $\rightarrow$ Fondo o Cartera Indexada de MyInvestor vía su fondo monetario puente = **0 € de IRPF hoy**) frente a activos **no traspasables** (ETFs, depósitos, acciones o *Unit-Linked*, donde vender sí tributa en IRPF), además de alertar sobre **comisiones de reembolso** en fondos garantizados con ventana de liquidez.

---

## 6. Guion de la Demo en Vivo (3 Minutos · 3 Botones + Micrófono Real)

1. **Escenario 1 — 🔴 ESTAJA (Falso Bróker en Vivo, 75 s):**
   * Carmen pone en altavoz al supuesto asesor que le promete un *"12 % garantizado si transfiere hoy"*.
   * En pantalla, la transcripción de **ElevenLabs Scribe** avanza en vivo y el medidor de riesgo sube al detectar: (1) promesa de rentabilidad garantizada, (2) urgencia artificial, (3) entidad en la **lista negra de la CNMV** y (4) IBAN con reportes.
   * **Centinela** le dice por voz: *"Cuelga, Carmen. Esta entidad está alertada por la CNMV"*. Cuando Carmen intenta transferir 9.000 €, **Mi Contrato** retiene la operación y su hijo Daniel recibe la notificación en su móvil.
2. **Escenario 2 — 🟠 CARO (Folleto DFI de Fondo en Sucursal, 75 s):**
   * Carmen sube la foto/PDF del DFI del fondo que le ofrecen en su banco de toda la vida.
   * Centinela subraya el **1,80 % TER** en el documento, consulta en vivo el **MCP de MyInvestor** para la misma categoría y le explica por voz: *"Pagas un 1,8 % al año. Con 50.000 €, en 10 años tendrás **10.600 € menos** que en un fondo de la misma categoría al 0,30 % en MyInvestor. Como es un fondo traspasable, puedes moverlo hoy pagando **0 € a Hacienda**"*. Deja el traspaso preparado para firma.
3. **Escenario 3 — ♿ ACCESIBILIDAD Y BENCHMARK (20 s):**
   * Conmutación en 1 clic a **Modo Persona Sorda** y **Modo Baja Visión**, seguido de la vista de validación técnica (**30 casos de prueba automatizados** con latencia y precisión determinista).

---

## 7. Plan de Ejecución y Límites Transparentes (Defensa ante Jurado)

* **Transparencia técnica proactiva (lo decimos nosotros antes de que lo pregunten):**
  1. **iOS Call Audio:** Por privacidad del sistema operativo, ninguna app de terceros en iPhone puede pinchar el audio interno de una llamada GSM; por eso el diseño real usa el **altavoz del teléfono + micrófono de la app Centinela**.
  2. **Datos Reales vs. Simulados:** El catálogo vía **MCP de MyInvestor**, las reglas fiscales de la **AEAT (19 %–30 %)**, la distinción de traspasabilidad (**Art. 94 LIRPF**) y las alertas de la **CNMV** son reales; la base de IBANs reportados y la firma bancaria final están simuladas en el entorno de sandbox.
