# DEV-623: validação na Sandbox (06/11/2026)

## 1. Repo (`refactor/DEV-623` @ `cf57555`)
- 181 `.js` em `Dome/`: requires, `clientScriptModulePath` e caminhos de arquivo resolvem. Zero `projectdome/`, `project_dome/` ou `Dome/libs/pd_c_netsuite_tools`.
- 70 `<scriptfile>` existem (69 em `Dome/` + `customscript_pd_po_form` → `/SuiteScripts/po_form.js`, que **está** no repo mas fora do `deploy.xml`).
- `node --check`: só falham os 2 `pd-sem-email-template-*.service.js` (já quebrados). Requires inexistentes só no `pd-ccr-vendor-bill.userevent.js` (já quebrado).
- `deploy.xml` cobre `Dome/*` → `pd_c_netsuite_tools` vai junto.
- Obs.: já existe `origin/refactor/DEV-623` (local está 1 commit à frente: `cf57555`).

## 2. Sandbox
- `cf57555` está na SB (config.json da lib e 34 arquivos com require `/SuiteScripts/Dome/pd_c_netsuite_tools/` iguais ao repo; deploy 06/11 08:18).
- 69 scripts do repo apontam exatamente pro arquivo do repo em `Dome/`.
- Scripts fora de `Dome/` (qualquer prefixo): `customscript_pd_pdf_credit_memo_ue` e `_print_credit_memo_sl` (`project_dome/pd_pdf_transaction/credit_memo/`), `customscript2334` (inativo, `projectdome/delete_from_search_mr.js`), `customscript_pd_po_form` (`po_form.js`), `customscript_inbound_in_transit` (`inbound-in-transit.js`).
- `Dome/pd_c_netsuite_tools`: 35/35 arquivos do repo; sobra uma pasta `.git/` (55 arquivos de 2025, lixo).
- `libs/`: 6 arquivos com `Dome/libs/...` corretos; fonte 457.588 bytes, disponível sem login. Nenhuma cópia sem `libs/` em `Dome/`.
- Name lookup do util de Suitelet (pega o arquivo modificado mais recente): 9 estáticos vêm hoje de `project_dome/pd_c_netsuite_tools` (upload de 26/10). 20 são idênticos; `pd-cntst-autocomplete-handler.js` e `pd-cntst-bootstrap-table-handler.js` da `project_dome` são versões **mais novas** (footer/multi-select) que não estão em nenhum branch. Nenhuma tela de `Dome/` usa esses recursos.

## 3. Testes (sem gravar)
- Invoice 249478: Invoice, Packing List, ATA-106 e COFC → PDF com `GreatVibes-Regular` embutida; etiqueta → PDF (Courier, sem fonte custom, esperado).
- Botões: Invoice (ATA, COFC, Print Invoice, Pack List, Shipping Label, Update Op. Cost), SO (Update Op. Cost), pagamentos cliente/fornecedor (Send Payment Email), Employee 4533 (Update Vendor). Botão CSO de requisição não aparece porque o script está inativo no repo e na SB.
- 11 client scripts carregam via `require`.
- Suitelets ccr (3), pos (2), pd_sie: telas abrem. RESTlets: todos carregam; `pos_comm_approval_po_rt`/`pos_commission_paym_rt` falham com `custrecord_pd_pos_pas_invoice` (conhecido).
- Logs: `customscript_pd_uoc_update_op_cost_ue` registrou 12× `MODULE_DOES_NOT_EXIST .../pd_pdf_ata_106/client/pd-uoc-update-operating-cost.client.js` (caminho relativo do client resolvido pela pasta do UE da ATA). Botão e client aparecem certos ao abrir a Invoice agora. Correção sugerida: caminho absoluto.
- Logs: `customscript_pd_ccr_commission_approv_mr` está **Scheduled** na SB, com 741 erros no reduce (`UNEXPECTED_ERROR` no search do `pd-ccr-invoice.service`). Não é caminho, mas conferir o agendamento na PROD.
- `customscript_pd_suiteql`: "no privileges" para Administrator. O XML do repo tem audiência vazia (`allroles=F`, sem papéis). Mesma coisa em `cso_purchord_propagat_ue` (RELEASED), `cso_purchase_spl_ord_ue` e `tno_inbound_track_num_ue` (TESTING).

## 4. Pode mover para `SuiteScripts/_obsoleto_DEV-623` (só com ok)
`projectdome/`: `pd_c_special_order`, `pd-c-aev`, `pd_c_commission_report`, `pd_ctf_clear_transactions_fields`, `pd_dcr_dynamic_commission_rate`,
`pd_inbound_shipment_synchronization`, `pd_mass_delete`, `pd_purchase_order_saving`, `pd_purchasing_owner`, `pd_prd_purchase_requisition_deletion`,
`pd_sem_send_email_billpayment`, `pd_tno_tracking_number_order`, `pd_uoc_update_operation_cost`, `pd_blc_bank_layout_conversion`,
`suiteql-query-tool.v20211027.suitelet (3) 1.js`, `pd_pdf_ata_106/` **exceto** `Fonts/`.
`project_dome/`: `pd_pdf_lgl_logitics_label`, `pd_frf_fill_receive_fields`, `pd_cvs_convert_data`, `pd_fld_fill_fields`, `pd_item_mass_delete`.
Raiz: `pd_tno_update_datefields.js`, `pd_tno_update_datefields_ue.js`, `PDFStructureCOFC-v2.SL.js` (nenhum script aponta).
`Dome/pd_c_netsuite_tools/.git/`.

**Ficam:** `project_dome/pd_pdf_transaction/` inteira (Credit Memo usa `modules/`, `layout/` e `credit_memo/`), `projectdome/pd_pdf_ata_106/Fonts/` (fonte do Credit Memo),
`project_dome/pd_c_netsuite_tools/` (nenhum script usa, mas tem as 2 versões mais novas citadas acima; `projectdome/pd_c_netsuite_tools` não existe na SB),
`projectdome/delete_from_search_mr.js` (até repontar o 2334), `po_form.js`, `inbound-in-transit.js`.
Mover não muda o name lookup (os arquivos continuam na conta).

## 5. Produção (segunda)
1. Importar da PROD numa cópia temporária com `project.json` = `ALOIA-PROD`:
   `suitecloud object:import --type ALL --scriptid <70 ids de src/Objects/custom_script> --destinationfolder /Objects/prod --excludefiles`
   Copiar os XMLs para `claude/prod_import/` (não commitar) e rodar `python claude/tools/compare_prod.py claude/prod_import`.
   Olhar: `isinactive` (5 scripts estão inativos no repo), audiência vazia, status, agendamento dos MR, parâmetros (`custscript_pd_sie_override_email`).
2. Na PROD (SuiteQL): `SELECT scriptid FROM customfield WHERE scriptid IN ('CUSTRECORD_PD_TNO_SHIP_DATE','CUSTRECORD_PD_TNO_DELIVERY_DATE','CUSTRECORD_PD_POS_PAS_INVOICE')`
   e os 3 custom records do manifest (`customrecord_pd_blc_bank_lay_convert`, `customrecord_pd_ccr_approval_comission`, `customrecord_pd_tno_track_notification`).
3. Rollback: worktree da `main` (`e1b753e`) com `deploy.xml` só com os objetos (sem FileCabinet). Os arquivos antigos continuam no File Cabinet da PROD (o SDF não apaga). Scripts novos (pd_sie, pow_control_daily, tno_update_datefields): inativar.
4. `project.json` → `ALOIA-PROD` só na hora; `validate` antes do `deploy`; voltar para `ALOIA-SB` depois.
5. Depois do deploy: Ctrl+F5, gerar os 4 PDFs + etiqueta de uma Invoice e abrir as telas.
