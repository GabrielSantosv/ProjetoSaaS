/* Fonte ÚNICA de verdade da matriz de permissão da área interna.
   Nenhum arquivo de tela deve redeclarar a matriz localmente. */
export const MODULES = ["dashboard", "pedidos", "pdv", "produtos", "importacao", "caixa", "configuracoes"];

export const ROLE_MODULES = {
  ADMIN:    ["dashboard", "pedidos", "pdv", "produtos", "importacao", "caixa", "configuracoes"],
  VENDEDOR: ["dashboard", "pedidos", "pdv", "produtos", "configuracoes"],
  PDV:      ["pedidos", "pdv", "configuracoes"],
  CAIXA:    ["dashboard", "pedidos", "caixa", "configuracoes"]
};

/* Ações sensíveis — separadas do acesso ao módulo. */
export const ROLE_ACTIONS = {
  ADMIN:    ["produto.criar", "produto.editar", "produto.excluir", "equipe.convidar", "conta.encerrar", "caixa.fechar", "importacao.enviar"],
  VENDEDOR: ["produto.criar", "produto.editar", "importacao.enviar"],
  PDV:      [],
  CAIXA:    ["caixa.fechar"]
};

/* Papel retornado pelo backend (enum Role.java) -> chave de papel usada
   aqui no frontend. ROLE_USER não tem um módulo "PDV" dedicado no
   backend hoje, mas é o papel de menor privilégio disponível, então é
   o destino do mapeamento. */
export const ROLE_BACKEND_TO_FRONTEND = {
  ROLE_ADMIN: "ADMIN",
  ROLE_SELLER: "VENDEDOR",
  ROLE_CASHIER: "CAIXA",
  ROLE_USER: "PDV"
};

/* Papel de menor privilégio — usado como fallback seguro sempre que um
   valor de papel não é reconhecido (nunca cair em ADMIN por padrão). */
const LEAST_PRIVILEGED_ROLE = "PDV";

export function mapBackendRole(backendRole) {
  return ROLE_BACKEND_TO_FRONTEND[backendRole] || LEAST_PRIVILEGED_ROLE;
}

export function modulesFor(role) {
  return ROLE_MODULES[role] || ROLE_MODULES[LEAST_PRIVILEGED_ROLE];
}

export function canAccess(role, moduleId) {
  return modulesFor(role).indexOf(moduleId) !== -1;
}

export function can(role, action) {
  return (ROLE_ACTIONS[role] || ROLE_ACTIONS[LEAST_PRIVILEGED_ROLE]).indexOf(action) !== -1;
}

export const AuroraPerms = {
  MODULES,
  ROLE_MODULES,
  ROLE_ACTIONS,
  ROLE_BACKEND_TO_FRONTEND,
  mapBackendRole,
  modulesFor,
  canAccess,
  can
};

export default AuroraPerms;
