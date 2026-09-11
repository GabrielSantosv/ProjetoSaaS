import React, { useState } from 'react';

export default function DashboardRealView({
  accentColor = '#2563eb'
}) {
  const [range, setRange] = useState('7 dias');

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');

  const brl = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rangeData = {
    Hoje: {
      fat: 14580,
      ped: 128,
      ticket: 113.9,
      novos: 12,
      days: ['06h', '10h', '13h', '16h', '19h', '21h', '23h'],
      series: [420, 1180, 3240, 2110, 4180, 2860, 590]
    },
    '7 dias': {
      fat: 96420,
      ped: 812,
      ticket: 118.75,
      novos: 74,
      days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      series: [9800, 11200, 10450, 13900, 18600, 21400, 11070]
    },
    '30 dias': {
      fat: 402180,
      ped: 3364,
      ticket: 119.55,
      novos: 288,
      days: ['S1', 'S2', 'S3', 'S4', 'S5'],
      series: [82400, 91300, 88600, 97800, 42080]
    }
  };

  const rd = rangeData[range] || rangeData['7 dias'];
  const peak = Math.max(...rd.series);

  const chart = rd.series.map((v, i) => ({
    day: rd.days[i],
    h: Math.max(6, Math.round((v / peak) * 100)) + '%',
    bg: v === peak ? accentColor : accentSoft,
    labelFg: v === peak ? accentHover : '#94a3b8',
    labelWeight: v === peak ? '600' : '400'
  }));

  const metrics = [
    { label: 'Faturamento', value: brl(rd.fat), delta: '+12,4%', up: true, hint: 'vs. período anterior', shape: 'diamond' },
    { label: 'Pedidos', value: String(rd.ped), delta: '+8,1%', up: true, hint: '34 ainda em preparo', shape: 'square' },
    { label: 'Ticket médio', value: brl(rd.ticket), delta: '−2,1%', up: false, hint: 'queda puxada pelo delivery', shape: 'round' },
    { label: 'Novos clientes', value: String(rd.novos), delta: '+19%', up: true, hint: 'vindos da vitrine pública', shape: 'round' }
  ];

  const chShare = [
    { label: 'E-commerce', share: 0.46, color: accentColor },
    { label: 'PDV · salão', share: 0.38, color: '#15803d' },
    { label: 'Importação B2B', share: 0.16, color: '#b45309' }
  ];

  const channels = chShare.map(c => ({
    ...c,
    iconBg: `color-mix(in oklab, ${c.color} 12%, #ffffff)`,
    value: brl(rd.fat * c.share),
    pct: Math.round(c.share * 100) + '%'
  }));

  const st = {
    ok: { bg: '#f0fdf4', fg: '#15803d' },
    warn: { bg: '#fffbeb', fg: '#b45309' },
    bad: { bg: '#fef2f2', fg: '#b91c1c' },
    info: { bg: accentSoft, fg: accentHover }
  };

  const miniCards = [
    {
      title: 'Operação agora',
      lines: [
        { k: 'Mesas ocupadas', v: '6 de 14', ...st.info },
        { k: 'Pedidos em preparo', v: '34', ...st.warn },
        { k: 'Caixa aberto desde', v: '17:00', ...st.ok }
      ]
    },
    {
      title: 'Catálogo',
      lines: [
        { k: 'Produtos ativos', v: '14', ...st.ok },
        { k: 'Sem estoque', v: '3', ...st.warn },
        { k: 'Rascunhos', v: '2', ...st.info }
      ]
    },
    {
      title: 'Importação',
      lines: [
        { k: 'Arquivos hoje', v: '12', ...st.ok },
        { k: 'Linhas importadas', v: '38,4 mil', ...st.info },
        { k: 'Linhas com erro', v: '49', ...st.bad }
      ]
    }
  ];

  const ranges = ['Hoje', '7 dias', '30 dias'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* HEADER WITH PERIOD SELECTOR */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
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
            Panorama de vendas, canais e operação. Números provisórios até o ReportService entrar no ar.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#ffffff', borderRadius: '999px', padding: '5px', boxShadow: '0 12px 30px rgba(2,6,23,0.05)' }}>
          {ranges.map(r => {
            const on = range === r;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  border: 0,
                  background: on ? accentColor : 'transparent',
                  color: on ? '#ffffff' : '#64748b',
                  borderRadius: '999px',
                  padding: '9px 17px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* BACKEND REPORT NOTICE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: '#fffbeb', borderRadius: '18px', padding: '14px 18px' }}>
        <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b45309' }} />
        </span>
        <span style={{ fontSize: '12.5px', color: '#92400e', lineHeight: 1.55 }}>
          Dados mockados — o <strong>ReportService</strong> ainda não existe no backend. A estrutura já espera o contrato final.
        </span>
      </div>

      {/* 4 METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 248px), 1fr))', gap: '22px' }}>
        {metrics.map((m, idx) => (
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
              <span style={{ width: '44px', height: '44px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: '14px', height: '14px', background: accentColor, borderRadius: m.shape === 'round' ? '999px' : '2px', transform: m.shape === 'diamond' ? 'rotate(45deg)' : 'none' }} />
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: m.up ? '#15803d' : '#b45309', background: m.up ? '#f0fdf4' : '#fffbeb', borderRadius: '999px', padding: '4px 11px' }}>
                {m.delta}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.025em', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{m.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '22px', alignItems: 'start' }}>
        {/* BAR CHART */}
        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Faturamento por dia</div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '21px', letterSpacing: '-0.02em', color: '#334155' }}>
                {range === 'Hoje' ? 'Distribuição por hora' : `Últimos ${range}`}
              </h2>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>pico {brl(peak)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '168px' }}>
            {chart.map((c, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: '130px' }}>
                  <div style={{ width: '100%', height: c.h, background: c.bg, borderRadius: '10px 10px 4px 4px', transition: 'height 0.4s ease' }} />
                </div>
                <span style={{ fontSize: '11px', color: c.labelFg, fontWeight: c.labelWeight }}>{c.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* REVENUE BY CHANNEL */}
        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
          <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Receita por canal</div>
          {channels.map((ch, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: ch.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: ch.color }} />
                  </span>
                  <span style={{ fontSize: '13px', color: '#475569' }}>{ch.label}</span>
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{ch.value}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', width: ch.pct, background: ch.color, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>Total do período</span>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '24px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{brl(rd.fat)}</span>
          </div>
        </div>
      </div>

      {/* 3 MINI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '22px' }}>
        {miniCards.map((mc, idx) => (
          <div key={idx} style={{ background: '#ffffff', borderRadius: '24px', padding: '24px 26px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>{mc.title}</div>
            {mc.lines.map((l, lIdx) => (
              <div key={lIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: l.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.fg }} />
                  </span>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>{l.k}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{l.v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
