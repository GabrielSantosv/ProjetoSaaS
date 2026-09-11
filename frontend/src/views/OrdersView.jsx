import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

const STATUS_TO_LABEL = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', COMPLETED: 'Enviado' };
const LABEL_TO_STATUS = { Pendente: 'PENDING', Confirmado: 'CONFIRMED', Cancelado: 'CANCELLED', Enviado: 'COMPLETED' };
const CHANNEL_TO_LABEL = { ECOMMERCE: 'E-commerce', PDV: 'PDV' };

async function apiRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.details?.length ? body.details.join(' ') : (body?.message || 'Não foi possível completar a operação.');
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function formatWhen(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Hoje, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
}

function orderCode(id) {
  return '#' + String(id || '').slice(0, 8).toUpperCase();
}

function mapOrderFromApi(o) {
  return {
    id: o.id,
    code: orderCode(o.id),
    client: o.customerId || '—',
    channel: CHANNEL_TO_LABEL[o.channel] || o.channel,
    when: formatWhen(o.createdAt),
    updatedWhen: formatWhen(o.updatedAt),
    status: STATUS_TO_LABEL[o.status] || o.status,
    total: Number(o.total),
    items: (o.items || []).map(it => ({
      qty: it.quantity,
      name: it.productName || 'Produto removido do catálogo',
      sku: (it.productId || '').slice(0, 8).toUpperCase(),
      unitPrice: Number(it.unitPrice),
      subtotal: Number(it.subtotal)
    }))
  };
}

export default function OrdersView({
  accentColor = '#2563eb'
}) {
  const [orders, setOrders] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [counts, setCounts] = useState({});
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const perPage = 6;

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const brl = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const initials = s => String(s || '').replace(/[#]/g, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const filterDefs = ['Todos', 'Pendente', 'Em preparo', 'Confirmado', 'Enviado', 'Cancelado'];

  // Debounce da busca em tempo real: evita disparar uma requisição a cada tecla
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Volta pra primeira página sempre que o filtro efetivo (busca ou status) muda
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filter]);

  // Listagem paginada no servidor via GET /orders/admin. "Em preparo" não existe como
  // status real no backend (só PENDING/CONFIRMED/CANCELLED/COMPLETED) — resolvido em
  // memória, sem chamada de rede, sempre como lista vazia, igual a um filtro que nunca
  // casa com nada.
  useEffect(() => {
    if (filter === 'Em preparo') {
      setOrders([]);
      setTotalElements(0);
      setTotalPages(1);
      setLoadingList(false);
      setListError(null);
      return;
    }

    const controller = new AbortController();
    setLoadingList(true);
    setListError(null);

    const params = new URLSearchParams();
    params.set('page', String(page - 1));
    params.set('size', String(perPage));
    if (debouncedQuery) params.set('search', debouncedQuery);
    if (filter !== 'Todos' && LABEL_TO_STATUS[filter]) params.set('status', LABEL_TO_STATUS[filter]);

    apiRequest(`/api/v1/orders/admin?${params.toString()}`, { signal: controller.signal })
      .then(data => {
        setOrders((data.page.content || []).map(mapOrderFromApi));
        setTotalElements(data.page.totalElements);
        setTotalPages(Math.max(1, data.page.totalPages));
        setCounts(data.counts || {});
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setListError(err.message || 'Não foi possível carregar os pedidos agora.');
      })
      .finally(() => setLoadingList(false));

    return () => controller.abort();
  }, [page, debouncedQuery, filter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const filterCounts = {
    Todos: counts.TOTAL || 0,
    Pendente: counts.PENDING || 0,
    'Em preparo': 0,
    Confirmado: counts.CONFIRMED || 0,
    Enviado: counts.COMPLETED || 0,
    Cancelado: counts.CANCELLED || 0
  };

  const pagedRows = orders;
  const validPage = Math.min(page, totalPages);

  const exportCSVOLD = () => {
    if (filteredOrders.length === 0) return;
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const head = 'pedido;cliente;canal;tipo_entrega;quando;total;situacao\n';
    const body = filteredOrders
      .map(r => [r.code, r.client, r.channel, r.deliveryType || 'Entrega', r.when, brl(r.total).replace('R$ ', ''), r.status].map(esc).join(';'))
      .join('\n');

    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob(['\uFEFF' + head + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${stamp}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const openOrderDetail = o => {
    setSelectedOrder(o);
    setView('detail');
  };

  const currentDetailOrder = selectedOrder || orders[0];
  const isPickup = currentDetailOrder.deliveryType === 'Retirar na loja' || currentDetailOrder.channel === 'PDV';

  const detailItems = [
    { qty: 2, name: 'Risoto de cogumelos', sku: 'PRD-1042', price: brl(118) },
    { qty: 1, name: 'Salada de burrata', sku: 'PRD-1044', price: brl(52) },
    { qty: 4, name: 'Água com gás 500ml', sku: 'PRD-1048', price: brl(36) },
    { qty: 1, name: 'Vinho Malbec (taça)', sku: 'PRD-1047', price: brl(48) }
  ];

  const subtotal = currentDetailOrder.total * 0.9;
  const shipping = isPickup ? 0 : currentDetailOrder.total * 0.06;
  const discount = currentDetailOrder.total * 0.02;

  // Strict regression check: Retirar na loja shows "Pronto para retirada"/"Retirado na loja", NO delivery mention
  const timelineSteps = [
    { label: 'Pedido criado', at: currentDetailOrder.when, done: true },
    { label: 'Pagamento aprovado', at: '2 min depois', done: currentDetailOrder.status !== 'Pendente' && currentDetailOrder.status !== 'Cancelado' },
    {
      label: isPickup ? 'Em preparo no balcão' : 'Em separação',
      at: currentDetailOrder.status === 'Enviado' || currentDetailOrder.status === 'Em preparo' ? '8 min depois' : 'aguardando',
      done: currentDetailOrder.status === 'Enviado' || currentDetailOrder.status === 'Em preparo'
    },
    {
      label: currentDetailOrder.status === 'Cancelado'
        ? 'Pedido cancelado'
        : isPickup
        ? 'Pronto para retirada na loja'
        : 'Enviado para entrega',
      at: currentDetailOrder.status === 'Enviado' ? '24 min depois' : currentDetailOrder.status === 'Cancelado' ? 'cancelado pelo cliente' : 'aguardando',
      done: currentDetailOrder.status === 'Enviado' || currentDetailOrder.status === 'Cancelado'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
            {view === 'detail' ? 'Pedidos · detalhe' : 'Operação'}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 700,
              fontSize: '44px',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: '#1e293b'
            }}
          >
            {view === 'detail' ? `Pedido ${currentDetailOrder.code}` : 'Pedidos'}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            {view === 'detail'
              ? 'Histórico completo do pedido, com linha do tempo e dados do cliente.'
              : 'Todos os canais em uma lista só — PDV, e-commerce e pedidos criados por importação.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {view === 'list' ? (
            <button
              onClick={exportCSV}
              disabled={filteredOrders.length === 0}
              style={{
                border: `1px solid ${filteredOrders.length === 0 ? '#e2e8f0' : '#bfdbfe'}`,
                background: '#ffffff',
                color: filteredOrders.length === 0 ? '#cbd5e1' : accentColor,
                borderRadius: '999px',
                padding: '12px 22px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: filteredOrders.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Exportar CSV ({filteredOrders.length})
            </button>
          ) : (
            <button
              onClick={() => setView('list')}
              style={{
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: accentColor,
                borderRadius: '999px',
                padding: '12px 22px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Voltar à lista
            </button>
          )}
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* SEARCH & FILTERS BAR */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '20px 24px', boxShadow: '0 24px 55px rgba(2,6,23,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', borderRadius: '999px', padding: '10px 16px', flex: '1 1 260px', minWidth: '220px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', border: `2px solid ${accentColor}` }} />
              </span>
              <input
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por pedido, cliente ou canal"
                style={{ border: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: '13.5px', color: '#334155' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filterDefs.map(f => {
                const on = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setPage(1);
                    }}
                    style={{
                      border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                      background: on ? accentSoft : '#ffffff',
                      color: on ? accentHover : '#475569',
                      borderRadius: '999px',
                      padding: '9px 16px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {f}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '999px',
                        padding: '1px 7px',
                        background: on ? '#ffffff' : '#f1f5f9',
                        color: on ? accentHover : '#94a3b8'
                      }}
                    >
                      {filterCounts[f] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1 }} />
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              {filteredOrders.length} pedidos
            </div>
          </div>

          {/* TABLE */}
          <div style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Pedido</th>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Canal</th>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Data</th>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map(r => (
                    <tr
                      key={r.code}
                      onClick={() => openOrderDetail(r)}
                      style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '15px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                          <span
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '999px',
                              background: accentSoft,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: 'none',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              color: accentHover
                            }}
                          >
                            {initials(r.client)}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>{r.code}</span>
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{r.client}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '15px 20px', color: '#475569', whiteSpace: 'nowrap' }}>{r.channel}</td>
                      <td style={{ padding: '15px 20px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.when}</td>
                      <td style={{ padding: '15px 20px' }}>
                        <StatusBadge status={r.status} accentSoft={accentSoft} accentHover={accentHover} />
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1e293b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {brl(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredOrders.length === 0 && (
              <div style={{ padding: '48px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: '12px', height: '12px', background: accentColor, borderRadius: '2px', transform: 'rotate(45deg)' }} />
                </span>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                  Nada encontrado
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Ajuste a busca ou limpe os filtros aplicados.
                </div>
              </div>
            )}

            <div style={{ padding: '16px 24px', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
              <span>
                {filteredOrders.length === 0
                  ? 'Nenhum resultado'
                  : `Mostrando ${(validPage - 1) * perPage + 1}–${Math.min(validPage * perPage, filteredOrders.length)} de ${filteredOrders.length}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={validPage <= 1}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: validPage > 1 ? '#475569' : '#cbd5e1',
                    cursor: validPage > 1 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={{
                      border: n === validPage ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                      background: n === validPage ? accentColor : '#ffffff',
                      color: n === validPage ? '#ffffff' : '#475569',
                      borderRadius: '999px',
                      minWidth: '36px',
                      height: '36px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={validPage >= totalPages}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: validPage < totalPages ? '#475569' : '#cbd5e1',
                    cursor: validPage < totalPages ? 'pointer' : 'not-allowed'
                  }}
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL VIEW */}
      {view === 'detail' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* ITEMS & FINANCIALS */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '26px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ width: '48px', height: '48px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 600, color: accentHover }}>
                  {initials(currentDetailOrder.client)}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{currentDetailOrder.client}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {currentDetailOrder.channel === 'PDV' ? 'Venda no salão' : 'Cliente cadastrado'}
                  </span>
                </div>
              </div>
              <StatusBadge status={currentDetailOrder.status} accentSoft={accentSoft} accentHover={accentHover} />
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: accentColor, fontWeight: 600 }}>
                {isPickup ? 'Retirada na loja' : 'Endereço de entrega'}
              </span>
              <span style={{ fontSize: '13px', color: '#334155' }}>
                {isPickup ? 'Consumo no local · Balcão / Salão' : 'Rua das Palmeiras, 482 · Pinheiros, São Paulo · 05422-000'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 600 }}>
                Itens do pedido ({detailItems.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {detailItems.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: accentHover }}>
                        {it.qty}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13.5px', color: '#334155', fontWeight: 500 }}>{it.name}</span>
                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{it.sku}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                      {it.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                <span>Subtotal</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                <span>{isPickup ? 'Taxa de serviço / balcão' : 'Frete'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{isPickup ? 'R$ 0,00' : brl(shipping)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#15803d' }}>
                <span>Desconto</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>− {brl(discount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                <span style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.14em', color: accentColor, fontWeight: 600 }}>Total</span>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '28px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                  {brl(currentDetailOrder.total)}
                </span>
              </div>
            </div>
          </div>

          {/* TIMELINE & METADATA */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '26px', position: 'sticky', top: '104px' }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Linha do tempo
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {timelineSteps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '14px', position: 'relative', minHeight: '60px' }}>
                  {idx < timelineSteps.length - 1 && (
                    <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: '-4px', width: '2px', background: '#f1f5f9' }} />
                  )}
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '999px',
                      background: step.done ? (step.label.includes('cancelado') ? '#fef2f2' : '#f0fdf4') : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      flex: 'none'
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: step.done ? (step.label.includes('cancelado') ? '#b91c1c' : '#15803d') : '#cbd5e1'
                      }}
                    />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: step.done ? '#1e293b' : '#94a3b8' }}>
                      {step.label}
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{step.at}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Canal</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155', marginTop: '2px' }}>{currentDetailOrder.channel}</div>
              </div>
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Data e hora</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155', marginTop: '2px' }}>{currentDetailOrder.when}</div>
              </div>
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Pagamento</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155', marginTop: '2px' }}>
                  {currentDetailOrder.status === 'Pendente' ? 'Aguardando Pix' : 'Cartão de crédito'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Tipo</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155', marginTop: '2px' }}>
                  {currentDetailOrder.deliveryType || (isPickup ? 'Retirar na loja' : 'Entrega')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
