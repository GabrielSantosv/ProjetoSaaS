import React, { useState } from 'react';
import { login, registerTenant, saveSession } from '../utils/auth.js';
import { mapBackendRole } from '../utils/permissions.js';

export default function AuthView({
  accentColor = '#2563eb',
  onLoginSuccess
}) {
  const [screen, setScreen] = useState('login'); // 'login' | 'signup' | 'recover'
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);
  const [signupRole, setSignupRole] = useState('Admin');

  const [auth, setAuth] = useState({
    name: '',
    store: '',
    document: '',
    planId: 'profissional',
    email: '',
    pass: ''
  });

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;
  const accentOnDark = mix(70, '#ffffff');

  const isLogin = screen === 'login';
  const isSignup = screen === 'signup';
  const isRecover = screen === 'recover';

  const pass = auth.pass;
  const score =
    (pass.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(pass) ? 1 : 0) +
    (/\d/.test(pass) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pass) ? 1 : 0);

  const strengthColors = ['#e2e8f0', '#b91c1c', '#b45309', accentColor, '#15803d'];
  const strengthText = ['Digite uma senha', 'Fraca', 'Razoável', 'Boa', 'Forte'];

  const pitch = [
    'Importação de CSV com progresso ao vivo',
    'PDV de mesas pensado para toque',
    'Fechamento de caixa com conciliação'
  ];

  const handleSubmit = e => {
    if (e) e.preventDefault();
    if (busy) return;

    if (isRecover) {
      if (!auth.email.includes('@')) {
        return setAuthError('Informe um e-mail válido.');
      }
      setBusy(true);
      setAuthError('');
      setTimeout(() => {
        setBusy(false);
        setRecoverSent(true);
      }, 700);
      return;
    }

    if (isSignup) {
      if (!auth.name.trim() || !auth.store.trim()) {
        return setAuthError('Informe seu nome e o nome do estabelecimento.');
      }
      if (!auth.document.trim()) {
        return setAuthError('Informe o CNPJ ou CPF do estabelecimento.');
      }
      if (!auth.email.includes('@')) {
        return setAuthError('Informe um e-mail de trabalho válido.');
      }
      if (auth.pass.length < 8) {
        return setAuthError('A senha precisa ter pelo menos 8 caracteres.');
      }
      setBusy(true);
      setAuthError('');
      registerTenant({
        companyName: auth.store,
        document: auth.document,
        planId: auth.planId,
        adminName: auth.name,
        adminEmail: auth.email,
        adminPassword: auth.pass
      })
        .then(response => {
          setBusy(false);
          saveSession(response);
          if (onLoginSuccess) {
            onLoginSuccess({
              name: response.user.name,
              role: mapBackendRole(response.user.role),
              store: response.tenant?.name || auth.store,
              email: response.user.email
            });
          }
        })
        .catch(err => {
          setBusy(false);
          setAuthError(err.message);
        });
      return;
    }

    // Login
    if (!auth.email.includes('@') || !auth.pass) {
      return setAuthError('Informe e-mail e senha para entrar.');
    }

    setBusy(true);
    setAuthError('');
    login(auth.email, auth.pass)
      .then(response => {
        setBusy(false);
        saveSession(response);
        if (onLoginSuccess) {
          onLoginSuccess({
            name: response.user.name,
            role: mapBackendRole(response.user.role),
            store: response.tenant?.name || '',
            email: response.user.email
          });
        }
      })
      .catch(err => {
        setBusy(false);
        setAuthError(err.message);
      });
  };

  // Papel só define o rótulo visual — o registro cria sempre o admin
  // inicial do tenant (RegisterTenantRequest não tem campo de papel).
  const roleChips = ['Admin', 'Vendedor', 'PDV', 'Caixa'];
  const planChips = [
    { id: 'essencial', label: 'Essencial' },
    { id: 'profissional', label: 'Profissional' },
    { id: 'rede', label: 'Rede' }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', minHeight: '100vh' }}>
      {/* LEFT COLUMN: BRAND & PITCH */}
      <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '48px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '999px', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: '13px', height: '13px', background: '#ffffff', borderRadius: '3px', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '17px', letterSpacing: '-0.015em', color: '#ffffff' }}>
              Comércio
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>
              Área interna
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '460px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentOnDark, fontWeight: 600 }}>
            Um sistema, todos os canais
          </div>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '38px', lineHeight: 1.12, letterSpacing: '-0.025em', color: '#ffffff' }}>
            Salão, delivery e vitrine no mesmo catálogo.
          </h2>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.7, color: '#94a3b8' }}>
            Importe planilhas do fornecedor, acompanhe o processamento linha a linha e venda com o estoque já conciliado.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {pitch.map((pi, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: 'rgba(148,163,184,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentOnDark }} />
                </span>
                <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{pi}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748b' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e' }} />
          Todos os serviços operando normalmente
        </div>
      </div>

      {/* RIGHT COLUMN: AUTH CARD */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 40px', minWidth: 0, background: '#f8fafc' }}>
        <div style={{ width: '100%', maxWidth: '420px', background: '#ffffff', borderRadius: '28px', padding: '40px', boxShadow: '0 28px 60px rgba(2,6,23,0.07)', display: 'flex', flexDirection: 'column', gap: '26px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              {isRecover ? 'Recuperar acesso' : isSignup ? 'Criar conta' : 'Acesso da equipe'}
            </div>
            <h1 style={{ margin: '8px 0', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '32px', lineHeight: 1.1, letterSpacing: '-0.025em', color: '#1e293b' }}>
              {isRecover ? (recoverSent ? 'Link enviado' : 'Recuperar senha') : isSignup ? 'Comece em minutos' : 'Entrar no painel'}
            </h1>
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: '#64748b' }}>
              {isRecover
                ? recoverSent
                  ? `Enviamos um link de redefinição para ${auth.email || 'seu e-mail'}. Ele expira em 30 minutos.`
                  : 'Informe o e-mail cadastrado e enviamos um link para você criar uma senha nova.'
                : isSignup
                ? 'Crie a conta do estabelecimento e convide a equipe depois, em Configurações.'
                : 'Use o e-mail cadastrado pelo administrador do estabelecimento.'}
            </p>
          </div>

          {authError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: '#fef2f2', borderRadius: '16px', padding: '13px 16px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '999px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#b91c1c' }} />
              </span>
              <span style={{ fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>{authError}</span>
            </div>
          )}

          {recoverSent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', background: '#f0fdf4', borderRadius: '16px', padding: '13px 16px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '999px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#15803d' }} />
              </span>
              <span style={{ fontSize: '12.5px', color: '#15803d', lineHeight: 1.5 }}>Link de redefinição enviado.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isSignup && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Nome completo</span>
                  <input
                    value={auth.name}
                    onChange={e => setAuth(s => ({ ...s, name: e.target.value }))}
                    placeholder="Helena Braga"
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '13px 15px', fontSize: '13.5px', color: '#334155' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Nome do estabelecimento</span>
                  <input
                    value={auth.store}
                    onChange={e => setAuth(s => ({ ...s, store: e.target.value }))}
                    placeholder="Restaurante Aurora"
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '13px 15px', fontSize: '13.5px', color: '#334155' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>CNPJ ou CPF</span>
                  <input
                    value={auth.document}
                    onChange={e => setAuth(s => ({ ...s, document: e.target.value }))}
                    placeholder="12.345.678/0001-90"
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '13px 15px', fontSize: '13.5px', color: '#334155' }}
                  />
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Plano</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {planChips.map(p => {
                      const on = auth.planId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAuth(s => ({ ...s, planId: p.id }))}
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
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>E-mail de trabalho</span>
              <input
                value={auth.email}
                onChange={e => setAuth(s => ({ ...s, email: e.target.value }))}
                placeholder="helena@aurora.com.br"
                style={{
                  border: `1px solid ${auth.email && !auth.email.includes('@') ? '#fecaca' : '#e2e8f0'}`,
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '13px 15px',
                  fontSize: '13.5px',
                  color: '#334155'
                }}
              />
            </label>

            {!isRecover && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Senha</span>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setScreen('recover');
                        setAuthError('');
                        setRecoverSent(false);
                      }}
                      style={{ border: 0, background: 'transparent', padding: 0, fontSize: '11.5px', color: accentColor, cursor: 'pointer' }}
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '4px 6px 4px 15px' }}>
                  <input
                    value={auth.pass}
                    onChange={e => setAuth(s => ({ ...s, pass: e.target.value }))}
                    type={showPass ? 'text' : 'password'}
                    placeholder="mínimo 8 caracteres"
                    style={{ border: 0, background: 'transparent', flex: 1, minWidth: 0, padding: '9px 0', fontSize: '13.5px', color: '#334155' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ border: 0, background: '#ffffff', color: accentColor, borderRadius: '999px', padding: '8px 14px', fontSize: '11.5px', fontWeight: 500, flex: 'none', cursor: 'pointer' }}
                  >
                    {showPass ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </label>
            )}

            {isSignup && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[0, 1, 2, 3].map(i => (
                      <span
                        key={i}
                        style={{
                          flex: 1,
                          height: '5px',
                          borderRadius: '999px',
                          background: i < score ? strengthColors[score] : '#e2e8f0'
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '11.5px', color: score >= 3 ? '#15803d' : score === 0 ? '#94a3b8' : '#b45309' }}>
                    {strengthText[score]}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                    Seu papel no time
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {roleChips.map(r => {
                      const on = signupRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSignupRole(r)}
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
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={busy}
                style={{
                  border: 0,
                  background: busy ? accentHover : accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '15px',
                  fontSize: '14px',
                  fontWeight: 500,
                  boxShadow: `0 16px 30px ${accentGlow}`,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                {busy
                  ? isSignup
                    ? 'Criando conta…'
                    : isRecover
                    ? 'Enviando…'
                    : 'Entrando…'
                  : isRecover
                  ? recoverSent
                    ? 'Reenviar link'
                    : 'Enviar link'
                  : isSignup
                  ? 'Criar conta'
                  : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen(isSignup || isRecover ? 'login' : 'signup');
                  setAuthError('');
                  setRecoverSent(false);
                }}
                style={{
                  border: '1px solid #bfdbfe',
                  background: '#ffffff',
                  color: accentColor,
                  borderRadius: '999px',
                  padding: '14px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {isRecover ? 'Voltar para o login' : isSignup ? 'Já tenho conta — entrar' : 'Criar uma conta nova'}
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.6, color: '#94a3b8', textAlign: 'center' }}>
              {isRecover
                ? 'Se o e-mail não chegar em alguns minutos, confira a caixa de spam.'
                : isSignup
                ? 'Ao criar a conta você concorda com os termos de uso e a política de privacidade.'
                : 'Use o e-mail e a senha cadastrados para o estabelecimento.'}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
