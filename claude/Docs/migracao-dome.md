# Migração Aloia → SuiteScripts/Dome/ (DEV-623)

Branch: `refactor/DEV-623` (a partir da `main` em `e1b753e`).
Profundidade: **só mover + ajustar** — lógica não mudou, exceto os exports do pd_sie (ver abaixo).

## Estrutura final

```
SuiteScripts/Dome/
├── libs/            contents.js, fonts/GreatVibes-Regular.ttf (availablewithoutlogin=T)
├── pd_invoice/      pd_pdf_transaction, pd_pdf_ata_106, pd_lgl_logistics_label,
│                    pd_ccr_commission_report, pd_uoc_update_operation_cost, pd_sie_invoice_email
├── pd_sales_order/  pd_cso_special_order, pd_pow_purchasing_owner, pd_dcr_dynamic_commission_rate,
│                    pd_ctf_clear_transactions_fields, pd_cvs_convert_data
├── pd_purchase_order/        pd_tno_tracking_number_order
├── pd_purchase_requisition/  pd_prd_purchase_requisition_deletion
├── pd_inbound_shipment/      pd_iss_inbound_shipment_sync
├── pd_item_receipt/          pd_frf_fill_receive_fields, pd_fld_fill_fields
├── pd_vendor_bill/           pd_pos_purchase_order_saving
├── pd_payment/               pd_sem_send_email_payment
├── pd_employee/              pd_aev_employee_to_vendor
├── pd_bank_layout/           pd_blc_bank_layout_conversion
└── pd_tools/                 pd_adm_admin_tools (mass delete, delete from search, SuiteQL tool)
```

Dentro de cada projeto: `client/ user_event/ suitelet/ restlet/ map_reduce/ mass_update/ service/ use_case/ modules/ ui/`.

Fora do escopo (ficaram onde estavam): `suitecode/`, `dev_suitecode/`, `po_form.js`, `PDFStructureCOFC-v2.SL.js`
e a lib `projectdome/pd_c_netsuite_tools/` (não está no repo; os requires apontam pra ela por caminho absoluto).

## O que mudou no código
- Requires relativos, `clientScriptModulePath` e caminho da fonte ajustados pro novo lugar.
- Requires da `pd_c_netsuite_tools` → `/SuiteScripts/projectdome/pd_c_netsuite_tools/...` (absoluto).
- `<scriptfile>` dos 66 objetos SDF dos projetos movidos atualizado.
- Renomeados: `item_receipt/modules/pd_frf_search_module.js` → `modules/pd_frf_item_receipt_search_module.js`
  (colidia com o outro `pd_frf_search_module.js`; ninguém faz require dele) e
  `suiteql-query-tool.v20211027.suitelet (3) 1.js` → `suiteql-query-tool.v20211027.suitelet.js`.
- **Exports pro pd_sie**: ATA-106/COFC ganharam `getGroupPlan`/`generatePdf` (renderPdf aceita context nulo);
  Invoice/Packing List ganharam `generatePdf`. Comportamento via HTTP igual.

## Já quebrados antes da migração (não mexi)
- `pd_ccr/user_event/pd-ccr-vendor-bill.userevent.js`: require de 4 services que não existem; sem objeto SDF.
- `pd_sem/service/pd-sem-email-template-*.service.js`: erro de sintaxe (template string) e ninguém usa.
- `manipulateInvoicePdf` retorna `null` se a Invoice já tem `custbody_pd_pdf_invoice_pdf_dc` → PDF da Invoice falha.

## Deploy na Sandbox
1. `suitecloud account:setup` → criar auth da sandbox (ex: `ALOIA-SB`). **Não** trocar o `defaultAuthId` do `project.json`.
2. `suitecloud project:validate --server --authid ALOIA-SB`
3. `suitecloud project:deploy --authid ALOIA-SB`
4. Scripts sem objeto SDF → trocar o Script File na mão: pd_sie (`customscript_pd_sie_invoice_email_suitelet`),
   `pd_fld_item_receipt_ue`, `pd-pow-sales-order-daily.mapreduce`, `delete_from_search_mr` (se existirem na conta).
5. Os arquivos antigos continuam em `projectdome/` e `project_dome/` no File Cabinet (SDF não apaga).
   Só apagar depois de validar em produção.

## Trazidos da sandbox (não estavam no repo)
- `customscript_pd_sie_invoice_email_suitelet` — objeto SDF novo (o script não existia na SB1). Parâmetro
  `custscript_pd_sie_override_email` vazio; deployment RELEASED pra todos os papéis (ajustar audiência se quiser restringir).
- `customscript_pd_pow_control_daily_mr` — objeto exportado da SB1, agora aponta pra
  `Dome/pd_sales_order/pd_pow_purchasing_owner/map_reduce/pd-pow-sales-order-daily.mapreduce.js` (arquivo já estava no repo).
- `customscript_pd_tno_update_datefields_ue` + `customscript_pd_tno_update_datefields` (scheduled, backfill) — código
  copiado da raiz de `SuiteScripts/` da SB1 (hash conferido) para `Dome/pd_purchase_order/pd_tno_tracking_number_order/`.
  Usam `custrecord_pd_tno_ship_date` / `custrecord_pd_tno_delivery_date`: **confirmar que existem em produção antes de subir**.

## Não migrado de propósito
- **Credit Memo (DEV-845)** — está na branch `origin/feat/dev845`, não mergeada. Ela altera módulos compartilhados com a
  Invoice (`pd_pdf_const_module`, `pd_pdf_search_module`, `pd_pdf_utils_module`). Na SB1 os scripts de Credit Memo continuam
  usando as cópias antigas em `project_dome/pd_pdf_transaction/` (intactas). A DEV-845 precisa ser rebaseada em cima desta
  branch (arquivos em `Dome/pd_credit_memo/...` ou `Dome/pd_invoice/pd_pdf_transaction/`) antes de entrar na `main`.
- `inbound-in-transit.js` (raiz da SB1) — não tem script `customscript_pd_*` apontando pra ele.

## Pastas antigas
Não apagar `projectdome/` e `project_dome/` enquanto a DEV-845 não for migrada (Credit Memo usa os módulos antigos) e
enquanto `pd_c_netsuite_tools` continuar lá.

## Checklist de teste (acionar cada script pelo menos 1x)

**pd_bank_layout/pd_blc_bank_layout_conversion**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_blc_convt_bank_layout_ue` | userevent | customrecord_pd_blc_bank_lay_convert |

**pd_employee/pd_aev_employee_to_vendor**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_aae_employeetovendorue` | userevent | EMPLOYEE |
| [ ] | `customscript_pd_aae_update_vendor` | client | VENDOR |

**pd_inbound_shipment/pd_iss_inbound_shipment_sync**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_iss_inbshipment_ue` | userevent | INBOUNDSHIPMENT |

**pd_invoice/pd_ccr_commission_report**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_ccr_approve_comission` | restlet | — |
| [ ] | `customscript_pd_ccr_comission_history_rt` | restlet | — |
| [ ] | `customscript_pd_ccr_comission_history_st` | suitelet | — |
| [ ] | `customscript_pd_ccr_comission_paymt_rt` | restlet | — |
| [ ] | `customscript_pd_ccr_comission_paymt_st` | suitelet | — |
| [ ] | `customscript_pd_ccr_comission_report_ue` | userevent | customrecord_pd_ccr_approval_comission |
| [ ] | `customscript_pd_ccr_commission_approv_mr` | mapreduce | — |
| [ ] | `customscript_pd_ccr_create_comission_ue` | userevent | INVOICE |
| [ ] | `customscript_pd_ccr_create_vendor_bill` | restlet | — |
| [ ] | `customscript_pd_ccr_payment_details` | restlet | — |
| [ ] | `customscript_pd_ccr_search_comission` | restlet | — |
| [ ] | `customscript_pd_ccr_view_commission` | suitelet | — |

**pd_invoice/pd_lgl_logistics_label**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_lgl_print_log_label_sl` | suitelet | — |
| [ ] | `customscript_pd_lgl_print_log_lib_ue` | userevent | INVOICE |

**pd_invoice/pd_pdf_ata_106**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_aae_cofc_pdf_sl` | suitelet | — |
| [ ] | `customscript_pd_aae_generationpdfue` | userevent | INVOICE |
| [ ] | `customscript_pd_aae_structurepdfsl` | suitelet | — |

**pd_invoice/pd_pdf_transaction**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_pdf_invoice_ue` | userevent | INVOICE |
| [ ] | `customscript_pd_pdf_print_invoice_sl` | suitelet | — |
| [ ] | `customscript_pd_pdf_print_pack_list_sl` | suitelet | — |

**pd_invoice/pd_uoc_update_operation_cost**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_uoc_update_op_cost_sl` | suitelet | — |
| [ ] | `customscript_pd_uoc_update_op_cost_ue` | userevent | INVOICE, SALESORDER |

**pd_item_receipt/pd_frf_fill_receive_fields**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_frf_rec_ind_ship_rl` | restlet | — |
| [ ] | `customscript_pd_frf_recei_ind_ship_ue` | userevent | RECEIVEINBOUNDSHIPMENT |
| [ ] | `customscript_pd_frf_receive_fields_ue` | userevent | ITEMRECEIPT |
| [ ] | `customscript_pd_frf_receive_fields_ue` | userevent | ITEMRECEIPT |

**pd_payment/pd_sem_send_email_payment**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_sem_send_email_sl` | suitelet | — |
| [ ] | `customscript_pd_sem_send_email_ue` | userevent | CUSTOMERPAYMENT, VENDORPAYMENT |

**pd_purchase_order/pd_tno_tracking_number_order**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_tno_inbound_track_num_ue` | userevent | INBOUNDSHIPMENT |
| [ ] | `customscript_pd_tno_track_notificat_ue` | userevent | customrecord_pd_tno_track_notification |
| [ ] | `customscript_pd_tno_track_number_orde_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_tno_tracking_number_rt` | restlet | — |

**pd_purchase_requisition/pd_prd_purchase_requisition_deletion**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_prd_purc_req_deletion_st` | suitelet | — |
| [ ] | `customscript_pd_prd_purc_req_deletion_ue` | userevent | PURCHASEREQUISITION |

**pd_sales_order/pd_cso_special_order**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_cso_button_requis_ord_ue` | userevent | SALESORDER |
| [ ] | `customscript_pd_cso_pcdord_slord_sync_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_cso_purchase_order_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_cso_purchase_requ_st` | suitelet | — |
| [ ] | `customscript_pd_cso_purchase_requis_ue` | userevent | PURCHASEREQUISITION |
| [ ] | `customscript_pd_cso_purchase_spl_ord_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_cso_purchord_propagat_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_cso_sales_order_cs` | client | SALESORDER |
| [ ] | `customscript_pd_cso_sales_order_ue` | userevent | SALESORDER |

**pd_sales_order/pd_ctf_clear_transactions_fields**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_ctf_clear_tran_fields_cs` | client | SALESORDER |

**pd_sales_order/pd_cvs_convert_data**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_cvs_transaction_cl` | client | SALESORDER |

**pd_sales_order/pd_dcr_dynamic_commission_rate**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_dcr_purchase_order_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_dcr_sales_order_ue` | userevent | SALESORDER |

**pd_sales_order/pd_pow_purchasing_owner**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_pow_purch_requisition_mr` | mapreduce | — |
| [ ] | `customscript_pd_pow_purch_requisition_ue` | userevent | PURCHASEREQUISITION |
| [ ] | `customscript_pd_pow_purchase_order_ue` | userevent | PURCHASEORDER |
| [ ] | `customscript_pd_pow_sales_order_mr` | mapreduce | — |
| [ ] | `customscript_pd_pow_sales_order_ue` | userevent | SALESORDER |

**pd_tools/pd_adm_admin_tools**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_item_mass_delete` | mapreduce | — |
| [ ] | `customscript_pd_mass_delete` | massupdate | ALLOCATIONSCHEDULE, CASHSALE, JOURNALENTRY, LOTNUMBEREDINVENTORYITEM, PURCHASEORDER, PURCHASEREQUISITION, SALESORDER, SERIALIZEDINVENTORYITEM, VENDORPAYMENT, VENDORPREPAYMENT |
| [ ] | `customscript_pd_suiteql` | suitelet | — |

**pd_vendor_bill/pd_pos_purchase_order_saving**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_pos_comm_approval_po_rt` | restlet | — |
| [ ] | `customscript_pd_pos_comm_approval_po_st` | suitelet | — |
| [ ] | `customscript_pd_pos_commission_approv_mr` | mapreduce | — |
| [ ] | `customscript_pd_pos_commission_paym_rt` | restlet | — |
| [ ] | `customscript_pd_pos_commission_paym_st` | suitelet | — |
| [ ] | `customscript_pd_pos_vendor_bill_ue` | userevent | VENDORBILL |
| [ ] | `customscript_pd_pos_vendor_payment_ue` | userevent | VENDORPAYMENT |

**po_form.js**

| ok | Script | Tipo | Record |
|---|---|---|---|
| [ ] | `customscript_pd_po_form` | userevent | PURCHASEORDER |
