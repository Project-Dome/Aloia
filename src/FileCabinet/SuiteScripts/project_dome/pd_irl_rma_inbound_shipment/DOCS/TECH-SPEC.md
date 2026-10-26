# TECH-SPEC — pd_irl_rma_inbound_shipment

**Cliente:** Aloia
**Versão:** 0.1 (rascunho)
**Última atualização:** 22/10/2026

---

## 1. Contexto e objetivo

Quando um RMA é aberto, a empresa eventualmente precisa receber fisicamente a mercadoria retornada
através de um Inbound Shipment. Hoje esse vínculo entre o RMA e o(s) Inbound Shipment(s)
correspondente(s) não é visível de forma direta dentro do próprio RMA. Este projeto cria uma
visualização consolidada dentro do RMA, além de uma tela dedicada para criar esses vínculos.

## 2. Visão geral da solução

A solução tem duas partes:
- Uma subaba dentro do RMA que lista todos os Inbound Shipments já vinculados a ele (EP1).
- Uma tela de criação personalizada, acessada via menu, para criar um novo Inbound Shipment e
  vinculá-lo a um RMA (EP2 + EP3).

O vínculo entre RMA e Inbound Shipment é modelado por um custom record dedicado — ver
`customrecord_pd_irl_rma_link` no MANIFEST.md.

## 3. Pendências explícitas

- **Internal IDs nativos** de `returnauthorization`, `inboundshipment` e dos campos customizados
  citados neste documento (`otherrefnum`, `salesrep`, `custcol_pd_partnumbercustomer`, etc.) ainda
  não foram confirmados em conta real — aguardando liberação de acesso ao conector NetSuite (Aloia
  produção, 11559462) ou fornecimento manual pelo usuário. Até lá, os nomes de campo usados neste
  documento são os **nomes funcionais/script IDs conhecidos**, não confirmados contra a conta. Os 4
  campos nativos adicionados ao formulário do EP2 (seção 6) — Bill Of Lading, Expected Shipping
  Date, Expected Delivery Date e Memo — seguem a mesma pendência: os internal IDs prováveis
  (`billofladingno`, `expectedshippingdate`, `expecteddeliverydate`, `memo`, baseados em padrão
  conhecido do NetSuite) ainda não foram verificados contra a conta real.
- **Existência de `custcol_pd_partnumbercustomer` na linha de item do RMA** — presumida, não
  confirmada. Precisa validação quando o acesso à conta for liberado.
- **Cadeia de joins RMA → Invoice → Sales Order → Purchase Order → Vendor** (coluna "Vendor" da
  subaba) — viabilidade técnica da busca salva com múltiplos níveis de `createdfrom` ainda não
  validada na conta real. Risco técnico a confirmar na implementação.
- **Requisito técnico 5** do documento de regras original (nova saved search inspirada na "PRE
  ALERT", id=1759 em produção) — as colunas da subaba já foram fechadas (seção 5 abaixo), mas os
  filtros/critérios de busca em si ainda não foram desenhados em detalhe.

## 4. Premissas e escopo assumidos

- **RMA de item único:** assume-se que, no caso comum, um RMA tem uma única linha de item. A subaba
  (EP1) exibe **uma linha por vínculo** (RMA + Shipment), não uma linha por item. Se surgirem RMAs
  com múltiplos itens, colunas como PN e Location podem não refletir corretamente todos os itens
  (simplificação aceita pelo usuário).
- **Escopo explícito da tela de criação (EP2):** embora o modelo de dados permita, em tese, que
  **1 Inbound Shipment agregue N RMAs**, esta primeira versão da tela de criação **sempre cria um
  Inbound Shipment novo** a cada uso — não existe fluxo de usuário para selecionar um Inbound
  Shipment **já existente** e vincular um RMA adicional a ele. Vincular múltiplos RMAs ao mesmo
  Shipment fica **fora de escopo** desta entrega. Isso é uma decisão de escopo, não uma limitação
  técnica do modelo de dados — não deve ser lido como bug em versões futuras.

---

## 5. Entrypoint 1 — UserEvent (beforeLoad) em Return Authorization: subaba "Inbound Shipments Vinculados"

**Necessidade funcional:** permitir que o usuário, ao abrir um RMA, veja diretamente quais Inbound
Shipments já foram vinculados a ele (fluxo 3.1 do documento de regras de negócio original).

**Tipo de entrypoint:** UserEventScript, evento `beforeLoad`, restrito aos modos `VIEW` e `EDIT`, no
record nativo `returnauthorization`.
*Justificativa:* a subaba precisa aparecer toda vez que o RMA é visualizado ou editado; `beforeLoad`
é o ponto de extensão padrão para adicionar sublists de UI ao form nativo.

**Comportamento:**
- `beforeLoad` (VIEW, EDIT): monta um sublist de UI (tipo `LIST`) no form do RMA, com o rótulo
  "Inbound Shipments Vinculados" (nome definitivo a confirmar).
- Executa uma busca sobre `customrecord_pd_irl_rma_link` (ver MANIFEST), filtrada por
  `custrecord_pd_irl_rma = [id do RMA atual]`.
- Preenche o sublist com uma linha por vínculo encontrado (ver premissa de RMA de item único,
  seção 4).

**Objetos consultados:** `customrecord_pd_irl_rma_link` (ver MANIFEST — campos
`custrecord_pd_irl_rma`, `custrecord_pd_irl_shipment`).

**Colunas exibidas e origem do dado (regra de negócio):**

| Coluna | Origem | Observação |
|---|---|---|
| Número do RMA | `tranid` nativo do RMA | |
| Customer | `entity` nativo do RMA | |
| PO Customer | `otherrefnum` nativo do RMA | rótulo mantido como "PO Customer" apesar do dado ser o PO/Check Number nativo |
| SA | `salesrep` nativo do RMA | campo nativo, não o customizado da cadeia SO/PO |
| PN | `custcol_pd_partnumbercustomer` da linha de item do RMA | existência a confirmar (pendência, seção 3) |
| Vendor | cadeia RMA → Invoice (`createdfrom`) → Sales Order (`createdfrom`) → Purchase Order → Vendor | risco técnico a validar (pendência, seção 3) |
| Location | `location` nativo do RMA | |
| Invoice | `createdfrom` do RMA | |

**Decisões de arquitetura:**
- Nenhuma coluna "rica" adicional (status do shipment, tracking/AWB, carrier, datas de
  compromisso, hazmat, UOM etc.) entra nesta subaba — essas informações permanecem exclusivas da
  saved search "PRE ALERT" de referência já existente (id=1759, produção), que não é afetada por
  este projeto.

---

## 6. Entrypoint 2 — Suitelet: criação de Inbound Shipment vinculado a um RMA

**Necessidade funcional:** permitir que o usuário crie um novo Inbound Shipment já vinculado a um
RMA de origem, com uma tela mais simples que o fluxo nativo de criação (que exige seleção de linhas
de PO) (fluxo 3.2 do documento de regras de negócio original).

**Tipo de entrypoint:** Suitelet, acessado via item de menu dedicado.
*Justificativa:* é uma tela de UI customizada e autônoma, sem relação de evento com um record
nativo existente — Suitelet é o entrypoint padrão para isso.

**Comportamento:**

- **GET:** renderiza formulário customizado com:
  - campo **RMA** (List/Record, fonte Return Authorization) — a lista de opções **exclui** RMAs que
    já possuem vínculo registrado em `customrecord_pd_irl_rma_link` (ver regra de negócio 1 abaixo).
  - campo **Location** — desabilitado/somente leitura na tela, preenchido automaticamente pelo
    Client Script (EP3) assim que o usuário seleciona o RMA.
  - campo **Bill Of Lading** (texto livre, nativo de `inboundshipment`) — editável, opcional, igual
    ao comportamento da tela nativa de criação de Inbound Shipment.
  - campo **Expected Shipping Date** (data, nativo de `inboundshipment`) — editável, opcional.
  - campo **Expected Delivery Date** (data, nativo de `inboundshipment`) — editável, opcional.
  - campo **Memo** (texto livre, nativo de `inboundshipment`) — editável, opcional.

- **POST (salvar):**
  1. Cria o registro nativo `inboundshipment`, **sem linhas de item/PO** (gravado com
     `ignoreMandatoryFields: true` — ver decisão de arquitetura abaixo), com o campo `location`
     preenchido com o location do RMA selecionado, além dos 4 campos lidos do formulário — Bill Of
     Lading, Expected Shipping Date, Expected Delivery Date e Memo (gravados quando preenchidos
     pelo usuário; todos opcionais).
  2. Cria o registro de vínculo `customrecord_pd_irl_rma_link`, com `custrecord_pd_irl_rma` = RMA
     selecionado e `custrecord_pd_irl_shipment` = Inbound Shipment recém-criado.

**Objetos manipulados:**
- `inboundshipment` (nativo) — criado sem linhas de item.
- `customrecord_pd_irl_rma_link` (ver MANIFEST) — criado.

**Regras de negócio:**
1. **RMA único por Shipment:** um RMA não pode ser vinculado a mais de um Inbound Shipment. A tela
   impede ativamente essa situação **filtrando a lista de opções do campo RMA** — RMAs já
   vinculados a outro Shipment (existência de registro em `customrecord_pd_irl_rma_link`) não
   aparecem como opção selecionável.
2. **Location herdado:** o campo Location do Inbound Shipment criado é sempre herdado do RMA
   selecionado, não editável nesta tela (regra 4.2 do documento original).
3. **Sempre cria um Shipment novo:** esta tela **sempre** cria um Inbound Shipment novo a cada uso
   — não há opção de vincular um RMA a um Shipment já existente (ver escopo explícito, seção 4).

**Decisões de arquitetura:**
- Criação do `inboundshipment` via `record.create()` + `save({ ignoreMandatoryFields: true })`,
  dado que o record nativo normalmente exige ao menos uma linha de item/PO para ser salvo pela tela
  padrão do NetSuite — aqui o shipment é criado como "container" sem linhas.

---

## 7. Entrypoint 3 — Client Script: auto-preenchimento de Location na tela de criação

**Necessidade funcional:** dar feedback imediato ao usuário, preenchendo e bloqueando o campo
Location assim que ele seleciona o RMA de origem, sem esperar o submit do formulário.

**Tipo de entrypoint:** ClientScript, anexado ao Suitelet do EP2.
*Justificativa:* a regra de negócio (Location herdado e não editável) precisa de resposta reativa
na UI — `fieldChanged` é o ponto de extensão padrão para isso.

**Comportamento:**
- `fieldChanged` (campo RMA): ao selecionar um RMA, consulta o location desse RMA e preenche o
  campo Location da tela, mantendo-o desabilitado para edição manual.

**Objetos consultados:** `returnauthorization` (nativo) — campo `location`.

---

## MANIFEST — referência

Objetos deste projeto cadastrados em `MANIFEST.md`:
- `customrecord_pd_irl_rma_link` — ver seção "Custom Records" do MANIFEST.