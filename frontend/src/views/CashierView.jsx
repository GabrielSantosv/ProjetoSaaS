import React, { useState, useEffect } from 'react';
import { parseBRL } from '../utils/money';
import StatusBadge from '../components/StatusBadge';

const EXPECTED = {
  Dinheiro: 1840.5,
  'Cartão de crédito': 6420,
  'Cartão de débito': 2310.75,
  Pix: 3980.25
};
const OPENING = 300;

export default function CashierView({
  accentColor = '#2563eb',
  userName = 'Helena Braga'
}) {
  const [caixaView, setCaixaView] = useState('turno'); // 'turno' | 'historico'
  const [histPage, setHistPage] = useState(1);
  const [histFilter, setHistFilter] = useState('Todos');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [note, setNote] = useState('');
  const [counted, setCounted] = useState({
    Dinheiro: '1.812,00',
    'Cartão de crédito': '6.420,00',
    'Cartão de débito': '2.310,75',
    Pix: '3.980,25'
  });

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const brl = n => {
    const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '− R$ ' : 'R$ ') + s;
  };

  const num = s => parseBRL(s);

  // ESC key handler for confirmation modal
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape' && confirming && !busy) {
        setConfirming(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirming, busy]);

  const shapes = {
    round: { iconRadius: '999px', iconRotate: 'none' },
    square: { iconRadius: '2px', iconRotate: 'none' },
    diamond: { iconRadius: '2px', iconRotate: 'rotate(45deg)' }
  };

  const methodShapes = {
    Dinheiro: 'round',
    'Cartão de crédito': 'square',
    'Cartão de débito': 'square',
    Pix: 'diamond'
  };

  const st = {
    ok: { bg: '#f0fdf4', fg: '#15803d' },
    warn: { bg: '#fffbeb', fg: '#b45309' },
    bad: { bg: '#fef2f2', fg: '#b91c1c' },
    info: { bg: accentSoft, fg: accentHover }
  };

  const methods = Object.keys(EXPECTED).map(k => {
    const diff = Math.round((num(counted[k]) - EXPECTED[k]) * 100) / 100;
    const exact = Math.abs(diff) < 0.005;
    return {
      label: k,
      ...shapes[methodShapes[k]],
      expected: brl(EXPECTED[k]),
      counted: counted[k],
      diffLabel: exact ? 'confere' : brl(diff),
      diffFg: exact ? '#15803d' : diff < 0 ? '#b91c1c' : '#b45309',
      onChange: e =>
        setCounted(s => ({
          ...s,
          [k]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 12)
        }))
    };
  });

  const totalExpected = Object.values(EXPECTED).reduce((a, b) => a + b, 0);
  const totalCounted =
    Object.keys(EXPECTED).reduce((a, k) => a + Math.round(num(counted[k]) * 100), 0) / 100;
  const totalDiff = Math.round((totalCounted - totalExpected) * 100) / 100;
  const exact = Math.abs(totalDiff) < 0.005;
  const small = Math.abs(totalDiff) <= 30;

  const recon = {
    status: closed ? 'Turno fechado' : exact ? 'Conferido' : small ? 'Divergência pequena' : 'Divergência',
    diff: exact ? 'R$ 0,00' : brl(totalDiff),
    note: exact ? 'Contagem bate com o sistema.' : totalDiff < 0 ? 'Falta dinheiro em relação ao esperado.' : 'Sobra em relação ao esperado.',
    ...(closed ? st.info : exact ? st.ok : small ? st.warn : st.bad)
  };

  const cashCards = [
    { label: 'Abertura', value: brl(OPENING), hint: 'fundo de troco às 17:00', shape: 'round', tag: 'Turno noite', tagBg: accentSoft, tagFg: accentHover, iconBg: accentSoft, iconFg: accentColor },
    { label: 'Vendas do turno', value: brl(totalExpected), hint: '4 formas de pagamento', shape: 'square', tag: '94 pedidos', tagBg: '#f0fdf4', tagFg: '#15803d', iconBg: '#f0fdf4', iconFg: '#15803d' },
    { label: 'Contado', value: brl(totalCounted), hint: 'informado pelo operador', shape: 'diamond', tag: null, iconBg: accentSoft, iconFg: accentColor },
    { label: 'Diferença', value: recon.diff, hint: recon.note, shape: 'round', tag: recon.status, tagBg: recon.bg, tagFg: recon.fg, iconBg: recon.bg, iconFg: recon.fg, valueFg: recon.fg }
  ].map(c => ({ ...c, ...shapes[c.shape], valueFg: c.valueFg || '#1e293b' }));

  const movements = [
    { label: 'Abertura de caixa', at: '17:00 · Helena', value: brl(OPENING), ...st.info },
    { label: 'Vendas em dinheiro', at: '17:00 – 23:40', value: brl(EXPECTED.Dinheiro), ...st.ok },
    { label: 'Sangria para cofre', at: '21:12 · gerente', value: brl(-200), ...st.warn },
    { label: 'Troco reposto', at: '21:15 · gerente', value: brl(100), ...st.info },
    { label: 'Estorno pedido #10424', at: '17:44 · cancelado', value: brl(-156.4), ...st.bad }
  ];

  const OPERATORS = ['Helena Braga', 'Bruno Ferraz', 'Larissa Prado', 'Caio Mendes'];
  const ALL_CLOSINGS = Array.from({ length: 27 }, (_, i) => {
    const dayNum = 22 - Math.floor(i / 2);
    const shift = i % 2 === 0 ? 'noite' : 'tarde';
    const diffCents = [0, -1200, 0, 850, -2850, 0, 0, -450, 3100][i % 9];
    const kind = diffCents === 0 ? st.ok : Math.abs(diffCents) <= 1500 ? st.warn : st.bad;
    return {
      id: 'f' + i,
      day: String(dayNum).padStart(2, '0') + '/08 · turno ' + shift,
      who: OPERATORS[i % 4],
      terminal: i % 3 === 0 ? 'PDV-01 · salão' : i % 3 === 1 ? 'PDV-02 · balcão' : 'PDV-01 · salão',
      total: brl(9800 + ((i * 733) % 6200)),
      diff: diffCents === 0 ? 'R$ 0,00' : brl(diffCents / 100),
      label: diffCents === 0 ? 'Conferido' : Math.abs(diffCents) <= 1500 ? 'Divergência pequena' : 'Divergência alta',
      ...kind
    };
  });

  const history = ALL_CLOSINGS.slice(0, 3);

  const PER_PAGE = 8;
  const histFiltered =
    histFilter === 'Todos'
      ? ALL_CLOSINGS
      : ALL_CLOSINGS.filter(c => (histFilter === 'Conferidos' ? c.label === 'Conferido' : c.label !== 'Conferido'));
  const histPages = Math.max(1, Math.ceil(histFiltered.length / PER_PAGE));
  const validHistPage = Math.min(histPage, histPages);
  const histSlice = histFiltered.slice((validHistPage - 1) * PER_PAGE, validHistPage * PER_PAGE);

  const handleConfirmClose = () => {
    if (busy) return; // Multi-click protection
    setBusy(true);

    setTimeout(() => {
      setBusy(false);
      setConfirming(false);
      setClosed(true);
    }, 700);
  };

  const handleResetCount = () => {
    setCounted({ Dinheiro: '', 'Cartão de crédito': '', 'Cartão de débito': '', Pix: '' });
    setClosed(false);
  };

  const shiftMeta = [
    { k: 'Operador', v: userName },
    { k: 'Aberto às', v: '17:00 · 23/08' },
    { k: 'Terminal', v: 'PDV-01 · salão' },
    { k: 'Situação', v: closed ? 'Fechado' : 'Aberto' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* CONFIRMATION CLOSING MODAL */}
      {confirming && (
        <div
          onClick={() => {
            if (!busy) setConfirming(false);
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
              maxWidth: '460px',
              background: '#ffffff',
              borderRadius: '26px',
              padding: '34px',
              boxShadow: '0 40px 90px rgba(2,6,23,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#b45309' }} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '24px', letterSpacing: '-0.02em', color: '#1e293b' }}>
                {exact ? 'Fechar o caixa deste turno?' : `Fechar com divergência de ${brl(totalDiff)}?`}
              </h2>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: '#64748b' }}>
                O turno é lacrado e a contagem não pode mais ser alterada. A ação não pode ser desfeita.
              </p>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Esperado no sistema</span>
                <span style={{ color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(totalExpected)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Contado pelo operador</span>
                <span style={{ color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(totalCounted)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Diferença apurada</span>
                <span style={{ color: recon.fg, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{exact ? 'R$ 0,00' : brl(totalDiff)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={handleConfirmClose}
                disabled={busy}
                style={{
                  border: 0,
                  background: busy ? '#94a3b8' : '#b45309',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '14px 24px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  boxShadow: '0 14px 28px rgba(180,83,9,0.28)',
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                {busy ? 'Fechando…' : 'Sim, fechar o turno'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '999px',
                  padding: '14px 24px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
            {caixaView === 'historico' ? 'Auditoria' : 'Operação financeira'}
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
            {caixaView === 'historico' ? 'Histórico de fechamentos' : 'Caixa'}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            {caixaView === 'historico'
              ? 'Todos os turnos lacrados, com operador, terminal e a diferença apurada na conciliação.'
              : 'Abertura, movimentos e fechamento com conciliação por forma de pagamento. A contagem é cega até o operador confirmar.'}
          </p>
        </div>

        <div>
          {caixaView === 'turno' && (
            <button
              onClick={() => (closed ? setClosed(false) : setConfirming(true))}
              style={{
                border: 0,
                background: closed ? accentColor : '#ffffff',
                color: closed ? '#ffffff' : accentColor,
                borderRadius: '999px',
                padding: '12px 24px',
                fontSize: '13px',
                fontWeight: 500,
                boxShadow: closed ? `0 14px 28px ${accentGlow}` : '0 12px 30px rgba(2,6,23,0.05)',
                cursor: 'pointer'
              }}
            >
              {closed ? 'Abrir novo turno' : 'Fechar turno'}
            </button>
          )}
        </div>
      </div>

      {/* VIEW: TURNO */}
      {caixaView === 'turno' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 248px), 1fr))', gap: '22px' }}>
            {cashCards.map((c, idx) => (
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
                  <span style={{ width: '44px', height: '44px', borderRadius: '999px', background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <span style={{ width: '14px', height: '14px', background: c.iconFg, borderRadius: c.iconRadius, transform: c.iconRotate }} />
                  </span>
                  {c.tag && (
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: c.tagFg, background: c.tagBg, borderRadius: '999px', padding: '4px 11px' }}>
                      {c.tag}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 'clamp(22px, 2.4vw, 32px)', letterSpacing: '-0.025em', color: c.valueFg, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{c.hint}</div>
                </div>
              </div>
            ))}
          </div>

          {/* TWO COLUMNS: RECONCILIATION & MOVEMENTS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: '22px', alignItems: 'start' }}>
            {/* CONCILIATION FORM */}
            <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Conciliação</div>
                  <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#334155' }}>
                    Contagem por forma
                  </h2>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 600, border: 'none', borderRadius: '999px', padding: '6px 13px', background: recon.bg, color: recon.fg }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: recon.fg }} />
                  {recon.status}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {methods.map(m => (
                  <div key={m.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(96px, 0.8fr) minmax(80px, 0.7fr)', gap: '12px', alignItems: 'center', padding: '14px 0', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <span style={{ width: '9px', height: '9px', background: accentColor, borderRadius: m.iconRadius, transform: m.iconRotate }} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>{m.label}</span>
                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>sistema {m.expected}</span>
                      </div>
                    </div>
                    <input
                      value={m.counted}
                      onChange={m.onChange}
                      disabled={closed}
                      style={{
                        border: '1px solid #e2e8f0',
                        background: closed ? '#f1f5f9' : '#f8fafc',
                        borderRadius: '12px',
                        padding: '11px 13px',
                        fontSize: '13.5px',
                        color: '#334155',
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right',
                        minWidth: 0
                      }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: m.diffFg, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {m.diffLabel}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ background: recon.bg, borderRadius: '20px', padding: '22px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: recon.fg, fontWeight: 600 }}>Diferença total</span>
                  <span style={{ fontSize: '12.5px', color: recon.fg }}>{recon.note}</span>
                </div>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '32px', letterSpacing: '-0.02em', color: recon.fg, fontVariantNumeric: 'tabular-nums' }}>
                  {recon.diff}
                </span>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Observação do fechamento</span>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ex.: sangria de R$ 200 às 21h, troco reposto pelo gerente."
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  onClick={() => (closed ? setClosed(false) : setConfirming(true))}
                  style={{
                    border: 0,
                    background: closed ? '#64748b' : accentColor,
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '14px 26px',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    boxShadow: closed ? 'rgba(100,116,139,0.28)' : `0 14px 28px ${accentGlow}`,
                    cursor: 'pointer'
                  }}
                >
                  {closed ? 'Reabrir turno' : 'Fechar caixa'}
                </button>
                <button
                  onClick={handleResetCount}
                  style={{
                    border: '1px solid #bfdbfe',
                    background: '#ffffff',
                    color: accentColor,
                    borderRadius: '999px',
                    padding: '14px 24px',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Recontar
                </button>
                <div style={{ flex: 1 }} />
                <button
                  style={{
                    border: 0,
                    background: '#f8fafc',
                    color: '#64748b',
                    borderRadius: '999px',
                    padding: '14px 22px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Imprimir cego
                </button>
              </div>
            </div>

            {/* TURNO META & MOVEMENTS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Turno atual</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  {shiftMeta.map(s => (
                    <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '12.5px' }}>
                      <span style={{ color: '#94a3b8' }}>{s.k}</span>
                      <span style={{ color: '#334155', textAlign: 'right' }}>{s.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>Esperado em gaveta</span>
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '24px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                    {brl(OPENING + EXPECTED.Dinheiro - 200 + 100 - 156.4)}
                  </span>
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Movimentos do turno</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {movements.map((mv, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 0', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: mv.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: mv.fg }} />
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <span style={{ fontSize: '12.5px', color: '#334155' }}>{mv.label}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{mv.at}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: mv.fg, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                        {mv.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Últimos fechamentos</div>
                {history.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12.5px', color: '#334155' }}>{h.day}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{h.who}</span>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 600, borderRadius: '999px', padding: '5px 12px', background: h.bg, color: h.fg }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: h.fg }} />
                      {h.diff}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setCaixaView('historico');
                    setHistPage(1);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: '6px',
                    border: '1px solid #bfdbfe',
                    background: '#ffffff',
                    color: accentColor,
                    borderRadius: '999px',
                    padding: '10px 18px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Ver histórico completo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: HISTORICO */}
      {caixaView === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <button
            onClick={() => setCaixaView('turno')}
            style={{
              alignSelf: 'flex-start',
              border: 0,
              background: 'transparent',
              padding: 0,
              fontSize: '12.5px',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            ← Voltar ao turno
          </button>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Histórico</div>
                <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '30px', letterSpacing: '-0.02em', color: '#334155' }}>
                  Fechamentos de caixa
                </h2>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  {histFiltered.length} registrados nos últimos 14 dias
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', borderRadius: '999px', padding: '5px' }}>
                {['Todos', 'Conferidos', 'Com divergência'].map(f => {
                  const on = histFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        setHistFilter(f);
                        setHistPage(1);
                      }}
                      style={{
                        border: 0,
                        background: on ? accentColor : 'transparent',
                        color: on ? '#ffffff' : '#64748b',
                        borderRadius: '999px',
                        padding: '9px 16px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr 1.1fr', gap: '14px', padding: '0 4px 12px 4px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Turno</span>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Operador</span>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Terminal</span>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', textAlign: 'right' }}>Total</span>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', textAlign: 'right' }}>Conciliação</span>
              </div>
              {histSlice.map(hr => (
                <div key={hr.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr 1.1fr', gap: '14px', alignItems: 'center', padding: '15px 4px', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ fontSize: '13px', color: '#334155' }}>{hr.day}</span>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>{hr.who}</span>
                  <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>{hr.terminal}</span>
                  <span style={{ fontSize: '12.5px', color: '#334155', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{hr.total}</span>
                  <span style={{ justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 600, borderRadius: '999px', padding: '5px 12px', background: hr.bg, color: hr.fg }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: hr.fg }} />
                    {hr.diff}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Mostrando {(validHistPage - 1) * PER_PAGE + 1}–{Math.min(validHistPage * PER_PAGE, histFiltered.length)} de {histFiltered.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setHistPage(p => Math.max(1, p - 1))}
                  disabled={validHistPage <= 1}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: validHistPage > 1 ? '#334155' : '#cbd5e1',
                    borderRadius: '999px',
                    padding: '9px 18px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: validHistPage > 1 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                  Página {validHistPage} de {histPages}
                </span>
                <button
                  onClick={() => setHistPage(p => Math.min(histPages, p + 1))}
                  disabled={validHistPage >= histPages}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: validHistPage < histPages ? '#334155' : '#cbd5e1',
                    borderRadius: '999px',
                    padding: '9px 18px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: validHistPage < histPages ? 'pointer' : 'not-allowed'
                  }}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
