// =============================================================
//  CONFIGURAÇÃO DO PEDIDO — edite só este arquivo
// =============================================================
window.CONFIG = {
  TITULO: "Novo Manto Avia Mininu",

  // Cole aqui a URL do Apps Script (veja o README).
  // Enquanto estiver vazio, o site funciona em "modo demonstração"
  // (os pedidos ficam salvos só no seu navegador).
  API_URL: "",

  // Prazo para pedidos (horário de Brasília)
  PRAZO: "2026-11-12T23:59:59-03:00", // fim do dia 12/11 (meia-noite)

  // Preços (valem para todos os tipos)
  PRECO_NORMAL: 50,
  PRECO_DESCONTO: 45,
  // Adicional por camisa com nome personalizado
  PRECO_NOME: 10,
  // A partir de quantas camisas NO TOTAL DO GRUPO o preço cai
  MINIMO_DESCONTO: 30,

  // Pagamento via Pix (deixe vazio até ter a chave)
  PIX_CHAVE: "c49b6398-01d4-4419-835b-cbba98f98521",
  PIX_NOME: "Jeffter Cleber Rios Ferreira", // nome de quem recebe

  // WhatsApp de quem organiza, só números com DDI e DDD (ex: "5583999999999").
  // Se preenchido, aparece um botão para a pessoa mandar o comprovante.
  WHATSAPP_ORGANIZADOR: "5579999286884",

  TIPOS: [
    { id: "Tradicional", descricao: "Com mangas", icone: "tradicional", tamanhos: ["P", "M", "G", "GG", "XGG"] },
    { id: "Baby Look", descricao: "Corte feminino", icone: "babylook", tamanhos: ["P", "M", "G", "GG", "XGG"] },
    { id: "Regata", descricao: "Sem mangas", icone: "regata", tamanhos: ["P", "M", "G", "GG", "XGG"] },
    {
      id: "Infantil",
      descricao: "Para crianças",
      icone: "infantil",
      tamanhos: ["2 anos", "4 anos", "6 anos", "8 anos", "10 anos", "12 anos (PP)"],
    },
  ],
};
