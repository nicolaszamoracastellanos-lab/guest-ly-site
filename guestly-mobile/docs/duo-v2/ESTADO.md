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

## Fase 2: planner, modos Duo, widgets, Live Activities

Rama `feat/duo-v2` (app) y `feat/duo-v2-api` en el worktree `~/Desktop/guestly-portal-duo` (portal). Nada se subió, mezcló ni desplegó.

| Tarea | Estado | Notas |
|---|---|---|
| T2.1 API del portal | parcial | Hechas y probadas contra el portal local con la cuenta demo: `GET /planner/portfolio` (por boda, con permisos propios de cada boda; sin teléfono, correo ni texto de invitados) y `GET /planner/agenda`. El rol pareja recibe `forbidden`. Pendientes: mensajes del planner, edición de invitados con permiso `contacts`, escritura de proveedores, programa, avisos, check-in, logística, documentos, analítica, Cerebro, sitio web, snapshot de widgets, registro de Live Activities |
| T2.2 Arquitectura del planner | parcial | Pestañas Hoy, Bodas, Invitados, Pendientes, Herramientas (barra del sistema); Hoy como cockpit entre bodas (se activa con 2 o más bodas); Bodas con lista y resumen en dos paneles y "Trabajar en esta boda"; menú del encabezado (Coordinador y Más). Mensajes del planner espera a su API |
| T2.3 Invitados del planner | parcial | Lista + ficha en dos paneles (misma información que la hoja, sin contacto). Edición directa y contactos esperan la decisión de privacidad de abajo |
| T2.7 Modos de pose | hecho y verificado con pose forzada | Modo Recepción (check-in) y Modo Día B (pantalla del día) en pose mesa. Falta verlos con el aparato realmente medio plegado |
| T2.8 Widgets | construidos, compilan con el prebuild | 5 widgets (Countdown, Replies, Today, Weddings, DayOf) en `src/widgets`, alimentados por `features/widgets/sync` con líneas de tiempo. No verificados a la vista: añadirlos a la pantalla de inicio requiere la interfaz del Duo |
| T2.9 (Live Activities) | arrancan, sin ver la isla | `startSampleActivities` devuelve "started" para las dos; el simulador del Duo no dibuja la isla. Se arrancan solas desde Día B (pareja) y el check-in. Sin push (falta la clave APNs) |
| T2.10 Invitación con la bisagra | hecho y verificado con ángulo forzado | `InviteEnvelope` en el inicio del invitado: sobre cerrado, solapa a la mitad, abierto; una vez por lanzamiento; toque y Reducir movimiento lo abren sin bisagra |
| T2.11 Bienvenida en la pantalla exterior | spike, compila y se monta | `WelcomeAccessoryView` (SwiftUI `sceneAccessory` + `CameraCaptureAccessory`) dentro del check-in con interruptor. Sin cámara en el simulador no se puede ver; verificar en un aparato real con el escáner activo |
| T2.12, T2.13 | pendientes | Capturas del App Store de las 4 medidas del Duo y la matriz F2 completa |
| Herramientas | hecho | Rejillas con 2 columnas en regular y 4 en ancho (pareja y planner) |

### Decisiones y hallazgos de esta tanda

- `systemExtraLargePortrait` NO está en `expo-widgets` 58.0.23 (el plugin lista small, medium, large, extraLarge y accesorios). Mi C7 (Mi boda) usará `systemLarge`; se revisa cuando Expo lo agregue.
- Privacidad: el código móvil documenta que el teléfono y el correo de un invitado "nunca entran en un payload de planner" (más estricto que la web, decisión del dueño del 12 de agosto, en BUILD-LOG). El rediseño con paridad total toca ese límite. Plan: exponer contactos al planner solo cuando el permiso `contacts` de esa boda lo conceda, igual que la web. No está hecho; espera tu confirmación.
- `useHinge()` devuelve un objeto (no null) en el Duo, también con la pantalla exterior: es la señal para distinguir un Duo. La política de orientación (`lib/duo.ts`) deja libre la orientación solo con bisagra.
- EAS necesitará el grupo de apps `group.com.zcventures.guestly` y un perfil de aprovisionamiento para el destino `com.zcventures.guestly.ExpoWidgetsTarget` en el primer build real.

## Tanda del 24 de octubre (revisión, despliegue y TestFlight)

- Portal en producción: `13cb293` (portfolio y agenda), `3241d8c` (boda pasada) y el check-in del planner. Build 30 en TestFlight (commit 59c4900).
- Revisión de código: 7 correcciones (reinicio de pestañas al cambiar de boda, widgets limpios al cerrar sesión, resultado descartable en modo mesa, boda pasada, base de la API solo en desarrollo, panel memoizado, última persona del Live Activity) y el preset del redactor al plegar.
- Check-in del planner (herramienta `checkin` del planner, apagada por defecto): `GET/POST /planner/checkin` y `GET /planner/checkin/search`, solo nombres y conteos. La pantalla de la pareja es ahora `features/checkin/CheckinScreen` con `role`; la cola sin conexión envía a la ruta correcta. Prueba de contrato `scripts/test-mobile-planner-checkin.mjs` en el portal. Verificado en el simulador a 678 x 466; la ruta de éxito con el permiso encendido no se probó contra datos reales para no tocar la boda demo.
- Quedan: Mensajes del planner, resto de Herramientas con paridad, Coordinador como panel, capturas y metadatos de la tienda, matriz F2 completa, y todo lo que solo se ve en un Duo real.
