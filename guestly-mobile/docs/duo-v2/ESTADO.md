# Duo v2: estado de la construcción

Rama `feat/duo-v2` (desde `spike/sdk58` fab39dd). Plan: `~/Desktop/Guest-ly Docs/iphone-duo-v2-oct23/06-MASTER-PROMPT-SONNET.md`.

## Fase 1: base Duo

| Tarea | Estado | Notas |
|---|---|---|
| T1.1 `useLayout` y `TwoPane` | hecho y verificado | `layoutMath.ts` (puro, `node --experimental-strip-types scripts/tests/layout.test.ts` pasa), `layout.ts`, `TwoPane.tsx`, `MasterDetail.tsx`. Sondeo en `DevProbe` (HUD) |
| T1.2 Barras del sistema | hecho y verificado en la exterior | `NativeRoleTabs` en los tres roles; riel vertical del sistema verificado en vertical y horizontal; `GlassTabBar` y burbuja retiradas; insets laterales en `Screen`, tour, inicio del invitado, check-in, engranaje de Inicio y botón anclado; orientación libre solo con bisagra, el resto de iPhone sigue en vertical |
| T1.3 Dos paneles en la pareja | hecho y verificado en horizontal exterior (678 x 466) | Invitados, Mensajes (conversaciones, avisos y redactor), Presupuesto (categorías). La misma ruta cambia de uno a dos paneles sin perder el registro. Falta verificar en la interior (669 x 951 y 951 x 669) |
| T1.4 Modo angosto (Split View) | parcial | ficha con "Copiar teléfono" y WhatsApp. No hay forma de simular Split View desde la línea de comandos: auditoría de 335 y 475 pt pendiente en Device Hub |
| T1.5 Módulo `guestly-duo` v1 | compilado y cargado | regiones reservadas (`fold none` cerrado), haptic al abrir y cerrar, gem que sigue la bisagra (`Gem followHinge`). Falta ver el pliegue activo con el aparato medio plegado |
| T1.6 Teclado | pendiente de aparato | la barra Prev / Next / Done aparece sin teclado en el simulador con teclado de hardware (también en la ficha de una columna); confirmar en un aparato real |
| T1.7 Matriz F1 y medidas | parcial | `MEDIDAS.md`. Celdas de exterior vertical y horizontal pasadas en Invitados, Mensajes, Presupuesto, Inicio |
