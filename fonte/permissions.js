/* Fonte ÚNICA de verdade da matriz de permissão da área interna.
   Carregado via <script src="./permissions.js"> no <helmet> de cada fase.
   Nenhum arquivo de tela deve redeclarar a matriz localmente. */
(function (g) {
  var MODULES = ["dashboard", "pedidos", "pdv", "produtos", "importacao", "caixa", "configuracoes"];

  var ROLE_MODULES = {
    ADMIN:    ["dashboard", "pedidos", "pdv", "produtos", "importacao", "caixa", "configuracoes"],
    VENDEDOR: ["dashboard", "pedidos", "pdv", "produtos", "configuracoes"],
    PDV:      ["pedidos", "pdv", "configuracoes"],
    CAIXA:    ["dashboard", "pedidos", "caixa", "configuracoes"]
  };

  /* Ações sensíveis — separadas do acesso ao módulo. */
  var ROLE_ACTIONS = {
    ADMIN:    ["produto.criar", "produto.editar", "produto.excluir", "equipe.convidar", "conta.encerrar", "caixa.fechar", "importacao.enviar"],
    VENDEDOR: ["produto.criar", "produto.editar", "importacao.enviar"],
    PDV:      [],
    CAIXA:    ["caixa.fechar"]
  };

  function modulesFor(role) {
    return ROLE_MODULES[role] || ROLE_MODULES.ADMIN;
  }
  function canAccess(role, moduleId) {
    return modulesFor(role).indexOf(moduleId) !== -1;
  }
  function can(role, action) {
    return (ROLE_ACTIONS[role] || ROLE_ACTIONS.ADMIN).indexOf(action) !== -1;
  }

  g.AuroraPerms = {
    MODULES: MODULES,
    ROLE_MODULES: ROLE_MODULES,
    ROLE_ACTIONS: ROLE_ACTIONS,
    modulesFor: modulesFor,
    canAccess: canAccess,
    can: can
  };
})(typeof window !== "undefined" ? window : globalThis);
