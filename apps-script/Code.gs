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
const CABECALHO = ["Data", "Pedido nº", "Nome", "Telefone", "Tipo", "Tamanho", "Qtd", "Nome na camisa", "Valor", "Pago?", "Comprovante", "Observação"];
// colunas (1 = A): E=Tipo F=Tamanho G=Qtd H=Nome na camisa I=Valor J=Pago? K=Comprovante
const COL = { tipo: 5, tamanho: 6, qtd: 7, nomeCamisa: 8, valor: 9, pago: 10, comprovante: 11 };

/** Menu "Pedido" dentro da planilha (aparece na barra de menus, depois de "Ajuda"). */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Pedido")
    .addItem("Gerar relatório do fornecedor", "gerarRelatorioFornecedor")
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

  const r = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO);
  r.clear();
  r.getRange("A1:A5").setValues([
    ["Total de camisas"], ["Preço por camisa"], ["Camisas com nome"], ["Valor total"], ["Valor já pago"],
  ]);
  r.getRange("B1:B5").setFormulas([
    ["=SUM(Pedidos!G2:G)"],
    [`=${PRECO_NORMAL}-${PRECO_NORMAL - PRECO_DESCONTO}*(B1>=${MINIMO_DESCONTO})`],
    ['=SUMPRODUCT((Pedidos!H2:H<>"")*Pedidos!G2:G)'],
    ["=SUM(Pedidos!I2:I)"],
    ["=SUMPRODUCT(Pedidos!J2:J*Pedidos!I2:I)"],
  ]);
  r.getRange("B2").setNumberFormat("R$ #,##0.00");
  r.getRange("B4:B5").setNumberFormat("R$ #,##0.00");
  r.getRange("A1:A5").setFontWeight("bold");
  r.getRange("A7").setValue("Para o relatório completo do fornecedor: menu Pedido → Gerar relatório do fornecedor").setFontStyle("italic");
  r.autoResizeColumns(1, 2);

  corrigirFormulasPedidos_(p);
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
      tipo: r[COL.tipo - 1], tamanho: String(r[COL.tamanho - 1]).replace(/^'/, ""),
      qtd: Number(r[COL.qtd - 1]) || 0, nomeCamisa: String(r[COL.nomeCamisa - 1] || "").trim(),
      pago: r[COL.pago - 1] === true,
    }))
    .filter((l) => l.qtd > 0);
}
const somar_ = (its) => its.reduce((s, l) => s + l.qtd, 0);
function ordem_(l) {
  return TIPOS.indexOf(l.tipo) * 100 + (TAMANHOS[l.tipo] || []).indexOf(l.tamanho);
}

function doGet() {
  return json({ ok: true, totalUnidades: totalUnidades_(), aberto: new Date() < PRAZO });
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
      const id = Number(props.getProperty("ultimoId") || 0) + 1;
      props.setProperty("ultimoId", String(id));
      arquivo.setName(`Pedido ${id} - ${arquivo.getName()}`);

      const agora = new Date();
      const inicio = sh.getLastRow() + 1;
      const linhas = itens.map((i) => {
        return [
          agora, id, "'" + nome, "'" + telefone, i.tipo, i.tamanho, i.qtd, i.nomeCamisa, "", true, "", "",
        ];
      });
      sh.getRange(inicio, 1, linhas.length, CABECALHO.length).setValues(linhas);
      sh.getRange(inicio, COL.valor, linhas.length, 1).setFormulas(linhas.map((_, k) => [formulaValor_(inicio + k)]));
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
