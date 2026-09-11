/**
 * Suíte de testes de regressão e segurança do Storefront.
 * Isolada totalmente dentro do projeto storefront (zero importações do frontend).
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

import { cartCount, cartSubtotal, shippingCost, shouldShowSummary, cartTotals } from '../utils/cart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

console.log('=== INICIANDO SUÍTE DE TESTES DO STOREFRONT ===\n');

// 1. TESTE DE CARRINHO VAZIO E RECÁLCULO BIDIRECIONAL DE FRETE
console.log('1. Testando carrinho vazio, totais e recálculo bidirecional de frete...');

const MINI_CATALOG = [
  { id: 'burrata', price: 52 },
  { id: 'risoto', price: 59 },
  { id: 'moqueca', price: 98 },
  { id: 'malbec', price: 140 }
];

// Carrinho vazio → count=0, showSummary=false, shipCost=0, total=0
const emptyCart = {};
assert.strictEqual(cartCount(emptyCart), 0, 'Carrinho vazio: cartCount deve ser 0');
assert.strictEqual(shouldShowSummary(emptyCart), false, 'Carrinho vazio DEVE ocultar resumo/checkout');
assert.strictEqual(shippingCost(0, 'Entrega padrão'), 0, 'Subtotal 0 -> frete grátis');

const emptyTotals = cartTotals(emptyCart, MINI_CATALOG, 'Entrega padrão');
assert.strictEqual(emptyTotals.count, 0);
assert.strictEqual(emptyTotals.subtotal, 0);
assert.strictEqual(emptyTotals.shipCost, 0);
assert.strictEqual(emptyTotals.total, 0);
assert.strictEqual(emptyTotals.showSummary, false);

// Subtotal R$ 240 (abaixo da marca de R$ 250) → Frete R$ 18
const cartBelow = { burrata: 2, malbec: 1 }; // 52*2 + 140 = 244 (abaixo de 250... espera, 244 < 250)
const subBelow = cartSubtotal(cartBelow, MINI_CATALOG);
assert.strictEqual(subBelow, 244);
assert.strictEqual(shippingCost(subBelow, 'Entrega padrão'), 18, 'Abaixo de R$ 250 o frete deve ser R$ 18');
assert.strictEqual(shouldShowSummary(cartBelow), true);

// Subtotal R$ 250 (marca exata de frete grátis) → Frete R$ 0
const cartExact = { burrata: 1, risoto: 1, moqueca: 1 }; // 52 + 59 + 98 = 209... vamos ajustar:
// 52 + 58? Não, burrata 52 + malbec 140 + risoto 58 = 250
const catalogWith250 = [
  { id: 'item1', price: 100 },
  { id: 'item2', price: 150 }
];
const cartExact250 = { item1: 1, item2: 1 }; // 100 + 150 = 250
const subExact = cartSubtotal(cartExact250, catalogWith250);
assert.strictEqual(subExact, 250);
assert.strictEqual(shippingCost(subExact, 'Entrega padrão'), 0, 'Aos R$ 250 o frete deve ser Grátis (0)');

// Retirar na loja → Sempre grátis
assert.strictEqual(shippingCost(100, 'Retirar na loja'), 0, 'Retirar na loja é sempre grátis');

// Recálculo bidirecional ao remover itens
const cartDropped = { item1: 1 }; // R$ 100 (caiu abaixo de 250 novamente)
const subDropped = cartSubtotal(cartDropped, catalogWith250);
assert.strictEqual(shippingCost(subDropped, 'Entrega padrão'), 18, 'Frete volta para R$ 18 se o subtotal cair abaixo de 250');

console.log('✓ Lógica do carrinho e frete bidirecional 100% validadas no Storefront.\n');

// 2. VERIFICAÇÃO DE XSS NO STOREFRONT
console.log('2. Testando ausência de dangerouslySetInnerHTML no Storefront...');

const storefrontSrcDir = resolve(__dirname, '../');
const appJsxContent = readFileSync(resolve(storefrontSrcDir, 'App.jsx'), 'utf8');
const imageSlotContent = readFileSync(resolve(storefrontSrcDir, 'components/ImageSlot.jsx'), 'utf8');
const cartJsContent = readFileSync(resolve(storefrontSrcDir, 'utils/cart.js'), 'utf8');

const allStorefrontCode = appJsxContent + '\n' + imageSlotContent + '\n' + cartJsContent;

assert.strictEqual(
  allStorefrontCode.includes('dangerouslySetInnerHTML'),
  false,
  'FALHA DE SEGURANÇA: dangerouslySetInnerHTML encontrado nos arquivos do Storefront!'
);
console.log('✓ Zero ocorrências de dangerouslySetInnerHTML no Storefront.\n');

console.log('=== TODOS OS TESTES DO STOREFRONT PASSARAM COM SUCESSO! ===');
