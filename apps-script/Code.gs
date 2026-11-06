/**
 * Backend do pedido de camisas — cole este código no Apps Script
 * da sua planilha (Extensões → Apps Script). Veja o README.
 */

// ====== CONFIGURAÇÃO ======
const PRAZO = new Date("2026-11-25T23:59:59-03:00"); // mesmo prazo do config.js
const PRECO_NORMAL = 50;
const PRECO_DESCONTO = 45;
const MINIMO_DESCONTO = 30; // total do grupo a partir do qual vale o desconto
const AVISAR_POR_EMAIL = true; // manda um e-mail para você a cada pedido

const TIPOS = ["Com mangas", "Regata"];
const TAMANHOS = {
  "Tradicional": ["P", "M", "G", "GG", "XGG"],
  "Baby Look": ["P", "M", "G", "GG", "XGG"],
  "Infantil": ["2 anos", "4 anos", "6 anos", "8 anos", "10 anos", "12 anos (PP)"],
};
// ==========================

const ABA_PEDIDOS = "Pedidos";
const ABA_RESUMO = "Resumo";
const CABECALHO = ["Data", "Pedido nº", "Nome", "Telefone", "Tipo", "Modelo", "Tamanho", "Qtd", "Valor", "Pago?", "Observação"];

/** Rode esta função UMA vez pelo editor para criar as abas. */
function configurarPlanilha() {
  const ss = SpreadsheetApp.getActive();
  let p = ss.getSheetByName(ABA_PEDIDOS) || ss.insertSheet(ABA_PEDIDOS);
  p.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]).setFontWeight("bold").setBackground("#0f1b3d").setFontColor("#ffffff");
  p.setFrozenRows(1);
  p.getRange("H:H").setNumberFormat("0");
  p.getRange("I:I").setNumberFormat("R$ #,##0.00");

  let r = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO);
  r.clear();
  r.getRange("A1:B4").setValues([
    ["Total de camisas", "=SUM(Pedidos!H2:H)"],
    ["Preço por camisa", `=IF(B1>=${MINIMO_DESCONTO},${PRECO_DESCONTO},${PRECO_NORMAL})`],
    ["Valor total", "=B1*B2"],
    ["Valor já pago", '=SUMIF(Pedidos!J2:J,TRUE,Pedidos!I2:I)'],
  ]);
  r.getRange("B2:B4").setNumberFormat("R$ #,##0.00");
  r.getRange("A1:A4").setFontWeight("bold");
  r.getRange("A6").setValue("Quantidade por tipo / modelo / tamanho (para o fornecedor)").setFontWeight("bold");
  r.getRange("A7").setFormula(
    "=IFERROR(QUERY(Pedidos!E1:H,\"select E, F, G, sum(H) where E is not null group by E, F, G order by E, F label sum(H) 'Quantidade'\",1),\"Sem pedidos ainda\")"
  );
  r.autoResizeColumns(1, 4);
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

    const itens = (dados.itens || []).filter(
      (i) => TIPOS.includes(i.tipo) && TAMANHOS[i.modelo] && TAMANHOS[i.modelo].includes(i.tamanho) &&
        Number.isInteger(i.qtd) && i.qtd >= 1 && i.qtd <= 20
    );
    if (!itens.length) return json({ ok: false, erro: "Pedido sem itens válidos." });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = SpreadsheetApp.getActive().getSheetByName(ABA_PEDIDOS);
      const props = PropertiesService.getScriptProperties();
      const id = Number(props.getProperty("ultimoId") || 0) + 1;
      props.setProperty("ultimoId", String(id));

      const agora = new Date();
      const inicio = sh.getLastRow() + 1;
      const linhas = itens.map((i, k) => [
        agora, id, nome, "'" + telefone, i.tipo, i.modelo, i.tamanho, i.qtd,
        `=H${inicio + k}*${ABA_RESUMO}!$B$2`, false, "",
      ]);
      sh.getRange(inicio, 1, linhas.length, CABECALHO.length).setValues(linhas);
      sh.getRange(inicio, 10, linhas.length, 1).insertCheckboxes();
      SpreadsheetApp.flush();

      const total = totalUnidades_();
      if (AVISAR_POR_EMAIL) avisar_(id, nome, telefone, itens, total);
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
  return sh.getRange(2, 8, n, 1).getValues().reduce((s, [q]) => s + (Number(q) || 0), 0);
}

function avisar_(id, nome, telefone, itens, total) {
  try {
    const linhas = itens.map((i) => `• ${i.qtd}x ${i.modelo} ${i.tamanho} (${i.tipo})`).join("\n");
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      `Novo pedido nº ${id} — ${nome}`,
      `${nome} (${telefone})\n\n${linhas}\n\nTotal do grupo agora: ${total} camisa(s).\n${SpreadsheetApp.getActive().getUrl()}`
    );
  } catch (e) { /* e-mail é opcional */ }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
