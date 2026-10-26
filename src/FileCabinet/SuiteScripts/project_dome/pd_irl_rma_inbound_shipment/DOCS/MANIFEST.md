# Project Manifest: pd_irl — RMA Inbound Shipment

**Cliente:** Aloia
**Gerado em:** 26/10/2026
**Versão do Spec:** —
**Gerado por:** manifest-builder

---

## Scripts

| Script ID | Arquivo | Tipo | Record Alvo | Descrição |
|-----------|---------|------|-------------|-----------|
| `customscript_pd_irl_inbo_ship_rma_us` | `IRL_RmaInboundShipments.UE.js` | UserEvent | `returnauthorization` | Adiciona a subaba "Inbound Shipments Vinculados" ao Return Authorization nos modos VIEW e EDIT (EP1) |

> Deploy ID do script `customscript_pd_irl_inbo_ship_rma_us`: `customdeploy_pd_irl_inbo_ship_rma_us`.

---

## Custom Records

### `customrecord_pd_irl_rma_link` — Vínculo RMA x Inbound Shipment

Registro de ligação entre Return Authorization e Inbound Shipment.

| Campo | Internal ID | Tipo | Descrição |
|-------|-------------|------|-----------|
| RMA | `custrecord_pd_irl_rma` | List/Record | Vínculo com o registro nativo Return Authorization (`returnauthorization`) |
| Inbound Shipment | `custrecord_pd_irl_shipment` | List/Record | Vínculo com o registro nativo Inbound Shipment (`inboundshipment`) |

---