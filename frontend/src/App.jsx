import React, { useEffect, useState } from 'react';
import Layout from './components/Layout';
import AuthView from './views/AuthView';
import DashboardRealView from './views/DashboardRealView';
import PdvView from './views/PdvView';
import ImportView from './views/ImportView';
import ProductsView from './views/ProductsView';
import OrdersView from './views/OrdersView';
import CashierView from './views/CashierView';
import SettingsView from './views/SettingsView';
import { canAccess, can, mapBackendRole } from './utils/permissions';
import { getToken, fetchCurrentUser, clearSession } from './utils/auth.js';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('Helena Braga');
  const [userRole, setUserRole] = useState('ADMIN');
  const [accentColor, setAccentColor] = useState('#2563eb');

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentSoft = mix(11, '#ffffff');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetchCurrentUser(token)
      .then(user => {
        if (user) {
          setUserName(user.name || '');
          setUserRole(mapBackendRole(user.role));
          setIsAuthenticated(true);
        } else {
          clearSession();
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <AuthView
        accentColor={accentColor}
        onLoginSuccess={data => {
          setUserName(data.name || 'Helena Braga');
          setUserRole(data.role || 'ADMIN');
          setIsAuthenticated(true);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  const hasAccess = canAccess(userRole, activeTab);
  const canEditProduct = can(userRole, 'produto.editar');

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userName={userName}
      userRole={userRole}
      setUserRole={setUserRole}
      accentColor={accentColor}
      setAccentColor={setAccentColor}
    >
      {!hasAccess ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '56px',
            boxShadow: '0 24px 55px rgba(2,6,23,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            textAlign: 'center'
          }}
        >
          <span
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '999px',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{ width: '14px', height: '14px', background: '#b91c1c', borderRadius: '2px', transform: 'rotate(45deg)' }} />
          </span>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '26px', color: '#334155' }}>
            Sem permissão
          </h2>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#94a3b8', maxWidth: '380px', lineHeight: 1.6 }}>
            O papel {userRole} não tem acesso a esta área. Fale com um administrador do estabelecimento.
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <DashboardRealView accentColor={accentColor} />
          )}

          {activeTab === 'pdv' && <PdvView accentColor={accentColor} />}

          {activeTab === 'importacao' && <ImportView accentColor={accentColor} />}

          {activeTab === 'produtos' && (
            <ProductsView
              accentColor={accentColor}
              canEdit={canEditProduct}
              onNavigateTab={tab => setActiveTab(tab)}
            />
          )}

          {activeTab === 'pedidos' && <OrdersView accentColor={accentColor} />}

          {activeTab === 'caixa' && (
            <CashierView accentColor={accentColor} userName={userName} />
          )}

          {activeTab === 'configuracoes' && (
            <SettingsView
              accentColor={accentColor}
              userRole={userRole}
              userName={userName}
            />
          )}
        </>
      )}
    </Layout>
  );
}
