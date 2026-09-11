import { parseBRL, cents, fromCents } from '../utils/money.js';
import { canAccess, can, ROLE_MODULES, ROLE_ACTIONS } from '../utils/permissions.js';

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL: ' + message);
    process.exit(1);
  }
}

// Test money.js
console.log('Testing money.js...');
assert(parseBRL("0.5") === 0.5, 'parseBRL("0.5") must be 0.5, got ' + parseBRL("0.5"));
assert(parseBRL("0,50") === 0.5, 'parseBRL("0,50") must be 0.5');
assert(parseBRL("1.000") === 1000, 'parseBRL("1.000") must be 1000, got ' + parseBRL("1.000"));
assert(parseBRL("1.234,56") === 1234.56, 'parseBRL("1.234,56") must be 1234.56');
assert(parseBRL("1,234.56") === 1234.56, 'parseBRL("1,234.56") must be 1234.56');
assert(parseBRL(",,,,") === 0, 'parseBRL(",,,,") must be 0, not NaN');
assert(parseBRL("-50,00") === -50, 'parseBRL("-50,00") must be -50');
assert(cents("10.99") === 1099, 'cents("10.99") must be 1099');
assert(fromCents(1099) === 10.99, 'fromCents(1099) must be 10.99');
console.log('money.js passed all tests!');

// Test permissions.js
console.log('Testing permissions.js...');
// ADMIN: all modules
const allMods = ["dashboard", "pedidos", "pdv", "produtos", "importacao", "caixa", "configuracoes"];
allMods.forEach(m => assert(canAccess("ADMIN", m), `ADMIN should access ${m}`));

// VENDEDOR: no caixa, no importacao
assert(!canAccess("VENDEDOR", "caixa"), 'VENDEDOR should NOT access caixa');
assert(!canAccess("VENDEDOR", "importacao"), 'VENDEDOR should NOT access importacao');
assert(canAccess("VENDEDOR", "dashboard"), 'VENDEDOR should access dashboard');
assert(canAccess("VENDEDOR", "pedidos"), 'VENDEDOR should access pedidos');
assert(canAccess("VENDEDOR", "pdv"), 'VENDEDOR should access pdv');
assert(canAccess("VENDEDOR", "produtos"), 'VENDEDOR should access produtos');
assert(canAccess("VENDEDOR", "configuracoes"), 'VENDEDOR should access configuracoes');

// PDV: only pedidos, pdv, configuracoes
assert(canAccess("PDV", "pedidos"), 'PDV should access pedidos');
assert(canAccess("PDV", "pdv"), 'PDV should access pdv');
assert(canAccess("PDV", "configuracoes"), 'PDV should access configuracoes');
assert(!canAccess("PDV", "dashboard"), 'PDV should NOT access dashboard');
assert(!canAccess("PDV", "produtos"), 'PDV should NOT access produtos');
assert(!canAccess("PDV", "importacao"), 'PDV should NOT access importacao');
assert(!canAccess("PDV", "caixa"), 'PDV should NOT access caixa');

// CAIXA: no pdv, no produtos, no importacao
assert(canAccess("CAIXA", "dashboard"), 'CAIXA should access dashboard');
assert(canAccess("CAIXA", "pedidos"), 'CAIXA should access pedidos');
assert(canAccess("CAIXA", "caixa"), 'CAIXA should access caixa');
assert(canAccess("CAIXA", "configuracoes"), 'CAIXA should access configuracoes');
assert(!canAccess("CAIXA", "pdv"), 'CAIXA should NOT access pdv');
assert(!canAccess("CAIXA", "produtos"), 'CAIXA should NOT access produtos');
assert(!canAccess("CAIXA", "importacao"), 'CAIXA should NOT access importacao');

console.log('permissions.js passed all tests!');
