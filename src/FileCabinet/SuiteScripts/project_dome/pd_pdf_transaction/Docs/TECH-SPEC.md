# Credit Memo — Impressão de PDF (Aloia)

> Módulo: `pd_pdf_transaction`. Este TECH-SPEC cobre apenas a feature de impressão de PDF do
> Credit Memo (DEV-845). Não retroage sobre Invoice/Packing List, já existentes e fora de escopo.
> Objetos referenciados em [MANIFEST.md](./MANIFEST.md).

## Entrypoint 1 — User Event `pd_pdf_credit_memo_ue` (beforeLoad)

**Necessidade funcional:** exibir o botão "PDF | Print Credit Memo" na transação Credit Memo em modo
de visualização, espelhando o botão "PDF | Print Invoice" já existente na Invoice.

**Tipo:** UserEventScript, fase `beforeLoad`, filtrado a `context.UserEventType.VIEW`.
**Justificativa:** mesmo padrão do Invoice — único ponto de entrada nativo para adicionar botão de
transação em modo view.

**Comportamento:**
- beforeLoad (VIEW only): seta `form.clientScriptModulePath` para o client script do Credit Memo e
  adiciona botão `custpage_print_credit_memo_btn`, label "PDF | Print Credit Memo", chamando
  `printCreditMemo(creditMemoId)`.

**Objetos:** ver MANIFEST.md.

## Entrypoint 2 — Client Script `pd_pdf_credit_memo_cl`

**Necessidade funcional:** abrir o PDF do Credit Memo em nova aba a partir do botão.
**Tipo:** ClientScript, referenciado via `form.clientScriptModulePath` (sem deployment próprio).
**Comportamento:** `printCreditMemo(id)` resolve a URL do Suitelet (scriptid/deployid do MANIFEST)
passando `creditmemoid`, abre em nova aba.

## Entrypoint 3 — Suitelet `pd_pdf_credit_memo_sl` (onRequest)

**Necessidade funcional:** gerar e servir o PDF do Credit Memo, com conteúdo variando conforme a
origem da transação (venda direta via Invoice ou devolução via RMA).
**Tipo:** Suitelet, ponto de entrada único `onRequest`.

**Comportamento:**
1. Carrega o registro Credit Memo pelo `creditmemoid` recebido.
2. **Campo de guarda** (paridade intencional com o Invoice — ver nota abaixo): no início de
   `manipulateCreditMemoPdf`, lê `custbody_pd_pdf_credit_memo_pdf_dc` do Credit Memo. Se o campo já
   tiver valor, a função retorna `null` (early-return), replicando exatamente o mesmo padrão hoje
   existente em `manipulateInvoicePdf` para `custbody_pd_pdf_invoice_pdf_dc`.
3. **Detecção de origem** (binária, confirmada com o usuário): lê `createdfrom` do Credit Memo.
   - Aponta para **Return Authorization** → `originType = 'RMA_SCRAP'`.
   - Aponta para **Invoice** → `originType = 'INVOICE_DIRECT'`.
   - Não há terceiro caminho a tratar (usuário confirmou que `createdfrom` do Credit Memo só assume
     um desses dois tipos).
4. Quando `RMA_SCRAP`: carrega também o registro da Return Authorization vinculada (e, a partir dela,
   o Invoice de origem da RMA, via `createdfrom` da própria RMA) para extrair os dados necessários
   ao bloco de Special Instructions e à coluna "Shipped".
5. Monta os parâmetros via `manipulateCreditMemoPdf(creditMemoRecord, originType, ...)` (módulo novo).
6. Renderiza via `pd_pdf_credit_memo_layout_module.getXml(params)`.
7. Nome do arquivo: `CM_{creditMemoNumber}.pdf`.

> **Nota sobre o campo de guarda:** o campo `custbody_pd_pdf_invoice_pdf_dc` do Invoice hoje é só
> **lido** como guarda — nenhum ponto do código atual grava valor nele, e se ele estiver populado o
> Suitelet do Invoice provavelmente quebra (`getXml(null)`). Decisão confirmada com o usuário: o
> Credit Memo replica **apenas esse mesmo padrão de leitura/guarda**, herdando a mesma lacuna —
> **não** há gravação nova de PDF nesse campo em nenhum dos dois fluxos. Não é escopo deste card
> implementar a gravação (nem aqui, nem retroativamente no Invoice). Campo cadastrado em
> [MANIFEST.md](./MANIFEST.md).

**Regras de cálculo e negócio:**

- **Título:** "Invoice" → "Credit Memo".
- **Identificação:** label "Invoice #:" → "CM #:".
- **Rótulo financeiro:** "Payable in" → "Credit in" (moeda continua dinâmica via `currencysymbol`,
  sem mudança na lógica).
- **Data/hora de emissão:** `trandate`/`createddate` do próprio Credit Memo (mesma formatação
  `formatDateUS`/`formatTimeAMPM` já usada no Invoice).
- **Valores (Total Amt, Subtotal, Total, "in USD"):** calculados sobre as linhas do próprio Credit
  Memo — mesma lógica de soma `subTotal`/`miscChargeTotal` do Invoice, replicada para o CM.
- **Coluna "Shipped":**
  - `RMA_SCRAP`: usa a quantidade **solicitada na linha correspondente da RMA** vinculada (não a
    quantidade da própria linha do CM). Pareamento de linha CM↔RMA é **1:1 por item** — usuário
    confirmou que não pode haver mais de uma linha do mesmo item no RMA nem no Credit Memo, então
    não há ambiguidade nem necessidade de campo de referência de linha adicional.
  - `INVOICE_DIRECT`: usa a quantidade da **própria linha do Credit Memo** (mesma fonte já usada
    hoje no Invoice, sem RMA envolvida).
- **Remoções de layout (em relação ao Invoice)** — em todos os casos abaixo, remove-se a
  caixa/container visual inteiro que envolve o conteúdo (reflow do layout ao redor), não apenas o
  valor do campo:
  - "Prepared By" (coluna 1 do bloco de campos de corpo).
  - "Ship To" (bloco de endereços).
  - "Final Destination" (bloco de endereços).
  - Bloco inteiro de "AWB".
  - Bloco inteiro de "Number of Boxes" (e "Weight" associado, mesma coluna).
  - "Box Dimensions" (tabela inteira).
  - "Total NET Weight" e "Total Gross Weight" (linhas do box de totais).
  - "Payment Amt", "Payment Type", "Payment Owed" (linhas do box de totais).
  - Bloco "Signature" (inteiro, ao final do documento).

**Special Instructions (substitui o texto livre atual do Invoice por um bloco estruturado,
variando por `originType`):**

- `RMA_SCRAP` — segue o texto literal fornecido pelo usuário:
  ```
  This is a credit note DO NOT PAY
  Invoice {invoiceNumberFromRma} - RMA {rmaNumber}
  Wrong Material: {returnReason}
  Authorized Signature: SA
  ```
  - `invoiceNumberFromRma` = `tranid` do Invoice de origem da RMA (`createdfrom` da própria RMA).
  - `rmaNumber` = `tranid` da Return Authorization vinculada ao Credit Memo.
  - `returnReason` = valor do campo `custbody_pd_motivo_rma_scrap` (Custom Body Field na Return
    Authorization) — ver [MANIFEST.md](./MANIFEST.md).
  - "This is a credit note DO NOT PAY" e "Authorized Signature: SA" são texto estático fixo — "SA"
    são iniciais fixas, não um lookup dinâmico (confirmado pelo usuário).

- `INVOICE_DIRECT` — segue o texto literal fornecido pelo usuário:
  ```
  This is a credit note DO NOT PAY
  Invoice {invoiceNumber}
  Authorized Signature: SA
  ```
  - `invoiceNumber` = `tranid` do Invoice apontado por `createdfrom` do próprio Credit Memo.
  - Sem referência a RMA, sem linha "Wrong Material".

## Decisões de arquitetura

- Layout do Credit Memo é módulo irmão (`pd_pdf_credit_memo_layout_module.js`), cópia adaptada do
  layout do Invoice — não parametrização do módulo existente. Decisão confirmada com o usuário:
  garante zero alteração no template original do Invoice, aceitando a duplicação de HTML/CSS como
  trade-off, consistente com o precedente já estabelecido pelo Packing List neste mesmo projeto.
- `pd_pdf_const_module.js` recebe edição aditiva (`PRINT_CREDIT_MEMO`), sem alterar as entradas
  existentes (`PRINT_INVOICE`, `PRINT_PACK_LIST`).
