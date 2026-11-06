/**
 * Backend do pedido de camisas — cole este código no Apps Script
 * da sua planilha (Extensões → Apps Script). Veja o README.
 */

// ====== CONFIGURAÇÃO ======
const PRAZO = new Date("2026-11-14T12:00:00-03:00"); // 14/11 ao meio-dia (mesmo prazo do config.js)
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

/** Menu "Pedido" dentro da planilha. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Pedido")
    .addItem("Gerar relatório do fornecedor", "gerarRelatorioFornecedor")
    .addToUi();
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
  r.getRange("A1:B5").setValues([
    ["Total de camisas", "=SUM(Pedidos!G2:G)"],
    ["Preço por camisa", `=IF(B1>=${MINIMO_DESCONTO},${PRECO_DESCONTO},${PRECO_NORMAL})`],
    ["Camisas com nome", '=SUMIF(Pedidos!H2:H,"<>",Pedidos!G2:G)'],
    ["Valor total", "=SUM(Pedidos!I2:I)"],
    ["Valor já pago", "=SUMIF(Pedidos!J2:J,TRUE,Pedidos!I2:I)"],
  ]);
  r.getRange("B2").setNumberFormat("R$ #,##0.00");
  r.getRange("B4:B5").setNumberFormat("R$ #,##0.00");
  r.getRange("A1:A5").setFontWeight("bold");
  r.getRange("A7").setValue("Para o relatório completo do fornecedor: menu Pedido → Gerar relatório do fornecedor").setFontStyle("italic");
  r.autoResizeColumns(1, 2);

  pastaComprovantes_(); // cria a pasta no Drive (e pede a permissão do Drive)
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

/** Cria/atualiza a aba "Fornecedor" com tudo que precisa ser produzido. */
function gerarRelatorioFornecedor() {
  const ss = SpreadsheetApp.getActive();
  const linhas = lerItens_();
  const sh = ss.getSheetByName(ABA_FORNECEDOR) || ss.insertSheet(ABA_FORNECEDOR);
  sh.clear();

  const out = [];
  const estilos = []; // [linha, tipo]
  const push = (row, estilo) => { out.push(row.concat(Array(4 - row.length).fill(""))); if (estilo) estilos.push([out.length, estilo]); };

  const total = linhas.reduce((s, l) => s + l.qtd, 0);
  const totalNome = linhas.filter((l) => l.nomeCamisa).reduce((s, l) => s + l.qtd, 0);
  push(["NOVO MANTO AVIA MININU — PEDIDO AO FORNECEDOR"], "titulo");
  push([`Gerado em ${Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}`]);
  push([`Total: ${total} camisa(s), sendo ${totalNome} com nome`], "negrito");
  push([""]);

  // 1) Quantidades por tipo / tamanho
  push(["1. QUANTIDADES"], "secao");
  TIPOS.forEach((tipo) => {
    const doTipo = linhas.filter((l) => l.tipo === tipo);
    if (!doTipo.length) return;
    push([tipo.toUpperCase(), "", "", `${somar_(doTipo)} un.`], "tipo");
    push(["Tamanho", "Sem nome", "Com nome", "Total"], "cabecalho");
    TAMANHOS[tipo].forEach((tam) => {
      const its = doTipo.filter((l) => l.tamanho === tam);
      if (!its.length) return;
      push([tam, somar_(its.filter((l) => !l.nomeCamisa)), somar_(its.filter((l) => l.nomeCamisa)), somar_(its)]);
    });
    push([""]);
  });

  // 2) Lista de nomes
  push(["2. NOMES NAS CAMISAS"], "secao");
  const comNome = linhas.filter((l) => l.nomeCamisa);
  if (!comNome.length) push(["Nenhuma camisa com nome."]);
  else {
    push(["Tipo", "Tamanho", "Nome", ""], "cabecalho");
    comNome
      .sort((a, b) => ordem_(a) - ordem_(b) || a.nomeCamisa.localeCompare(b.nomeCamisa))
      .forEach((l) => { for (let k = 0; k < l.qtd; k++) push([l.tipo, l.tamanho, l.nomeCamisa]); });
  }

  sh.getRange(1, 1, out.length, 4).setValues(out);
  estilos.forEach(([row, e]) => {
    const rg = sh.getRange(row, 1, 1, 4);
    if (e === "titulo") rg.setFontWeight("bold").setFontSize(14);
    if (e === "negrito") rg.setFontWeight("bold");
    if (e === "secao") rg.setFontWeight("bold").setBackground("#0f1b3d").setFontColor("#ffffff");
    if (e === "tipo") rg.setFontWeight("bold").setBackground("#ffc23d");
    if (e === "cabecalho") rg.setFontWeight("bold").setBackground("#e6ecff");
  });
  sh.setColumnWidths(1, 4, 150);
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
      const link = `=HYPERLINK("${arquivo.getUrl()}","ver comprovante")`;

      const agora = new Date();
      const inicio = sh.getLastRow() + 1;
      const linhas = itens.map((i, k) => {
        const r = inicio + k;
        return [
          agora, id, "'" + nome, "'" + telefone, i.tipo, i.tamanho, i.qtd, i.nomeCamisa,
          `=G${r}*(${ABA_RESUMO}!$B$2+IF(H${r}<>"",${PRECO_NOME},0))`, false, link, "",
        ];
      });
      sh.getRange(inicio, 1, linhas.length, CABECALHO.length).setValues(linhas);
      sh.getRange(inicio, COL.pago, linhas.length, 1).insertCheckboxes();
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
