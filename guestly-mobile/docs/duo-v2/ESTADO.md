# Duo v2: estado de la construcción

Rama `feat/duo-v2` (desde `spike/sdk58` fab39dd). Plan: `~/Desktop/Guest-ly Docs/iphone-duo-v2-oct23/06-MASTER-PROMPT-SONNET.md`.

## Fase 1: base Duo

| Tarea | Estado | Notas |
|---|---|---|
| T1.1 `useLayout` y `TwoPane` | hecho en código, tests de lógica pasan | `src/ui/layoutMath.ts` (puro, probado con `node --experimental-strip-types scripts/tests/layout.test.ts`), `layout.ts`, `TwoPane.tsx`, `MasterDetail.tsx` |
| T1.2 Barras del sistema | en código, falta verificar en el simulador | `NativeRoleTabs` en los tres roles; `GlassTabBar` y burbuja retiradas; insets laterales en `Screen`; orientación libre |
| T1.3 Dos paneles en la pareja | pendiente | |
| T1.4 Modo angosto (Split View) | pendiente | |
| T1.5 Módulo `guestly-duo` v1 | pendiente | |
| T1.6 Teclado | pendiente | |
| T1.7 Matriz F1 y medidas | pendiente | |
