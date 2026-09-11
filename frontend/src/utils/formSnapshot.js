/**
 * Utilitários puros para snapshot / rollback de formulários.
 *
 * Utiliza `structuredClone` nativo (disponível no Node.js 17+ e navegadores modernos)
 * para realizar clonagem profunda segura mantendo tipos complexos (Date, Map, Set, ArrayBuffer).
 * Mantém um fallback gracioso via JSON para ambientes legados.
 *
 * `createSnapshot` e `applySnapshot` são alias semânticos:
 * - `createSnapshot`: invocado na abertura do formulário para salvar a foto inicial.
 * - `applySnapshot`: invocado no descarte para re-clonar o snapshot e evitar que
 *   mutações no estado do form afetem o objeto de backup.
 */

export function createSnapshot(values) {
  if (!values) return null;
  if (typeof structuredClone === 'function') {
    return structuredClone(values);
  }
  return JSON.parse(JSON.stringify(values));
}

export function applySnapshot(snapshot) {
  return createSnapshot(snapshot);
}
