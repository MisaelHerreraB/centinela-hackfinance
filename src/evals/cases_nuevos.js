/**
 * 12 casos que el motor de reglas NO ha visto nunca (no están en cases_30.js).
 * Sirven para medir con honestidad cuánto generaliza Centinela: 8 estafas con guiones
 * distintos al del falso bróker y 4 comunicaciones legítimas que no deben dar falsa alarma.
 */
module.exports = [
  { id: 'NUEVO-01', expected: 'ESTAFA', title: 'Bizum inverso', text: 'Hola, soy del departamento de seguridad de su banco. Hemos detectado un cargo raro. Para anularlo le va a llegar una solicitud de Bizum, acéptela y le devolvemos el dinero.' },
  { id: 'NUEVO-02', expected: 'ESTAFA', title: 'Hijo en apuros (WhatsApp)', text: 'Mamá, se me ha roto el móvil, este es mi número nuevo. Necesito que me hagas una transferencia de 1.800 euros hoy, luego te lo explico, no me llames que no va el micro.' },
  { id: 'NUEVO-03', expected: 'ESTAFA', title: 'Falso técnico', text: 'Le llamamos del servicio técnico de Microsoft. Su ordenador tiene un virus. Instale la aplicación de acceso remoto y entre en su banca online para que lo revisemos.' },
  { id: 'NUEVO-04', expected: 'ESTAFA', title: 'Inversión «de un conocido»', text: 'Buenas tardes, Carmen. Mi primo ha triplicado sus ahorros en tres meses con una plataforma de trading automático. Si entra esta semana con 5.000 le reservo plaza en el grupo privado.' },
  { id: 'NUEVO-05', expected: 'ESTAFA', title: 'Paquete retenido (SMS)', text: 'CORREOS: su paquete está retenido en aduanas. Abone 1,79 EUR de tasas en el siguiente enlace para liberarlo: correos-envio-es.com' },
  { id: 'NUEVO-06', expected: 'ESTAFA', title: 'Falso policía y «cuenta segura»', text: 'Le habla el inspector Ramírez de la Policía Nacional. Su cuenta está siendo usada para blanqueo. Debe mover sus ahorros a una cuenta segura que le indicamos mientras investigamos.' },
  { id: 'NUEVO-07', expected: 'ESTAFA', title: 'Estafa romántica', text: 'Cariño, estoy retenido en el aeropuerto de Estambul y no puedo acceder a mi cuenta. Si me envías 3.000 euros te los devuelvo en cuanto llegue a Madrid.' },
  { id: 'NUEVO-08', expected: 'ESTAFA', title: 'Fraude del jefe', text: 'Soy el director financiero. Necesito que hagas ya una transferencia urgente y confidencial de 24.000 euros a este proveedor, no lo comentes con nadie hasta que cierre la operación.' },
  { id: 'NUEVO-09', expected: 'ADELANTE', title: 'Aviso real del banco', text: 'Le recordamos que MyInvestor nunca le pedirá sus claves por teléfono. Puede consultar sus movimientos en la app.' },
  { id: 'NUEVO-10', expected: 'ADELANTE', title: 'Conversación familiar', text: 'Mamá, el sábado comemos en casa. Si quieres te ayudo a mirar lo del plan de pensiones con calma el mes que viene.' },
  { id: 'NUEVO-11', expected: 'ADELANTE', title: 'Oferta comercial normal', text: 'Le llamo de su compañía eléctrica para informarle de una nueva tarifa. Puede consultarla en nuestra web y decidir cuando quiera, sin compromiso.' },
  { id: 'NUEVO-12', expected: 'ADELANTE', title: 'Depósito garantizado legítimo', text: 'El depósito a 12 meses de su banco ofrece un 2,5 % TAE garantizado por el Fondo de Garantía de Depósitos hasta 100.000 euros.' }
];
