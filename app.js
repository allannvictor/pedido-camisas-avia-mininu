(function () {
  "use strict";

  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const DEMO = !C.API_URL;
  const prazo = new Date(C.PRAZO);

  const ICONES = {
    manga:
      '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 8 12 12 4 24l8 6 4-4v30h32V26l4 4 8-6-8-12-10-4c-2 4-6 6-10 6s-8-2-10-6Z"/></svg>',
    regata:
      '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 5v8c0 8-4 13-6 15v30h34V28c-2-2-6-7-6-15V5h-6c0 7-2 11-5 11s-5-4-5-11h-6Z"/></svg>',
  };

  const state = {
    tipo: C.TIPOS[0].id,
    modelo: C.MODELOS[0].id,
    tamanho: null,
    qtd: 1,
    cart: [],
    totalGrupo: 0,
  };

  // ---------- utilidades ----------
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const precoPara = (total) => (total >= C.MINIMO_DESCONTO ? C.PRECO_DESCONTO : C.PRECO_NORMAL);
  const qtdCarrinho = () => state.cart.reduce((s, i) => s + i.qtd, 0);
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
    radioGroup($("tipos"), C.TIPOS, state.tipo, (id) => { state.tipo = id; renderTipos(); },
      (t) => `${ICONES[t.icone] || ""}<strong>${esc(t.id)}</strong><small>${esc(t.descricao)}</small>`);
    [...$("tipos").children].forEach((b) => b.classList.add("tipo"));
  }

  function renderModelos() {
    radioGroup($("modelos"), C.MODELOS, state.modelo, (id) => {
      state.modelo = id;
      state.tamanho = null;
      renderModelos();
      renderTamanhos();
    }, (m) => esc(m.id));
  }

  function renderTamanhos() {
    const modelo = C.MODELOS.find((m) => m.id === state.modelo);
    radioGroup($("tamanhos"), modelo.tamanhos.map((t) => ({ id: t })), state.tamanho,
      (id) => { state.tamanho = id; $("add-hint").textContent = ""; renderTamanhos(); },
      (t) => esc(t.id));
  }

  function renderCart() {
    const ul = $("cart");
    ul.innerHTML = "";
    state.cart.forEach((item, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="qty">${item.qtd}x</span>
        <span class="desc"><strong>${esc(item.modelo)} · ${esc(item.tamanho)}</strong><span>${esc(item.tipo)}</span></span>
        <button type="button" class="rm" aria-label="Remover">×</button>`;
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
    $("total-valor").textContent = brl(qtd * preco);
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

  function renderPrazo() {
    const fmt = prazo.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const dias = Math.ceil((prazo - Date.now()) / 86400000);
    const aberto = Date.now() < prazo.getTime();
    $("prazo-badge").textContent = aberto
      ? `Pedidos até ${fmt}${dias <= 3 ? ` · faltam ${dias} dia(s)` : ""}`
      : "Pedidos encerrados";
    $("prazo-texto").textContent = aberto ? `Você pode fazer pedidos até ${fmt}.` : "";
    $("form").hidden = !aberto;
    $("closed").hidden = aberto;
  }

  // ---------- ações ----------
  $("qtd-menos").addEventListener("click", () => { state.qtd = Math.max(1, state.qtd - 1); $("qtd").textContent = state.qtd; });
  $("qtd-mais").addEventListener("click", () => { state.qtd = Math.min(20, state.qtd + 1); $("qtd").textContent = state.qtd; });

  $("add").addEventListener("click", () => {
    if (!state.tamanho) {
      $("add-hint").textContent = "Escolha um tamanho antes de adicionar.";
      $("tamanhos").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const existente = state.cart.find(
      (i) => i.tipo === state.tipo && i.modelo === state.modelo && i.tamanho === state.tamanho
    );
    if (existente) existente.qtd += state.qtd;
    else state.cart.push({ tipo: state.tipo, modelo: state.modelo, tamanho: state.tamanho, qtd: state.qtd });
    toast(`${state.qtd}x ${state.modelo} ${state.tamanho} adicionada(s)`);
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
    erro("");

    const pedido = { nome, telefone, itens: state.cart, site: $("site").value };
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
      btn.disabled = false;
      btn.textContent = "Enviar pedido";
    }
  });

  function mostrarSucesso(pedido, res) {
    const qtd = pedido.itens.reduce((s, i) => s + i.qtd, 0);
    const preco = precoPara(res.totalUnidades);
    $("sucesso-id").textContent = `${pedido.nome.split(" ")[0]}, seu pedido nº ${res.id} foi registrado.`;
    $("sucesso-itens").innerHTML = pedido.itens
      .map((i) => `<li><span class="qty">${i.qtd}x</span><span class="desc"><strong>${esc(i.modelo)} · ${esc(i.tamanho)}</strong><span>${esc(i.tipo)}</span></span></li>`)
      .join("");
    $("sucesso-qtd").textContent = `${qtd} camisa(s) × ${brl(preco)}`;
    $("sucesso-valor").textContent = brl(qtd * preco);

    if (C.PIX_CHAVE) {
      $("pix-key").textContent = C.PIX_CHAVE;
      $("pix-key").classList.remove("pending");
      $("copiar-pix").hidden = false;
    }
    $("pix-nome").textContent = C.PIX_NOME ? `Favorecido: ${C.PIX_NOME}` : "";
    $("aviso-desconto").textContent =
      res.totalUnidades >= C.MINIMO_DESCONTO
        ? ""
        : `Se o grupo chegar a ${C.MINIMO_DESCONTO} camisas, o preço cai para ${brl(C.PRECO_DESCONTO)} e a diferença é acertada com a organização.`;

    if (C.WHATSAPP_ORGANIZADOR) {
      const linhas = pedido.itens.map((i) => `• ${i.qtd}x ${i.modelo} ${i.tamanho} (${i.tipo})`).join("\n");
      const texto = `Olá! Fiz o pedido nº ${res.id} do ${C.TITULO}.\nNome: ${pedido.nome}\n${linhas}\nTotal: ${brl(qtd * preco)}\nSegue o comprovante do Pix:`;
      $("whats").href = `https://wa.me/${C.WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(texto)}`;
      $("whats").hidden = false;
    }

    $("form").hidden = true;
    $("sucesso").hidden = false;
    state.cart = [];
    renderCart();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      lista.push({ ...pedido, id, data: new Date().toISOString() });
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
  $("demo-banner").hidden = !DEMO;
  renderTipos();
  renderModelos();
  renderTamanhos();
  renderCart();
  renderPrazo();
  carregarTotal().then(renderCart);
})();
