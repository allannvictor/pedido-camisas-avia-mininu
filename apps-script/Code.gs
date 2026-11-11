/**
 * Backend do pedido de camisas — cole este código no Apps Script
 * da sua planilha (Extensões → Apps Script). Veja o README.
 */

// ====== CONFIGURAÇÃO ======
const PRAZO = new Date("2026-11-12T23:59:59-03:00"); // fim do dia 12/11, meia-noite (mesmo prazo do config.js)
const PRECO_NORMAL = 50;
const PRECO_DESCONTO = 45;
const MINIMO_DESCONTO = 30; // total do grupo a partir do qual vale o desconto
const PRECO_NOME = 10; // adicional por camisa com nome
const NOME_MAX = 15; // máximo de letras no nome da camisa
const AVISAR_POR_EMAIL = true; // manda um e-mail para você a cada pedido
const PASTA_COMPROVANTES = "Comprovantes - Novo Manto Avia Mininu"; // pasta criada no seu Google Drive
const COMPROVANTE_MAX_MB = 6;
const COMPROVANTE_TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" };

// Tipo de camisa → tamanhos (mesma lista do config.js)
const TAMANHOS = {
  "Tradicional": ["P", "M", "G", "GG", "XGG"],
  "Baby Look": ["P", "M", "G", "GG", "XGG"],
  "Regata": ["P", "M", "G", "GG", "XGG"],
  "Infantil": ["2 anos", "4 anos", "6 anos", "8 anos", "10 anos", "12 anos (PP)"],
};
const TIPOS = Object.keys(TAMANHOS);
// ==========================

const ABA_PEDIDOS = "Pedidos";
const ABA_RESUMO = "Resumo";
const ABA_FORNECEDOR = "Fornecedor";
const ABA_DEVOLUCOES = "Devoluções";
const CABECALHO = ["Data", "Pedido nº", "Nome", "Telefone", "Tipo", "Tamanho", "Qtd", "Nome na camisa", "Valor final", "Pago?", "Comprovante", "Observação", "Valor pago (Pix)", "A devolver"];
// colunas (1 = A): E=Tipo F=Tamanho G=Qtd H=Nome na camisa I=Valor final (preço atual)
// J=Pago? K=Comprovante L=Observação M=Valor pago (o que a pessoa pagou no Pix) N=A devolver (M - I)
const COL = { nome: 3, telefone: 4, tipo: 5, tamanho: 6, qtd: 7, nomeCamisa: 8, valor: 9, pago: 10, comprovante: 11, valorPago: 13, devolver: 14 };

/** Menu "Pedido" dentro da planilha (aparece na barra de menus, depois de "Ajuda"). */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Pedido")
    .addItem("Gerar relatório do fornecedor", "gerarRelatorioFornecedor")
    .addItem("Atualizar lista de devoluções", "gerarDevolucoes")
    .addSeparator()
    .addItem("Limpar todos os pedidos (zerar)", "limparPedidos")
    .addToUi();
}

// IMPORTANTE: as fórmulas não usam separador de argumentos ("," ou ";").
// Em planilhas em português o separador é ";" e em inglês é ",", e fórmulas com
// o separador errado dão "Erro de análise de fórmula" (#ERROR!). Por isso:
//   - SE(...) virou aritmética com comparações: (H2<>"") vale 1 ou 0;
//   - SOMASE virou SUMPRODUCT de um único argumento;
//   - o link do comprovante é um texto com link, sem fórmula HYPERLINK.
function formulaValor_(r) {
  return `=G${r}*(${ABA_RESUMO}!$B$2+${PRECO_NOME}*(H${r}<>""))`;
}
function formulaDevolver_(r) {
  return `=M${r}-I${r}`;
}
function linkComprovante_(url) {
  return SpreadsheetApp.newRichTextValue().setText("ver comprovante").setLinkUrl(url).build();
}

/** Rode esta função UMA vez pelo editor para criar as abas. */
function configurarPlanilha() {
  const ss = SpreadsheetApp.getActive();
  const p = ss.getSheetByName(ABA_PEDIDOS) || ss.insertSheet(ABA_PEDIDOS);
  p.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO])
    .setFontWeight("bold").setBackground("#0f1b3d").setFontColor("#ffffff");
  p.setFrozenRows(1);
  p.getRange("G:G").setNumberFormat("0");
  p.getRange("I:I").setNumberFormat("R$ #,##0.00");
  p.getRange("M:N").setNumberFormat("R$ #,##0.00");

  const r = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO);
  r.clear();
  r.getRange("A1:A7").setValues([
    ["Total de camisas"], ["Preço atual por camisa"], ["Camisas com nome"],
    ["Valor final (preço atual)"], ["Valor recebido (Pix)"], ["Total a devolver"], ["Saldo (recebido − devolver)"],
  ]);
  r.getRange("B1:B7").setFormulas([
    ["=SUM(Pedidos!G2:G)"],
    [`=${PRECO_NORMAL}-${PRECO_NORMAL - PRECO_DESCONTO}*(B1>=${MINIMO_DESCONTO})`],
    ['=SUMPRODUCT((Pedidos!H2:H<>"")*Pedidos!G2:G)'],
    ["=SUM(Pedidos!I2:I)"],
    ["=SUM(Pedidos!M2:M)"],
    ["=SUM(Pedidos!N2:N)"],
    ["=B5-B6"],
  ]);
  r.getRange("B2").setNumberFormat("R$ #,##0.00");
  r.getRange("B4:B7").setNumberFormat("R$ #,##0.00");
  r.getRange("A1:A7").setFontWeight("bold");
  r.getRange("A6:B6").setBackground("#fff4d6");
  r.getRange("A9").setValue("Quem devolver a quem: aba Devoluções (menu Pedido → Atualizar lista de devoluções). Relatório: menu Pedido → Gerar relatório do fornecedor").setFontStyle("italic");
  r.autoResizeColumns(1, 2);

  corrigirFormulasPedidos_(p);
  preencherValorPago_(p);
  atualizarDevolucoes_();
  pastaComprovantes_(); // cria a pasta no Drive (e pede a permissão do Drive)
  try { onOpen(); } catch (e) { /* rodando pelo editor: o menu aparece ao recarregar a planilha */ }
}

/**
 * Conserta as linhas já gravadas: regrava a fórmula de Valor e, onde a coluna
 * Comprovante estiver vazia ou com erro, refaz o link procurando o arquivo
 * "Pedido N - ..." na pasta de comprovantes do Drive.
 */
function corrigirFormulasPedidos_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const valores = [];
  for (let k = 0; k < n; k++) valores.push([formulaValor_(k + 2)]);
  sh.getRange(2, COL.valor, n, 1).setFormulas(valores);

  const ids = sh.getRange(2, 2, n, 1).getValues();
  const comp = sh.getRange(2, COL.comprovante, n, 1);
  const links = comp.getRichTextValues();
  const shown = comp.getDisplayValues();
  let arquivos = null; // id do pedido → url (carregado só se precisar)
  for (let k = 0; k < n; k++) {
    const temLink = links[k][0] && links[k][0].getLinkUrl();
    if (temLink && shown[k][0] !== "#ERROR!") continue;
    if (!arquivos) arquivos = mapaComprovantes_();
    const url = arquivos[String(ids[k][0])];
    if (url) sh.getRange(k + 2, COL.comprovante).setRichTextValue(linkComprovante_(url));
  }
}

/**
 * Pedidos gravados antes da coluna "Valor pago (Pix)" existir: considera que
 * pagaram o preço cheio (R$ 50 + R$ 10 por nome), que era o valor cobrado até
 * o grupo chegar a 30 camisas. Só preenche células vazias. Também regrava a
 * fórmula "A devolver" (= Valor pago − Valor final) em todas as linhas.
 */
function preencherValorPago_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const dados = sh.getRange(2, 1, n, CABECALHO.length).getValues();
  const pagos = dados.map((r) => {
    if (r[COL.valorPago - 1] !== "" && r[COL.valorPago - 1] !== null) return [r[COL.valorPago - 1]];
    const qtd = Number(r[COL.qtd - 1]) || 0;
    const temNome = String(r[COL.nomeCamisa - 1] || "").trim() !== "";
    return [qtd ? qtd * (PRECO_NORMAL + (temNome ? PRECO_NOME : 0)) : ""];
  });
  sh.getRange(2, COL.valorPago, n, 1).setValues(pagos);
  const devolver = [];
  for (let k = 0; k < n; k++) devolver.push([formulaDevolver_(k + 2)]);
  sh.getRange(2, COL.devolver, n, 1).setFormulas(devolver);
}

/** Menu: recria a aba Devoluções e avisa o total. */
function gerarDevolucoes() {
  const d = atualizarDevolucoes_();
  try {
    SpreadsheetApp.getUi().alert(
      d.total > 0
        ? `Aba "Devoluções" atualizada: ${d.pedidos.length} pedido(s), total a devolver R$ ${d.total.toFixed(2).replace(".", ",")}.`
        : "Nenhuma devolução pendente."
    );
  } catch (e) {}
}

/** Valor pago, valor final e diferença, por pedido. */
function devolucoesPorPedido_() {
  const linhas = lerItens_();
  const total = somar_(linhas);
  const preco = total >= MINIMO_DESCONTO ? PRECO_DESCONTO : PRECO_NORMAL;
  const mapa = {};
  linhas.forEach((l) => {
    const p = mapa[l.id] || (mapa[l.id] = { pedido: l.id, nome: l.nome, telefone: l.telefone, camisas: 0, pago: 0, final: 0, semValorPago: false });
    const final = l.qtd * (preco + (l.nomeCamisa ? PRECO_NOME : 0));
    p.camisas += l.qtd;
    p.final += final;
    if (l.valorPago === null) { p.pago += final; p.semValorPago = true; } else p.pago += l.valorPago;
  });
  return Object.values(mapa)
    .map((p) => ({ ...p, devolver: Math.round((p.pago - p.final) * 100) / 100 }))
    .sort((a, b) => a.pedido - b.pedido);
}

/**
 * Recria a aba Devoluções (só pedidos com valor a devolver), mantendo marcada a
 * caixinha "Devolvido?" de quem já recebeu.
 */
function atualizarDevolucoes_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(ABA_DEVOLUCOES) || ss.insertSheet(ABA_DEVOLUCOES);
  const jaDevolvido = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().forEach((r) => { if (r[7] === true) jaDevolvido[r[0]] = true; });
  }
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), 8).clearDataValidations();
  const cab = ["Pedido nº", "Nome", "Telefone", "Camisas", "Pagou", "Valor final", "A devolver", "Devolvido?"];
  sh.getRange(1, 1, 1, cab.length).setValues([cab])
    .setFontWeight("bold").setBackground("#0f1b3d").setFontColor("#ffffff");
  sh.setFrozenRows(1);

  const lista = devolucoesPorPedido_().filter((p) => p.devolver > 0);
  const total = lista.reduce((s, p) => s + p.devolver, 0);
  if (lista.length) {
    sh.getRange(2, 1, lista.length, 7).setValues(
      lista.map((p) => [p.pedido, "'" + p.nome, "'" + p.telefone, p.camisas, p.pago, p.final, p.devolver])
    );
    const caixas = sh.getRange(2, 8, lista.length, 1).insertCheckboxes();
    caixas.setValues(lista.map((p) => [jaDevolvido[p.pedido] === true]));
    sh.getRange(2, 5, lista.length, 3).setNumberFormat("R$ #,##0.00");
    const fim = lista.length + 2;
    sh.getRange(fim, 1, 1, 7).setValues([["TOTAL", "", "", lista.reduce((s, p) => s + p.camisas, 0), "", "", total]])
      .setFontWeight("bold").setBackground("#fff4d6");
    sh.getRange(fim, 7).setNumberFormat("R$ #,##0.00");
  } else {
    sh.getRange(2, 1).setValue("Nenhuma devolução pendente.");
  }
  sh.autoResizeColumns(1, 8);
  return { pedidos: lista, total };
}

function mapaComprovantes_() {
  const mapa = {};
  const it = pastaComprovantes_().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const m = f.getName().match(/^Pedido (\d+) - /);
    if (m && !mapa[m[1]]) mapa[m[1]] = f.getUrl();
  }
  return mapa;
}

/**
 * Zera o pedido para recomeçar (ex.: depois de testes): apaga as linhas da aba
 * Pedidos (mantém o cabeçalho), manda os comprovantes para a lixeira do Drive
 * (recuperáveis por 30 dias), volta a numeração para 1 e remove a aba Fornecedor.
 * Pede confirmação antes.
 */
function limparPedidos() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    "Limpar todos os pedidos?",
    "Isso apaga TODAS as linhas da aba Pedidos, manda os comprovantes para a lixeira do Drive " +
      "e volta a numeração para o pedido nº 1.\n\nUse só para apagar testes. Continuar?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(ABA_PEDIDOS);
    const n = sh.getLastRow() - 1;
    if (n > 0) {
      sh.getRange(2, 1, n, sh.getMaxColumns()).clearContent().clearDataValidations().setBackground(null);
    }

    let arquivos = 0;
    const it = pastaComprovantes_().getFiles();
    while (it.hasNext()) { it.next().setTrashed(true); arquivos++; }

    PropertiesService.getScriptProperties().deleteProperty("ultimoId");

    [ABA_FORNECEDOR, ABA_DEVOLUCOES].forEach((nome) => {
      const aba = ss.getSheetByName(nome);
      if (aba) ss.deleteSheet(aba);
    });

    SpreadsheetApp.flush();
    ui.alert(`Pronto! ${n > 0 ? n : 0} linha(s) apagada(s) e ${arquivos} comprovante(s) enviados para a lixeira. O próximo pedido será o nº 1.`);
  } finally {
    lock.releaseLock();
  }
}

function pastaComprovantes_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("pastaComprovantes");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* pasta apagada: cria outra */ }
  }
  const pasta = DriveApp.createFolder(PASTA_COMPROVANTES);
  props.setProperty("pastaComprovantes", pasta.getId());
  return pasta;
}

/** Valida e salva o comprovante no Drive. Retorna o arquivo ou lança erro com mensagem amigável. */
function salvarComprovante_(c, nome) {
  if (!c || !c.dados) throw new Error("Anexe o comprovante do Pix.");
  const ext = COMPROVANTE_TIPOS[c.tipo];
  if (!ext) throw new Error("Comprovante deve ser foto ou PDF.");
  const bytes = Utilities.base64Decode(c.dados);
  if (bytes.length > COMPROVANTE_MAX_MB * 1024 * 1024) throw new Error("Comprovante muito grande.");
  const limpo = nome.replace(/[\\/:*?"<>|]/g, "").slice(0, 60);
  const blob = Utilities.newBlob(bytes, c.tipo, `${limpo}.${ext}`);
  return pastaComprovantes_().createFile(blob);
}

/**
 * Cria/atualiza a aba "Fornecedor": uma linha por tipo + sem/com nome + tamanho,
 * e uma linha por camisa com nome (com o nome ao lado). Pronta para virar PDF.
 */
function gerarRelatorioFornecedor() {
  const ss = SpreadsheetApp.getActive();
  const linhas = lerItens_();
  const sh = ss.getSheetByName(ABA_FORNECEDOR) || ss.insertSheet(ABA_FORNECEDOR);
  sh.clear();

  const NC = 5; // colunas do relatório
  const out = [];
  const estilos = []; // [linha, estilo]
  const push = (row, estilo) => {
    out.push(row.concat(Array(NC - row.length).fill("")));
    if (estilo) estilos.push([out.length, estilo]);
  };

  const total = somar_(linhas);
  const totalNome = somar_(linhas.filter((l) => l.nomeCamisa));
  const naoPagas = somar_(linhas.filter((l) => !l.pago));
  push(["NOVO MANTO AVIA MININU — PEDIDO AO FORNECEDOR"], "titulo");
  push([`Gerado em ${Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}`]);
  push([`Total: ${total} camisa(s) — ${total - totalNome} sem nome e ${totalNome} com nome`], "negrito");
  if (naoPagas) push([`Atenção: ${naoPagas} camisa(s) são de pedidos com "Pago?" desmarcado e estão incluídas.`], "alerta");
  push([""]);

  // 1) Resumo por tipo
  push(["1. RESUMO POR TIPO"], "secao");
  push(["Tipo", "Sem nome", "Com nome", "Total"], "cabecalho");
  TIPOS.forEach((tipo) => {
    const doTipo = linhas.filter((l) => l.tipo === tipo);
    if (!doTipo.length) return;
    push([tipo.toUpperCase(), somar_(doTipo.filter((l) => !l.nomeCamisa)), somar_(doTipo.filter((l) => l.nomeCamisa)), somar_(doTipo)]);
  });
  push(["TOTAL", total - totalNome, totalNome, total], "negrito");
  push([""]);

  // 2) Lista para produção
  push(["2. LISTA PARA PRODUÇÃO"], "secao");
  push(["Tipo", "Nome?", "Tamanho", "Qtd", "Nome na camisa"], "cabecalho");
  TIPOS.forEach((tipo) => {
    const doTipo = linhas.filter((l) => l.tipo === tipo);
    if (!doTipo.length) return;
    const T = tipo.toUpperCase();

    // sem nome: uma linha por tamanho
    TAMANHOS[tipo].forEach((tam) => {
      const q = somar_(doTipo.filter((l) => !l.nomeCamisa && l.tamanho === tam));
      if (q) push([T, "SEM NOME", tam, q, ""]);
    });

    // com nome: uma linha por nome
    doTipo
      .filter((l) => l.nomeCamisa)
      .sort((a, b) => ordem_(a) - ordem_(b) || a.nomeCamisa.localeCompare(b.nomeCamisa))
      .forEach((l) => push([T, "COM NOME", l.tamanho, l.qtd, l.nomeCamisa], "comNome"));

    push([`Total ${tipo}`, "", "", somar_(doTipo), ""], "subtotal");
    push([""]);
  });
  push(["TOTAL GERAL", "", "", total, ""], "tipo");

  sh.getRange(1, 1, out.length, NC).setValues(out);
  estilos.forEach(([row, e]) => {
    const rg = sh.getRange(row, 1, 1, NC);
    if (e === "titulo") rg.setFontWeight("bold").setFontSize(14);
    if (e === "negrito") rg.setFontWeight("bold");
    if (e === "alerta") rg.setFontWeight("bold").setFontColor("#c62f3b");
    if (e === "secao") rg.setFontWeight("bold").setBackground("#0f1b3d").setFontColor("#ffffff");
    if (e === "cabecalho") rg.setFontWeight("bold").setBackground("#e6ecff");
    if (e === "comNome") rg.setBackground("#fff4d6");
    if (e === "subtotal") rg.setFontWeight("bold").setBackground("#f1f3f8");
    if (e === "tipo") rg.setFontWeight("bold").setBackground("#ffc23d");
  });
  sh.setColumnWidths(1, NC, 130);
  sh.setColumnWidth(5, 180);
  ss.setActiveSheet(sh);
  try { SpreadsheetApp.getUi().alert("Relatório gerado na aba \"Fornecedor\". Para PDF: Arquivo → Fazer download → PDF."); } catch (e) {}
}

function lerItens_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_PEDIDOS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, CABECALHO.length).getValues()
    .map((r) => ({
      id: r[1], tipo: r[COL.tipo - 1], tamanho: String(r[COL.tamanho - 1]).replace(/^'/, ""),
      qtd: Number(r[COL.qtd - 1]) || 0, nomeCamisa: String(r[COL.nomeCamisa - 1] || "").trim(),
      pago: r[COL.pago - 1] === true,
      nome: String(r[COL.nome - 1] || "").replace(/^'/, ""),
      telefone: String(r[COL.telefone - 1] || "").replace(/^'/, ""),
      valorPago: r[COL.valorPago - 1] === "" || r[COL.valorPago - 1] === null ? null : Number(r[COL.valorPago - 1]) || 0,
    }))
    .filter((l) => l.qtd > 0);
}
const somar_ = (its) => its.reduce((s, l) => s + l.qtd, 0);
function ordem_(l) {
  return TIPOS.indexOf(l.tipo) * 100 + (TAMANHOS[l.tipo] || []).indexOf(l.tamanho);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.acao === "resumo") return json(resumo_());
  return json({ ok: true, totalUnidades: totalUnidades_(), aberto: new Date() < PRAZO });
}

/**
 * Dados da página /resumo do site: os números da aba Resumo + a lista para o
 * fornecedor. Não inclui nome nem telefone de quem pediu, só o nome que vai na camisa.
 */
function resumo_() {
  const linhas = lerItens_();
  const total = somar_(linhas);
  const preco = total >= MINIMO_DESCONTO ? PRECO_DESCONTO : PRECO_NORMAL;
  const valor = (its) => its.reduce((s, l) => s + l.qtd * (preco + (l.nomeCamisa ? PRECO_NOME : 0)), 0);
  const tipos = TIPOS.map((tipo) => {
    const doTipo = linhas.filter((l) => l.tipo === tipo);
    return {
      tipo,
      semNome: somar_(doTipo.filter((l) => !l.nomeCamisa)),
      comNome: somar_(doTipo.filter((l) => l.nomeCamisa)),
      total: somar_(doTipo),
      tamanhos: TAMANHOS[tipo]
        .map((tam) => ({ tamanho: tam, qtd: somar_(doTipo.filter((l) => !l.nomeCamisa && l.tamanho === tam)) }))
        .filter((t) => t.qtd),
      nomes: doTipo
        .filter((l) => l.nomeCamisa)
        .sort((a, b) => ordem_(a) - ordem_(b) || a.nomeCamisa.localeCompare(b.nomeCamisa))
        .map((l) => ({ tamanho: l.tamanho, qtd: l.qtd, nome: l.nomeCamisa })),
    };
  }).filter((t) => t.total);
  return {
    ok: true,
    atualizadoEm: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
    aberto: new Date() < PRAZO,
    pedidos: new Set(linhas.map((l) => l.id)).size,
    totalUnidades: total,
    preco,
    comNome: somar_(linhas.filter((l) => l.nomeCamisa)),
    valorTotal: valor(linhas),
    valorPago: valor(linhas.filter((l) => l.pago)),
    naoPagas: somar_(linhas.filter((l) => !l.pago)),
    ...resumoDevolucoes_(),
    tipos,
  };
}

/**
 * Para a página /resumo: valor recebido de verdade, total a devolver e a lista
 * por pedido (só o primeiro nome, sem telefone — a página é pública).
 */
function resumoDevolucoes_() {
  const ped = devolucoesPorPedido_();
  const devolver = ped.filter((p) => p.devolver > 0);
  return {
    valorRecebido: ped.reduce((s, p) => s + p.pago, 0),
    aDevolver: devolver.reduce((s, p) => s + p.devolver, 0),
    semValorPago: ped.filter((p) => p.semValorPago).length,
    devolucoes: devolver.map((p) => ({ pedido: p.pedido, nome: p.nome.split(" ")[0], camisas: p.camisas, valor: p.devolver })),
  };
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    if (dados.site) return json({ ok: true, id: 0, totalUnidades: totalUnidades_() }); // robô
    if (new Date() >= PRAZO) return json({ ok: false, erro: "O prazo de pedidos terminou." });

    const nome = String(dados.nome || "").trim().slice(0, 80);
    const telefone = String(dados.telefone || "").trim().slice(0, 20);
    if (nome.length < 3) return json({ ok: false, erro: "Informe seu nome." });
    if (telefone.replace(/\D/g, "").length < 10) return json({ ok: false, erro: "Telefone inválido." });

    const itens = (dados.itens || [])
      .filter((i) => TAMANHOS[i.tipo] && TAMANHOS[i.tipo].includes(i.tamanho) &&
        Number.isInteger(i.qtd) && i.qtd >= 1 && i.qtd <= 20)
      .map((i) => ({ ...i, nomeCamisa: String(i.nomeCamisa || "").trim().toUpperCase().slice(0, NOME_MAX).replace(/^[=+\-@]/, "") }));
    if (!itens.length) return json({ ok: false, erro: "Pedido sem itens válidos." });

    // salva o comprovante antes de travar a planilha (upload pode demorar)
    let arquivo;
    try {
      arquivo = salvarComprovante_(dados.comprovante, nome);
    } catch (err) {
      return json({ ok: false, erro: err.message || "Não foi possível salvar o comprovante." });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = SpreadsheetApp.getActive().getSheetByName(ABA_PEDIDOS);
      const props = PropertiesService.getScriptProperties();
      // próximo nº = maior entre o contador salvo e o maior nº já na planilha (evita repetir)
      const nLinhas = sh.getLastRow() - 1;
      const maiorNaPlanilha = nLinhas > 0
        ? Math.max(0, ...sh.getRange(2, 2, nLinhas, 1).getValues().map(([v]) => Number(v) || 0))
        : 0;
      const id = Math.max(Number(props.getProperty("ultimoId") || 0), maiorNaPlanilha) + 1;
      props.setProperty("ultimoId", String(id));
      arquivo.setName(`Pedido ${id} - ${arquivo.getName()}`);

      // Quanto a pessoa pagou: o site mostra o valor com o preço do momento
      // (R$ 50 ou R$ 45). Usa o valor informado pelo site se bater com um dos dois
      // preços; senão, calcula com a mesma regra do site.
      const qtdPedido = itens.reduce((s, i) => s + i.qtd, 0);
      const esperado = (p) => itens.reduce((s, i) => s + i.qtd * (p + (i.nomeCamisa ? PRECO_NOME : 0)), 0);
      const informado = Number(dados.valor);
      let precoPago = totalUnidades_() + qtdPedido >= MINIMO_DESCONTO ? PRECO_DESCONTO : PRECO_NORMAL;
      if (informado === esperado(PRECO_NORMAL)) precoPago = PRECO_NORMAL;
      else if (informado === esperado(PRECO_DESCONTO)) precoPago = PRECO_DESCONTO;

      const agora = new Date();
      const inicio = sh.getLastRow() + 1;
      const linhas = itens.map((i) => {
        return [
          agora, id, "'" + nome, "'" + telefone, i.tipo, i.tamanho, i.qtd, i.nomeCamisa, "", true, "", "",
          i.qtd * (precoPago + (i.nomeCamisa ? PRECO_NOME : 0)), "",
        ];
      });
      sh.getRange(inicio, 1, linhas.length, CABECALHO.length).setValues(linhas);
      sh.getRange(inicio, COL.valor, linhas.length, 1).setFormulas(linhas.map((_, k) => [formulaValor_(inicio + k)]));
      sh.getRange(inicio, COL.devolver, linhas.length, 1).setFormulas(linhas.map((_, k) => [formulaDevolver_(inicio + k)]));
      sh.getRange(inicio, COL.comprovante, linhas.length, 1)
        .setRichTextValues(linhas.map(() => [linkComprovante_(arquivo.getUrl())]));
      sh.getRange(inicio, COL.pago, linhas.length, 1).insertCheckboxes().check(); // comprovante é obrigatório: já entra como pago
      SpreadsheetApp.flush();

      const total = totalUnidades_();
      if (AVISAR_POR_EMAIL) avisar_(id, nome, telefone, itens, total, arquivo.getUrl());
      return json({ ok: true, id, totalUnidades: total });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, erro: "Erro ao salvar o pedido. Tente novamente." });
  }
}

function totalUnidades_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_PEDIDOS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  return sh.getRange(2, COL.qtd, n, 1).getValues().reduce((s, [q]) => s + (Number(q) || 0), 0);
}

function avisar_(id, nome, telefone, itens, total, urlComprovante) {
  try {
    const linhas = itens
      .map((i) => `• ${i.qtd}x ${i.tipo} ${i.tamanho}${i.nomeCamisa ? ` - nome: ${i.nomeCamisa}` : ""}`)
      .join("\n");
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      `Novo pedido nº ${id} — ${nome}`,
      `${nome} (${telefone})\n\n${linhas}\n\nComprovante: ${urlComprovante}\n\nTotal do grupo agora: ${total} camisa(s).\n${SpreadsheetApp.getActive().getUrl()}`
    );
  } catch (e) { /* e-mail é opcional */ }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
