# Novo Manto Avia Mininu: pedido de camisas

Site simples (uma página, feito para celular) para coletar os pedidos de camisa.
Os pedidos caem direto numa **planilha do Google**, já com um resumo por tamanho para o fornecedor.

- `index.html`, `styles.css`, `app.js`: o site
- `config.js`: **tudo o que você precisa editar** (prazo, preços, chave Pix, WhatsApp)
- `apps-script/Code.gs`: o código que liga o site à planilha

Enquanto `API_URL` estiver vazio no `config.js`, o site roda em **modo demonstração**
(os pedidos ficam só no navegador de quem testou).

---

## 1. Criar a planilha e o "backend" (uns 5 minutos)

1. Crie uma planilha nova no Google Sheets (ex.: "Pedidos Manto Avia Mininu").
2. No menu, vá em **Extensões → Apps Script**.
3. Apague o que estiver lá, cole todo o conteúdo de `apps-script/Code.gs` e salve.
4. No seletor de função (no topo), escolha **`configurarPlanilha`** e clique em **Executar**.
   O Google vai pedir autorização: clique em *Revisar permissões* → sua conta →
   *Avançado* → *Acessar (não seguro)* → *Permitir*. (É seguro, o código é seu.)
   Isso cria as abas **Pedidos** e **Resumo**.
5. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a **URL do app da Web** (termina em `/exec`) e cole em `API_URL` no `config.js`.

> Se mudar o `Code.gs` depois, use **Implantar → Gerenciar implantações → editar (lápis) →
> Versão: Nova versão**, para manter a mesma URL.

## 2. Publicar o site (GitHub Pages, grátis)

1. No GitHub, abra o repositório → **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
3. Em 1 ou 2 minutos o site estará em
   `https://allannvictor.github.io/pedido-camisas-avia-mininu/`.

Esse link é o que vocês mandam no grupo do WhatsApp.

## 3. Dia a dia

- **Aba Pedidos:** uma linha por item, com o nº do pedido, nome e telefone.
  Marque a caixinha **Pago?** quando receber o Pix.
- **Aba Resumo:** total de camisas, preço em vigor (50 ou 45), camisas com nome,
  valor total e valor já pago.
- **Relatório do fornecedor:** na planilha, menu **Pedido → Gerar relatório do fornecedor**.
  Cria a aba **Fornecedor** com as quantidades por tipo, modelo e tamanho (separando sem nome e
  com nome) e a lista de todos os nomes que vão nas camisas. Para mandar como PDF:
  **Arquivo → Fazer download → PDF**. Pode gerar quantas vezes quiser; ele sempre se atualiza.
  (Se o menu não aparecer, recarregue a planilha.)
- A cada pedido você recebe um **e-mail** (pode desligar em `AVISAR_POR_EMAIL`).

## Regras de preço

- Até 29 camisas no total do grupo: **R$ 50,00** cada.
- A partir de 30 camisas: **R$ 45,00** para todo mundo.
- Nome na camisa: **+ R$ 10,00** por camisa (até 15 letras).
- O site mostra o contador "Camisas solicitadas" e as duas faixas de preço. Se a meta for batida depois que alguém
  já pagou, a diferença é acertada com a organização (o site avisa isso).

Para mudar o prazo ou os preços, altere **os dois** arquivos: `config.js` e `Code.gs`.

## Encerrar

Depois do prazo, o site e a planilha param de aceitar pedidos sozinhos.
Para tirar o site do ar: **Settings → Pages → Unpublish** (ou arquive o repositório).
