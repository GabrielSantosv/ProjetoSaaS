import React, { useState } from 'react';
import { canAccess } from '../utils/permissions.js';

export default function Layout({
  activeTab,
  setActiveTab,
  userName = 'Helena Braga',
  userRole = 'ADMIN',
  setUserRole,
  accentColor = '#2563eb',
  setAccentColor,
  children
}) {
  const [hoveredNav, setHoveredNav] = useState(null);
  const [devMenuOpen, setDevMenuOpen] = useState(false);

  const isDev = Boolean(import.meta.env?.DEV);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;
  const accentOnDark = mix(70, '#ffffff');

  const shapes = {
    round: { iconRadius: '999px', iconRotate: 'none' },
    square: { iconRadius: '2px', iconRotate: 'none' },
    diamond: { iconRadius: '2px', iconRotate: 'rotate(45deg)' }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', shape: 'square' },
    { id: 'pedidos', label: 'Pedidos', shape: 'round', badge: '12' },
    { id: 'pdv', label: 'PDV · Mesas', shape: 'diamond', badge: '6/14' },
    { id: 'produtos', label: 'Produtos', shape: 'square' },
    { id: 'importacao', label: 'Importação', shape: 'diamond', badge: '2' },
    { id: 'caixa', label: 'Caixa', shape: 'round' },
    { id: 'configuracoes', label: 'Configurações', shape: 'square' }
  ];

  const visibleNav = navItems.filter(item => canAccess(userRole, item.id));
  const activeItem = navItems.find(i => i.id === activeTab) || navItems[0];
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

  const roles = ['ADMIN', 'VENDEDOR', 'PDV', 'CAIXA'];
  const accents = [
    { label: 'Azul', value: '#2563eb' },
    { label: 'Ciano', value: '#0ea5e9' },
    { label: 'Índigo', value: '#4f46e5' },
    { label: 'Teal', value: '#0f766e' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* SIDEBAR */}
      <aside
        style={{
          width: '268px',
          flex: 'none',
          background: '#0f172a',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 10
        }}
      >
        {/* LOGO */}
        <div style={{ padding: '28px 24px 24px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '999px',
              background: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none'
            }}
          >
            <span
              style={{
                width: '13px',
                height: '13px',
                background: '#ffffff',
                borderRadius: '3px',
                transform: 'rotate(45deg)'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontWeight: 700,
                fontSize: '17px',
                letterSpacing: '-0.015em',
                color: '#ffffff'
              }}
            >
              Comércio
            </div>
            <div
              style={{
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#64748b'
              }}
            >
              Área interna
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '4px 16px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          {visibleNav.map(item => {
            const isActive = activeTab === item.id;
            const isHovered = hoveredNav === item.id && !isActive;
            const shape = shapes[item.shape];

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                onMouseEnter={() => setHoveredNav(item.id)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  width: '100%',
                  border: 0,
                  background: isHovered ? 'rgba(148,163,184,0.14)' : 'transparent',
                  borderRadius: '999px',
                  padding: '8px 12px 8px 8px',
                  textAlign: 'left',
                  color: isActive || isHovered ? '#ffffff' : '#cbd5e1',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: accentColor,
                      borderRadius: '999px',
                      boxShadow: `0 12px 24px ${accentGlow}`
                    }}
                  />
                )}
                <span
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    color: isActive ? '#ffffff' : 'inherit'
                  }}
                >
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '999px',
                      background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(148,163,184,0.16)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none'
                    }}
                  >
                    <span
                      style={{
                        width: '9px',
                        height: '9px',
                        background: isActive ? '#ffffff' : '#94a3b8',
                        borderRadius: shape.iconRadius,
                        transform: shape.iconRotate
                      }}
                    />
                  </span>
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    style={{
                      position: 'relative',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '999px',
                      padding: '2px 9px',
                      background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(148,163,184,0.16)',
                      color: isActive ? '#ffffff' : '#94a3b8'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* IMPORT FOOTER CARD (visible if user can access importacao) */}
        {canAccess(userRole, 'importacao') && (
          <div style={{ padding: '14px 22px 24px 22px', flex: 'none' }}>
            <div
              style={{
                background: 'rgba(148,163,184,0.12)',
                borderRadius: '20px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px'
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: accentOnDark
                }}
              >
                Importação
              </div>
              <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
                2 planilhas na fila de processamento agora.
              </div>
              <button
                onClick={() => setActiveTab('importacao')}
                style={{
                  marginTop: '4px',
                  alignSelf: 'flex-start',
                  border: 0,
                  background: accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Ver fila
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: 'rgba(248,250,252,0.9)',
            backdropFilter: 'blur(10px)',
            padding: '22px 44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div
              style={{
                fontSize: '10.5px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: accentColor,
                fontWeight: 600
              }}
            >
              Comércio SaaS · Área interna
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontWeight: 600,
                fontSize: '16px',
                color: '#334155'
              }}
            >
              {activeItem.label}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Live Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                borderRadius: '999px',
                padding: '8px 15px 8px 12px',
                boxShadow: '0 12px 30px rgba(2,6,23,0.05)'
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  animation: 'pulseDot 1.8s ease-in-out infinite'
                }}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Ao vivo</span>
            </div>

            {/* Quick search button */}
            <button
              style={{
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                borderRadius: '999px',
                padding: '9px 18px',
                fontSize: '12.5px',
                fontWeight: 500,
                color: accentColor,
                cursor: 'pointer'
              }}
            >
              Buscar
            </button>

            <div style={{ width: '1px', height: '28px', background: '#e2e8f0' }} />

            {/* User Profile (Real Production Info - Read-only) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{userName}</div>
                <div style={{ fontSize: '9.5px', letterSpacing: '0.14em', color: accentColor, fontWeight: 600 }}>
                  {userRole}
                </div>
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '999px',
                  background: accentSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontWeight: 600,
                  fontSize: '14px',
                  color: accentHover
                }}
              >
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main style={{ flex: 1, padding: '14px 44px 56px 44px', display: 'flex', flexDirection: 'column', gap: '34px' }}>
          {children}
        </main>
      </div>

      {/* DEV TOOLBAR — Only rendered in development mode (import.meta.env.DEV) for testing permissions & themes */}
      {isDev && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '8px'
          }}
        >
          {devMenuOpen && (
            <div
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 20px 45px rgba(2,6,23,0.4)',
                border: '1px solid #334155',
                minWidth: '220px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '8px' }}>
                  Simular Papel (RBAC DEV)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {roles.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        if (setUserRole) setUserRole(r);
                      }}
                      style={{
                        border: 0,
                        background: userRole === r ? accentColor : 'rgba(255,255,255,0.06)',
                        color: '#ffffff',
                        fontWeight: userRole === r ? 600 : 400,
                        padding: '6px 10px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {r} {userRole === r && '✓'}
                    </button>
                  ))}
                </div>
              </div>

              {setAccentColor && (
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '6px' }}>
                    Cor do Tema
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {accents.map(acc => (
                      <button
                        key={acc.value}
                        title={acc.label}
                        onClick={() => setAccentColor(acc.value)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: acc.value,
                          border: accentColor === acc.value ? '2px solid #ffffff' : 'none',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setDevMenuOpen(!devMenuOpen)}
            style={{
              border: 0,
              background: '#0f172a',
              color: '#38bdf8',
              borderRadius: '999px',
              padding: '8px 16px',
              fontSize: '11.5px',
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🛠 DEV RBAC: {userRole}</span>
          </button>
        </div>
      )}
    </div>
  );
}
