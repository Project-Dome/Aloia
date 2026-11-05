# Migração Aloia → SuiteScripts/Dome/

Escopo: todos os projetos de `projectdome/` (17) e `project_dome/` (6) num PR só.
Profundidade: **só mover + ajustar** (renomear pastas, corrigir requires, `clientScriptModulePath`,
paths hardcoded e `<scriptfile>` dos objetos SDF). Lógica não muda.

Fora do escopo: `suitecode/`, `dev_suitecode/` (outro fornecedor), `po_form.js` e
`PDFStructureCOFC-v2.SL.js` (soltos na raiz de SuiteScripts).

## Mapeamento proposto (agrupado pelo record principal)

| Destino `Dome/...` | Origem | Records onde roda |
|---|---|---|
| `libs/contents.js` | novo | — |
| `libs/pd_c_netsuite_tools/` | `projectdome/pd_c_netsuite_tools` (**não está no repo**) | — |
| `libs/fonts/GreatVibes-Regular.ttf` | `projectdome/pd_pdf_ata_106/Fonts` | — |
| `pd_invoice/pd_pdf_transaction` | `project_dome/pd_pdf_transaction` | Invoice |
| `pd_invoice/pd_pdf_ata_106` | `projectdome/pd_pdf_ata_106` | Invoice |
| `pd_invoice/pd_lgl_logistics_label` | `project_dome/pd_pdf_lgl_logitics_label` | Invoice |
| `pd_invoice/pd_sie_invoice_email` | já migrado | Invoice |
| `pd_invoice/pd_ccr_commission_report` | `projectdome/pd_c_commission_report` | Invoice, custom record approval |
| `pd_invoice/pd_uoc_update_operation_cost` | `projectdome/pd_uoc_update_operation_cost` | Invoice, SO |
| `pd_sales_order/pd_cso_special_order` | `projectdome/pd_c_special_order` | SO, PO, PR |
| `pd_sales_order/pd_pow_purchasing_owner` | `projectdome/pd_purchasing_owner` | SO, PO, PR |
| `pd_sales_order/pd_dcr_dynamic_commission_rate` | `projectdome/pd_dcr_dynamic_commission_rate` | SO, PO |
| `pd_sales_order/pd_ctf_clear_transactions_fields` | `projectdome/pd_ctf_clear_transactions_fields` | SO |
| `pd_sales_order/pd_cvs_convert_data` | `project_dome/pd_cvs_convert_data` | SO |
| `pd_purchase_order/pd_tno_tracking_number_order` | `projectdome/pd_tno_tracking_number_order` | PO, Inbound Shipment, custom record |
| `pd_purchase_requisition/pd_prd_purchase_requisition_deletion` | `projectdome/pd_prd_purchase_requisition_deletion` | PR |
| `pd_inbound_shipment/pd_iss_inbound_shipment_sync` | `projectdome/pd_inbound_shipment_synchronization` | Inbound Shipment |
| `pd_item_receipt/pd_frf_fill_receive_fields` | `project_dome/pd_frf_fill_receive_fields` | Item Receipt, Receive Inbound Shipment |
| `pd_item_receipt/pd_fld_fill_fields` | `project_dome/pd_fld_fill_fields` | Item Receipt |
| `pd_vendor_bill/pd_pos_purchase_order_saving` | `projectdome/pd_purchase_order_saving` | Vendor Bill, Vendor Payment |
| `pd_payment/pd_sem_send_email_payment` | `projectdome/pd_sem_send_email_billpayment` | Customer Payment, Vendor Payment |
| `pd_employee/pd_aev_employee_to_vendor` | `projectdome/pd-c-aev` | Employee, Vendor |
| `pd_bank_layout/pd_blc_bank_layout_conversion` | `projectdome/pd_blc_bank_layout_conversion` | custom record bank layout |
| `pd_tools/` | `delete_from_search_mr.js`, `pd_mass_delete`, `pd_item_mass_delete`, `suiteql-query-tool` | utilitários admin |

Subpastas internas viram só o tipo: `pd_ccr_restlet` → `restlet`, `pd_pow_user_event` → `user_event`,
`EntryPoints` → separado em `client/`, `user_event/`, `suitelet/`, `UseCases` → `use_case`,
`*_static` → `ui`, `layout` → `modules`, `lib` (xlsx) → `modules`.

## O que precisa ser ajustado no código
- ~40 arquivos (ccr, cso, iss, pos, pow, sem) fazem `require('../../pd_c_netsuite_tools/...')`.
- `cso_sales_order.service` depende de `pow_sales_order.service` (cross-project).
- `clientScriptModulePath` relativo em 7 UEs (aev, cso, prd, sem, uoc, lgl, pdf_transaction).
- Caminho da fonte de assinatura hardcoded em 3 lugares (ATA-106, COFC, pd_pdf_const_module).
- `<scriptfile>` de 65 objetos em `src/Objects` (55 projectdome + 10 project_dome).

## Bloqueios antes do deploy
1. **`pd_c_netsuite_tools` não está no repo** (pasta vazia). Importar da conta:
   `suitecloud file:import --paths "/SuiteScripts/projectdome/pd_c_netsuite_tools"`.
   Sem isso, os requires apontam por caminho absoluto pro local antigo.
2. **Repo ≠ conta**: `pd-ccr-vendor-bill.userevent.js` faz require de 4 services que não existem no repo
   (e o arquivo não tem objeto SDF — provavelmente morto). `pd_fld`, `CreatePDF.CS`, `pd_sie` também
   não têm objeto SDF. Recomendado `suitecloud file:import` de `projectdome/` e `project_dome/`
   inteiros pra garantir que o repo bate com a conta antes de mover.
3. **`project.json` aponta pra `ALOIA-PROD`**. Configurar auth de sandbox e validar lá primeiro.
4. **SDF não apaga arquivo**: os antigos continuam no File Cabinet depois do deploy. Manter até validar
   (rollback = voltar o `<scriptfile>`), depois apagar manualmente.
5. Scripts sem objeto SDF (pd_sie, pd_fld, etc.): trocar o Script File na mão.
6. Referências fora do repo (workflow actions, Advanced PDF templates, CSV imports salvos) não aparecem
   aqui — conferir na conta.
