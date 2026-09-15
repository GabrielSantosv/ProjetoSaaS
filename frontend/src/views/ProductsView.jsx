import React, { useState, useEffect, useMemo } from 'react';
import StatusBadge from '../components/StatusBadge';
import { parseBRL, cents } from '../utils/money';
import { createSnapshot, applySnapshot } from '../utils/formSnapshot';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';

const STATUS_TO_LABEL = { ACTIVE: 'Ativo', OUT_OF_STOCK: 'Sem estoque', DRAFT: 'Rascunho', INACTIVE: 'Inativo' };
const LABEL_TO_STATUS = { Ativo: 'ACTIVE', 'Sem estoque': 'OUT_OF_STOCK', Rascunho: 'DRAFT', Inativo: 'INACTIVE' };

function formatDecimalString(brlInput) {
  return (cents(brlInput) / 100).toFixed(2);
}

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

function mapProductFromApi(p) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    cat: p.categoryName || '',
    price: Number(p.price),
    cost: Number(p.cost),
    stock: p.stockQuantity,
    status: STATUS_TO_LABEL[p.status] || 'Rascunho',
    description: p.description || ''
  };
}

const EMPTY_FORM = {
  name: '',
  sku: '',
  desc: '',
  price: '0,00',
  cost: '0,00',
  stock: '0',
  category: 'Pratos',
  status: 'Ativo'
};

export default function ProductsView({
  accentColor = '#2563eb',
  canEdit = true,
  onNavigateTab
}) {
  const [products, setProducts] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [counts, setCounts] = useState({});
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [categories, setCategories] = useState([]);

  const [view, setView] = useState('list'); // 'list' | 'form'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [savedFormState, setSavedFormState] = useState(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const perPage = 6;

  const [form, setForm] = useState(EMPTY_FORM);

  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [skuError, setSkuError] = useState(null);

  const mix = (pct, other) => `color-mix(in oklab, ${accentColor} ${pct}%, ${other})`;
  const accentHover = mix(85, '#0f172a');
  const accentSoft = mix(11, '#ffffff');
  const accentGlow = `color-mix(in oklab, ${accentColor} 32%, transparent)`;

  const brl = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const initials = s => String(s || '').replace(/[#]/g, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // ESC key for discard modal
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape' && pendingNav) {
        setPendingNav(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingNav]);

  // Debounce da busca em tempo real: evita disparar uma requisição a cada tecla
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Volta pra primeira página sempre que o filtro efetivo (busca ou status) muda
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filter]);

  useEffect(() => {
    apiRequest('/api/v1/categories')
      .then(data => setCategories(data || []))
      .catch(() => {});
  }, []);

  const categoryNameToId = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.name] = c.id;
    });
    return map;
  }, [categories]);

  // Listagem paginada no servidor — busca e status também filtram no backend,
  // e cada troca de página cancela a requisição anterior ainda em voo.
  useEffect(() => {
    const controller = new AbortController();
    setLoadingList(true);
    setListError(null);

    const params = new URLSearchParams();
    params.set('page', String(page - 1));
    params.set('size', String(perPage));
    if (debouncedQuery) params.set('search', debouncedQuery);
    if (filter !== 'Todos') params.set('status', LABEL_TO_STATUS[filter]);

    apiRequest(`/api/v1/products?${params.toString()}`, { signal: controller.signal })
      .then(data => {
        setProducts((data.page.content || []).map(mapProductFromApi));
        setTotalElements(data.page.totalElements);
        setTotalPages(Math.max(1, data.page.totalPages));
        setCounts(data.counts || {});
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setListError(err.message || 'Não foi possível carregar os produtos agora.');
      })
      .finally(() => {
        // Uma requisição cancelada (StrictMode remontando o efeito, ou o usuário trocando
        // o filtro rápido) nunca pode desligar o loading — só quem ainda está "vivo" pode,
        // senão a tela pisca "Nada encontrado" com contagem zerada antes do fetch real chegar.
        if (!controller.signal.aborted) setLoadingList(false);
      });

    return () => controller.abort();
  }, [page, debouncedQuery, filter, refreshTick]);

  // Se o filtro atual reduzir o total de páginas abaixo da página em que o usuário está
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const editField = patch => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const openForm = prod => {
    const initialValues = prod
      ? {
          name: prod.name,
          sku: prod.sku,
          desc: prod.description || '',
          price: brl(prod.price).replace('R$ ', ''),
          cost: brl(prod.cost).replace('R$ ', ''),
          stock: String(prod.stock),
          category: prod.cat || 'Pratos',
          status: prod.status
        }
      : { ...EMPTY_FORM };

    setSelectedProduct(prod || null);
    setForm(initialValues);
    setSavedFormState(createSnapshot(initialValues));
    setDirty(false);
    setSaveError(null);
    setSkuError(null);
    setView('form');
  };

  const handleBackToList = () => {
    if (dirty) {
      setPendingNav({ type: 'view', target: 'list' });
      return;
    }
    setView('list');
  };

  const confirmDiscard = () => {
    if (savedFormState) {
      setForm(applySnapshot(savedFormState)); // Revert to exact saved data via applySnapshot!
    }
    setDirty(false);
    if (pendingNav) {
      if (pendingNav.type === 'view') {
        setView(pendingNav.target);
      } else if (pendingNav.type === 'tab' && onNavigateTab) {
        onNavigateTab(pendingNav.target);
      }
      setPendingNav(null);
    }
  };

  const handleSaveProduct = async () => {
    if (saving) return; // Prevent double/triple clicks
    setSaving(true);
    setSaveError(null);
    setSkuError(null);

    try {
      let categoryId = categoryNameToId[form.category];
      if (!categoryId) {
        const newCategory = await apiRequest('/api/v1/categories', {
          method: 'POST',
          body: JSON.stringify({ name: form.category, description: '' })
        });
        categoryId = newCategory.id;
        setCategories(prev => [...prev, newCategory]);
      }

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        price: formatDecimalString(form.price),
        // No update, o backend ignora stockQuantity (ver ProductServiceImpl.updateProduct) \u2014
        // o ajuste real de estoque vai sempre pela chamada at\u00F4mica separada, abaixo.
        stockQuantity: selectedProduct ? selectedProduct.stock : (parseInt(form.stock, 10) || 0),
        categoryId,
        cost: formatDecimalString(form.cost),
        status: LABEL_TO_STATUS[form.status],
        description: form.desc
      };

      let response;
      if (selectedProduct) {
        response = await apiRequest(`/api/v1/products/${selectedProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        const newStock = parseInt(form.stock, 10) || 0;
        const delta = newStock - selectedProduct.stock;
        if (delta !== 0) {
          response = await apiRequest(`/api/v1/products/${selectedProduct.id}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({ deltaQuantity: delta })
          });
        }
      } else {
        response = await apiRequest('/api/v1/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      const saved = mapProductFromApi(response);
      setProducts(prev => (selectedProduct ? prev.map(p => (p.id === saved.id ? saved : p)) : [saved, ...prev]));

      const savedFormValues = {
        name: saved.name,
        sku: saved.sku,
        desc: saved.description,
        price: brl(saved.price).replace('R$ ', ''),
        cost: brl(saved.cost).replace('R$ ', ''),
        stock: String(saved.stock),
        category: saved.cat,
        status: saved.status
      };
      setForm(savedFormValues);
      setSavedFormState(createSnapshot(savedFormValues));
      setDirty(false);
      setRefreshTick(t => t + 1);
      setView('list');
    } catch (err) {
      // Conflito de SKU duplicado \u00E9 rejeitado pelo backend como 400 (BusinessException),
      // n\u00E3o 409 \u2014 a checagem de unicidade roda em mem\u00F3ria antes da constraint do banco.
      // Detecta pelo conte\u00FAdo da mensagem (controlada por n\u00F3s) em vez do status HTTP.
      if (err.status === 409 || (err.status === 400 && /sku/i.test(err.message || ''))) {
        setSkuError('Este SKU j\u00E1 est\u00E1 em uso');
      } else {
        setSaveError(err.message || 'N\u00E3o foi poss\u00EDvel salvar o produto agora.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Chips de filtro \u2014 contagens v\u00EAm agregadas do backend (mesmo filtro de busca da p\u00E1gina atual)
  const filterDefs = ['Todos', 'Ativo', 'Sem estoque', 'Rascunho', 'Inativo'];
  const filterCounts = {
    Todos: counts.TOTAL || 0,
    Ativo: counts.ACTIVE || 0,
    'Sem estoque': counts.OUT_OF_STOCK || 0,
    Rascunho: counts.DRAFT || 0,
    Inativo: counts.INACTIVE || 0
  };

  const pagedRows = products;
  const validPage = Math.min(page, totalPages);

  const exportCSV = async () => {
    if (totalElements === 0 || exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '0');
      params.set('size', String(totalElements));
      if (debouncedQuery) params.set('search', debouncedQuery);
      if (filter !== 'Todos') params.set('status', LABEL_TO_STATUS[filter]);

      const data = await apiRequest(`/api/v1/products?${params.toString()}`);
      const rows = (data.page.content || []).map(mapProductFromApi);

      const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
      const head = 'sku;nome;categoria;preco_venda;preco_custo;estoque;situacao\n';
      const body = rows
        .map(r => [r.sku, r.name, r.cat, brl(r.price).replace('R$ ', ''), brl(r.cost).replace('R$ ', ''), r.stock, r.status].map(esc).join(';'))
        .join('\n');

      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob(['\uFEFF' + head + body], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `produtos-${stamp}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setListError('N\u00E3o foi poss\u00EDvel exportar o CSV agora. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  // Form price and margin calculation using money.js parseBRL
  const priceNum = parseBRL(form.price);
  const costNum = parseBRL(form.cost);
  const marginPct = priceNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : 0;
  const catList = ['Pratos', 'Entradas', 'Bebidas', 'Sobremesas', 'Acompanhamentos'];
  const statusList = ['Ativo', 'Rascunho', 'Inativo'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* DISCARD CHANGES MODAL */}
      {pendingNav && (
        <div
          onClick={() => setPendingNav(null)}
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
            <span style={{ width: '42px', height: '42px', borderRadius: '999px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#b45309' }} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '23px', letterSpacing: '-0.02em', color: '#1e293b' }}>
                Descartar as alterações?
              </h2>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b' }}>
                Você editou este produto e ainda não salvou. Sair agora perde o que foi digitado.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={() => setPendingNav(null)}
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
                Descartar e sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
          <div style={{ fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
            {view === 'form' ? 'Produtos · edição' : 'Catálogo'}
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
            {view === 'form' ? (selectedProduct ? 'Editar produto' : 'Novo produto') : 'Produtos'}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#64748b' }}>
            {view === 'form'
              ? 'Alterações aqui refletem no PDV e na vitrine. Produtos vindos de CSV mantêm vínculo com o arquivo de origem.'
              : 'Catálogo unificado entre salão, delivery e vitrine pública. Filtro e paginação são o mesmo componente usado em Pedidos.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canEdit ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              {view === 'list' ? (
                <>
                  <button
                    onClick={exportCSV}
                    disabled={totalElements === 0 || exporting}
                    style={{
                      border: `1px solid ${totalElements === 0 ? '#e2e8f0' : '#bfdbfe'}`,
                      background: '#ffffff',
                      color: totalElements === 0 ? '#cbd5e1' : accentColor,
                      borderRadius: '999px',
                      padding: '12px 22px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: totalElements === 0 || exporting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Exportar CSV ({totalElements})
                  </button>
                  <button
                    onClick={() => openForm(null)}
                    style={{
                      border: 0,
                      background: accentColor,
                      color: '#ffffff',
                      borderRadius: '999px',
                      padding: '12px 24px',
                      fontSize: '13px',
                      fontWeight: 500,
                      boxShadow: `0 14px 28px ${accentGlow}`,
                      cursor: 'pointer'
                    }}
                  >
                    Novo produto
                  </button>
                </>
              ) : (
                <button
                  onClick={handleBackToList}
                  style={{
                    border: '1px solid #bfdbfe',
                    background: '#ffffff',
                    color: accentColor,
                    borderRadius: '999px',
                    padding: '12px 22px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Voltar à lista
                </button>
              )}
            </div>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, borderRadius: '999px', padding: '9px 16px', background: '#f1f5f9', color: '#475569' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
              Somente leitura
            </span>
          )}
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* SEARCH & FILTERS BAR */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '20px 24px', boxShadow: '0 24px 55px rgba(2,6,23,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', borderRadius: '999px', padding: '10px 16px', flex: '1 1 260px', minWidth: '220px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', border: `2px solid ${accentColor}` }} />
              </span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nome, SKU ou categoria"
                style={{ border: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: '13.5px', color: '#334155' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filterDefs.map(f => {
                const on = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setPage(1);
                    }}
                    style={{
                      border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                      background: on ? accentSoft : '#ffffff',
                      color: on ? accentHover : '#475569',
                      borderRadius: '999px',
                      padding: '9px 16px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {f}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '999px',
                        padding: '1px 7px',
                        background: on ? '#ffffff' : '#f1f5f9',
                        color: on ? accentHover : '#94a3b8'
                      }}
                    >
                      {filterCounts[f] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1 }} />
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              {totalElements} produtos
            </div>
          </div>

          {/* PRODUCTS TABLE */}
          <div style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Produto</th>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Categoria</th>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Estoque</th>
                    <th style={{ textAlign: 'left', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '13px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: '#f8fafc', whiteSpace: 'nowrap' }}>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => openForm(r)}
                      style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '15px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                          <span
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '999px',
                              background: accentSoft,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: 'none',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              color: accentHover
                            }}
                          >
                            {initials(r.name)}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>{r.name}</span>
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{r.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '15px 20px', color: '#475569', whiteSpace: 'nowrap' }}>{r.cat}</td>
                      <td style={{ padding: '15px 20px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.stock} un. em estoque</td>
                      <td style={{ padding: '15px 20px' }}>
                        <StatusBadge status={r.status} accentSoft={accentSoft} accentHover={accentHover} />
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1e293b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {brl(r.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loadingList && listError && (
              <div style={{ padding: '48px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: '12px', height: '12px', background: '#b91c1c', borderRadius: '2px', transform: 'rotate(45deg)' }} />
                </span>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                  Não foi possível carregar
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  {listError}
                </div>
              </div>
            )}

            {loadingList && products.length === 0 && !listError && (
              <div style={{ padding: '48px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: '12px', height: '12px', background: accentColor, borderRadius: '2px', transform: 'rotate(45deg)' }} />
                </span>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                  Carregando produtos…
                </div>
              </div>
            )}

            {!loadingList && !listError && totalElements === 0 && (
              <div style={{ padding: '48px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                <span style={{ width: '46px', height: '46px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: '12px', height: '12px', background: accentColor, borderRadius: '2px', transform: 'rotate(45deg)' }} />
                </span>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '19px', color: '#334155' }}>
                  Nada encontrado
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Ajuste a busca ou limpe os filtros aplicados.
                </div>
              </div>
            )}

            <div style={{ padding: '16px 24px', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
              <span>
                {totalElements === 0
                  ? 'Nenhum resultado'
                  : `Mostrando ${(validPage - 1) * perPage + 1}–${Math.min(validPage * perPage, totalElements)} de ${totalElements}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={validPage <= 1}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: validPage > 1 ? '#475569' : '#cbd5e1',
                    cursor: validPage > 1 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={{
                      border: n === validPage ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                      background: n === validPage ? accentColor : '#ffffff',
                      color: n === validPage ? '#ffffff' : '#475569',
                      borderRadius: '999px',
                      minWidth: '36px',
                      height: '36px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={validPage >= totalPages}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: validPage < totalPages ? '#475569' : '#cbd5e1',
                    cursor: validPage < totalPages ? 'pointer' : 'not-allowed'
                  }}
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT FORM VIEW */}
      {view === 'form' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* FORM FIELDS */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '26px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Identificação
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Nome do produto</span>
                  <input
                    value={form.name}
                    onChange={e => editField({ name: e.target.value })}
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>SKU</span>
                  <input
                    value={form.sku}
                    onChange={e => {
                      editField({ sku: e.target.value });
                      setSkuError(null);
                    }}
                    style={{ border: `1px solid ${skuError ? '#fecaca' : '#e2e8f0'}`, background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                  />
                  {skuError && (
                    <span style={{ fontSize: '11.5px', color: '#b91c1c' }}>{skuError}</span>
                  )}
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Descrição</span>
                <textarea
                  value={form.desc}
                  onChange={e => editField({ desc: e.target.value })}
                  rows={3}
                  style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
            </div>

            <div style={{ height: '1px', background: '#f1f5f9' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Preço e estoque
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Preço de venda (R$)</span>
                  <input
                    value={form.price}
                    onChange={e => editField({ price: e.target.value.replace(/[^\d.,]/g, '') })}
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Custo (R$)</span>
                  <input
                    value={form.cost}
                    onChange={e => editField({ cost: e.target.value.replace(/[^\d.,]/g, '') })}
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Estoque atual</span>
                  <input
                    value={form.stock}
                    onChange={e => editField({ stock: e.target.value.replace(/[^\d]/g, '').slice(0, 6) })}
                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ height: '1px', background: '#f1f5f9' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Categoria
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {catList.map(c => {
                  const on = form.category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => editField({ category: c })}
                      style={{
                        border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                        background: on ? accentSoft : '#ffffff',
                        color: on ? accentHover : '#475569',
                        borderRadius: '999px',
                        padding: '8px 16px',
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
            </div>

            <div style={{ height: '1px', background: '#f1f5f9' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
                Situação no catálogo
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {statusList.map(s => {
                  const b = StatusBadge({ status: s, accentSoft, accentHover });
                  const on = form.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => editField({ status: s })}
                      style={{
                        border: on ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                        background: on ? accentSoft : '#ffffff',
                        color: on ? accentHover : '#475569',
                        borderRadius: '999px',
                        padding: '8px 16px',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: on ? accentColor : '#94a3b8' }} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {saveError && (
              <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '12px 16px', fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving}
                style={{
                  border: 0,
                  background: saving ? accentHover : accentColor,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '14px 28px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  boxShadow: saving ? 'none' : `0 14px 28px ${accentGlow}`,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Salvando…' : 'Salvar produto'}
              </button>
              <button
                type="button"
                onClick={handleBackToList}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '999px',
                  padding: '14px 24px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>

          {/* PREVIEW CARD */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 24px 55px rgba(2,6,23,0.06)', display: 'flex', flexDirection: 'column', gap: '22px', position: 'sticky', top: '104px' }}>
            <div style={{ fontSize: '10.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: accentColor, fontWeight: 600 }}>
              Pré-visualização
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: '56px', height: '56px', borderRadius: '999px', background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: accentHover, flex: 'none' }}>
                {initials(form.name || 'Produto')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '20px', color: '#1e293b' }}>
                  {form.name || 'Nome do produto'}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {form.sku} · {form.category}
                </span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Preço de venda</span>
                <span style={{ fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{brl(priceNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Custo unitário</span>
                <span style={{ fontWeight: 500, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{brl(costNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Margem bruta</span>
                <span style={{ fontWeight: 600, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>
                  {priceNum > 0 ? `${marginPct}%` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Disponibilidade</span>
                <StatusBadge status={form.status} accentSoft={accentSoft} accentHover={accentHover} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
