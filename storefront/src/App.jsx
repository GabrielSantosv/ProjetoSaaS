import React, { useState, useEffect, useRef } from 'react';
import ImageSlot from './components/ImageSlot';
import { cartCount as calcCartCount, cartSubtotal, shippingCost, shouldShowSummary } from './utils/cart.js';
import {
  getOrCreateCustomerId,
  fetchCatalog,
  fetchCart,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  updateCartDelivery,
  checkout as apiCheckout,
  toUiProduct,
  SHIPPING_METHOD_CODES,
  PAYMENT_METHOD_CODES,
  paymentMethodLabel
} from './utils/api.js';

export default function App() {
  const [view, setView] = useState('grid'); // 'grid' | 'detail' | 'cart' | 'checkout' | 'done'
  const [cat, setCat] = useState('Tudo');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState({});
  const [ship, setShip] = useState('Entrega padrão');
  const [pay, setPay] = useState('Pix');
  const [busy, setBusy] = useState(false);
  const [buyer, setBuyer] = useState({ name: '', email: '', address: '', phone: '' });
  const [order, setOrder] = useState(null);

  const [customerId] = useState(() => getOrCreateCustomerId());
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [addBusyIds, setAddBusyIds] = useState({});
  const [itemBusyIds, setItemBusyIds] = useState({});
  const [actionError, setActionError] = useState(null);
  const checkoutInFlight = useRef(false);

  const syncCartFromResponse = response => {
    setCart(Object.fromEntries((response?.items || []).map(i => [i.productId, i.quantity])));
  };

  // Carga inicial do catálogo — AbortController cancela a requisição anterior se o efeito
  // remontar (StrictMode) ou o componente desmontar antes da resposta chegar.
  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(null);

    fetchCatalog({ signal: controller.signal })
      .then(page => setCatalog((page.content || []).map(toUiProduct)))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setCatalogError(err.message || 'Não foi possível carregar os produtos agora.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Carga inicial do carrinho do servidor — mesmo cuidado de cancelamento do efeito acima.
  useEffect(() => {
    const controller = new AbortController();

    fetchCart(customerId, { signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted) syncCartFromResponse(response);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setActionError(err.message || 'Não foi possível carregar seu carrinho agora.');
      });

    return () => controller.abort();
  }, [customerId]);

  const accent = '#2563eb';
  const mix = (pct, other) => `color-mix(in oklab, ${accent} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentGlow = `color-mix(in oklab, ${accent} 26%, transparent)`;

  const brl = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const performAddToCart = async (id, n, { navigateToCart } = {}) => {
    if (addBusyIds[id]) return;
    setAddBusyIds(prev => ({ ...prev, [id]: true }));
    setActionError(null);
    try {
      const response = await addCartItem(customerId, id, n);
      syncCartFromResponse(response);
      if (navigateToCart) {
        setQty(1);
        setView('cart');
      }
    } catch (err) {
      setActionError(err.message || 'Não foi possível adicionar este item ao carrinho.');
    } finally {
      setAddBusyIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addToCart = (id, n) => performAddToCart(id, n);

  // Um pedido de rede por item por vez — clique repetido em +/- enquanto a requisição
  // anterior ainda está em voo é ignorado, então nunca há respostas fora de ordem.
  const setItemQty = async (id, n) => {
    if (itemBusyIds[id]) return;
    setItemBusyIds(prev => ({ ...prev, [id]: true }));
    setActionError(null);
    try {
      const response = n <= 0
        ? await removeCartItem(customerId, id)
        : await updateCartItemQuantity(customerId, id, Math.min(20, n));
      syncCartFromResponse(response);
    } catch (err) {
      setActionError(err.message || 'Não foi possível atualizar o carrinho agora.');
    } finally {
      setItemBusyIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const catList = ['Tudo', 'Pratos', 'Entradas', 'Sobremesas', 'Vinhos', 'Padaria', 'Mercearia'];
  const q = query.trim().toLowerCase();

  const visibleProducts = catalog.filter(
    x => (cat === 'Tudo' || x.cat === cat) && (!q || x.name.toLowerCase().includes(q) || x.cat.toLowerCase().includes(q))
  );

  const curProduct = catalog.find(x => x.id === current) || null;

  const cartIds = Object.keys(cart);
  const cartLines = cartIds
    .map(id => {
      const x = catalog.find(c => c.id === id);
      if (!x) return null;
      const n = cart[id];
      return {
        ...x,
        qty: n,
        total: brl(x.price * n)
      };
    })
    .filter(Boolean);

  const cartCount = calcCartCount(cart);
  const subtotal = cartSubtotal(cart, catalog);

  // Free shipping recalculation at R$ 250 (bidirectional) — logic lives in cart.js
  const shipCost = shippingCost(subtotal, ship);
  const total = subtotal + shipCost;

  const validBuyer =
    buyer.name.trim().length > 2 &&
    buyer.email.includes('@') &&
    (ship === 'Retirar na loja' || buyer.address.trim().length > 5) &&
    cartCount > 0;

  const handlePlaceOrder = async () => {
    if (!validBuyer || checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setBusy(true);
    setActionError(null);

    try {
      await updateCartDelivery(customerId, {
        address: ship === 'Retirar na loja' ? null : buyer.address,
        shippingMethod: SHIPPING_METHOD_CODES[ship],
        paymentMethod: PAYMENT_METHOD_CODES[pay]
      });
      const created = await apiCheckout(customerId);

      const newOrder = {
        code: `#${created.id.slice(-6).toUpperCase()}`,
        email: buyer.email,
        ship: created.deliveryAddress ? 'Entrega padrão' : 'Retirar na loja',
        pay: paymentMethodLabel(created.paymentMethod),
        address: created.deliveryAddress,
        lines: (created.items || []).map(it => ({ qty: it.quantity, name: it.productName, total: brl(Number(it.subtotal)) })),
        total: brl(Number(created.total))
      };

      setOrder(newOrder);
      setCart({});
      setView('done');
    } catch (err) {
      setActionError(err.message || 'Não foi possível confirmar seu pedido agora. Tente novamente.');
    } finally {
      setBusy(false);
      checkoutInFlight.current = false;
    }
  };

  const isPickup = (order && order.ship === 'Retirar na loja') || ship === 'Retirar na loja';

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(12px)',
          padding: '26px clamp(24px, 5vw, 72px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px'
        }}
      >
        <button
          onClick={() => setView('grid')}
          style={{ border: 0, background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: '24px', letterSpacing: '-0.02em', color: '#1e293b' }}>
            Aurora
          </span>
          <span style={{ fontSize: '9.5px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#94a3b8' }}>
            Mercearia
          </span>
        </button>

        <button
          onClick={() => setView('cart')}
          style={{ position: 'relative', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '13px', color: '#64748b' }}>Carrinho</span>
          <span
            style={{
              position: 'relative',
              width: '34px',
              height: '34px',
              borderRadius: '999px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{ width: '13px', height: '11px', border: `1.6px solid ${accent}`, borderRadius: '2px 2px 5px 5px' }} />
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '19px',
                height: '19px',
                borderRadius: '999px',
                background: accent,
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px'
              }}
            >
              {cartCount}
            </span>
          </span>
        </button>
      </header>

      {/* VIEW: GRID (HOME) */}
      {view === 'grid' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* HERO */}
          <section style={{ padding: 'clamp(40px, 7vw, 90px) clamp(24px, 5vw, 72px) clamp(32px, 4vw, 56px) clamp(24px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: '26px', maxWidth: '900px' }}>
            <h1 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(44px, 7vw, 82px)', lineHeight: 1.02, letterSpacing: '-0.035em', color: '#1e293b' }}>
              A cozinha da Aurora, agora na sua casa.
            </h1>
            <p style={{ margin: 0, fontSize: 'clamp(15px, 1.4vw, 18px)', lineHeight: 1.7, color: '#64748b', maxWidth: '560px' }}>
              Pratos, massas frescas e vinhos selecionados pelo mesmo time que atende o salão. Entregamos na cidade inteira, todos os dias.
            </p>
          </section>

          {/* CATEGORIES & SEARCH */}
          <div style={{ padding: '0 clamp(24px, 5vw, 72px)', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '26px', borderBottom: '1px solid #f1f5f9', paddingBottom: '22px' }}>
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px, 2.4vw, 34px)' }}>
              {catList.map(c => {
                const on = cat === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: '4px 0 6px 0',
                      fontSize: '14.5px',
                      fontWeight: on ? 500 : 400,
                      color: on ? '#1e293b' : '#94a3b8',
                      borderBottom: `2px solid ${on ? accent : 'transparent'}`,
                      cursor: 'pointer'
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', padding: '0 2px 7px 2px', minWidth: '220px' }}>
              <span style={{ width: '11px', height: '11px', border: '1.6px solid #cbd5e1', borderRadius: '50%', flexShrink: 0 }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar na loja"
                style={{ border: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: '14px', color: '#334155' }}
              />
            </div>
          </div>

          {/* LOADING / ERROR DO CATÁLOGO */}
          {catalogLoading && (
            <div style={{ padding: 'clamp(40px, 5vw, 72px) clamp(24px, 5vw, 72px) clamp(60px, 8vw, 110px) clamp(24px, 5vw, 72px)' }}>
              <p style={{ margin: 0, fontSize: '14.5px', color: '#94a3b8' }}>Carregando produtos…</p>
            </div>
          )}
          {catalogError && !catalogLoading && (
            <div style={{ padding: 'clamp(40px, 5vw, 72px) clamp(24px, 5vw, 72px) clamp(60px, 8vw, 110px) clamp(24px, 5vw, 72px)' }}>
              <p style={{ margin: 0, fontSize: '14.5px', color: '#dc2626' }}>{catalogError}</p>
            </div>
          )}

          {!catalogLoading && !catalogError && (
          <>
          {/* PRODUCT CARDS GRID */}
          <section style={{ padding: 'clamp(40px, 5vw, 72px) clamp(24px, 5vw, 72px) clamp(60px, 8vw, 110px) clamp(24px, 5vw, 72px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'clamp(40px, 5vw, 72px) clamp(28px, 3.5vw, 56px)' }}>
            {visibleProducts.map(pr => (
              <article key={pr.id} style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
                <button
                  onClick={() => {
                    setCurrent(pr.id);
                    setQty(1);
                    setView('detail');
                  }}
                  style={{ border: 0, background: 'transparent', padding: 0, display: 'block', width: '100%', cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', background: '#f8fafc', overflow: 'hidden', borderRadius: '16px' }}>
                    <ImageSlot id={`shop-${pr.id}`} hint={`Foto — ${pr.name}`} />
                  </div>
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    {pr.cat}
                  </div>
                  <button
                    onClick={() => {
                      setCurrent(pr.id);
                      setQty(1);
                      setView('detail');
                    }}
                    style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(24px, 2.3vw, 30px)', lineHeight: 1.15, letterSpacing: '-0.025em', color: '#1e293b' }}>
                      {pr.name}
                    </h2>
                  </button>
                  <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.65, color: '#94a3b8' }}>
                    {pr.short}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingTop: '6px' }}>
                    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '26px', letterSpacing: '-0.02em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                      {brl(pr.price)}
                    </span>
                    <button
                      onClick={() => addToCart(pr.id, 1)}
                      disabled={!!addBusyIds[pr.id]}
                      style={{
                        border: 0,
                        background: accent,
                        color: '#ffffff',
                        borderRadius: '999px',
                        padding: '14px 26px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        boxShadow: `0 14px 30px ${accentGlow}`,
                        cursor: addBusyIds[pr.id] ? 'not-allowed' : 'pointer',
                        opacity: addBusyIds[pr.id] ? 0.7 : 1
                      }}
                    >
                      {addBusyIds[pr.id] ? 'Adicionando…' : 'Adicionar ao carrinho'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {visibleProducts.length === 0 && (
            <div style={{ padding: '0 clamp(24px, 5vw, 72px) 110px clamp(24px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '520px' }}>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: '32px', letterSpacing: '-0.025em', color: '#1e293b' }}>
                Nada por aqui.
              </h2>
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.7, color: '#94a3b8' }}>
                Tente outra palavra ou volte para todas as categorias.
              </p>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* VIEW: DETAIL */}
      {view === 'detail' && curProduct && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px clamp(24px, 5vw, 72px) 0 clamp(24px, 5vw, 72px)' }}>
            <button
              onClick={() => setView('grid')}
              style={{ border: 0, background: 'transparent', padding: 0, fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}
            >
              ← Voltar à loja
            </button>
          </div>

          <section style={{ padding: 'clamp(28px, 4vw, 52px) clamp(24px, 5vw, 72px) clamp(60px, 8vw, 100px) clamp(24px, 5vw, 72px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 'clamp(36px, 5vw, 80px)', alignItems: 'start' }}>
            {/* IMAGES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', background: '#f8fafc', overflow: 'hidden', borderRadius: '20px' }}>
                <ImageSlot id={`detail-${curProduct.id}`} hint={`Foto principal — ${curProduct.name}`} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#f8fafc', overflow: 'hidden', borderRadius: '14px' }}>
                    <ImageSlot id={`detail-${curProduct.id}-${n}`} hint={`Detalhe ${n}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* DETAILS & BUY */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', minWidth: 0, paddingTop: 'clamp(0px, 1vw, 18px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                  {curProduct.cat}
                </div>
                <h1 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(38px, 4.6vw, 60px)', lineHeight: 1.05, letterSpacing: '-0.032em', color: '#1e293b' }}>
                  {curProduct.name}
                </h1>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 'clamp(30px, 3vw, 40px)', letterSpacing: '-0.025em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                  {brl(curProduct.price)}
                </span>
              </div>

              <p style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(17px, 1.7vw, 21px)', lineHeight: 1.6, color: '#475569' }}>
                {curProduct.long}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '26px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '5px' }}>
                    <button
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      disabled={qty <= 1}
                      style={{ border: 0, background: 'transparent', width: '42px', height: '42px', borderRadius: '999px', fontSize: '18px', color: qty <= 1 ? '#cbd5e1' : '#334155', cursor: qty <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                      −
                    </button>
                    <span style={{ minWidth: '34px', textAlign: 'center', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '18px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty(q => Math.min(20, q + 1))}
                      style={{ border: 0, background: 'transparent', width: '42px', height: '42px', borderRadius: '999px', fontSize: '18px', color: '#334155', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Entrega hoje se pedir até 18h
                  </span>
                </div>
                <button
                  onClick={() => performAddToCart(curProduct.id, qty, { navigateToCart: true })}
                  disabled={!!addBusyIds[curProduct.id]}
                  style={{
                    border: 0,
                    background: accent,
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '20px 32px',
                    fontSize: '15.5px',
                    fontWeight: 500,
                    boxShadow: `0 18px 36px ${accentGlow}`,
                    cursor: addBusyIds[curProduct.id] ? 'not-allowed' : 'pointer',
                    opacity: addBusyIds[curProduct.id] ? 0.7 : 1
                  }}
                >
                  {addBusyIds[curProduct.id] ? 'Adicionando…' : `Adicionar ao carrinho · ${brl(curProduct.price * qty)}`}
                </button>
                {actionError && (
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: '#dc2626' }}>{actionError}</p>
                )}
              </div>

              {/* SPECS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '26px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Categoria</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>{curProduct.cat}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Porção</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>{curProduct.cat === 'Vinhos' ? 'Garrafa 750 ml' : 'Serve 2 pessoas'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Preparo</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>{curProduct.cat === 'Vinhos' || curProduct.cat === 'Mercearia' ? 'Pronto para servir' : 'Finaliza em casa em minutos'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Entrega</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>Terça a domingo, 11h às 22h</span>
                </div>
              </div>
            </div>
          </section>

          {/* COMBINA COM */}
          <section style={{ padding: '0 clamp(24px, 5vw, 72px) clamp(70px, 9vw, 120px) clamp(24px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: 'clamp(32px, 4vw, 52px)' }}>
            <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(28px, 3vw, 40px)', letterSpacing: '-0.028em', color: '#1e293b' }}>
              Combina com
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 'clamp(28px, 3.5vw, 52px)' }}>
              {catalog.filter(x => x.id !== curProduct.id).slice(0, 3).map(rp => (
                <article key={rp.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                  <button
                    onClick={() => {
                      setCurrent(rp.id);
                      setQty(1);
                    }}
                    style={{ border: 0, background: 'transparent', padding: 0, display: 'block', width: '100%', cursor: 'pointer' }}
                  >
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#f8fafc', overflow: 'hidden', borderRadius: '16px' }}>
                      <ImageSlot id={`related-${rp.id}`} hint={`Foto — ${rp.name}`} />
                    </div>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: '21px', lineHeight: 1.2, letterSpacing: '-0.02em', color: '#1e293b' }}>
                      {rp.name}
                    </h3>
                    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '18px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                      {brl(rp.price)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* VIEW: CART */}
      {view === 'cart' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px clamp(24px, 5vw, 72px) 0 clamp(24px, 5vw, 72px)' }}>
            <button
              onClick={() => setView('grid')}
              style={{ border: 0, background: 'transparent', padding: 0, fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}
            >
              ← Continuar comprando
            </button>
          </div>

          <section style={{ padding: 'clamp(30px, 4vw, 54px) clamp(24px, 5vw, 72px) clamp(20px, 3vw, 36px) clamp(24px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
            <h1 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(40px, 5.6vw, 66px)', lineHeight: 1.04, letterSpacing: '-0.032em', color: '#1e293b' }}>
              Seu carrinho
            </h1>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.7, color: '#64748b' }}>
              {cartCount === 0
                ? 'Seu carrinho está vazio no momento.'
                : `${cartCount} ${cartCount === 1 ? 'item selecionado.' : 'itens selecionados.'} Entregamos hoje se o pedido sair até 18h.`}
            </p>
            {actionError && (
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: '#dc2626' }}>{actionError}</p>
            )}
          </section>

          {/* EMPTY STATE: Hides summary/checkout and shows 'Ver a loja' */}
          {cartCount === 0 && (
            <div style={{ padding: '0 clamp(24px, 5vw, 72px) clamp(70px, 9vw, 110px) clamp(24px, 5vw, 72px)' }}>
              <button
                onClick={() => setView('grid')}
                style={{
                  border: 0,
                  background: accent,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '18px 30px',
                  fontSize: '15px',
                  fontWeight: 500,
                  boxShadow: `0 18px 36px ${accentGlow}`,
                  cursor: 'pointer'
                }}
              >
                Ver a loja
              </button>
            </div>
          )}

          {/* NON-EMPTY CART: LINES + SUMMARY */}
          {shouldShowSummary(cart) && (
            <section style={{ padding: '0 clamp(24px, 5vw, 72px) clamp(70px, 9vw, 110px) clamp(24px, 5vw, 72px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 'clamp(36px, 5vw, 72px)', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {cartLines.map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: 'clamp(16px, 2vw, 26px)', padding: '26px 0', borderTop: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                    <button
                      onClick={() => {
                        setCurrent(l.id);
                        setQty(1);
                        setView('detail');
                      }}
                      style={{ border: 0, background: 'transparent', padding: 0, width: 'clamp(92px, 11vw, 132px)', flexShrink: 0, cursor: 'pointer' }}
                    >
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', background: '#f8fafc', overflow: 'hidden', borderRadius: '12px' }}>
                        <ImageSlot id={`shop-${l.id}`} hint={`Foto — ${l.name}`} />
                      </div>
                    </button>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                        {l.cat}
                      </div>
                      <button
                        onClick={() => {
                          setCurrent(l.id);
                          setQty(1);
                          setView('detail');
                        }}
                        style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                      >
                        <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(20px, 2vw, 26px)', lineHeight: 1.18, letterSpacing: '-0.022em', color: '#1e293b' }}>
                          {l.name}
                        </h2>
                      </button>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', paddingTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '4px', opacity: itemBusyIds[l.id] ? 0.6 : 1 }}>
                          <button
                            onClick={() => setItemQty(l.id, l.qty - 1)}
                            disabled={!!itemBusyIds[l.id]}
                            style={{ border: 0, background: 'transparent', width: '36px', height: '36px', borderRadius: '999px', fontSize: '16px', color: '#334155', cursor: itemBusyIds[l.id] ? 'not-allowed' : 'pointer' }}
                          >
                            −
                          </button>
                          <span style={{ minWidth: '28px', textAlign: 'center', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '16px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                            {l.qty}
                          </span>
                          <button
                            onClick={() => setItemQty(l.id, l.qty + 1)}
                            disabled={!!itemBusyIds[l.id]}
                            style={{ border: 0, background: 'transparent', width: '36px', height: '36px', borderRadius: '999px', fontSize: '16px', color: '#334155', cursor: itemBusyIds[l.id] ? 'not-allowed' : 'pointer' }}
                          >
                            +
                          </button>
                        </div>
                        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '22px', letterSpacing: '-0.02em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                          {l.total}
                        </span>
                      </div>
                      <button
                        onClick={() => setItemQty(l.id, 0)}
                        disabled={!!itemBusyIds[l.id]}
                        style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, fontSize: '12.5px', color: '#94a3b8', cursor: itemBusyIds[l.id] ? 'not-allowed' : 'pointer' }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* SUMMARY */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0, borderTop: '1px solid #f1f5f9', paddingTop: '26px' }}>
                <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: '28px', letterSpacing: '-0.025em', color: '#1e293b' }}>
                  Resumo
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '14px' }}>
                    <span style={{ color: '#94a3b8' }}>Subtotal</span>
                    <span style={{ color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{brl(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '14px' }}>
                    <span style={{ color: '#94a3b8' }}>Entrega</span>
                    <span style={{ color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                      {shipCost === 0 ? 'Grátis' : brl(shipCost)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '14px' }}>
                    <span style={{ color: '#94a3b8' }}>Previsão</span>
                    <span style={{ color: '#334155' }}>
                      {ship === 'Retirar na loja' ? 'Pronto em 40 min' : 'Hoje, até 22h'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>Total</span>
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 'clamp(30px, 3vw, 38px)', letterSpacing: '-0.025em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                    {brl(total)}
                  </span>
                </div>

                <button
                  onClick={() => setView('checkout')}
                  style={{
                    border: 0,
                    background: accent,
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '20px 30px',
                    fontSize: '15.5px',
                    fontWeight: 500,
                    boxShadow: `0 18px 36px ${accentGlow}`,
                    cursor: 'pointer'
                  }}
                >
                  Finalizar compra
                </button>
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: '#94a3b8' }}>
                  Frete grátis acima de R$ 250. Entregamos de terça a domingo, das 11h às 22h.
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {/* VIEW: CHECKOUT */}
      {view === 'checkout' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px clamp(24px, 5vw, 72px) 0 clamp(24px, 5vw, 72px)' }}>
            <button
              onClick={() => setView('cart')}
              style={{ border: 0, background: 'transparent', padding: 0, fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}
            >
              ← Voltar ao carrinho
            </button>
          </div>

          <section style={{ padding: 'clamp(30px, 4vw, 54px) clamp(24px, 5vw, 72px) clamp(20px, 3vw, 36px) clamp(24px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
            <h1 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(40px, 5.6vw, 66px)', lineHeight: 1.04, letterSpacing: '-0.032em', color: '#1e293b' }}>
              Entrega e pagamento
            </h1>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.7, color: '#64748b' }}>
              Confirme onde devemos deixar o pedido e como você prefere pagar.
            </p>
          </section>

          <section style={{ padding: '0 clamp(24px, 5vw, 72px) clamp(70px, 9vw, 110px) clamp(24px, 5vw, 72px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 'clamp(36px, 5vw, 72px)', alignItems: 'start' }}>
            {/* BUYER FORM & OPTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '34px', minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                  Seus dados
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Nome completo</span>
                  <input
                    value={buyer.name}
                    onChange={e => setBuyer(b => ({ ...b, name: e.target.value }))}
                    placeholder="Marina Duarte"
                    style={{ border: 0, borderBottom: '1px solid #e2e8f0', background: 'transparent', padding: '10px 2px', fontSize: '15px', color: '#1e293b' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>E-mail</span>
                  <input
                    value={buyer.email}
                    onChange={e => setBuyer(b => ({ ...b, email: e.target.value }))}
                    placeholder="marina@email.com"
                    style={{ border: 0, borderBottom: `1px solid ${buyer.email && !buyer.email.includes('@') ? '#fecaca' : '#e2e8f0'}`, background: 'transparent', padding: '10px 2px', fontSize: '15px', color: '#1e293b' }}
                  />
                </label>
                {ship !== 'Retirar na loja' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Endereço de entrega</span>
                    <input
                      value={buyer.address}
                      onChange={e => setBuyer(b => ({ ...b, address: e.target.value }))}
                      placeholder="Rua das Palmeiras, 482 · apto 71"
                      style={{ border: 0, borderBottom: '1px solid #e2e8f0', background: 'transparent', padding: '10px 2px', fontSize: '15px', color: '#1e293b' }}
                    />
                  </label>
                )}
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Telefone</span>
                  <input
                    value={buyer.phone}
                    onChange={e => setBuyer(b => ({ ...b, phone: e.target.value }))}
                    placeholder="(11) 99999-0000"
                    style={{ border: 0, borderBottom: '1px solid #e2e8f0', background: 'transparent', padding: '10px 2px', fontSize: '15px', color: '#1e293b' }}
                  />
                </label>
              </div>

              {/* SHIPPING CHOICE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '30px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                  Entrega
                </div>
                {[
                  { label: 'Entrega padrão', hint: 'Hoje, até 22h', price: shipCost === 0 ? 'Grátis' : brl(18) },
                  { label: 'Retirar na loja', hint: 'Pinheiros · pronto em 40 min', price: 'Grátis' }
                ].map(so => {
                  const on = ship === so.label;
                  return (
                    <button
                      key={so.label}
                      type="button"
                      onClick={() => setShip(so.label)}
                      style={{
                        border: `1px solid ${on ? accent : '#e2e8f0'}`,
                        background: 'transparent',
                        borderRadius: '20px',
                        padding: '20px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '18px',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', minWidth: 0 }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '999px', border: `1.5px solid ${on ? accent : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: on ? accent : 'transparent' }} />
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '17px', color: '#1e293b' }}>
                            {so.label}
                          </span>
                          <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>{so.hint}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', color: '#334155', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {so.price}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* PAYMENT CHOICE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '30px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                  Pagamento
                </div>
                {[
                  { label: 'Pix', hint: 'Aprovação imediata' },
                  { label: 'Cartão de crédito', hint: 'Em até 3x sem juros' },
                  { label: 'Na entrega', hint: 'Cartão ou dinheiro com o entregador' }
                ].map(po => {
                  const on = pay === po.label;
                  return (
                    <button
                      key={po.label}
                      type="button"
                      onClick={() => setPay(po.label)}
                      style={{
                        border: `1px solid ${on ? accent : '#e2e8f0'}`,
                        background: 'transparent',
                        borderRadius: '20px',
                        padding: '20px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: '20px', height: '20px', borderRadius: '999px', border: `1.5px solid ${on ? accent : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: on ? accent : 'transparent' }} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '17px', color: '#1e293b' }}>
                          {po.label}
                        </span>
                        <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>{po.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ORDER SUMMARY IN CHECKOUT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0, borderTop: '1px solid #f1f5f9', paddingTop: '26px' }}>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: '28px', letterSpacing: '-0.025em', color: '#1e293b' }}>
                Seu pedido
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {cartLines.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                      <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', fontWeight: 500, color: accentHover, fontVariantNumeric: 'tabular-nums' }}>
                        {l.qty}
                      </span>
                      <span style={{ fontSize: '13.5px', color: '#475569' }}>{l.name}</span>
                    </div>
                    <span style={{ fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{l.total}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '14px' }}>
                  <span style={{ color: '#94a3b8' }}>Subtotal</span>
                  <span style={{ color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{brl(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '14px' }}>
                  <span style={{ color: '#94a3b8' }}>Entrega</span>
                  <span style={{ color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                    {shipCost === 0 ? 'Grátis' : brl(shipCost)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '14px' }}>
                  <span style={{ color: '#94a3b8' }}>Previsão</span>
                  <span style={{ color: '#334155' }}>
                    {ship === 'Retirar na loja' ? 'Pronto em 40 min' : 'Hoje, até 22h'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>Total</span>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 'clamp(30px, 3vw, 38px)', letterSpacing: '-0.025em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                  {brl(total)}
                </span>
              </div>

              {/* SINGLE SUBMIT BUTTON */}
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={!validBuyer || busy}
                style={{
                  border: 0,
                  background: busy ? accentHover : validBuyer ? accent : '#cbd5e1',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '20px 30px',
                  fontSize: '15.5px',
                  fontWeight: 500,
                  boxShadow: validBuyer && !busy ? `0 18px 36px ${accentGlow}` : 'none',
                  cursor: !validBuyer || busy ? 'not-allowed' : 'pointer'
                }}
              >
                {busy
                  ? 'Confirmando pedido…'
                  : validBuyer
                  ? `Confirmar pedido · ${brl(total)}`
                  : 'Preencha seus dados'}
              </button>
              <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: '#94a3b8' }}>
                {busy
                  ? 'Estamos registrando seu pedido. Não feche esta página.'
                  : validBuyer
                  ? 'Você recebe a confirmação por e-mail em instantes.'
                  : 'Nome, e-mail e dados de entrega são necessários para seguir.'}
              </p>
              {actionError && (
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: '#dc2626' }}>{actionError}</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* VIEW: DONE / CONFIRMATION */}
      {view === 'done' && order && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <section style={{ padding: 'clamp(56px, 9vw, 120px) clamp(24px, 5vw, 72px) clamp(40px, 5vw, 64px) clamp(24px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: '26px', maxWidth: '780px' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '999px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '18px', height: '10px', borderLeft: `2px solid ${accent}`, borderBottom: `2px solid ${accent}`, transform: 'rotate(-45deg) translateY(-2px)' }} />
            </div>
            <h1 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.03, letterSpacing: '-0.034em', color: '#1e293b' }}>
              Pedido confirmado. Já estamos preparando.
            </h1>
            <p style={{ margin: 0, fontSize: 'clamp(15px, 1.4vw, 18px)', lineHeight: 1.7, color: '#64748b', maxWidth: '560px' }}>
              Enviamos os detalhes para {order.email}.{' '}
              {order.ship === 'Retirar na loja'
                ? 'Você recebe um aviso quando o pedido estiver pronto para retirada no balcão.'
                : 'Você recebe um aviso quando o entregador sair da nossa cozinha.'}
            </p>
          </section>

          <section style={{ padding: '0 clamp(24px, 5vw, 72px) clamp(70px, 9vw, 110px) clamp(24px, 5vw, 72px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'clamp(30px, 4vw, 56px)', alignItems: 'start' }}>
            {/* ORDER INFO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                Pedido
              </div>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '30px', letterSpacing: '-0.02em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {order.code}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Pagamento</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>{order.pay}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Entrega</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>{order.ship}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Endereço</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>
                    {order.ship === 'Retirar na loja' ? 'Rua das Palmeiras, 482 · loja' : order.address}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', fontSize: '13.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Previsão</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>
                    {order.ship === 'Retirar na loja' ? 'Pronto em 40 min' : 'Hoje, até 22h'}
                  </span>
                </div>
              </div>
            </div>

            {/* ORDER ITEMS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                Itens
              </div>
              {order.lines.map((ol, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11.5px', color: accentHover, fontVariantNumeric: 'tabular-nums' }}>
                      {ol.qty}
                    </span>
                    <span style={{ fontSize: '13.5px', color: '#475569' }}>{ol.name}</span>
                  </div>
                  <span style={{ fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{ol.total}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>Total pago</span>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: '26px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                  {order.total}
                </span>
              </div>
            </div>

            {/* ORDER TRACKING */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8' }}>
                Acompanhe
              </div>
              {(order.ship === 'Retirar na loja'
                ? [
                    { label: 'Pedido recebido', at: 'agora', done: true },
                    { label: 'Em preparo na cozinha', at: 'em alguns minutos', done: false },
                    { label: 'Pronto para retirada', at: 'aviso por e-mail em ~40 min', done: false },
                    { label: 'Retirado na loja', at: 'Rua das Palmeiras, 482', done: false }
                  ]
                : [
                    { label: 'Pedido recebido', at: 'agora', done: true },
                    { label: 'Em preparo na cozinha', at: 'em alguns minutos', done: false },
                    { label: 'Saiu para entrega', at: 'aviso por e-mail', done: false },
                    { label: 'Entregue', at: 'hoje, até 22h', done: false }
                  ]
              ).map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '999px',
                      background: step.done ? '#eff6ff' : '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: step.done ? accent : '#cbd5e1' }} />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '13.5px', color: step.done ? '#1e293b' : '#94a3b8' }}>{step.label}</span>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{step.at}</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setView('grid')}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '6px',
                  border: 0,
                  background: accent,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '17px 28px',
                  fontSize: '14.5px',
                  fontWeight: 500,
                  boxShadow: `0 18px 36px ${accentGlow}`,
                  cursor: 'pointer'
                }}
              >
                Voltar à loja
              </button>
            </div>
          </section>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', padding: 'clamp(40px, 5vw, 64px) clamp(24px, 5vw, 72px)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px' }}>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: '20px', letterSpacing: '-0.02em', color: '#1e293b' }}>
            Aurora Mercearia
          </span>
          <span style={{ fontSize: '13px', lineHeight: 1.7, color: '#94a3b8' }}>
            Rua das Palmeiras, 482 · Pinheiros, São Paulo · entregas de terça a domingo, 11h às 22h.
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '26px', fontSize: '13px' }}>
          <a href="#entregas">Entregas</a>
          <a href="#trocas">Trocas</a>
          <a href="#contato">Contato</a>
        </div>
      </footer>
    </div>
  );
}
