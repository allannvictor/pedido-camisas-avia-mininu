# Novo Manto Avia Mininu: pedido de camisas

Site simples (uma página, feito para celular) para coletar os pedidos de camisa.
Os pedidos caem direto numa **planilha do Google**, já com um resumo por tamanho para o fornecedor.

- `index.html`, `styles.css`, `app.js`: o site
- `config.js`: **tudo o que você precisa editar** (prazo, preços, chave Pix, WhatsApp)
- `resumo/index.html`: página com o resumo do pedido (para a organização)
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
   Isso cria as abas **Pedidos** e **Resumo** e a pasta **"Comprovantes - Novo Manto Avia Mininu"**
   no seu Google Drive (por isso o Google pede acesso à Planilha, ao Drive e ao Gmail).
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
  Cada pedido traz o link **"ver comprovante"** (o arquivo fica na pasta de comprovantes do
  seu Drive, visível só para você). Como o comprovante é obrigatório, **Pago?** já entra
  marcado; se algum comprovante não conferir, desmarque.
- **Aba Resumo:** total de camisas, preço em vigor (50 ou 45), camisas com nome,
  valor total e valor já pago.
- **Relatório do fornecedor:** na planilha, menu **Pedido → Gerar relatório do fornecedor**.
  Cria a aba **Fornecedor** com:
  1. um resumo por tipo (sem nome / com nome / total);
  2. a **lista para produção**, uma linha por tipo + tamanho, por exemplo
     `TRADICIONAL | SEM NOME | M | 5` e, para cada camisa com nome,
     `TRADICIONAL | COM NOME | G | 1 | ALLANN`, com o total de cada tipo.

  Se algum pedido estiver com **Pago?** desmarcado, o relatório avisa no topo. Para mandar
  como PDF: **Arquivo → Fazer download → PDF**. Pode gerar quantas vezes quiser; ele sempre
  se atualiza.
  O menu **Pedido** fica na barra de menus da planilha, depois de **Ajuda**. Se não aparecer,
  recarregue a página da planilha (F5). Alternativa: no Apps Script, escolha a função
  `gerarRelatorioFornecedor` e clique em **Executar**.
- **Resumo no navegador (sem abrir a planilha):**
  `https://allannvictor.github.io/pedido-camisas-avia-mininu/resumo/`
  mostra total de camisas, preço em vigor, valor total e já pago, a contagem por tipo e a
  lista para produção (tamanhos e nomes nas camisas). Atualiza sozinha a cada minuto.
  Não mostra nome nem telefone de quem pediu, mas qualquer pessoa com o link vê os números.
  Precisa do `Code.gs` mais recente publicado como **nova versão** (veja o passo 1).
- A cada pedido você recebe um **e-mail** (pode desligar em `AVISAR_POR_EMAIL`).

## Pagamento

O comprovante do Pix é **obrigatório**: a pessoa vê o valor a pagar e a chave Pix antes de
enviar, paga, anexa a foto/print/PDF do comprovante (até 5 MB) e só então consegue enviar.
Fotos grandes são reduzidas automaticamente antes do envio.

## Regras de preço

- Até 29 camisas no total do grupo: **R$ 50,00** cada.
- A partir de 30 camisas: **R$ 45,00** para todo mundo.
- Nome na camisa: **+ R$ 10,00** por camisa (até 15 letras).
- O site mostra o contador "Camisas solicitadas" e as duas faixas de preço. Se a meta for batida depois que alguém
  já pagou, a organização devolve R$ 5,00 por camisa (o site avisa isso desde a página inicial).

Para mudar o prazo ou os preços, altere **os dois** arquivos: `config.js` e `Code.gs`.

## Encerrar

Depois do prazo, o site e a planilha param de aceitar pedidos sozinhos.
Para tirar o site do ar: **Settings → Pages → Unpublish** (ou arquive o repositório).

## Problemas comuns

- **`#ERROR!` nas colunas Valor/Comprovante ou na aba Resumo:** cole o `Code.gs` mais recente,
  rode `configurarPlanilha` de novo (ele conserta as linhas existentes e refaz os links dos
  comprovantes a partir da pasta do Drive) e publique uma nova versão
  em **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**.
- **O site mostra erro ao enviar:** confira se a implantação está com acesso **Qualquer pessoa**
  e se a URL em `config.js` termina em `/exec`.
