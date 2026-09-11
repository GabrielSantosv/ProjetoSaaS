# O que tem nesta pasta

Cópia byte-a-byte dos arquivos-fonte do projeto. Nada aqui foi reescrito,
resumido ou traduzido. Se você abrir qualquer `.dc.html` num navegador com
esta pasta inteira ao lado, a tela roda — é o mesmo arquivo que a
pré-visualização executa.

## Arquivos

| Arquivo | O que é |
|---|---|
| `Fase 1 - Casco Interno.dc.html` | primeira versão do casco (sidebar + header + dashboard) |
| `Fase 1 - Casco Interno v2.dc.html` | revisão do casco |
| `Fase 2 - PDV e Importacao.dc.html` | mapa de mesas, comanda, fila de importação CSV, relatório de erros |
| `Fase 3 - Produtos e Pedidos.dc.html` | listagem+filtro+paginação, form de produto, detalhe de pedido |
| `Fase 4 - Caixa e Dashboard.dc.html` | conciliação de caixa, histórico de fechamentos, gráficos |
| `Fase 5 - Acesso e Configuracoes.dc.html` | login/cadastro/recuperação, abas de configurações, sessões |
| `Fase 6 - Vitrine Publica.dc.html` | loja pública: grid, detalhe, carrinho, checkout, confirmação |
| `Canvas.dc.html` | página que agrupa as opções apresentadas |
| `permissions.js` | matriz de permissão (fonte única de verdade) |
| `money.js` | parser de valor monetário pt-BR |
| `image-slot.js` | componente de placeholder de imagem |
| `support.js` | runtime da ferramenta — necessário pra abrir os `.dc.html` |

## Estrutura de um `.dc.html`

NÃO é React/JSX. É um formato próprio da ferramenta, com três partes:

### 1. Template — entre `<x-dc>` e `</x-dc>`

HTML com marcação própria:

- `{{ caminho.pontilhado }}` — buraco de valor. Só caminho, nunca expressão.
- `<sc-if value="{{ flag }}">…</sc-if>` — condicional.
- `<sc-for list="{{ arr }}" as="item">…</sc-for>` — repetição; `$index` no escopo.
- `style-hover` / `style-focus` / `style-active` — pseudo-estados inline.
- `onClick="{{ handler }}"` — o buraco entrega a própria função.
- Todo o estilo é inline. Não há folhas de estilo nem classes.

### 2. Lógica — `<script type="text/x-dc" data-dc-script>`

```js
class Component extends DCLogic {
  state = { … };
  componentDidMount() { … }
  renderVals() { return { …valores que o template consome… }; }
}
```

É praticamente um class component do React sem `render()`: tem `this.state`,
`this.setState`, `this.props`, ciclo de vida. O que `renderVals()` devolve é o
que os `{{ }}` do template leem, por nome.

### 3. Props — atributo `data-props` (JSON, HTML-escapado)

Define os controles que aparecem no painel de ajustes: `userName` (texto),
`userRole` (enum ADMIN/VENDEDOR/PDV/CAIXA), `accentColor` (cor),
`rowsPerPage` (int), etc. O `default` só semeia o editor — o código lê com
`this.props.x ?? fallback`.

## Se o objetivo é portar pra React

O caminho de conversão, arquivo por arquivo:

1. `renderVals()` → corpo de um componente funcional; `this.state` → `useState`;
   `componentDidMount`/`WillUnmount` → `useEffect`.
2. Template → JSX: `{{ x }}` → `{x}`, `<sc-if value="{{ a }}">` → `{a && (…)}`,
   `<sc-for list="{{ l }}" as="i">` → `{l.map(i => …)}`, `style="a: b"` →
   `style={{ a: 'b' }}`, `style-hover` → CSS-in-JS ou classe.
3. `data-props` → interface de props do componente.
4. `permissions.js` e `money.js` → copiar como estão (JS puro, sem dependência
   da ferramenta); trocar o IIFE em `window` por `export`.
5. Os arrays `PRODUCTS`, `ORDERS`, `CATALOG`, `EXPECTED`, `ALL_CLOSINGS` →
   fixtures/seed, ou substituir pelas chamadas reais da API.

Nenhum passo acima está feito nesta pasta. O que está aqui é a origem, crua.
