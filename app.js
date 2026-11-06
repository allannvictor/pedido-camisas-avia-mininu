(function () {
  "use strict";

  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const DEMO = !C.API_URL;
  const prazo = new Date(C.PRAZO);

  const ICONES = {
    tradicional:
      '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 8 12 12 4 24l8 6 4-4v30h32V26l4 4 8-6-8-12-10-4c-2 4-6 6-10 6s-8-2-10-6Z"/></svg>',
    babylook:
      '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 9 15 12 8 22l7 5 4-3c1 7-3 12-3 18 0 5 1 10 2 14h30c1-4 2-9 2-14 0-6-4-11-3-18l4 3 7-5-7-10-8-3c-2 3-5 5-9 5s-7-2-9-5Z"/></svg>',
    infantil:
      '<svg viewBox="0 0 64 64" aria-hidden="true"><path transform="translate(11 16) scale(.66)" d="M22 8 12 12 4 24l8 6 4-4v30h32V26l4 4 8-6-8-12-10-4c-2 4-6 6-10 6s-8-2-10-6Z"/></svg>',
    regata:
      '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 5v8c0 8-4 13-6 15v30h34V28c-2-2-6-7-6-15V5h-6c0 7-2 11-5 11s-5-4-5-11h-6Z"/></svg>',
  };

  const state = {
    tipo: C.TIPOS[0].id,
    tamanho: null,
    qtd: 1,
    comNome: false,
    comprovante: null, // { nome, tipo, dados (base64), kb }
    cart: [],
    totalGrupo: 0,
  };

  // ---------- utilidades ----------
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const precoPara = (total) => (total >= C.MINIMO_DESCONTO ? C.PRECO_DESCONTO : C.PRECO_NORMAL);
  const qtdCarrinho = () => state.cart.reduce((s, i) => s + i.qtd, 0);
  const valorItem = (i, preco) => i.qtd * (preco + (i.nomeCamisa ? C.PRECO_NOME : 0));
  const valorTotal = (itens, preco) => itens.reduce((s, i) => s + valorItem(i, preco), 0);
  const itemHtml = (i, preco, remover) => `
        <span class="qty">${i.qtd}x</span>
        <span class="desc"><strong>${esc(i.tipo)} · ${esc(i.tamanho)}</strong>${
          i.nomeCamisa ? `<span class="tag">NOME: ${esc(i.nomeCamisa)}</span>` : "<span>Sem nome</span>"}</span>
        <span class="price">${brl(valorItem(i, preco))}</span>${
          remover ? '<button type="button" class="rm" aria-label="Remover">×</button>' : ""}`;
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function radioGroup(container, items, current, onPick, render) {
    container.innerHTML = "";
    items.forEach((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(item.id === current));
      b.innerHTML = render(item);
      b.addEventListener("click", () => onPick(item.id));
      container.appendChild(b);
    });
  }

  // ---------- render ----------
  function renderTipos() {
    radioGroup($("tipos"), C.TIPOS, state.tipo, (id) => {
      state.tipo = id;
      state.tamanho = null;
      renderTipos();
      renderTamanhos();
    },
      (t) => `${ICONES[t.icone] || ""}<strong>${esc(t.id)}</strong><small>${esc(t.descricao)}</small>`);
    [...$("tipos").children].forEach((b) => b.classList.add("tipo"));
  }

  function renderTamanhos() {
    const tipo = C.TIPOS.find((t) => t.id === state.tipo);
    radioGroup($("tamanhos"), tipo.tamanhos.map((t) => ({ id: t })), state.tamanho,
      (id) => { state.tamanho = id; $("add-hint").textContent = ""; renderTamanhos(); },
      (t) => esc(t.id));
  }

  function renderCart() {
    const ul = $("cart");
    ul.innerHTML = "";
    const precoAtual = precoPara(state.totalGrupo + qtdCarrinho());
    state.cart.forEach((item, idx) => {
      const li = document.createElement("li");
      li.innerHTML = itemHtml(item, precoAtual, true);
      li.querySelector(".rm").addEventListener("click", () => {
        state.cart.splice(idx, 1);
        renderCart();
      });
      ul.appendChild(li);
    });
    const qtd = qtdCarrinho();
    const preco = precoPara(state.totalGrupo + qtd);
    $("cart-empty").hidden = qtd > 0;
    $("cart-total").hidden = qtd === 0;
    $("total-qtd").textContent = qtd;
    $("total-valor").textContent = brl(valorTotal(state.cart, preco));
    $("pagar-valor").textContent = brl(valorTotal(state.cart, preco));
    const atingido = state.totalGrupo + qtd >= C.MINIMO_DESCONTO;
    $("aviso-desconto").textContent = qtd === 0
      ? "Adicione as camisas para ver o valor."
      : atingido
        ? ""
        : `Se o grupo chegar a ${C.MINIMO_DESCONTO} camisas, o preço cai para ${brl(C.PRECO_DESCONTO)} e a diferença é acertada com a organização.`;
    renderProgresso();
  }

  function renderProgresso() {
    const total = state.totalGrupo;
    const comCarrinho = total + qtdCarrinho();
    const preco = precoPara(comCarrinho);
    $("preco-atual").textContent = brl(preco).replace(",00", "");
    $("total-grupo").textContent = total;
    document.querySelector(".meta").textContent = C.MINIMO_DESCONTO - 1;
    document.querySelector(".meta-desc").textContent = C.MINIMO_DESCONTO;
    $("preco-normal").textContent = brl(C.PRECO_NORMAL).replace(",00", "");
    $("preco-desconto").textContent = brl(C.PRECO_DESCONTO).replace(",00", "");
    $("tier-normal").classList.toggle("active", preco === C.PRECO_NORMAL);
    $("tier-desconto").classList.toggle("active", preco === C.PRECO_DESCONTO);

    const falta = C.MINIMO_DESCONTO - comCarrinho;
    let msg;
    if (total >= C.MINIMO_DESCONTO) {
      msg = `O grupo já chegou a ${C.MINIMO_DESCONTO} camisas: todo mundo paga <b>${brl(C.PRECO_DESCONTO)}</b>.`;
    } else if (falta <= 0) {
      msg = `Com o seu pedido o grupo chega a ${C.MINIMO_DESCONTO} camisas e o preço cai para <b>${brl(C.PRECO_DESCONTO)}</b>!`;
    } else {
      msg = `A partir de ${C.MINIMO_DESCONTO} camisas no total do grupo, o valor cai para <b>${brl(C.PRECO_DESCONTO)}</b> para todo mundo.`;
    }
    $("progress-msg").innerHTML = msg;
  }

  const estaAberto = () => Date.now() < prazo.getTime();

  function renderPrazo() {
    const tz = { timeZone: "America/Sao_Paulo" };
    const dia = prazo.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", ...tz });
    const hora = prazo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...tz }).replace(":00", "h");
    const quando = `${dia} às ${hora}`;
    const ms = prazo - Date.now();
    const aberto = ms > 0;
    let falta = "";
    if (aberto && ms < 3600000) falta = " · falta menos de 1h";
    else if (aberto && ms < 86400000) falta = ` · faltam ${Math.ceil(ms / 3600000)}h`;
    else if (aberto && ms < 3 * 86400000) falta = ` · faltam ${Math.ceil(ms / 86400000)} dia(s)`;
    $("prazo-badge").textContent = aberto ? `Pedidos até ${quando}${falta}` : "Pedidos encerrados";
    $("prazo-texto").textContent = aberto ? `Pedidos até ${quando} (horário de Brasília).` : "";
    $("closed-text").textContent = `O prazo terminou em ${quando}. Fale com a organização se precisar de algo.`;
    $("closed").hidden = aberto;
    $("form").classList.toggle("encerrado", !aberto);
    $("add").disabled = !aberto;
    $("comprovante").disabled = !aberto;
    $("nome").disabled = !aberto;
    $("telefone").disabled = !aberto;
    $("enviar").disabled = !aberto;
    $("enviar").textContent = aberto ? "Enviar pedido" : "Pedidos encerrados";
  }

  // ---------- ações ----------
  $("qtd-menos").addEventListener("click", () => { state.qtd = Math.max(1, state.qtd - 1); $("qtd").textContent = state.qtd; });
  $("qtd-mais").addEventListener("click", () => {
    if (state.comNome) return toast("Com nome, adicione uma camisa de cada vez.");
    state.qtd = Math.min(20, state.qtd + 1); $("qtd").textContent = state.qtd;
  });

  function setComNome(v) {
    state.comNome = v;
    [...$("personalizar").children].forEach((b) => b.setAttribute("aria-checked", String((b.dataset.v === "sim") === v)));
    $("nome-camisa-wrap").hidden = !v;
    $("qtd-mais").closest(".stepper").classList.toggle("locked", v);
    if (v) { state.qtd = 1; $("qtd").textContent = 1; $("nome-camisa").focus(); }
  }
  [...$("personalizar").children].forEach((b) => b.addEventListener("click", () => setComNome(b.dataset.v === "sim")));
  $("preco-nome-label").textContent = `+ ${brl(C.PRECO_NOME).replace(",00", "")}`;

  $("add").addEventListener("click", () => {
    if (!estaAberto()) return renderPrazo();
    if (!state.tamanho) {
      $("add-hint").textContent = "Escolha um tamanho antes de adicionar.";
      $("tamanhos").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const nomeCamisa = state.comNome ? $("nome-camisa").value.trim().toUpperCase() : "";
    if (state.comNome && !nomeCamisa) {
      $("add-hint").textContent = "Digite o nome que vai na camisa (ou escolha \"Sem nome\").";
      $("nome-camisa").focus();
      return;
    }
    const existente = !nomeCamisa && state.cart.find(
      (i) => i.tipo === state.tipo && i.tamanho === state.tamanho && !i.nomeCamisa
    );
    if (existente) existente.qtd += state.qtd;
    else state.cart.push({ tipo: state.tipo, tamanho: state.tamanho, qtd: state.qtd, nomeCamisa });
    toast(`${state.qtd}x ${state.tipo} ${state.tamanho}${nomeCamisa ? ` "${nomeCamisa}"` : ""} adicionada(s)`);
    $("add-hint").textContent = "";
    $("nome-camisa").value = "";
    setComNome(false);
    state.qtd = 1;
    $("qtd").textContent = 1;
    state.tamanho = null;
    renderTamanhos();
    renderCart();
  });

  // máscara de telefone
  $("telefone").addEventListener("input", (e) => {
    let d = e.target.value.replace(/\D/g, "").slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    e.target.value = out;
  });

  function erro(msg, campo) {
    $("erro").textContent = msg;
    $("erro").hidden = !msg;
    document.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    if (campo) { campo.classList.add("invalid"); campo.focus(); }
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!estaAberto()) {
      renderPrazo();
      return erro("O prazo de pedidos terminou.");
    }
    const nome = $("nome").value.trim();
    const telefone = $("telefone").value.trim();
    const digitos = telefone.replace(/\D/g, "");

    if (!state.cart.length) {
      erro("Adicione pelo menos uma camisa ao pedido.");
      $("carrinho-card").scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (nome.length < 3) return erro("Informe seu nome.", $("nome"));
    if (digitos.length < 10) return erro("Informe um telefone válido com DDD.", $("telefone"));
    if (!state.comprovante) {
      erro("Anexe o comprovante do Pix para enviar o pedido.");
      $("upload").classList.add("invalid");
      $("upload").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    erro("");

    const valor = valorTotal(state.cart, precoPara(state.totalGrupo + qtdCarrinho()));
    const pedido = { nome, telefone, itens: state.cart, valor, comprovante: state.comprovante, site: $("site").value };
    const btn = $("enviar");
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      const res = await enviar(pedido);
      if (!res.ok) throw new Error(res.erro || "Não foi possível enviar.");
      state.totalGrupo = res.totalUnidades;
      mostrarSucesso(pedido, res);
    } catch (err) {
      erro(err.message || "Falha de conexão. Tente de novo.");
    } finally {
      renderPrazo();
    }
  });

  function mostrarSucesso(pedido, res) {
    const qtd = pedido.itens.reduce((s, i) => s + i.qtd, 0);
    const total = pedido.valor;
    const preco = valorTotal(pedido.itens, C.PRECO_DESCONTO) === total ? C.PRECO_DESCONTO : C.PRECO_NORMAL;
    $("sucesso-id").textContent = `${pedido.nome.split(" ")[0]}, seu pedido nº ${res.id} foi registrado.`;
    const comNome = pedido.itens.filter((i) => i.nomeCamisa).reduce((s, i) => s + i.qtd, 0);
    $("sucesso-itens").innerHTML = pedido.itens.map((i) => `<li>${itemHtml(i, preco, false)}</li>`).join("");
    $("sucesso-qtd").textContent = `${qtd} camisa(s) × ${brl(preco)}${comNome ? ` + ${comNome} nome(s)` : ""}`;
    $("sucesso-valor").textContent = brl(total);

    $("sucesso-aviso").textContent =
      preco === C.PRECO_DESCONTO
        ? ""
        : `Se o grupo chegar a ${C.MINIMO_DESCONTO} camisas, o preço cai para ${brl(C.PRECO_DESCONTO)} e a diferença é acertada com a organização.`;

    if (C.WHATSAPP_ORGANIZADOR) {
      const linhas = pedido.itens
        .map((i) => `• ${i.qtd}x ${i.tipo} ${i.tamanho}${i.nomeCamisa ? ` - nome: ${i.nomeCamisa}` : ""}`)
        .join("\n");
      const texto = `Olá! Fiz o pedido nº ${res.id} do ${C.TITULO}.\nNome: ${pedido.nome}\n${linhas}\nTotal pago: ${brl(total)} (comprovante anexado no site).`;
      $("whats").href = `https://wa.me/${C.WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(texto)}`;
      $("whats").hidden = false;
    }

    $("form").hidden = true;
    $("sucesso").hidden = false;
    state.cart = [];
    limparComprovante();
    renderCart();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- comprovante ----------
  const LIMITE_MB = 5;
  const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

  function lerComoDataURL(file) {
    return new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => falha(r.error);
      r.readAsDataURL(file);
    });
  }

  // Reduz fotos grandes para enviar mais rápido (máx. 1600 px, JPEG).
  async function comprimirImagem(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = falha;
        i.src = url;
      });
      const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * escala);
      c.height = Math.round(img.naturalHeight * escala);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function limparComprovante() {
    state.comprovante = null;
    $("comprovante").value = "";
    $("upload").hidden = false;
    $("upload-ok").hidden = true;
    $("upload-thumb").hidden = true;
  }

  $("comprovante").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $("upload").classList.remove("invalid");
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const ehImagem = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!ehPdf && !ehImagem) {
      limparComprovante();
      return erro("Envie uma foto, print ou PDF do comprovante.");
    }
    try {
      let dataUrl, tipo, nome = file.name;
      if (ehImagem) {
        try {
          dataUrl = await comprimirImagem(file);
          tipo = "image/jpeg";
          nome = nome.replace(/\.[^.]+$/, "") + ".jpg";
        } catch {
          dataUrl = await lerComoDataURL(file); // navegador não abriu a imagem: envia como está
          tipo = file.type || "image/jpeg";
        }
      } else {
        dataUrl = await lerComoDataURL(file);
        tipo = "application/pdf";
      }
      const dados = dataUrl.split(",")[1];
      const kb = Math.round((dados.length * 3) / 4 / 1024);
      if (kb > LIMITE_MB * 1024) {
        limparComprovante();
        return erro(`O arquivo passou de ${LIMITE_MB} MB. Tente um print da tela do comprovante.`);
      }
      if (!TIPOS_OK.includes(tipo)) tipo = ehPdf ? "application/pdf" : "image/jpeg";
      state.comprovante = { nome, tipo, dados, kb };
      $("upload-nome").textContent = file.name;
      $("upload-info").textContent = `${kb < 1024 ? kb + " KB" : (kb / 1024).toFixed(1) + " MB"} · pronto para enviar`;
      $("upload-thumb").hidden = tipo === "application/pdf";
      if (tipo !== "application/pdf") $("upload-thumb").src = dataUrl;
      $("upload").hidden = true;
      $("upload-ok").hidden = false;
      erro("");
    } catch {
      limparComprovante();
      erro("Não foi possível ler o arquivo. Tente outro.");
    }
  });
  $("upload-rm").addEventListener("click", limparComprovante);

  $("copiar-pix").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(C.PIX_CHAVE);
      toast("Chave Pix copiada!");
    } catch {
      toast("Não deu para copiar. Selecione a chave e copie manualmente.");
    }
  });

  $("novo").addEventListener("click", () => {
    $("sucesso").hidden = true;
    $("form").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- comunicação com a planilha ----------
  async function enviar(pedido) {
    if (DEMO) {
      const lista = lerDemo();
      const id = lista.length + 1;
      lista.push({ ...pedido, comprovante: { nome: pedido.comprovante.nome }, id, data: new Date().toISOString() });
      try { localStorage.setItem("pedidos-demo", JSON.stringify(lista)); } catch {}
      await new Promise((r) => setTimeout(r, 500));
      return { ok: true, id, totalUnidades: somaDemo(lista) };
    }
    // text/plain evita a verificação CORS extra do navegador
    const r = await fetch(C.API_URL, { method: "POST", body: JSON.stringify(pedido) });
    return r.json();
  }

  async function carregarTotal() {
    if (DEMO) {
      state.totalGrupo = somaDemo(lerDemo());
      return;
    }
    try {
      const r = await fetch(C.API_URL);
      const j = await r.json();
      if (j.ok) state.totalGrupo = j.totalUnidades;
    } catch {
      /* mantém 0 se falhar */
    }
  }

  function lerDemo() {
    try { return JSON.parse(localStorage.getItem("pedidos-demo") || "[]"); } catch { return []; }
  }
  function somaDemo(lista) {
    return lista.reduce((s, p) => s + p.itens.reduce((a, i) => a + i.qtd, 0), 0);
  }

  // ---------- início ----------
  document.title = C.TITULO;
  if (C.PIX_CHAVE) {
    $("pix-key").textContent = C.PIX_CHAVE;
    $("pix-key").classList.remove("pending");
    $("copiar-pix").hidden = false;
  }
  $("pix-nome").textContent = C.PIX_NOME ? `Favorecido: ${C.PIX_NOME}` : "";
  $("demo-banner").hidden = !DEMO;
  renderTipos();
  renderTamanhos();
  renderCart();
  renderPrazo();
  setInterval(renderPrazo, 30000); // bloqueia sozinho se a página ficar aberta
  carregarTotal().then(renderCart);
})();
