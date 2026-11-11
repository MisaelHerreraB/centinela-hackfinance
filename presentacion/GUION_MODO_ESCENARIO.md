# Guion del modo escenario (demo en el iPhone de Carmen)

Abre **http://localhost:3000/escenario.html** y pulsa **F** para pantalla completa.

| Tecla | Qué hace |
|---|---|
| `→`, espacio o el mando de presentaciones | Siguiente paso |
| `←` | Paso anterior |
| `1` `2` `3` | Ir al acto 1, 2 o 3 |
| `4` | Reto: el jurado escribe su propia estafa |
| `M` | Sonido y voz, sí o no |
| `H` | Oculta la barra inferior |
| `R` | Repite el acto |

También se puede avanzar tocando el botón principal de cada pantalla del móvil (contestar, enviar, la gráfica).

Los veredictos, las señales, las cifras y la gráfica salen de la API en cada paso. La llamada, la cámara y Face ID son puesta en escena. Las personas, la entidad y el IBAN son de ejemplo, y la velocidad del habla (188 palabras/min) es la del guion, no una medición.

## Acto 1 · La llamada (unos 60 s)

1. **Carmen, 68 años.** «Sus ahorros de toda la vida caben en su móvil.»
2. **Suena el teléfono.** Dejad que suene un par de veces. Pulsad contestar.
3. **Centinela escucha.** No habléis encima: se oye al estafador. Señalad a la derecha cómo sube el riesgo frase a frase y cómo salta el aviso rojo.
4. **Aun así, va a enviar el dinero.** «Con el estafador al teléfono, Carmen abre la transferencia.» Pulsad *Enviar*.
5. **Sin bloquearle su dinero.** La idea clave para el jurado: no se retiene la orden; se explica el motivo, se ofrece hablar con el banco y el hijo recibe el aviso (móvil pequeño a la derecha).
6. **9.000 € a salvo.**

## Acto 2 · La sucursal (unos 50 s)

1. **«Es un fondo muy bueno».**
2. **Carmen le hace una foto** al folleto. Pulsad el disparador.
3. A la derecha aparece lo que hace Centinela: lee la comisión, pregunta al MCP de MyInvestor en vivo y el código hace las cuentas. Salta el aviso naranja y se dibuja la gráfica a 30 años.
4. **Toca la gráfica**: los números año a año.
5. **Firmado con la cara**: traspaso sin tributar en ese momento.

## Acto 3 · Para todos (unos 15 s)

El mismo aviso en tres modos. Un paso más y sale el cierre con las cifras de esta sesión.

## Reto (tecla 4), si el jurado quiere probar

«Inventad una estafa que Centinela no haya visto.» Se escribe a la izquierda (o se pulsa un ejemplo) y Enter. Las reglas no la conocen; Claude señala las tácticas citando la frase literal y el código decide. Tarda entre 2 y 5 segundos y necesita `ANTHROPIC_API_KEY` y conexión. Sin clave, si Claude no responde o si se alcanza el tope de llamadas, la pantalla lo dice y solo usa reglas.

Los actos 1 y 2 no esperan a Claude en la llamada: el guion del falso bróker ya lo reconocen las reglas, así que el aviso sale al instante. Claude se enseña en el reto.

## Si algo falla

- Sin internet: el acto 1 funciona entero; el acto 2 usa la caché del catálogo y lo indica («caché» en lugar de «en vivo»); el reto no funciona.
- Enlace directo a un paso: `/escenario.html?acto=2&paso=3` (añade `&rapido=1` para abrirlo sin animaciones).
- Plan B: grabad la pantalla del modo escenario el día anterior y llevad el vídeo.
