import React, { useState, useEffect } from 'react';
import { parseBRL } from '../utils/money';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

const HIST_PAGE_SIZE = 8;

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

export default function CashierView({
  accentColor = '#2563eb',
  userName = ''
}) {
  const [caixaView, setCaixaView] = useState('turno'); // 'turno' | 'historico'

  // Turno atual (caixa aberto ou último caixa fechado nesta sessão)
  const [register, setRegister] = useState(null);
  const [loadingRegister, setLoadingRegister] = useState(true);
  const [registerError, setRegisterError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Contagem do operador (cega — começa em branco)
  const [counted, setCounted] = useState({ cash: '', card: '' });

  // Modal de confirmação de fechamento
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [closeSnapshot, setCloseSnapshot] = useState(null);

  // Abertura de caixa
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState(null);

  // Histórico paginado
  const [histPage, setHistPage] = useState(0);
  const [histData, setHistData] = useState({ content: [], totalElements: 0, totalPages: 1 });
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState(null);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const brl = n => {
    const v = Number(n || 0);
    const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '− R$ ' : 'R$ ') + s;
  };

  const num = s => parseBRL(s);

  const formatDateTime = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' · ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Carrega o caixa aberto do tenant. 404 é esperado quando não há turno em curso.
  useEffect(() => {
    const controller = new AbortController();
    setLoadingRegister(true);
    setRegisterError(null);

    apiRequest('/api/v1/cashier/registers/open', { signal: controller.signal })
      .then(data => {
        setRegister(data);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        if (err.status === 404) {
          setRegister(null);
        } else {
          setRegisterError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRegister(false);
      });

    return () => controller.abort();
  }, [refreshTick]);

  // Histórico — só carrega quando a aba está visível.
  useEffect(() => {
    if (caixaView !== 'historico') return;
    const controller = new AbortController();
    setHistLoading(true);
    setHistError(null);

    apiRequest(`/api/v1/cashier/registers?page=${histPage}&size=${HIST_PAGE_SIZE}`, { signal: controller.signal })
      .then(data => setHistData(data))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setHistError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistLoading(false);
      });

    return () => controller.abort();
  }, [caixaView, histPage]);

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

  const st = {
    ok: { bg: '#f0fdf4', fg: '#15803d' },
    warn: { bg: '#fffbeb', fg: '#b45309' },
    bad: { bg: '#fef2f2', fg: '#b91c1c' },
    info: { bg: accentSoft, fg: accentHover }
  };

  const isClosedRecord = !!register && register.status === 'CLOSED';

  // Formas de pagamento reais do backend: só dinheiro e cartão — Pix entra
  // somado em "cartão" porque é assim que a conciliação do backend agrega
  // (PaymentMethod.CARD + PaymentMethod.PIX viram um único totalCard).
  const PAYMENT_METHODS = [
    { key: 'cash', label: 'Dinheiro', shapeKey: 'round', expected: register ? Number(register.totalCash) : 0 },
    { key: 'card', label: 'Cartão (inclui Pix)', shapeKey: 'square', expected: register ? Number(register.totalCard) : 0 }
  ];

  const hasCounted = counted.cash !== '' || counted.card !== '';

  const methods = PAYMENT_METHODS.map(m => {
    const countedValue = isClosedRecord
      ? (m.key === 'cash' ? Number(register.totalCash) : Number(register.totalCard))
      : num(counted[m.key]);
    const diff = Math.round((countedValue - m.expected) * 100) / 100;
    const exact = Math.abs(diff) < 0.005;
    return {
      label: m.label,
      ...shapes[m.shapeKey],
      expected: brl(m.expected),
      counted: isClosedRecord ? brl(countedValue) : counted[m.key],
      isClosed: isClosedRecord,
      diffLabel: !isClosedRecord && !hasCounted ? '—' : exact ? 'confere' : brl(diff),
      diffFg: !isClosedRecord && !hasCounted ? '#94a3b8' : exact ? '#15803d' : diff < 0 ? '#b91c1c' : '#b45309',
      onChange: e =>
        setCounted(s => ({
          ...s,
          [m.key]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 12)
        }))
    };
  });

  const totalExpected = PAYMENT_METHODS.reduce((a, m) => a + m.expected, 0);
  const totalCounted = isClosedRecord
    ? Number(register.totalCash) + Number(register.totalCard)
    : Math.round((num(counted.cash) + num(counted.card)) * 100) / 100;
  const totalDiff = isClosedRecord
    ? Number(register.cashDifference) + Number(register.cardDifference)
    : Math.round((totalCounted - totalExpected) * 100) / 100;
  const exact = Math.abs(totalDiff) < 0.005;
  const small = Math.abs(totalDiff) <= 30;

  const recon = {
    status: isClosedRecord ? 'Turno fechado' : !hasCounted ? 'Aguardando contagem' : exact ? 'Conferido' : small ? 'Divergência pequena' : 'Divergência',
    diff: !isClosedRecord && !hasCounted ? '—' : exact ? 'R$ 0,00' : brl(totalDiff),
    note: isClosedRecord
      ? (exact ? 'Contagem bateu com o sistema.' : totalDiff < 0 ? 'Faltou dinheiro em relação ao esperado.' : 'Sobrou em relação ao esperado.')
      : !hasCounted ? 'Informe a contagem de dinheiro e cartão.' : exact ? 'Contagem bate com o sistema.' : totalDiff < 0 ? 'Falta dinheiro em relação ao esperado.' : 'Sobra em relação ao esperado.',
    ...(isClosedRecord ? st.info : !hasCounted ? st.info : exact ? st.ok : small ? st.warn : st.bad)
  };

  const cashCards = register ? [
    { label: 'Aberto em', value: formatDateTime(register.openedAt), hint: isClosedRecord ? `Fechado em ${formatDateTime(register.closedAt)}` : 'turno em curso', shape: 'round', iconBg: accentSoft, iconFg: accentColor },
    { label: 'Vendas do turno', value: brl(totalExpected), hint: 'dinheiro + cartão/Pix', shape: 'square', iconBg: '#f0fdf4', iconFg: '#15803d' },
    { label: 'Contado', value: isClosedRecord ? brl(totalCounted) : (hasCounted ? brl(totalCounted) : '—'), hint: 'informado pelo operador', shape: 'diamond', iconBg: accentSoft, iconFg: accentColor },
    { label: 'Diferença', value: recon.diff, hint: recon.note, shape: 'round', tag: recon.status, tagBg: recon.bg, tagFg: recon.fg, iconBg: recon.bg, iconFg: recon.fg, valueFg: recon.fg }
  ].map(c => ({ ...c, ...shapes[c.shape], valueFg: c.valueFg || '#1e293b' })) : [];

  const shiftMeta = register ? [
    { k: 'Operador', v: userName || '—' },
    { k: 'Aberto às', v: formatDateTime(register.openedAt) },
    { k: 'Situação', v: register.status === 'OPEN' ? 'Aberto' : 'Fechado' }
  ] : [];

  const handleOpenRegister = () => {
    if (openBusy) return;
    setOpenBusy(true);
    setOpenError(null);

    apiRequest('/api/v1/cashier/registers/open', { method: 'POST', body: JSON.stringify({}) })
      .then(data => {
        setRegister(data);
        setCounted({ cash: '', card: '' });
      })
      .catch(err => {
        setOpenError(err.message);
        if (err.message && err.message.toLowerCase().includes('já existe')) {
          setRefreshTick(t => t + 1);
        }
      })
      .finally(() => setOpenBusy(false));
  };

  const handleOpenCloseModal = () => {
    if (!register) return;
    // Snapshot dos valores no momento do clique, não dados de fundo que já mudaram.
    setCloseSnapshot({
      totalExpected,
      totalCounted,
      totalDiff,
      exact
    });
    setActionError(null);
    setConfirming(true);
  };

  const handleConfirmClose = () => {
    if (busy || !register) return;
    setBusy(true);
    setActionError(null);

    apiRequest(`/api/v1/cashier/registers/${register.id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        cashAmount: String(num(counted.cash)),
        cardAmount: String(num(counted.card))
      })
    })
      .then(data => {
        setRegister(data);
        setConfirming(false);
      })
      .catch(err => {
        if (err.message && (err.message.includes('outro terminal') || err.message.includes('já está fechado'))) {
          setActionError('Este caixa já foi fechado — atualize a tela para ver o resultado.');
          setRefreshTick(t => t + 1);
        } else {
          setActionError(err.message);
        }
      })
      .finally(() => setBusy(false));
  };

  const handleNewShift = () => {
    setRegister(null);
    setCounted({ cash: '', card: '' });
    setOpenError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* CONFIRMATION CLOSING MODAL */}
      {confirming && closeSnapshot && (
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
                {closeSnapshot.exact ? 'Fechar o caixa deste turno?' : `Fechar com divergência de ${brl(closeSnapshot.totalDiff)}?`}
              </h2>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: '#64748b' }}>
                O turno é lacrado e a contagem não pode mais ser alterada. A ação não pode ser desfeita.
              </p>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Esperado no sistema</span>
                <span style={{ color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(closeSnapshot.totalExpected)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Contado pelo operador</span>
                <span style={{ color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(closeSnapshot.totalCounted)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Diferença apurada</span>
                <span style={{ color: recon.fg, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{closeSnapshot.exact ? 'R$ 0,00' : brl(closeSnapshot.totalDiff)}</span>
              </div>
            </div>
            {actionError && (
              <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                {actionError}
              </div>
            )}
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
              ? 'Todos os turnos lacrados, com a diferença apurada na conciliação.'
              : 'Abertura e fechamento com conciliação por forma de pagamento. A contagem é cega até o operador confirmar.'}
          </p>
        </div>

        <div>
          {caixaView === 'turno' && register && (
            <button
              onClick={() => (isClosedRecord ? handleNewShift() : handleOpenCloseModal())}
              style={{
                border: 0,
                background: isClosedRecord ? accentColor : '#ffffff',
                color: isClosedRecord ? '#ffffff' : accentColor,
                borderRadius: '999px',
                padding: '12px 24px',
                fontSize: '13px',
                fontWeight: 500,
                boxShadow: isClosedRecord ? `0 14px 28px ${accentGlow}` : '0 12px 30px rgba(2,6,23,0.05)',
                cursor: 'pointer'
              }}
            >
              {isClosedRecord ? 'Abrir novo turno' : 'Fechar turno'}
            </button>
          )}
        </div>
      </div>

      {/* VIEW: TURNO */}
      {caixaView === 'turno' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {registerError && (
            <div style={{ background: '#ffffff', borderRadius: '24px', padding: '40px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
              <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '12px', height: '12px', background: '#b91c1c', borderRadius: '2px', transform: 'rotate(45deg)' }} />
              </span>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                Não foi possível carregar o caixa
              </div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{registerError}</div>
              <button
                onClick={() => setRefreshTick(t => t + 1)}
                style={{ border: '1px solid #bfdbfe', background: '#ffffff', color: accentColor, borderRadius: '999px', padding: '13px 22px', fontSize: '13.5px', fontWeight: 500, minHeight: '48px', cursor: 'pointer' }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!registerError && loadingRegister && (
            <div style={{ background: '#ffffff', borderRadius: '24px', padding: '40px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
              <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '12px', height: '12px', background: accentColor, borderRadius: '2px', transform: 'rotate(45deg)' }} />
              </span>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                Carregando caixa…
              </div>
            </div>
          )}

          {!registerError && !loadingRegister && !register && (
            <div style={{ background: '#ffffff', borderRadius: '24px', padding: '48px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
              <span style={{ width: '52px', height: '52px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '14px', height: '14px', background: accentColor, borderRadius: '999px' }} />
              </span>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '22px', color: '#334155' }}>
                Nenhum turno aberto
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '360px', lineHeight: 1.6 }}>
                Abra o caixa para começar a registrar e conciliar os pagamentos deste turno.
              </p>
              {openError && (
                <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5, maxWidth: '360px' }}>
                  {openError}
                </div>
              )}
              <button
                onClick={handleOpenRegister}
                disabled={openBusy}
                style={{
                  border: 0,
                  background: openBusy ? '#94a3b8' : accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '14px 28px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  boxShadow: openBusy ? 'none' : `0 14px 28px ${accentGlow}`,
                  cursor: openBusy ? 'not-allowed' : 'pointer',
                  marginTop: '6px'
                }}
              >
                {openBusy ? 'Abrindo…' : 'Abrir caixa'}
              </button>
            </div>
          )}

          {!registerError && !loadingRegister && register && (
            <>
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

              {/* TWO COLUMNS: RECONCILIATION & SHIFT INFO */}
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
                          disabled={m.isClosed}
                          placeholder="0,00"
                          style={{
                            border: '1px solid #e2e8f0',
                            background: m.isClosed ? '#f1f5f9' : '#f8fafc',
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

                  {actionError && !confirming && (
                    <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                      {actionError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {isClosedRecord ? (
                      <button
                        onClick={handleNewShift}
                        style={{
                          border: 0,
                          background: accentColor,
                          color: '#ffffff',
                          borderRadius: '999px',
                          padding: '14px 26px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          boxShadow: `0 14px 28px ${accentGlow}`,
                          cursor: 'pointer'
                        }}
                      >
                        Abrir novo turno
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenCloseModal}
                        style={{
                          border: 0,
                          background: accentColor,
                          color: '#ffffff',
                          borderRadius: '999px',
                          padding: '14px 26px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          boxShadow: `0 14px 28px ${accentGlow}`,
                          cursor: 'pointer'
                        }}
                      >
                        Fechar caixa
                      </button>
                    )}
                    {!isClosedRecord && (
                      <button
                        onClick={() => setCounted({ cash: '', card: '' })}
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
                    )}
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => window.print()}
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
                      Imprimir
                    </button>
                  </div>
                </div>

                {/* TURNO META & HISTÓRICO RECENTE */}
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
                      <span style={{ fontSize: '12.5px', color: '#64748b' }}>Esperado em dinheiro na gaveta</span>
                      <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '24px', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {brl(register.totalCash)}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Sangria e estorno</div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.6 }}>
                      Este sistema ainda não registra movimentos avulsos de sangria ou estorno de caixa — apenas as vendas conciliadas automaticamente pelos pagamentos do turno.
                    </p>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Fechamentos</div>
                    <button
                      onClick={() => {
                        setCaixaView('historico');
                        setHistPage(0);
                      }}
                      style={{
                        alignSelf: 'flex-start',
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
            </>
          )}
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
                  {histData.totalElements} {histData.totalElements === 1 ? 'registrado' : 'registrados'} ao todo
                </span>
              </div>
            </div>

            {histError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '12.5px', color: '#b91c1c' }}>{histError}</div>
                <button
                  onClick={() => setHistPage(p => p)}
                  style={{ border: '1px solid #bfdbfe', background: '#ffffff', color: accentColor, borderRadius: '999px', padding: '10px 18px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!histError && histLoading && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: '#94a3b8' }}>Carregando histórico…</div>
            )}

            {!histError && !histLoading && histData.content.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: '#94a3b8' }}>Nenhum fechamento registrado ainda.</div>
            )}

            {!histError && !histLoading && histData.content.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.1fr', gap: '14px', padding: '0 4px 12px 4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Turno</span>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', textAlign: 'right' }}>Dinheiro</span>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', textAlign: 'right' }}>Cartão</span>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', textAlign: 'right' }}>Conciliação</span>
                </div>
                {histData.content.map(hr => {
                  const totalDiffRow = Number(hr.cashDifference || 0) + Number(hr.cardDifference || 0);
                  const exactRow = Math.abs(totalDiffRow) < 0.005;
                  const kind = hr.status !== 'CLOSED' ? st.info : exactRow ? st.ok : Math.abs(totalDiffRow) <= 30 ? st.warn : st.bad;
                  const label = hr.status !== 'CLOSED' ? 'Em aberto' : exactRow ? 'Conferido' : 'Divergência';
                  return (
                    <div key={hr.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.1fr', gap: '14px', alignItems: 'center', padding: '15px 4px', borderBottom: '1px solid #f8fafc' }}>
                      <span style={{ fontSize: '13px', color: '#334155' }}>{formatDateTime(hr.openedAt)}</span>
                      <span style={{ fontSize: '12.5px', color: '#334155', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(hr.totalCash)}</span>
                      <span style={{ fontSize: '12.5px', color: '#334155', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(hr.totalCard)}</span>
                      <span style={{ justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 600, borderRadius: '999px', padding: '5px 12px', background: kind.bg, color: kind.fg }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: kind.fg }} />
                        {label === 'Divergência' ? brl(totalDiffRow) : label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                {histData.totalElements > 0
                  ? `Página ${histPage + 1} de ${histData.totalPages}`
                  : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setHistPage(p => Math.max(0, p - 1))}
                  disabled={histPage <= 0 || histLoading}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: histPage > 0 ? '#334155' : '#cbd5e1',
                    borderRadius: '999px',
                    padding: '9px 18px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: histPage > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setHistPage(p => (p + 1 < histData.totalPages ? p + 1 : p))}
                  disabled={histPage + 1 >= histData.totalPages || histLoading}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: histPage + 1 < histData.totalPages ? '#334155' : '#cbd5e1',
                    borderRadius: '999px',
                    padding: '9px 18px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: histPage + 1 < histData.totalPages ? 'pointer' : 'not-allowed'
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
