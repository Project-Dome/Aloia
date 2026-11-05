# pd_sie — Send Invoices by Email (Aloia Aerospace)

> Pasta `claude/` vai só pro git, nunca pro File Cabinet.

## Estrutura (padrão Dome)

```
SuiteScripts/Dome/
├── libs/contents.js                         IDs (campo de e-mail do cliente, script/deploy, parâmetro de override)
└── pd_invoice/pd_sie_invoice_email/
    ├── suitelet/pd-sie-invoice-email.suitelet.js     entry point: GET = tela, POST = roteia action -> use_case
    ├── use_case/
    │   ├── pd-sie-list-customers.use_case.js         action listCustomers
    │   ├── pd-sie-search-invoices.use_case.js        action searchInvoices
    │   ├── pd-sie-preview-email.use_case.js          action previewEmail
    │   ├── pd-sie-send-invoice-email.use_case.js     action sendEmail
    │   └── pd-sie-load-history.use_case.js           action loadHistory
    ├── service/
    │   ├── pd-sie-customer.service.js                lista clientes / Customer Invoice Email
    │   ├── pd-sie-invoice.service.js                 SuiteQL de invoices
    │   ├── pd-sie-attachment.service.js              gera PDFs (require dos Suitelets legados)
    │   ├── pd-sie-email.service.js                   email.send + override de teste
    │   └── pd-sie-message.service.js                 Communication History
    ├── modules/pd-sie-email-template.module.js       assunto/corpo/preview
    └── ui/pd-sie-invoice-email.html|.js              tela (sem alteração)
```

## Dependências legadas (não migradas, caminho absoluto)
- `/SuiteScripts/projectdome/pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util` (serve HTML/JS no GET)
- `/SuiteScripts/project_dome/pd_pdf_transaction/invoice/suitelet/pd_pdf_invoice_sl` e `pd_pdf_packing_list_sl`
- `/SuiteScripts/projectdome/pd_pdf_ata_106/EntryPoints/PDFStructure.SL` e `PDFStructureCOFC.SL`
  (os 4 exportam `generatePdf` / `getGroupPlan`)

## IDs
- Script: `customscript_pd_sie_invoice_email_suitelet` / `customdeploy_pd_sie_invoice_email_suitelet`
- Parâmetro: `custscript_pd_sie_override_email` (Free-Form Text; vazio em produção)
- Campo do cliente: `custentity_atlas_customer_invoice_email`

## Mudanças de comportamento no refactor
- `getCustomerInvoiceEmail`: `record.load` trocado por `search.lookupFields` (menos cota).
- Status/tipo da SuiteQL de invoices viraram parâmetros (`?`) vindos do contents.js.
- Resto: mesma lógica, só separada em camadas.

## Pendências conhecidas
1. Coluna AMOUNT vazia na tela (inspecionar o `<td>` no DevTools).
2. Communication History sem data e sem tranid (coluna de data / join do search `message` não confirmados).
3. Regra "Available/None" simplificada: os 3 badges = "invoice tem linha de item".
4. Body com `overflow:hidden` pode cortar o Communication History.
5. `$.modal` da Dome não usado — `confirm()`/`alert()` nativos.
6. `manipulateInvoicePdf` retorna null se `custbody_pd_pdf_invoice_pdf_dc` já estiver preenchido.
7. Sandbox redireciona e-mails (Setup > Company > Email Preferences).
