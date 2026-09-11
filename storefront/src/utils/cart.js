/**
 * Funções puras de cálculo do carrinho.
 * Importadas tanto pelo App.jsx quanto pela suíte de testes.
 * Nenhum estado React aqui — somente lógica determinística.
 */

/** Soma a quantidade total de itens no carrinho. */
export function cartCount(cart) {
  return Object.keys(cart).reduce((acc, id) => acc + cart[id], 0);
}

/**
 * Calcula o subtotal em reais dado o catálogo completo e o estado do carrinho.
 * @param {Record<string, number>} cart  - { [productId]: quantity }
 * @param {Array<{id: string, price: number}>} catalog
 */
export function cartSubtotal(cart, catalog) {
  return Object.keys(cart).reduce((acc, id) => {
    const product = catalog.find(p => p.id === id);
    return product ? acc + product.price * cart[id] : acc;
  }, 0);
}

/**
 * Calcula o custo de frete.
 * Regras:
 *   - "Retirar na loja" → sempre grátis.
 *   - Carrinho vazio → grátis (subtotal = 0, sem entregas).
 *   - subtotal >= 250 → grátis.
 *   - subtotal < 250  → R$ 18.
 *
 * @param {number} subtotal
 * @param {'Entrega padrão'|'Retirar na loja'} shipType
 */
export function shippingCost(subtotal, shipType) {
  if (shipType === 'Retirar na loja') return 0;
  if (subtotal >= 250 || subtotal === 0) return 0;
  return 18;
}

/**
 * Retorna se o bloco de resumo/checkout deve ser exibido.
 * A regra é: somente quando há ao menos 1 item no carrinho.
 *
 * @param {Record<string, number>} cart
 */
export function shouldShowSummary(cart) {
  return cartCount(cart) > 0;
}

/**
 * Função agregada: recebe o cart e o catálogo, retorna tudo que a UI precisa.
 */
export function cartTotals(cart, catalog, shipType) {
  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart, catalog);
  const ship = shippingCost(subtotal, shipType);
  return {
    count,
    subtotal,
    shipCost: ship,
    total: subtotal + ship,
    showSummary: count > 0
  };
}
