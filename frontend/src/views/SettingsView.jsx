import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import { getToken } from '../utils/auth';
import { mapBackendRole } from '../utils/permissions';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

const PLAN_LABEL_TO_ID = { Essencial: 'ESSENCIAL', Profissional: 'PROFISSIONAL', Rede: 'REDE' };
const PLAN_ID_TO_LABEL = { ESSENCIAL: 'Essencial', PROFISSIONAL: 'Profissional', REDE: 'Rede' };
const USER_STATUS_TO_LABEL = { ACTIVE: 'Ativo' };

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

const INITIAL_SETTINGS = {
  store: '',
  cnpj: '',
  email: 'contato@aurora.com.br',
  phone: '(11) 3555-0142',
  service: '10',
  oldPass: '',
  newPass: '',
  services: ['Salão', 'Delivery'],
  delimiter: 'Vírgula (,)',
  rules: { upsert: true, notify: true, dryRun: false, autoPublish: false }
};

export default function SettingsView({
  accentColor = '#2563eb',
  userRole = 'ADMIN',
  userName = 'Helena Braga'
}) {
  const [tab, setTab] = useState('Geral'); // 'Geral' | 'Equipe' | 'Importação' | 'Segurança'
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(INITIAL_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState(null);

  const [team, setTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState(null);

  const [askDiscard, setAskDiscard] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [planPick, setPlanPick] = useState('Profissional');
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState(null);

  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState(null);
  const [revoked, setRevoked] = useState([]);
  const [revoking, setRevoking] = useState(null);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const initials = s => String(s || '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // Carrega os dados reais do tenant e da equipe uma vez, independente da aba ativa
  useEffect(() => {
    apiRequest('/api/v1/tenants/me')
      .then(data => {
        setTenant(data);
        setSettings(prev => ({ ...prev, store: data.name, cnpj: data.document }));
        setSavedSettings(prev => ({ ...prev, store: data.name, cnpj: data.document }));
        setPlanPick(PLAN_ID_TO_LABEL[data.planId] || data.planId);
      })
      .catch(err => setTenantError(err.message || 'Não foi possível carregar os dados do estabelecimento.'))
      .finally(() => setTenantLoading(false));

    apiRequest('/api/v1/users')
      .then(data => {
        setTeam((data || []).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: mapBackendRole(u.role),
          status: USER_STATUS_TO_LABEL[u.status] || u.status
        })));
      })
      .catch(err => setTeamError(err.message || 'Não foi possível carregar a equipe.'))
      .finally(() => setTeamLoading(false));
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        if (askDiscard) setAskDiscard(false);
        if (planModal && !planBusy) setPlanModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [askDiscard, planModal, planBusy]);

  const patch = part => {
    setSettings(prev => ({ ...prev, ...part }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    setSaveError(null);

    try {
      const response = await apiRequest('/api/v1/tenants/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: settings.store,
          document: settings.cnpj,
          planId: tenant?.planId || PLAN_LABEL_TO_ID[planPick] || 'ESSENCIAL'
        })
      });
      setTenant(response);
      const nextSaved = { ...settings, store: response.name, cnpj: response.document };
      setSavedSettings(nextSaved);
      setBusy(false);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setBusy(false);
      setSaveError(err.message || 'Não foi possível salvar as alterações agora.');
    }
  };

  const handleDiscard = () => {
    if (!dirty) return;
    setAskDiscard(true);
  };

  const confirmDiscard = () => {
    setSettings(JSON.parse(JSON.stringify(savedSettings))); // Revert fields to exact snapshot
    setDirty(false);
    setSaved(false);
    setAskDiscard(false);
    setPassMsg(null);
  };

  const np = settings.newPass || '';
  const secScore =
    (np.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(np) ? 1 : 0) +
    (/\d/.test(np) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(np) ? 1 : 0);

  const strengthColors = ['#e2e8f0', '#b91c1c', '#b45309', accentColor, '#15803d'];
  const strengthText = ['Digite uma senha', 'Fraca', 'Razoável', 'Boa', 'Forte'];

  const handleSubmitPass = async () => {
    if (passBusy) return;
    if (!settings.oldPass) return setPassMsg({ ok: false, text: 'Informe a senha atual.' });
    if (settings.newPass.length < 8) return setPassMsg({ ok: false, text: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    if (secScore < 3) return setPassMsg({ ok: false, text: 'Senha fraca. Combine maiúsculas, números e um símbolo.' });
    if (settings.newPass === settings.oldPass) return setPassMsg({ ok: false, text: 'A nova senha precisa ser diferente da atual.' });

    setPassBusy(true);
    setPassMsg(null);
    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: settings.oldPass, newPassword: settings.newPass })
      });
      setPassBusy(false);
      setPassMsg({ ok: true, text: 'Senha atualizada. As outras sessões continuam ativas.' });
      setSettings(s => ({ ...s, oldPass: '', newPass: '' }));
    } catch (err) {
      setPassBusy(false);
      setPassMsg({ ok: false, text: err.message || 'Não foi possível atualizar a senha agora.' });
    }
  };

  const ruleDefs = [
    { key: 'upsert', label: 'Atualizar em vez de duplicar', hint: 'Reimportar o mesmo SKU sobrescreve o produto existente.' },
    { key: 'notify', label: 'Avisar ao concluir', hint: 'E-mail para o responsável quando o job termina.' },
    { key: 'dryRun', label: 'Simulação antes de aplicar', hint: 'Processa o arquivo e mostra o resultado sem gravar.' },
    { key: 'autoPublish', label: 'Publicar na vitrine automaticamente', hint: 'Produtos importados entram como Ativo na loja pública.' }
  ];

  const sessions = [
    { id: 's1', device: 'Chrome · MacBook Pro', at: 'Agora · São Paulo', current: true },
    { id: 's2', device: 'PDV-01 · terminal do salão', at: 'Ativa desde 17:00', current: false },
    { id: 's3', device: 'Safari · iPhone', at: 'Ontem, 22:14', current: false },
    { id: 's4', device: 'Edge · Windows do escritório', at: '21/08, 09:40', current: false }
  ];

  const handleRevokeSession = id => {
    if (revoking || revoked.includes(id)) return;
    setRevoking(id);
    setTimeout(() => {
      setRevoking(null);
      setRevoked(prev => [...prev, id]);
    }, 700);
  };

  const tabs = ['Geral', 'Equipe', 'Importação', 'Segurança'];
  const columns = ['sku', 'nome', 'preco', 'estoque', 'categoria', 'codigo_barras', 'unidade'];

  const planOptions = [
    { name: 'Essencial', price: 'R$ 149/mês', hint: '1 terminal PDV · 20 importações/mês' },
    { name: 'Profissional', price: 'R$ 329/mês', hint: '5 terminais PDV · 100 importações/mês' },
    { name: 'Rede', price: 'R$ 690/mês', hint: 'Terminais ilimitados · multi-loja' }
  ];

  const currentPlanLabel = PLAN_ID_TO_LABEL[tenant?.planId] || tenant?.planId || '—';
  const isAdmin = userRole === 'ADMIN';
  const notBuiltTitle = 'Disponível em uma fase futura — ainda não existe endpoint de backend para esta ação.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* DISCARD MODAL */}
      {askDiscard && (
        <div
          onClick={() => setAskDiscard(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 75,
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
            <span style={{ width: '42px', height: '42px', borderRadius: '999px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#b45309' }} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '23px', letterSpacing: '-0.02em', color: '#334155' }}>
                Descartar as alterações?
              </h2>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b' }}>
                Os campos voltam para os valores do último salvamento. O que foi digitado agora é perdido.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={() => setAskDiscard(false)}
                style={{
                  border: 0,
                  background: accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '13px 24px',
                  fontSize: '13px',
                  fontWeight: 500,
                  boxShadow: `0 14px 28px ${accentGlow}`,
                  cursor: 'pointer'
                }}
              >
                Continuar editando
              </button>
              <button
                onClick={confirmDiscard}
                style={{
                  border: '1px solid #fecaca',
                  background: '#ffffff',
                  color: '#b91c1c',
                  borderRadius: '999px',
                  padding: '13px 24px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Descartar e reverter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN SWITCH MODAL */}
      {planModal && (
        <div
          onClick={() => {
            if (!planBusy) setPlanModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
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
              maxWidth: '480px',
              background: '#ffffff',
              borderRadius: '26px',
              padding: '32px',
              boxShadow: '0 40px 90px rgba(2,6,23,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Assinatura
              </div>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '25px', letterSpacing: '-0.02em', color: '#334155' }}>
                Trocar de plano
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#64748b' }}>
                A diferença é cobrada proporcionalmente no próximo ciclo, em 12/09.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {planOptions.map(po => {
                const on = planPick === po.name;
                const isCurrent = po.name === currentPlanLabel;
                return (
                  <button
                    key={po.name}
                    onClick={() => setPlanPick(po.name)}
                    style={{
                      border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                      background: '#ffffff',
                      borderRadius: '18px',
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '999px',
                        border: `1.5px solid ${on ? accentColor : '#cbd5e1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none'
                      }}
                    >
                      <span style={{ width: '9px', height: '9px', borderRadius: '999px', background: on ? accentColor : 'transparent' }} />
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>{po.name}</span>
                        {isCurrent && (
                          <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', background: accentSoft, color: accentHover }}>
                            Plano atual
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{po.hint}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', flex: 'none' }}>{po.price}</span>
                  </button>
                );
              })}
            </div>

            {planError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: '#fef2f2', borderRadius: '14px', padding: '12px 15px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b91c1c', flex: 'none' }} />
                <span style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#b91c1c' }}>{planError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={async () => {
                  setPlanBusy(true);
                  setPlanError(null);
                  try {
                    const response = await apiRequest('/api/v1/tenants/me', {
                      method: 'PUT',
                      body: JSON.stringify({
                        name: settings.store,
                        document: settings.cnpj,
                        planId: PLAN_LABEL_TO_ID[planPick] || planPick
                      })
                    });
                    setTenant(response);
                    setPlanBusy(false);
                    setPlanModal(false);
                  } catch (err) {
                    setPlanBusy(false);
                    setPlanError(err.message || 'Não foi possível trocar de plano agora.');
                  }
                }}
                disabled={planBusy}
                style={{
                  border: 0,
                  background: accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '13px 24px',
                  fontSize: '13px',
                  fontWeight: 500,
                  boxShadow: `0 14px 28px ${accentGlow}`,
                  cursor: planBusy ? 'not-allowed' : 'pointer'
                }}
              >
                {planBusy ? 'Aplicando…' : 'Confirmar plano'}
              </button>
              <button
                onClick={() => setPlanModal(false)}
                disabled={planBusy}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '999px',
                  padding: '13px 24px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: planBusy ? 'not-allowed' : 'pointer'
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
            Preferências da conta
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
            Configurações
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            Dados do estabelecimento, equipe e regras de importação. Alterações aqui valem para todos os canais de venda.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleDiscard}
            disabled={!dirty}
            style={{
              border: `1px solid ${!dirty ? '#e2e8f0' : '#bfdbfe'}`,
              background: '#ffffff',
              color: !dirty ? '#cbd5e1' : accentColor,
              borderRadius: '999px',
              padding: '12px 22px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: !dirty ? 'not-allowed' : 'pointer'
            }}
          >
            Descartar
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{
              border: 0,
              background: accentColor,
              color: '#ffffff',
              borderRadius: '999px',
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: `0 14px 28px ${accentGlow}`,
              cursor: busy ? 'not-allowed' : 'pointer'
            }}
          >
            {busy ? 'Salvando…' : saved ? 'Salvo' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ background: '#fef2f2', borderRadius: '18px', padding: '14px 18px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
          {saveError}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {tabs.map(t => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                background: on ? accentSoft : '#ffffff',
                color: on ? accentHover : '#475569',
                borderRadius: '999px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GERAL */}
      {tab === 'Geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: '22px', alignItems: 'start' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Estabelecimento
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Razão social</span>
                <input
                  value={settings.store}
                  onChange={e => patch({ store: e.target.value })}
                  disabled={tenantLoading}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>CNPJ</span>
                <input
                  value={settings.cnpj}
                  onChange={e => patch({ cnpj: e.target.value })}
                  disabled={tenantLoading}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                />
              </label>
            </div>

            {tenantError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: '#fef2f2', borderRadius: '14px', padding: '12px 15px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b91c1c', flex: 'none' }} />
                <span style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#b91c1c' }}>{tenantError}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>E-mail de contato</span>
                <input
                  value={settings.email}
                  onChange={e => patch({ email: e.target.value })}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Telefone</span>
                <input
                  value={settings.phone}
                  onChange={e => patch({ phone: e.target.value })}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                />
              </label>
            </div>

            <div style={{ height: '1px', background: '#f1f5f9' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Operação
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['Salão', 'Delivery', 'Retirada'].map(c => {
                  const on = settings.services.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        patch({
                          services: settings.services.includes(c)
                            ? settings.services.filter(x => x !== c)
                            : [...settings.services, c]
                        })
                      }
                      style={{
                        border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                        background: on ? accentSoft : '#ffffff',
                        color: on ? accentHover : '#475569',
                        borderRadius: '999px',
                        padding: '9px 16px',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxWidth: '220px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Taxa de serviço (%)</span>
                <input
                  value={settings.service}
                  onChange={e => patch({ service: e.target.value.replace(/[^\d.,]/g, '') })}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
            {/* PLAN CARD */}
            <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Plano</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px' }}>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '26px', letterSpacing: '-0.02em', color: '#334155' }}>
                  {currentPlanLabel}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 600, borderRadius: '999px', padding: '5px 12px', background: '#f0fdf4', color: '#15803d' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#15803d' }} />
                  Ativo
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '12.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Ciclo</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>Mensal · renova 12/09</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '12.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Terminais PDV</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>3 de 5 em uso</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '12.5px' }}>
                  <span style={{ color: '#94a3b8' }}>Importações no mês</span>
                  <span style={{ color: '#334155', textAlign: 'right' }}>12 de 100</span>
                </div>
              </div>
              <button
                onClick={() => setPlanModal(true)}
                style={{
                  alignSelf: 'flex-start',
                  border: '1px solid #bfdbfe',
                  background: '#ffffff',
                  color: accentColor,
                  borderRadius: '999px',
                  padding: '11px 20px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Gerenciar assinatura
              </button>
            </div>

            {/* SENSITIVE ZONE */}
            {isAdmin && (
              <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>Zona sensível</div>
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#64748b' }}>
                  Encerrar a conta remove catálogo, pedidos e histórico de importações. A ação não pode ser desfeita. Exclusivo do papel ADMIN.
                </p>
                <button
                  disabled
                  title={notBuiltTitle}
                  style={{
                    alignSelf: 'flex-start',
                    border: 0,
                    background: '#f1f5f9',
                    color: '#94a3b8',
                    borderRadius: '999px',
                    padding: '12px 20px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'not-allowed'
                  }}
                >
                  Encerrar conta
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EQUIPE */}
      {tab === 'Equipe' && (
        <div style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '26px 30px 20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#334155' }}>
              Equipe
            </h2>
            {isAdmin && (
              <button
                disabled
                title={notBuiltTitle}
                style={{
                  border: 0,
                  background: '#f1f5f9',
                  color: '#94a3b8',
                  borderRadius: '999px',
                  padding: '11px 20px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'not-allowed'
                }}
              >
                Convidar pessoa
              </button>
            )}
          </div>
          <div style={{ padding: '0 30px 12px 30px', display: 'flex', flexDirection: 'column' }}>
            {teamLoading && (
              <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8' }}>
                Carregando equipe…
              </div>
            )}
            {!teamLoading && teamError && (
              <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '12.5px', color: '#b91c1c' }}>
                {teamError}
              </div>
            )}
            {!teamLoading && !teamError && team.map((p, idx) => (
              <div key={p.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '15px 0', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                  <span style={{ width: '40px', height: '40px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: '12px', fontWeight: 600, color: accentHover }}>
                    {initials(p.name)}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>{p.name}</span>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{p.email}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', letterSpacing: '0.1em', fontWeight: 600, color: accentColor }}>{p.role}</span>
                  <StatusBadge status={p.status} accentSoft={accentSoft} accentHover={accentHover} />
                  <button
                    disabled
                    title={notBuiltTitle}
                    style={{
                      border: '1px solid #f1f5f9',
                      background: '#ffffff',
                      color: '#94a3b8',
                      borderRadius: '999px',
                      padding: '8px 15px',
                      fontSize: '12px',
                      cursor: 'not-allowed'
                    }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: IMPORTAÇÃO */}
      {tab === 'Importação' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '22px', alignItems: 'start' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Regras de importação
            </div>
            {ruleDefs.map(r => {
              const on = !!settings.rules[r.key];
              return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', padding: '14px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>{r.label}</span>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.5 }}>{r.hint}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => patch({ rules: { ...settings.rules, [r.key]: !on } })}
                    style={{
                      border: 0,
                      background: on ? accentColor : '#e2e8f0',
                      borderRadius: '999px',
                      width: '50px',
                      height: '28px',
                      padding: '3px',
                      display: 'flex',
                      justifyContent: on ? 'flex-end' : 'flex-start',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <span style={{ width: '22px', height: '22px', borderRadius: '999px', background: '#ffffff', boxShadow: '0 3px 8px rgba(2,6,23,0.18)' }} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Mapeamento de colunas
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: '#64748b' }}>
              Colunas reconhecidas automaticamente nos arquivos enviados. Nomes fora da lista vão para o relatório de erros sem interromper o job.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {columns.map(c => (
                <span key={c} style={{ fontSize: '11.5px', fontWeight: 500, borderRadius: '999px', padding: '7px 13px', background: '#f8fafc', color: '#475569' }}>
                  {c}
                </span>
              ))}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Delimitador padrão</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Vírgula (,)', 'Ponto e vírgula (;)', 'Tabulação'].map(d => {
                  const on = settings.delimiter === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patch({ delimiter: d })}
                      style={{
                        border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                        background: on ? accentSoft : '#ffffff',
                        color: on ? accentHover : '#475569',
                        borderRadius: '999px',
                        padding: '10px 18px',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </label>
          </div>
        </div>
      )}

      {/* TAB 4: SEGURANÇA */}
      {tab === 'Segurança' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '22px', alignItems: 'start' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Trocar senha
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Senha atual</span>
              <input
                type="password"
                value={settings.oldPass}
                onChange={e => patch({ oldPass: e.target.value })}
                style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Nova senha</span>
              <input
                type="password"
                value={settings.newPass}
                onChange={e => patch({ newPass: e.target.value })}
                style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
                  {[0, 1, 2, 3].map(i => (
                    <span
                      key={i}
                      style={{
                        height: '4px',
                        flex: 1,
                        borderRadius: '999px',
                        background: i < secScore ? strengthColors[secScore] : '#e2e8f0'
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: secScore >= 3 ? '#15803d' : secScore === 0 ? '#94a3b8' : '#b45309', flex: 'none' }}>
                  {strengthText[secScore]}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                Mínimo de 8 caracteres, com maiúscula, número e símbolo — mesma regra do cadastro.
              </span>
            </label>

            {passMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: passMsg.ok ? '#f0fdf4' : '#fef2f2', borderRadius: '14px', padding: '12px 15px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: passMsg.ok ? '#15803d' : '#b91c1c', flex: 'none' }} />
                <span style={{ fontSize: '12.5px', lineHeight: 1.5, color: passMsg.ok ? '#15803d' : '#b91c1c' }}>{passMsg.text}</span>
              </div>
            )}

            <button
              onClick={handleSubmitPass}
              disabled={passBusy}
              style={{
                alignSelf: 'flex-start',
                border: 0,
                background: passBusy ? accentHover : accentColor,
                color: '#ffffff',
                borderRadius: '999px',
                padding: '12px 22px',
                fontSize: '13px',
                fontWeight: 500,
                boxShadow: `0 14px 28px ${accentGlow}`,
                cursor: passBusy ? 'not-allowed' : 'pointer'
              }}
            >
              {passBusy ? 'Atualizando…' : 'Atualizar senha'}
            </button>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Sessões ativas
            </div>
            {sessions.map(ss => {
              const isGone = revoked.includes(ss.id);
              const isRevokingThis = revoking === ss.id;
              return (
                <div key={ss.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '13px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '999px', background: isGone ? '#f1f5f9' : accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isGone ? '#94a3b8' : accentColor }} />
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '12.5px', color: isGone ? '#94a3b8' : '#334155' }}>{ss.device}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{isGone ? 'Sessão encerrada agora' : ss.at}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(ss.id)}
                    disabled={ss.current || isGone || isRevokingThis}
                    title="Autenticação stateless (JWT) — não há sessões reais no servidor para encerrar."
                    style={{
                      border: `1px solid ${isGone || ss.current ? '#f1f5f9' : '#fecaca'}`,
                      background: '#ffffff',
                      color: isGone || ss.current ? '#94a3b8' : '#b91c1c',
                      borderRadius: '999px',
                      padding: '7px 14px',
                      fontSize: '12px',
                      flex: 'none',
                      cursor: ss.current || isGone || isRevokingThis ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {ss.current ? 'Esta sessão' : isGone ? 'Encerrada' : isRevokingThis ? 'Encerrando…' : 'Encerrar'}
                  </button>
                </div>
              );
            })}

            {revoked.length > 0 && (
              <span style={{ fontSize: '11.5px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                {revoked.length === 1 ? '1 sessão encerrada nesta visita.' : `${revoked.length} sessões encerradas nesta visita.`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
