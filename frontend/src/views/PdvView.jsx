import React, { useState } from 'react';
import StatusBadge, { getStatusStyle } from '../components/StatusBadge';

export default function PdvView({
  accentColor = '#2563eb'
}) {
  const [selectedTable, setSelectedTable] = useState(7);
  const [tables, setTables] = useState([
    { num: '01', zone: 'Salão principal', status: 'Livre', seats: 2 },
    { num: '02', zone: 'Salão principal', status: 'Ocupada', seats: 4, since: '18 min', value: 'R$ 184,00' },
    { num: '03', zone: 'Salão principal', status: 'Livre', seats: 4 },
    { num: '04', zone: 'Salão principal', status: 'Reservada', seats: 6, at: '20:30' },
    { num: '05', zone: 'Salão principal', status: 'Ocupada', seats: 2, since: '42 min', value: 'R$ 96,50' },
    { num: '06', zone: 'Salão principal', status: 'Conta pedida', seats: 4, since: '1h 12', value: 'R$ 412,00' },
    { num: '07', zone: 'Salão principal', status: 'Ocupada', seats: 4, since: '27 min', value: 'R$ 312,90' },
    { num: '08', zone: 'Salão principal', status: 'Livre', seats: 2 },
    { num: '09', zone: 'Varanda', status: 'Ocupada', seats: 6, since: '8 min', value: 'R$ 78,00' },
    { num: '10', zone: 'Varanda', status: 'Livre', seats: 4 },
    { num: '11', zone: 'Varanda', status: 'Reservada', seats: 8, at: '21:00' },
    { num: '12', zone: 'Varanda', status: 'Livre', seats: 4 },
    { num: '13', zone: 'Varanda', status: 'Ocupada', seats: 2, since: '35 min', value: 'R$ 143,20' },
    { num: '14', zone: 'Varanda', status: 'Livre', seats: 6 }
  ]);

  const [comandas, setComandas] = useState({
    7: {
      table: '07',
      people: '4 pessoas',
      elapsed: '27 min',
      waiter: 'Atend. Bruno',
      status: 'Em preparo',
      items: [
        { qty: 2, name: 'Risoto de cogumelos', note: '1 sem parmesão', price: 'R$ 118,00' },
        { qty: 1, name: 'Salada de burrata', note: 'entrada', price: 'R$ 52,00' },
        { qty: 4, name: 'Água com gás 500ml', note: '', price: 'R$ 36,00' },
        { qty: 1, name: 'Vinho Malbec (taça)', note: 'adicionado 19:42', price: 'R$ 48,00' },
        { qty: 2, name: 'Petit gâteau', note: 'sobremesa · aguardando', price: 'R$ 58,90' }
      ],
      subtotal: 'R$ 312,90',
      service: 'R$ 31,29',
      total: 'R$ 344,19'
    },
    2: {
      table: '02',
      people: '4 pessoas',
      elapsed: '18 min',
      waiter: 'Atend. Larissa',
      status: 'Em preparo',
      items: [
        { qty: 2, name: 'Pizza margherita', note: 'massa fina', price: 'R$ 124,00' },
        { qty: 3, name: 'Chope pilsen 500ml', note: '', price: 'R$ 60,00' }
      ],
      subtotal: 'R$ 184,00',
      service: 'R$ 18,40',
      total: 'R$ 202,40'
    },
    5: {
      table: '05',
      people: '2 pessoas',
      elapsed: '42 min',
      waiter: 'Atend. Bruno',
      status: 'Em preparo',
      items: [
        { qty: 1, name: 'Fettuccine ao pesto', note: '', price: 'R$ 62,50' },
        { qty: 2, name: 'Suco de laranja', note: 'sem açúcar', price: 'R$ 34,00' }
      ],
      subtotal: 'R$ 96,50',
      service: 'R$ 9,65',
      total: 'R$ 106,15'
    },
    6: {
      table: '06',
      people: '4 pessoas',
      elapsed: '1h 12',
      waiter: 'Atend. Larissa',
      status: 'Conta pedida',
      items: [
        { qty: 2, name: 'Picanha na chapa', note: 'ao ponto', price: 'R$ 268,00' },
        { qty: 4, name: 'Caipirinha', note: '', price: 'R$ 144,00' }
      ],
      subtotal: 'R$ 412,00',
      service: 'R$ 41,20',
      total: 'R$ 453,20'
    },
    9: {
      table: '09',
      people: '6 pessoas',
      elapsed: '8 min',
      waiter: 'Atend. Kaio',
      status: 'Pendente',
      items: [
        { qty: 3, name: 'Couvert de pães', note: '', price: 'R$ 36,00' },
        { qty: 3, name: 'Água sem gás', note: '', price: 'R$ 42,00' }
      ],
      subtotal: 'R$ 78,00',
      service: 'R$ 7,80',
      total: 'R$ 85,80'
    },
    13: {
      table: '13',
      people: '2 pessoas',
      elapsed: '35 min',
      waiter: 'Atend. Kaio',
      status: 'Em preparo',
      items: [
        { qty: 1, name: 'Moqueca individual', note: 'sem pimenta', price: 'R$ 98,00' },
        { qty: 1, name: 'Arroz de coco', note: '', price: 'R$ 24,00' },
        { qty: 2, name: 'Limonada suíça', note: '', price: 'R$ 21,20' }
      ],
      subtotal: 'R$ 143,20',
      service: 'R$ 14,32',
      total: 'R$ 157,52'
    }
  });

  const [modalAction, setModalAction] = useState(null); // 'addItem', 'closeAccount', 'openTable'
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const tableLegend = ['Livre', 'Ocupada', 'Reservada', 'Conta pedida'];

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

  const currentOrder = comandas[selectedTable] || emptyOrder;

  // ESC key handler for modals
  React.useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape' && modalAction && !isBusy) {
        setModalAction(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalAction, isBusy]);

  const handleAddItemSubmit = e => {
    e.preventDefault();
    if (!newItemName || isBusy) return;
    setIsBusy(true);

    setTimeout(() => {
      const priceVal = parseFloat(newItemPrice.replace(',', '.')) || 35.0;
      const priceFormatted = `R$ ${priceVal.toFixed(2).replace('.', ',')}`;

      setComandas(prev => {
        const existing = prev[selectedTable] || {
          table: String(selectedTable).padStart(2, '0'),
          people: '2 pessoas',
          elapsed: 'Agora',
          waiter: 'Atend. Salão',
          status: 'Em preparo',
          items: [],
          subtotal: 'R$ 0,00',
          service: 'R$ 0,00',
          total: 'R$ 0,00'
        };

        const updatedItems = [...existing.items, { qty: 1, name: newItemName, note: 'novo', price: priceFormatted }];
        return {
          ...prev,
          [selectedTable]: {
            ...existing,
            status: 'Em preparo',
            items: updatedItems,
            subtotal: 'R$ 347,90',
            service: 'R$ 34,79',
            total: 'R$ 382,69'
          }
        };
      });

      setTables(prev =>
        prev.map(t =>
          Number(t.num) === selectedTable
            ? { ...t, status: 'Ocupada', value: 'R$ 382,69', since: 'Agora' }
            : t
        )
      );

      setNewItemName('');
      setNewItemPrice('');
      setIsBusy(false);
      setModalAction(null);
    }, 400);
  };

  const handleCloseAccount = () => {
    if (isBusy) return;
    setIsBusy(true);

    setTimeout(() => {
      setTables(prev =>
        prev.map(t =>
          Number(t.num) === selectedTable
            ? { ...t, status: 'Livre', value: undefined, since: undefined }
            : t
        )
      );

      setComandas(prev => {
        const next = { ...prev };
        delete next[selectedTable];
        return next;
      });

      setIsBusy(false);
      setModalAction(null);
    }, 500);
  };

  const zoneNames = ['Salão principal', 'Varanda'];

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
            onClick={() => setModalAction('openTable')}
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
          {zoneNames.map(zName => {
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
                        onClick={() => setSelectedTable(Number(t.num))}
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

          <div style={{ padding: '18px 26px 26px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => setModalAction('addItem')}
              style={{
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: accentColor,
                borderRadius: '999px',
                padding: '14px',
                fontSize: '13.5px',
                fontWeight: 500,
                minHeight: '50px',
                cursor: 'pointer'
              }}
            >
              Adicionar item
            </button>
            <button
              onClick={() => setModalAction('closeAccount')}
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
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>Nome do produto / prato</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="ex: Filé Mignon ao Molho Madeira"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    color: '#1e293b'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>Preço unitário (R$)</label>
                <input
                  type="text"
                  value={newItemPrice}
                  onChange={e => setNewItemPrice(e.target.value)}
                  placeholder="ex: 68,00"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    fontSize: '13.5px',
                    color: '#1e293b'
                  }}
                />
              </div>

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
                Total a receber: <strong>{currentOrder.total}</strong> ({currentOrder.items.length} itens consumidos). A mesa voltará ao estado Livre.
              </p>
            </div>

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
