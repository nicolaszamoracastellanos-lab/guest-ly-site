# Matriz de verificación y lista para el Duo real

Build en TestFlight: 34 (1.2.0), commit `419414c`. Portal en producción: `7bc279d`.

Leyenda: **Sim** = visto en el simulador del Duo (pantalla exterior); **Contrato** = prueba automática contra el portal; **Revisión** = revisión de código; **Falta** = solo se puede comprobar en el aparato o con una decisión tuya.

## Qué está verificado y cómo

| Pieza | Sim | Contrato | Revisión | Falta |
|---|---|---|---|---|
| Barra del sistema (riel) en pareja, planner e invitado | sí, vertical y horizontal | | sí | |
| Dos paneles: Invitados, Mensajes, Presupuesto, Bodas y Guests del planner, asistente | sí, 678 x 466 | | sí | pantalla interior 669 x 951 |
| Modo Recepción y Modo Día B | sí, con postura forzada | | sí | medio plegado de verdad |
| Invitación que se abre con la bisagra | sí, con ángulo forzado | | sí | ángulo real |
| Widgets (5) | cronologías escritas | | sí | verlos en inicio, bloqueo y StandBy |
| Live Activities (2) | arrancan sin error | | sí | ver la isla; sin clave APNs no se actualizan con la app cerrada |
| Bienvenida en la pantalla exterior | compila y se monta | | sí | solo con el Duo y la cámara activa |
| Cockpit Hoy, Bodas, portfolio y agenda del planner | sí | sí | sí | |
| Check-in del planner | sí, pantalla | sí | sí (2 rondas) | prueba con el permiso encendido |
| Mensajes del planner (solo lectura) | sí, con datos de ejemplo | sí | sí (2 rondas) | prueba con una boda que tenga la herramienta y conversaciones de WhatsApp |
| Datos del concierge del planner | no | no | sí | verlo con la herramienta encendida |
| Bundle de producción sin la sonda | arranca | | sí | |
| Cola de check-in sin conexión por boda | | | sí | probar sin red con dos bodas |

## Pasada en el Duo (unos 15 minutos)

1. **Cerrado, pantalla exterior**: las cinco pestañas en el riel de la derecha; Invitados y Mensajes con una columna; nada pegado a la columna de estado.
2. **Girar la exterior a horizontal**: dos paneles en Invitados, Mensajes, Presupuesto y el asistente; el riel pasa a la izquierda.
3. **Abrir el Duo (pantalla interior)**: lo mismo en dos paneles, sin elementos sobre el pliegue; al cerrar y abrir, el registro abierto se mantiene.
4. **Medio abierto en forma de mesa** (Check-in y Día B): resultado grande en la mitad superior, cámara y búsqueda abajo; en Día B, Ahora y Siguiente arriba.
5. **Invitado**: al abrir el teléfono se abre el sobre; con Reducir movimiento o un toque se abre sin animación.
6. **Widgets**: añadir Cuenta regresiva, Respuestas y Hoy a la pantalla de inicio y de bloqueo; confirmar que el número cambia a medianoche.
7. **Live Activities**: iniciar Día B y Check-in desde la app y mirar la isla y la pantalla de bloqueo.
8. **Bienvenida exterior**: en Check-in, con el escáner activo, cerrar el Duo y ver "Bienvenid@, nombre. Mesa n" en la exterior; apagarla con el interruptor.
9. **Teclado**: en la ficha de un invitado, confirmar que Prev / Next / Done solo aparece con el teclado abierto.
10. **Planner**: pedir a la agencia que active Check-in y Mensajes en una boda de prueba y repetir 4 y la lectura de conversaciones.

## Decisiones que siguen abiertas

- Clave APNs para que las Live Activities se actualicen con la app cerrada.
- Subir o integrar la rama `feat/duo-v2` (mi push fue denegado).
- Mostrar a los planners teléfono y correo de los invitados (hoy nunca, por tu regla del 12 de agosto).
- Responder y traspasar desde Mensajes del planner, y las herramientas Documentos, Logística, Sitio y Cerebro: piden rutas nuevas en el servidor.
