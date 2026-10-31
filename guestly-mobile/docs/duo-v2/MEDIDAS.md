# Medidas del iPhone Duo (simulador Duo-27.1, Xcode 27.1, iOS 27.1)

Tomadas con el HUD de `DevProbe` (EXPO_PUBLIC_DUO_PROBE=1) y capturas en `docs/duo-v2/fase1/`. Solo la pantalla exterior se puede mover desde la línea de comandos; la interior y los giros de la bisagra requieren la GUI de Device Hub o un aparato real.

| Pose | Ventana (pt) | Insets (arriba, derecha, abajo, izquierda) | `useHinge()` | Bucket | Paneles |
|---|---|---|---|---|---|
| Exterior cerrado, vertical | 466 x 678 | 0, 84, 34, 0 | `closed`, 0 grados | compact | uno |
| Exterior cerrado, horizontal (bloqueo LANDSCAPE_RIGHT) | 678 x 466 | 0, 0, 34, 84 | `closed`, 0 grados | regular | dos |

Hallazgos:

- `useHinge()` devuelve un objeto (no `null`) en el Duo, incluso con la pantalla exterior activa. Es la señal más simple para distinguir un Duo de cualquier otro iPhone: la política de orientación (`lib/duo.ts`) la usa.
- En horizontal la columna del sistema (estado y barra de pestañas) pasa al borde IZQUIERDO (inset izquierdo 84). Por eso los insets se aplican por borde, nunca simétricos.
- La barra de pestañas del sistema (`NativeTabs`) aparece sola en el riel vertical con Liquid Glass, con insignia en Mensajes.
- `reservedRegions` (módulo `guestly-duo`): disponible, sin región de pliegue con el aparato cerrado (`fold none`). Falta medir con el aparato medio plegado.
- Las capturas de la pantalla exterior se toman con `xcrun simctl io <udid> screenshot --display=primary`. Sin `--display` sale la interior inactiva (negra).

Pendiente de medir (Device Hub o aparato real): safe area de la interior en vertical y horizontal, frame y ancho del pliegue en poses libro y mesa, altura de la barra horizontal en la interior vertical.
