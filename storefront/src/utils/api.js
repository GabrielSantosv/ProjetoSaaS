/**
 * Cliente HTTP do Storefront. Fala só com as rotas públicas "/api/v1/storefront/**"
 * (sem JWT — não há login no storefront). O carrinho é estado de servidor: cada mutação
 * chama o backend e a UI deve sempre refletir a resposta real, nunca assumir localmente.
 */

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';
const CUSTOMER_ID_KEY = 'aurora.customerId';

/** UUID do visitante, gerado uma vez e persistido — identifica o carrinho dele no servidor. */
export function getOrCreateCustomerId() {
  try {
    const existing = localStorage.getItem(CUSTOMER_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(CUSTOMER_ID_KEY, created);
    return created;
  } catch {
    // localStorage indisponível (aba anônima bloqueada, etc.): segue com um id efêmero
    // só desta sessão de memória, em vez de quebrar a tela.
    return crypto.randomUUID();
  }
}

async function parseErrorMessage(response, fallback) {
  const body = await response.json().catch(() => null);
  if (body?.details?.length) return body.details.join(' ');
  return body?.message || fallback;
}

async function request(path, { method = 'GET', body, signal } = {}, fallbackErrorMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, fallbackErrorMessage));
  }
  if (response.status === 204) return null;
  return response.json();
}

export function fetchCatalog({ signal } = {}) {
  return request(
    '/api/v1/storefront/products?size=100&sort=name,asc',
    { signal },
    'Não foi possível carregar os produtos agora.'
  );
}

export function fetchCart(customerId, { signal } = {}) {
  return request(
    `/api/v1/storefront/cart/${customerId}`,
    { signal },
    'Não foi possível carregar seu carrinho agora.'
  );
}

export function addCartItem(customerId, productId, quantity) {
  return request(
    `/api/v1/storefront/cart/${customerId}/items`,
    { method: 'POST', body: { productId, quantity } },
    'Não foi possível adicionar este item ao carrinho.'
  );
}

export function updateCartItemQuantity(customerId, productId, quantity) {
  return request(
    `/api/v1/storefront/cart/${customerId}/items/${productId}`,
    { method: 'PUT', body: { quantity } },
    'Não foi possível atualizar a quantidade deste item.'
  );
}

export function removeCartItem(customerId, productId) {
  return request(
    `/api/v1/storefront/cart/${customerId}/items/${productId}`,
    { method: 'DELETE' },
    'Não foi possível remover este item do carrinho.'
  );
}

export function updateCartDelivery(customerId, { address, shippingMethod, paymentMethod }) {
  return request(
    `/api/v1/storefront/cart/${customerId}/delivery`,
    { method: 'PUT', body: { address, shippingMethod, paymentMethod } },
    'Não foi possível salvar os dados de entrega e pagamento.'
  );
}

export function checkout(customerId) {
  return request(
    `/api/v1/storefront/checkout/${customerId}`,
    { method: 'POST' },
    'Não foi possível confirmar seu pedido agora. Tente novamente.'
  );
}

/** Mapeia o produto do backend para o formato usado pela UI (grid, detalhe, carrinho). */
export function toUiProduct(p) {
  return {
    id: p.id,
    name: p.name,
    cat: p.categoryName || 'Geral',
    price: Number(p.price),
    short: p.description || '',
    long: p.description || '',
    stockQuantity: p.stockQuantity
  };
}

export const SHIPPING_METHOD_CODES = {
  'Entrega padrão': 'DELIVERY',
  'Retirar na loja': 'PICKUP'
};

export const PAYMENT_METHOD_CODES = {
  Pix: 'PIX',
  'Cartão de crédito': 'CREDIT_CARD',
  'Na entrega': 'ON_DELIVERY'
};

const PAYMENT_METHOD_LABELS = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  ON_DELIVERY: 'Na entrega'
};

export function paymentMethodLabel(code) {
  return PAYMENT_METHOD_LABELS[code] || code;
}
