# Project Manifest: pd_pdf_transaction — Impressão de PDF de Transações

**Cliente:** Aloia
**Gerado em:** 04/11/2026 (atualizado: cadastro dos campos `custbody_related_so` e `custbody_pd_authorized_signature`)
**Versão do Spec:** TECH-SPEC.md (card DEV-845) — rodada de validação em Sandbox (Sales Order/Terms e Authorized Signature dinâmico)
**Gerado por:** manifest-builder

> **Escopo desta versão:** este é o primeiro MANIFEST do módulo `pd_pdf_transaction`. Por decisão do
> time, ele **não retroage** sobre os objetos já existentes de Invoice e Packing List — cataloga
> **somente os objetos novos** da feature "Print Credit Memo" (card DEV-845) e a única edição aditiva
> em arquivo existente (constantes compartilhadas). Os objetos legados de Invoice/Packing List
> permanecem não documentados até que uma rodada própria os cubra.

---

## Scripts

| Script ID | Arquivo | Tipo | Record Alvo | Descrição |
|-----------|---------|------|-------------|-----------|
| `customscript_pd_pdf_credit_memo_ue` | `credit_memo/userevent/pd_pdf_credit_memo_ue.js` | UserEvent | `CREDITMEMO` | Adicionar o botão "Print Credit Memo" e definir o client script module da transação Credit Memo |
| `—`¹ | `credit_memo/client/pd_pdf_credit_memo_cl.js` | ClientScript | `CREDITMEMO` | Implementar a lógica client-side do botão "Print Credit Memo" |
| `customscript_pd_pdf_print_credit_memo_sl` | `credit_memo/suitelet/pd_pdf_credit_memo_sl.js` | Suitelet | — | Gerar e exibir o PDF do Credit Memo |

**Deploy IDs:**

| Script ID | Deploy ID |
|-----------|-----------|
| `customscript_pd_pdf_credit_memo_ue` | `customdeploy_pd_pdf_credit_memo_ue` |
| `customscript_pd_pdf_print_credit_memo_sl` | `customdeploy_pd_pdf_print_credit_memo_sl` |

> ¹ O Client Script não possui script record/deployment próprio no NetSuite — é carregado via
> `form.clientScriptModulePath = "../client/pd_pdf_credit_memo_cl"` pelo User Event
> `customscript_pd_pdf_credit_memo_ue` acima, seguindo o mesmo padrão do `pd_pdf_invoice_cl.js`
> (Invoice) já existente.
>
> Os IDs do Suitelet acima também são registrados em `CUSTOM_SCRIPT.SUITELET.PRINT_CREDIT_MEMO`,
> no módulo de constantes compartilhado `modules/pd_pdf_const_module.js` — ver nota de edição
> aditiva ao final deste documento.

---

## Módulos Auxiliares (sem Script Record)

Arquivos JS puros, sem `@NScriptType`, que não geram script record próprio no NetSuite. São
consumidos via `define` pelo Suitelet acima, seguindo o mesmo padrão dos módulos irmãos já
existentes para Invoice (`layout/pd_pdf_invoice_layout_module.js` e `modules/pd_pdf_utils_module.js`).

| Arquivo | Expõe | Usado por | Descrição |
|---------|-------|-----------|-----------|
| `layout/pd_pdf_credit_memo_layout_module.js` | `getXml` | `customscript_pd_pdf_print_credit_memo_sl` | Fornecer o XML de layout do PDF do Credit Memo |
| `modules/pd_pdf_credit_memo_utils_module.js` | `manipulateCreditMemoPdf` | `customscript_pd_pdf_print_credit_memo_sl` | Extrair e formatar os dados do Credit Memo para o PDF e detectar a origem da transação (RMA vinculado ou não) |

---

## Custom Records

Nenhum custom record novo nesta feature.

---

## Campos Customizados em Records Nativos

### `returnauthorization` — Return Authorization

| Campo | Internal ID | Tipo | Descrição |
|-------|-------------|------|-----------|
| Return Reason | `custbody_pd_motivo_rma_scrap` | A confirmar¹ | Armazenar o motivo do retorno (Return Reason) da RMA, usado para preencher a linha "Wrong Material" das Special Instructions no cenário RMA/SCRAP do Credit Memo PDF |

> ¹ Label exibido e tipo de dado exato (free text, list/record etc.) ainda não confirmados pelo
> usuário/ambiente NetSuite. Internal ID é real (confirmado no TECH-SPEC.md) — confirmar apenas o
> tipo na implementação.

### `creditmemo` — Credit Memo

| Campo | Internal ID | Tipo | Descrição |
|-------|-------------|------|-----------|
| PDF Credit Memo (DC) | `custbody_pd_pdf_credit_memo_pdf_dc` | A confirmar² | Servir de campo auxiliar análogo a `custbody_pd_pdf_invoice_pdf_dc` (Invoice), para o fluxo de PDF do Credit Memo |
| Related SO | `custbody_related_so` | A confirmar³ (List/Record — Sales Order) | Resolver o número da Sales Order relacionada exibido no template ("Sales Order:") e servir de fonte do Terms do Credit Memo (lido da Sales Order relacionada, não do próprio registro) |
| Authorized Signature | `custbody_pd_authorized_signature` | List/Record (Employee) | Armazenar o funcionário cujo nome completo substitui o texto estático "SA" na linha "Authorized Signature:" das Special Instructions do Credit Memo |

> ² Internal ID definido pelo usuário seguindo o padrão de nomenclatura já estabelecido no projeto
> (`custbody_pd_pdf_<entidade>_pdf_dc`), por isso tratado como real (não marcado com `*`). Tipo de
> dado exato a confirmar — o campo análogo do Invoice (`custbody_pd_pdf_invoice_pdf_dc`) também não
> possui XML de objeto em `src/Objects`, só referência em código (leitura em
> `manipulateInvoicePdf`, módulo `pd_pdf_utils_module.js`), então seu tipo tampouco está confirmado.
>
> ³ Internal ID confirmado diretamente pelo usuário nesta rodada (não vem de XML nem de TECH-SPEC
> anterior) — campo **pré-existente no ambiente, não gerenciado por este projeto SDF**. Evidência:
> aparece como `sourcelist` em outros campos custom do projeto (ex.: `custbody_pd_so_customer.xml`),
> mas não possui XML de definição própria aqui. Papel funcional (campo que referencia a Sales Order
> relacionada da transação) está confirmado; detalhes formais do tipo (ex.: `sourcefilter`, se é o
> mesmo campo em todos os tipos de transação) permanecem a confirmar por falta de XML próprio.

---

## Edição Aditiva em Arquivo Existente

### `modules/pd_pdf_const_module.js`

Arquivo de constantes compartilhado entre as features de Invoice, Packing List e Credit Memo deste
módulo. Esta rodada adiciona uma nova entrada em `CUSTOM_SCRIPT.SUITELET`, sem alterar as entradas
já existentes (`PRINT_INVOICE`, `PRINT_PACK_LIST`):

```js
PRINT_CREDIT_MEMO: {
    ID: "customscript_pd_pdf_print_credit_memo_sl",
    DEPLOY: "customdeploy_pd_pdf_print_credit_memo_sl"
}
```

---

## Notas / Pendências

- **`custbody_pd_authorized_signature` candidato a objeto SDF próprio:** este campo foi criado
  diretamente na UI do Sandbox e **não existe em nenhum XML deste projeto SDF nem em nenhum código**
  até o momento — por isso já "desapareceu" uma vez num refresh de sandbox e precisou ser recriado.
  É candidato natural a virar `customfield` XML deste projeto, para sobreviver a futuros refreshes,
  mas essa decisão **ainda não foi tomada** pelo usuário — não assumir, apenas sinalizar aqui até
  que seja pedida explicitamente (ex.: ao `sdf-generator`).
