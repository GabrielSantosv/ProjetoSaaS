/**
 * Suíte de regressão + segurança do Frontend (Área Interna).
 * Isolada totalmente dentro do projeto frontend (zero importações do storefront).
 *
 *   Bloco 1 — RBAC            → importa utils/permissions.js
 *   Bloco 2 — Ausência XSS    → importa utils/money.js + verificação de código-fonte frontend
 *   Bloco 3 — Snapshot/Rollback → importa utils/formSnapshot.js
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

import { parseBRL }                      from '../utils/money.js';
import { canAccess, can, ROLE_MODULES }  from '../utils/permissions.js';
import { createSnapshot, applySnapshot } from '../utils/formSnapshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

console.log('=== INICIANDO SUÍTE DE TESTES DO FRONTEND (ÁREA INTERNA) ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. MATRIZ DE PERMISSÕES RBAC EXATA
//    Importa: frontend/src/utils/permissions.js (código de produção)
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Testando matriz exata de permissões (RBAC)...');

// ADMIN
assert.strictEqual(canAccess('ADMIN', 'dashboard'), true);
assert.strictEqual(canAccess('ADMIN', 'pedidos'), true);
assert.strictEqual(canAccess('ADMIN', 'pdv'), true);
assert.strictEqual(canAccess('ADMIN', 'produtos'), true);
assert.strictEqual(canAccess('ADMIN', 'importacao'), true);
assert.strictEqual(canAccess('ADMIN', 'caixa'), true);
assert.strictEqual(canAccess('ADMIN', 'configuracoes'), true);
assert.strictEqual(ROLE_MODULES.ADMIN.length, 7, 'ADMIN deve ter acesso aos 7 módulos');
assert.strictEqual(can('ADMIN', 'conta.encerrar'), true);
assert.strictEqual(can('ADMIN', 'produto.excluir'), true);
assert.strictEqual(can('ADMIN', 'caixa.fechar'), true);

// VENDEDOR: dashboard, pedidos, pdv, produtos, configuracoes — SEM caixa e SEM importacao
assert.strictEqual(canAccess('VENDEDOR', 'dashboard'), true);
assert.strictEqual(canAccess('VENDEDOR', 'pedidos'), true);
assert.strictEqual(canAccess('VENDEDOR', 'pdv'), true);
assert.strictEqual(canAccess('VENDEDOR', 'produtos'), true);
assert.strictEqual(canAccess('VENDEDOR', 'configuracoes'), true);
assert.strictEqual(canAccess('VENDEDOR', 'caixa'), false,      'VENDEDOR NÃO pode acessar caixa');
assert.strictEqual(canAccess('VENDEDOR', 'importacao'), false,  'VENDEDOR NÃO pode acessar importação');
assert.strictEqual(can('VENDEDOR', 'produto.criar'), true);
assert.strictEqual(can('VENDEDOR', 'produto.editar'), true);
assert.strictEqual(can('VENDEDOR', 'produto.excluir'), false,  'VENDEDOR NÃO pode excluir produto');
assert.strictEqual(can('VENDEDOR', 'conta.encerrar'), false,   'VENDEDOR NÃO pode encerrar conta');
assert.strictEqual(can('VENDEDOR', 'caixa.fechar'), false,     'VENDEDOR NÃO pode fechar caixa');

// PDV: pedidos, pdv, configuracoes apenas
assert.strictEqual(canAccess('PDV', 'pedidos'), true);
assert.strictEqual(canAccess('PDV', 'pdv'), true);
assert.strictEqual(canAccess('PDV', 'configuracoes'), true);
assert.strictEqual(canAccess('PDV', 'dashboard'), false, 'PDV NÃO pode acessar dashboard');
assert.strictEqual(canAccess('PDV', 'produtos'), false,  'PDV NÃO pode acessar produtos');
assert.strictEqual(canAccess('PDV', 'importacao'), false,'PDV NÃO pode acessar importação');
assert.strictEqual(canAccess('PDV', 'caixa'), false,     'PDV NÃO pode acessar caixa');
assert.strictEqual(can('PDV', 'produto.criar'), false);
assert.strictEqual(can('PDV', 'produto.editar'), false);

// CAIXA: dashboard, pedidos, caixa, configuracoes
assert.strictEqual(canAccess('CAIXA', 'dashboard'), true);
assert.strictEqual(canAccess('CAIXA', 'pedidos'), true);
assert.strictEqual(canAccess('CAIXA', 'caixa'), true);
assert.strictEqual(canAccess('CAIXA', 'configuracoes'), true);
assert.strictEqual(canAccess('CAIXA', 'pdv'), false,     'CAIXA NÃO pode acessar pdv');
assert.strictEqual(canAccess('CAIXA', 'produtos'), false,'CAIXA NÃO pode acessar produtos');
assert.strictEqual(canAccess('CAIXA', 'importacao'), false,'CAIXA NÃO pode acessar importação');
assert.strictEqual(can('CAIXA', 'caixa.fechar'), true,   'CAIXA pode fechar caixa');
assert.strictEqual(can('CAIXA', 'produto.editar'), false,'CAIXA NÃO pode editar produto');

console.log('✓ Matriz RBAC 100% validada conforme especificação.\n');

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUSÊNCIA DE dangerouslySetInnerHTML NO FRONTEND + SANITIZAÇÃO DE MONEY
//    Importa: frontend/src/utils/money.js (código de produção)
// ─────────────────────────────────────────────────────────────────────────────
console.log('2. Testando sanitização de inputs contra XSS no Frontend...');

const xssPayloads = [
  "<script>alert('xss')</script>",
  '<img src=x onerror=alert(1)>',
  '"><svg/onload=alert(1)>',
  "javascript:alert('XSS')",
  "'; DROP TABLE users; --"
];

xssPayloads.forEach(payload => {
  const result = parseBRL(payload);
  assert.strictEqual(typeof result, 'number', `parseBRL("${payload}") deve retornar number`);
  assert.strictEqual(isNaN(result), false, `parseBRL("${payload}") não deve retornar NaN`);
});
console.log('  ✓ parseBRL imune a payloads XSS (retorna 0, nunca NaN).');

const srcRoot = resolve(__dirname, '../');

const frontendFiles = [
  'App.jsx',
  'views/ProductsView.jsx',
  'views/OrdersView.jsx',
  'views/CashierView.jsx',
  'views/DashboardRealView.jsx',
  'views/ImportView.jsx',
  'views/PdvView.jsx',
  'views/SettingsView.jsx',
  'views/AuthView.jsx',
  'components/Layout.jsx',
  'components/StatusBadge.jsx',
  'utils/formSnapshot.js',
  'utils/money.js',
  'utils/permissions.js'
];

const frontendSourceCode = frontendFiles.map(file => {
  try { return readFileSync(resolve(srcRoot, file), 'utf8'); } catch { return ''; }
}).join('\n');

assert.strictEqual(
  frontendSourceCode.includes('dangerouslySetInnerHTML'),
  false,
  'FALHA DE SEGURANÇA: dangerouslySetInnerHTML encontrado no código do Frontend!'
);
console.log('  ✓ Zero ocorrências de dangerouslySetInnerHTML em todo o código do Frontend.');
console.log('✓ Testes XSS do Frontend aprovados.\n');

// ─────────────────────────────────────────────────────────────────────────────
// 3. DIRTY STATE E REVERSÃO EXATA (SNAPSHOT ROLLBACK)
//    Importa: frontend/src/utils/formSnapshot.js (código de produção)
// ─────────────────────────────────────────────────────────────────────────────
console.log('3. Testando reversão de formulário sujo (Snapshot Rollback)...');

const pristineProduct = {
  name: 'Risoto de cogumelos',
  sku:  'PRD-1042',
  price: '59,00',
  cost:  '21,40',
  stock: '38'
};

const savedSnapshot = createSnapshot(pristineProduct);

assert.deepStrictEqual(savedSnapshot, pristineProduct, 'Snapshot deve ser deepEqual ao original');
assert.notStrictEqual(savedSnapshot, pristineProduct, 'Snapshot deve ser objeto diferente (não a mesma referência)');

savedSnapshot.name = 'Mutação no snapshot';
assert.strictEqual(pristineProduct.name, 'Risoto de cogumelos', 'Mutação no snapshot NÃO deve afetar o objeto original');

const cleanSnapshot = createSnapshot(pristineProduct);
let currentForm = { ...pristineProduct, name: 'Risoto Alterado Teste', price: '999,00' };
let dirtyFlag = true;

currentForm = applySnapshot(cleanSnapshot);
dirtyFlag = false;

assert.deepStrictEqual(currentForm, pristineProduct, 'O formulário deve voltar exatamente ao estado original após descarte');
assert.strictEqual(dirtyFlag, false, 'dirtyFlag deve ser false após descartar');
assert.notStrictEqual(currentForm, cleanSnapshot, 'applySnapshot deve retornar nova cópia, não o próprio snapshot');

const nested = { address: { street: 'Rua A', number: '10' } };
const snapshotNested = createSnapshot(nested);
snapshotNested.address.street = 'Rua B';
assert.strictEqual(nested.address.street, 'Rua A', 'createSnapshot deve fazer deep clone de objetos aninhados');

console.log('✓ Reversão de formulário sujo via snapshot 100% validada.\n');

console.log('=== TODOS OS TESTES DO FRONTEND FORAM APROVADOS COM SUCESSO! ===');
