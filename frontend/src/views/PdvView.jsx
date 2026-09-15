import React, { useState, useEffect } from 'react';
import StatusBadge, { getStatusStyle } from '../components/StatusBadge';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

// Planta do salão: o backend só conhece uma mesa quando ela é aberta (uma
// comanda), não existe cadastro de mesa física. Esta planta fixa (número,
// zona, lugares) é local ao frontend e serve só de referência visual; o
// status real (Livre/Ocupada) e os dados de consumo vêm da API por cima dela.
const FLOOR_PLAN = [
  { num: '01', zone: 'Salão principal', seats: 2 },
  { num: '02', zone: 'Salão principal', seats: 4 },
  { num: '03', zone: 'Salão principal', seats: 4 },
  { num: '04', zone: 'Salão principal', seats: 6 },
  { num: '05', zone: 'Salão principal', seats: 2 },
  { num: '06', zone: 'Salão principal', seats: 4 },
  { num: '07', zone: 'Salão principal', seats: 4 },
  { num: '08', zone: 'Salão principal', seats: 2 },
  { num: '09', zone: 'Varanda', seats: 6 },
  { num: '10', zone: 'Varanda', seats: 4 },
  { num: '11', zone: 'Varanda', seats: 8 },
  { num: '12', zone: 'Varanda', seats: 4 },
  { num: '13', zone: 'Varanda', seats: 2 },
  { num: '14', zone: 'Varanda', seats: 6 }
];

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

const brl = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatElapsed(openedAt) {
  if (!openedAt) return 'Agora';
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(openedAt).getTime()) / 60000));
  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return `${hours}h ${minutes}`;
}

export default function PdvView({
  accentColor = '#2563eb',
  userName = ''
}) {
  const [selectedTable, setSelectedTable] = useState(1);

  const [openTables, setOpenTables] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [modalAction, setModalAction] = useState(null); // 'addItem', 'closeAccount', 'openTable'
  const [openTableForm, setOpenTableForm] = useState({ tableNumber: '', customerName: '' });
  const [addItemForm, setAddItemForm] = useState({ productId: '', quantity: 1 });
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [closeSnapshot, setCloseSnapshot] = useState({ total: 'R$ 0,00', itemCount: 0 });

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const tableLegend = ['Livre', 'Ocupada', 'Reservada', 'Conta pedida'];
  const zoneNames = ['Salão principal', 'Varanda'];

  // Listagem das mesas abertas — cancela a requisição anterior ainda em voo
  // (StrictMode remontando o efeito, ou uma ação disparando um novo refreshTick).
  useEffect(() => {
    const controller = new AbortController();
    setLoadingList(true);
    setListError(null);

    apiRequest('/api/v1/pdv/tables', { signal: controller.signal })
      .then(data => setOpenTables(data || []))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setListError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingList(false);
      });

    return () => controller.abort();
  }, [refreshTick]);

  // Catálogo de produtos para o seletor de item — só carrega quando o modal abre.
  useEffect(() => {
    if (modalAction !== 'addItem') return;
    const controller = new AbortController();
    setLoadingProducts(true);

    apiRequest('/api/v1/products?status=ACTIVE&size=100', { signal: controller.signal })
      .then(data => setProducts((data?.page?.content) || []))
      .catch(err => {
        if (err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProducts(false);
      });

    return () => controller.abort();
  }, [modalAction]);

  // ESC key handler for modals
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape' && modalAction && !isBusy) {
        setModalAction(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalAction, isBusy]);

  const selectedOpenTable = openTables.find(t => t.number === selectedTable) || null;

  const tables = FLOOR_PLAN.map(entry => {
    const numInt = parseInt(entry.num, 10);
    const open = openTables.find(t => t.number === numInt);
    if (!open) {
      return { ...entry, status: 'Livre' };
    }
    return {
      ...entry,
      status: 'Ocupada',
      value: brl(open.total),
      since: formatElapsed(open.openedAt)
    };
  });

  const emptyOrder = {
    table: String(selectedTable).padStart(2, '0'),
    people: 'Mesa livre',
    elapsed: 'sem consumo',
    waiter: 'sem atendente',
    status: 'Livre',
    items: [],
    subtotal: 'R$ 0,00',
    service: 'R$ 0,00',
    total: 'R$ 0,00'
  };

  const currentOrder = selectedOpenTable
    ? {
        table: String(selectedOpenTable.number).padStart(2, '0'),
        people: selectedOpenTable.customerName,
        elapsed: formatElapsed(selectedOpenTable.openedAt),
        waiter: userName ? `Atend. ${userName}` : 'Atend. PDV',
        status: 'Ocupada',
        items: (selectedOpenTable.items || []).map(i => ({
          qty: i.quantity,
          name: i.productName,
          note: '',
          price: brl(i.subtotal)
        })),
        subtotal: brl(selectedOpenTable.total),
        service: brl(0),
        total: brl(selectedOpenTable.total)
      }
    : emptyOrder;

  const handleOpenTableSubmit = e => {
    e.preventDefault();
    if (isBusy || !openTableForm.tableNumber || !openTableForm.customerName) return;
    setIsBusy(true);
    setActionError(null);

    apiRequest('/api/v1/pdv/tables', {
      method: 'POST',
      body: JSON.stringify({
        tableNumber: openTableForm.tableNumber,
        customerName: openTableForm.customerName
      })
    })
      .then(data => {
        setOpenTables(prev => [...prev, data]);
        setSelectedTable(data.number);
        setOpenTableForm({ tableNumber: '', customerName: '' });
        setModalAction(null);
      })
      .catch(err => setActionError(err.message))
      .finally(() => setIsBusy(false));
  };

  const handleAddItemSubmit = e => {
    e.preventDefault();
    if (isBusy || !addItemForm.productId || !selectedOpenTable) return;
    setIsBusy(true);
    setActionError(null);

    apiRequest(`/api/v1/pdv/tables/${selectedOpenTable.id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        productId: addItemForm.productId,
        quantity: Number(addItemForm.quantity) || 1
      })
    })
      .then(data => {
        setOpenTables(prev => prev.map(t => (t.id === data.id ? data : t)));
        setAddItemForm({ productId: '', quantity: 1 });
        setModalAction(null);
      })
      .catch(err => setActionError(err.message))
      .finally(() => setIsBusy(false));
  };

  const handleCloseAccount = () => {
    if (isBusy || !selectedOpenTable) return;
    setIsBusy(true);
    setActionError(null);

    apiRequest(`/api/v1/pdv/tables/${selectedOpenTable.id}/close`, { method: 'POST' })
      .then(data => {
        setOpenTables(prev => prev.filter(t => t.id !== data.id));
        setModalAction(null);
      })
      .catch(err => {
        if (err.message && err.message.includes('outro terminal')) {
          setActionError('Esta mesa já foi fechada em outro terminal — atualize a tela.');
          setRefreshTick(t => t + 1);
        } else {
          setActionError(err.message);
        }
      })
      .finally(() => setIsBusy(false));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
            Salão · turno da noite
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
            Mapa de mesas
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            Toque numa mesa para abrir a comanda. O estado de cada mesa atualiza ao vivo com o mesmo padrão de badge da fila de importação.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: accentColor,
              borderRadius: '999px',
              padding: '13px 22px',
              fontSize: '13.5px',
              fontWeight: 500,
              minHeight: '48px',
              cursor: 'pointer'
            }}
          >
            Reservas
          </button>
          <button
            onClick={() => {
              setActionError(null);
              setOpenTableForm({ tableNumber: !selectedOpenTable ? String(selectedTable).padStart(2, '0') : '', customerName: '' });
              setModalAction('openTable');
            }}
            style={{
              border: 0,
              background: accentColor,
              color: '#ffffff',
              borderRadius: '999px',
              padding: '13px 24px',
              fontSize: '13.5px',
              fontWeight: 500,
              minHeight: '48px',
              boxShadow: `0 14px 28px ${accentGlow}`,
              cursor: 'pointer'
            }}
          >
            Abrir mesa
          </button>
        </div>
      </div>

      {/* LEGEND */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        {tableLegend.map(l => (
          <StatusBadge key={l} status={l} accentSoft={accentSoft} accentHover={accentHover} />
        ))}
      </div>

      {/* GRID CONTAINER: TABLES + COMANDA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* TABLES CARD */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            minWidth: 0
          }}
        >
          {listError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: '24px 0' }}>
              <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '12px', height: '12px', background: '#b91c1c', borderRadius: '2px', transform: 'rotate(45deg)' }} />
              </span>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                Não foi possível carregar o mapa de mesas
              </div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{listError}</div>
              <button
                onClick={() => setRefreshTick(t => t + 1)}
                style={{
                  border: '1px solid #bfdbfe',
                  background: '#ffffff',
                  color: accentColor,
                  borderRadius: '999px',
                  padding: '13px 22px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  minHeight: '48px',
                  cursor: 'pointer'
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!listError && loadingList && openTables.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: '24px 0' }}>
              <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '12px', height: '12px', background: accentColor, borderRadius: '2px', transform: 'rotate(45deg)' }} />
              </span>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                Carregando mapa de mesas…
              </div>
            </div>
          )}

          {!listError && !(loadingList && openTables.length === 0) && zoneNames.map(zName => {
            const list = tables.filter(t => t.zone === zName);
            const busy = list.filter(t => t.status !== 'Livre').length;

            return (
              <div key={zName} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                    {zName}
                  </div>
                  <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    {busy} de {list.length} ocupadas
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 112px), 1fr))', gap: '14px' }}>
                  {list.map(t => {
                    const isSelected = Number(t.num) === selectedTable;
                    const stStyle = getStatusStyle(t.status, accentSoft, accentHover);
                    const meta =
                      t.status === 'Livre'
                        ? `${t.seats} lugares`
                        : t.status === 'Reservada'
                        ? `Reserva ${t.at}`
                        : `${t.value} · ${t.since}`;

                    return (
                      <button
                        key={t.num}
                        onClick={() => {
                          setActionError(null);
                          setSelectedTable(Number(t.num));
                        }}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '14px',
                          minHeight: '116px',
                          border: isSelected ? `2px solid ${accentColor}` : '2px solid transparent',
                          background: t.status === 'Livre' ? '#ffffff' : stStyle.bg,
                          borderRadius: '20px',
                          padding: '15px',
                          textAlign: 'left',
                          boxShadow: isSelected ? `0 18px 34px ${accentGlow}` : '0 10px 26px rgba(2,6,23,0.05)',
                          cursor: 'pointer',
                          transition: 'transform 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                          <span
                            style={{
                              fontFamily: "'Fraunces', Georgia, serif",
                              fontWeight: 700,
                              fontSize: '22px',
                              letterSpacing: '-0.02em',
                              color: t.status === 'Livre' ? '#334155' : stStyle.fg
                            }}
                          >
                            {t.num}
                          </span>
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '999px',
                              background: t.status === 'Livre' ? '#f1f5f9' : 'rgba(255,255,255,0.65)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: 'none'
                            }}
                          >
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: stStyle.fg
                              }}
                            />
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', color: stStyle.fg }}>
                            {t.status}
                          </span>
                          <span style={{ fontSize: '11.5px', color: t.status === 'Livre' ? '#94a3b8' : stStyle.fg }}>
                            {meta}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* COMANDA DRAWER / CARD */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
            overflow: 'hidden',
            position: 'sticky',
            top: '104px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0
          }}
        >
          <div style={{ padding: '24px 26px 18px 26px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                  Comanda aberta
                </div>
                <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '26px', letterSpacing: '-0.02em', color: '#334155' }}>
                  Mesa {currentOrder.table}
                </h2>
              </div>
              <StatusBadge status={currentOrder.status} accentSoft={accentSoft} accentHover={accentHover} />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
              <span>{currentOrder.people}</span>
              <span>·</span>
              <span>{currentOrder.elapsed}</span>
              <span>·</span>
              <span>{currentOrder.waiter}</span>
            </div>
          </div>

          <div style={{ padding: '4px 26px 8px 26px', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '340px', overflowY: 'auto' }}>
            {currentOrder.items.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Nenhum item lançado nesta comanda.
              </div>
            ) : (
              currentOrder.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '13px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '999px',
                        background: accentSoft,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: accentHover
                      }}
                    >
                      {i.qty}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>{i.name}</span>
                      {i.note && <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{i.note}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: '#1e293b', fontWeight: 500, flex: 'none' }}>
                    {i.price}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{ margin: '8px 26px 0 26px', borderTop: '1px solid #f1f5f9', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
              <span>Subtotal</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currentOrder.subtotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
              <span>Serviço 10%</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currentOrder.service}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
              <span style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '28px', letterSpacing: '-0.02em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {currentOrder.total}
              </span>
            </div>
          </div>

          {actionError && !modalAction && (
            <div style={{ margin: '16px 26px 0 26px', background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
              {actionError}
            </div>
          )}

          <div style={{ padding: '18px 26px 26px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => {
                setActionError(null);
                setAddItemForm({ productId: '', quantity: 1 });
                setModalAction('addItem');
              }}
              disabled={!selectedOpenTable}
              style={{
                border: !selectedOpenTable ? '1px solid #e2e8f0' : '1px solid #bfdbfe',
                background: '#ffffff',
                color: !selectedOpenTable ? '#94a3b8' : accentColor,
                borderRadius: '999px',
                padding: '14px',
                fontSize: '13.5px',
                fontWeight: 500,
                minHeight: '50px',
                cursor: !selectedOpenTable ? 'not-allowed' : 'pointer'
              }}
            >
              Adicionar item
            </button>
            <button
              onClick={() => {
                setActionError(null);
                setCloseSnapshot({ total: currentOrder.total, itemCount: currentOrder.items.length });
                setModalAction('closeAccount');
              }}
              disabled={currentOrder.items.length === 0}
              style={{
                border: 0,
                background: currentOrder.items.length === 0 ? '#e2e8f0' : accentColor,
                color: currentOrder.items.length === 0 ? '#94a3b8' : '#ffffff',
                borderRadius: '999px',
                padding: '14px',
                fontSize: '13.5px',
                fontWeight: 500,
                minHeight: '50px',
                boxShadow: currentOrder.items.length === 0 ? 'none' : `0 14px 28px ${accentGlow}`,
                cursor: currentOrder.items.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Fechar conta
            </button>
            <button
              style={{
                gridColumn: 'span 2',
                border: 0,
                background: '#f8fafc',
                color: '#64748b',
                borderRadius: '999px',
                padding: '13px',
                fontSize: '13px',
                fontWeight: 500,
                minHeight: '46px',
                cursor: 'pointer'
              }}
            >
              Transferir mesa
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: ABRIR MESA (Backdrop click & ESC to close, except when busy) */}
      {modalAction === 'openTable' && (
        <div
          onClick={() => {
            if (!isBusy) setModalAction(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#ffffff',
              borderRadius: '26px',
              padding: '32px',
              boxShadow: '0 40px 90px rgba(2,6,23,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Nova comanda
              </div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '23px', letterSpacing: '-0.02em', color: '#1e293b' }}>
                Abrir mesa
              </h2>
            </div>

            <form onSubmit={handleOpenTableSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>Número da mesa</label>
                <select
                  required
                  value={openTableForm.tableNumber}
                  onChange={e => setOpenTableForm(f => ({ ...f, tableNumber: e.target.value }))}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    color: '#1e293b',
                    background: '#ffffff'
                  }}
                >
                  <option value="">Selecione uma mesa livre</option>
                  {tables.filter(t => t.status === 'Livre').map(t => (
                    <option key={t.num} value={t.num}>
                      Mesa {t.num} — {t.zone} ({t.seats} lugares)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>Nome do cliente</label>
                <input
                  type="text"
                  required
                  value={openTableForm.customerName}
                  onChange={e => setOpenTableForm(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="ex: João"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    color: '#1e293b',
                    background: '#ffffff'
                  }}
                />
              </div>

              {actionError && (
                <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                  {actionError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    border: 0,
                    background: isBusy ? '#94a3b8' : accentColor,
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '13px 24px',
                    fontSize: '13px',
                    fontWeight: 500,
                    boxShadow: isBusy ? 'none' : `0 14px 28px ${accentGlow}`,
                    cursor: isBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isBusy ? 'Abrindo...' : 'Abrir mesa'}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setModalAction(null)}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#475569',
                    borderRadius: '999px',
                    padding: '13px 20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: isBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR ITEM (Backdrop click & ESC to close, except when busy) */}
      {modalAction === 'addItem' && (
        <div
          onClick={() => {
            if (!isBusy) setModalAction(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#ffffff',
              borderRadius: '26px',
              padding: '32px',
              boxShadow: '0 40px 90px rgba(2,6,23,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Mesa {currentOrder.table}
              </div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '23px', letterSpacing: '-0.02em', color: '#1e293b' }}>
                Lançar item na comanda
              </h2>
            </div>

            <form onSubmit={handleAddItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>Produto</label>
                <select
                  required
                  value={addItemForm.productId}
                  onChange={e => setAddItemForm(f => ({ ...f, productId: e.target.value }))}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    color: '#1e293b',
                    background: '#ffffff'
                  }}
                >
                  <option value="">{loadingProducts ? 'Carregando produtos...' : 'Selecione um produto'}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {brl(p.price)} (estoque: {p.stockQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>Quantidade</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addItemForm.quantity}
                  onChange={e => setAddItemForm(f => ({ ...f, quantity: e.target.value }))}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    color: '#1e293b',
                    background: '#ffffff'
                  }}
                />
              </div>

              {actionError && (
                <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                  {actionError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    border: 0,
                    background: isBusy ? '#94a3b8' : accentColor,
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '13px 24px',
                    fontSize: '13px',
                    fontWeight: 500,
                    boxShadow: isBusy ? 'none' : `0 14px 28px ${accentGlow}`,
                    cursor: isBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isBusy ? 'Lançando...' : 'Confirmar item'}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setModalAction(null)}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#475569',
                    borderRadius: '999px',
                    padding: '13px 20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: isBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FECHAR CONTA (Backdrop click & ESC to close, except when busy) */}
      {modalAction === 'closeAccount' && (
        <div
          onClick={() => {
            if (!isBusy) setModalAction(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#ffffff',
              borderRadius: '26px',
              padding: '32px',
              boxShadow: '0 40px 90px rgba(2,6,23,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Encerramento de comanda
              </div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '23px', letterSpacing: '-0.02em', color: '#1e293b' }}>
                Fechar Mesa {currentOrder.table}?
              </h2>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b' }}>
                Total a receber: <strong>{closeSnapshot.total}</strong> ({closeSnapshot.itemCount} itens consumidos). A mesa voltará ao estado Livre.
              </p>
            </div>

            {actionError && (
              <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={handleCloseAccount}
                disabled={isBusy}
                style={{
                  flex: 1,
                  border: 0,
                  background: isBusy ? '#94a3b8' : accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '13px 24px',
                  fontSize: '13px',
                  fontWeight: 500,
                  boxShadow: isBusy ? 'none' : `0 14px 28px ${accentGlow}`,
                  cursor: isBusy ? 'not-allowed' : 'pointer'
                }}
              >
                {isBusy ? 'Processando...' : 'Confirmar pagamento'}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setModalAction(null)}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '999px',
                  padding: '13px 20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isBusy ? 'not-allowed' : 'pointer'
                }}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
