import React, { useState } from 'react';
import StatusBadge from '../components/StatusBadge';

export default function DashboardMockView({
  accentColor = '#2563eb',
  onGoImport,
  onGoOrders,
  showDeltas = true
}) {
  const [orderPage, setOrderPage] = useState(1);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const shapes = {
    round: { iconRadius: '999px', iconRotate: 'none' },
    square: { iconRadius: '2px', iconRotate: 'none' },
    diamond: { iconRadius: '2px', iconRotate: 'rotate(45deg)' }
  };

  const metrics = [
    { label: 'Faturamento', value: 'R$ 48.320', delta: '+12,4%', up: true, hint: 'vs. mesmo dia da semana passada', shape: 'diamond' },
    { label: 'Pedidos', value: '128', delta: '+8', up: true, hint: '34 ainda em preparo', shape: 'square' },
    { label: 'Ticket médio', value: 'R$ 377,50', delta: '−2,1%', up: false, hint: 'queda puxada pelo delivery', shape: 'round' }
  ];

  const orders = [
    { code: '#10428', client: 'Marina Duarte', channel: 'E-commerce', status: 'Confirmado', total: 'R$ 1.240,00' },
    { code: '#10427', client: 'Mesa 07', channel: 'PDV', status: 'Em preparo', total: 'R$ 312,90' },
    { code: '#10426', client: 'Rodrigo Salles', channel: 'E-commerce', status: 'Pendente', total: 'R$ 89,00' },
    { code: '#10425', client: 'Padaria Aurora', channel: 'Importação CSV', status: 'Pago', total: 'R$ 4.180,00' },
    { code: '#10424', client: 'Mesa 12', channel: 'PDV', status: 'Cancelado', total: 'R$ 156,40' }
  ];

  const statusSamples = ['Confirmado', 'Processando', 'Pendente', 'Cancelado', 'Rascunho'];

  return (
    <>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
            Resumo do dia
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
            Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            Panorama operacional das últimas 24 horas. Números provisórios até o ReportService entrar no ar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: accentColor,
              borderRadius: '999px',
              padding: '11px 20px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Exportar
          </button>
          <button
            onClick={onGoImport}
            style={{
              border: 0,
              background: accentColor,
              color: '#ffffff',
              borderRadius: '999px',
              padding: '11px 22px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: `0 14px 28px ${accentGlow}`,
              cursor: 'pointer'
            }}
          >
            Nova importação
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: '22px' }}>
        {metrics.map((m, idx) => {
          const shape = shapes[m.shape];
          return (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '26px',
                boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <span
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '999px',
                    background: accentSoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none'
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      background: accentColor,
                      borderRadius: shape.iconRadius,
                      transform: shape.iconRotate
                    }}
                  />
                </span>
                {showDeltas && (
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: m.up ? '#15803d' : '#b45309',
                      background: m.up ? '#f0fdf4' : '#fffbeb',
                      borderRadius: '999px',
                      padding: '4px 11px'
                    }}
                  >
                    {m.delta}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '36px', letterSpacing: '-0.025em', color: '#1e293b' }}>
                  {m.value}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  {m.hint}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RECENT ORDERS TABLE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
          Atividade recente
        </div>
        <div style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '26px 30px 20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#334155' }}>
              Últimos pedidos
            </h2>
            <button
              onClick={onGoOrders}
              style={{
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: accentColor,
                borderRadius: '999px',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Ver todos
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '11px 30px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc' }}>Pedido</th>
                  <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc' }}>Cliente</th>
                  <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc' }}>Canal</th>
                  <th style={{ textAlign: 'left', padding: '11px 16px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '11px 30px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.code} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 30px', fontVariantNumeric: 'tabular-nums', color: '#334155', fontWeight: 500 }}>{o.code}</td>
                    <td style={{ padding: '16px', color: '#475569' }}>{o.client}</td>
                    <td style={{ padding: '16px', color: '#94a3b8' }}>{o.channel}</td>
                    <td style={{ padding: '16px' }}>
                      <StatusBadge status={o.status} accentSoft={accentSoft} accentHover={accentHover} />
                    </td>
                    <td style={{ padding: '16px 30px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1e293b', fontWeight: 500 }}>{o.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '16px 30px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
            <span>Mostrando 5 de 128 pedidos</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  borderRadius: '999px',
                  padding: '7px 15px',
                  fontSize: '12px',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Anterior
              </button>
              <button
                onClick={() => setOrderPage(p => p + 1)}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  borderRadius: '999px',
                  padding: '7px 15px',
                  fontSize: '12px',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* STATUS COMPONENT SHOWCASE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
          Status · componente reutilizável
        </div>
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px 30px',
            boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          {statusSamples.map(s => (
            <StatusBadge key={s} status={s} accentSoft={accentSoft} accentHover={accentHover} />
          ))}
          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>
            mesmos estados serão usados na fila de Importação (Fase 2)
          </span>
        </div>
      </div>
    </>
  );
}
