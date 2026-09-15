import React, { useState, useEffect } from 'react';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

// Mesma planta fixa de 14 mesas já usada no PdvView (Fase 8) — o backend só
// conhece uma mesa quando ela é aberta pela primeira vez, não existe cadastro
// de capacidade total. Reaproveita o mesmo total "de fachada" já aceito lá,
// em vez de inventar um segundo número diferente aqui.
const TOTAL_TABLES = 14;

const PERIOD_TO_BACKEND = { Hoje: 'TODAY', '7 dias': 'LAST_7_DAYS', '30 dias': 'LAST_30_DAYS' };
const PERIOD_DAYS = { Hoje: 1, '7 dias': 7, '30 dias': 30 };

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

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Eixo completo de dias do período, hoje incluso — o backend só devolve os
// dias que tiveram pagamento (GROUP BY), então os dias sem venda precisam ser
// preenchidos com zero aqui para o gráfico não ficar com buracos.
function buildDateAxis(days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const axis = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    axis.push(d);
  }
  return axis;
}

export default function DashboardRealView({
  accentColor = '#2563eb'
}) {
  const [range, setRange] = useState('7 dias');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');

  const brl = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Troca rápida de período cancela a chamada anterior ainda em voo, senão uma
  // resposta lenta e desatualizada pode sobrescrever a mais recente.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiRequest(`/api/v1/reports/dashboard?period=${PERIOD_TO_BACKEND[range]}`, { signal: controller.signal })
      .then(data => setReport(data))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [range, refreshTick]);

  const rd = report || {
    faturamento: 0,
    pedidos: 0,
    ticketMedio: 0,
    novosClientes: 0,
    receitaPorCanal: { ecommerce: 0, pdv: 0 },
    faturamentoPorDia: [],
    operacional: { produtosAtivos: 0, produtosSemEstoque: 0, produtosRascunho: 0, arquivosImportadosHoje: 0, linhasImportadasHoje: 0, linhasComErroHoje: 0, mesasOcupadas: 0 }
  };

  const dailyByDate = new Map((rd.faturamentoPorDia || []).map(d => [d.date, Number(d.total)]));
  const axis = buildDateAxis(PERIOD_DAYS[range]);
  const series = axis.map(d => dailyByDate.get(toISODate(d)) || 0);
  const peak = Math.max(1, ...series);

  const chart = axis.map((d, i) => {
    const v = series[i];
    const isPeak = v === peak && v > 0;
    const label = range === 'Hoje'
      ? 'Hoje'
      : range === '7 dias'
        ? d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return {
      day: label,
      h: Math.max(6, Math.round((v / peak) * 100)) + '%',
      bg: isPeak ? accentColor : accentSoft,
      labelFg: isPeak ? accentHover : '#94a3b8',
      labelWeight: isPeak ? '600' : '400'
    };
  });

  const metrics = [
    { label: 'Faturamento', value: brl(rd.faturamento), hint: `no período selecionado`, shape: 'diamond' },
    { label: 'Pedidos', value: String(rd.pedidos), hint: 'no período selecionado', shape: 'square' },
    { label: 'Ticket médio', value: brl(rd.ticketMedio), hint: 'faturamento dividido por pedidos', shape: 'round' },
    { label: 'Novos clientes', value: String(rd.novosClientes), hint: 'vindos da vitrine pública', shape: 'round' }
  ];

  // A fatia "Importação" fica fixa em zero de propósito: o canal de
  // importação nunca gerou receita (é upload de catálogo, não venda), então
  // não existe — e não deveria existir — uma chamada de backend para isso.
  const chShare = [
    { label: 'E-commerce', value: Number(rd.receitaPorCanal.ecommerce), color: accentColor },
    { label: 'PDV · salão', value: Number(rd.receitaPorCanal.pdv), color: '#15803d' },
    { label: 'Importação B2B', value: 0, color: '#b45309' }
  ];
  const channelTotal = chShare.reduce((a, c) => a + c.value, 0) || 1;

  const channels = chShare.map(c => ({
    ...c,
    iconBg: `color-mix(in oklab, ${c.color} 12%, #ffffff)`,
    valueLabel: brl(c.value),
    pct: Math.round((c.value / channelTotal) * 100) + '%'
  }));

  const st = {
    ok: { bg: '#f0fdf4', fg: '#15803d' },
    warn: { bg: '#fffbeb', fg: '#b45309' },
    bad: { bg: '#fef2f2', fg: '#b91c1c' },
    info: { bg: accentSoft, fg: accentHover }
  };

  const linhasImportadas = rd.operacional.linhasImportadasHoje >= 1000
    ? (rd.operacional.linhasImportadasHoje / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
    : String(rd.operacional.linhasImportadasHoje);

  const miniCards = [
    {
      title: 'Operação agora',
      lines: [
        { k: 'Mesas ocupadas', v: `${rd.operacional.mesasOcupadas} de ${TOTAL_TABLES}`, ...st.info },
        // Sem status "em preparo" no backend (OrderStatus só tem PENDING/CONFIRMED/CANCELLED/COMPLETED) — honesto em vez de inventado.
        { k: 'Pedidos em preparo', v: '—', ...st.warn },
        // "Caixa aberto desde" existe de verdade (Fase 9), mas o endpoint é ADMIN/CASHIER; SELLER tem acesso a este dashboard mas não ao caixa — não chamamos daqui para não gerar um 403 esperado.
        { k: 'Caixa aberto desde', v: '—', ...st.ok }
      ]
    },
    {
      title: 'Catálogo',
      lines: [
        { k: 'Produtos ativos', v: String(rd.operacional.produtosAtivos), ...st.ok },
        { k: 'Sem estoque', v: String(rd.operacional.produtosSemEstoque), ...st.warn },
        { k: 'Rascunhos', v: String(rd.operacional.produtosRascunho), ...st.info }
      ]
    },
    {
      title: 'Importação',
      lines: [
        { k: 'Arquivos hoje', v: String(rd.operacional.arquivosImportadosHoje), ...st.ok },
        { k: 'Linhas importadas', v: linhasImportadas, ...st.info },
        { k: 'Linhas com erro', v: String(rd.operacional.linhasComErroHoje), ...st.bad }
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
            Panorama de vendas, canais e operação.
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

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: '#fef2f2', borderRadius: '18px', padding: '14px 18px' }}>
          <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b91c1c' }} />
          </span>
          <span style={{ fontSize: '12.5px', color: '#991b1b', lineHeight: 1.55 }}>
            Não foi possível carregar o dashboard: {error}
          </span>
          <button
            onClick={() => setRefreshTick(t => t + 1)}
            style={{ marginLeft: 'auto', border: '1px solid #fecaca', background: '#ffffff', color: '#b91c1c', borderRadius: '999px', padding: '8px 16px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* 4 METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 248px), 1fr))', gap: '22px', opacity: loading ? 0.6 : 1 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '22px', alignItems: 'start', opacity: loading ? 0.6 : 1 }}>
        {/* BAR CHART */}
        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Faturamento por dia</div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '21px', letterSpacing: '-0.02em', color: '#334155' }}>
                {range === 'Hoje' ? 'Hoje' : `Últimos ${range}`}
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
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{ch.valueLabel}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', width: ch.pct, background: ch.color, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>Total do período</span>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '24px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{brl(rd.faturamento)}</span>
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
