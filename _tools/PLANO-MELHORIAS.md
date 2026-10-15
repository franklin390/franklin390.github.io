# Plano de melhorias do portfólio (documento vivo)

Origem: análise crítica de 2026-10-14 (design, recrutador, dono de empresa, par técnico; mercado global).
Este arquivo fica em `_tools/`, que o GitHub Pages não publica. Atualizamos a cada decisão.

## Regras do jogo

- **Nenhum fato novo entra sem a sua confirmação.** O gate G0 prova os fatos contra o PDF do LinkedIn e o G12 barra tecnologia ou número inventado. O que só você sabe (custo absoluto, stack real, disponibilidade) vai para uma seção "confirmado pelo dono" do ledger.
- Toda mudança passa por `npm run verify` e pelo comparador de layout (`out/layout-snap.mjs`). Os CVs em EN/PT/ES acompanham o site.
- Não trocamos um padrão de layout (carrosséis, por exemplo) sem você decidir antes.
- PT e ES seguem o inglês: o texto novo nasce em `js/i18n/en.js`, depois `pt.js`/`es.js`, depois `npm run build:site`.

## Decisões tomadas

| # | Pergunta | Resposta | Data |
|---|---|---|---|
| D1 | Objetivo principal do portfólio agora | Os dois: ser encontrado por recrutadores e empresas **e** atrair consultoria ou projetos como autônomo (o contato precisa de dois caminhos) | 2026-10-14 |
| D2 | Posicionamento (Staff individual × líder de dados × os dois) | Staff individual: autoridade técnica e arquitetura em primeiro plano; liderar o time aparece como consequência | 2026-10-14 |
| D3 | Experiência: como mostrar os 7 papéis | Faixa de relance acima do carrossel (o carrossel continua com o detalhe) | 2026-10-14 |
| D5 | Tagline do hero | "I design the architecture of the Databricks platform a whole company runs on, from lakehouse to governance and cost." (PT/ES traduzidos) | 2026-10-14 |
| D6 | Seção About (5 parágrafos) | Manter como está | 2026-10-14 |
| D7 | Contato | Dois caminhos, cada um com seu botão de e-mail (assunto no idioma da página). **Revisado:** o primeiro cartão virou "Oportunidades" (qualquer tipo: tempo integral, contrato ou parceria, sem limite de nível) e o segundo "Projetos" (inclui qualquer outro desafio de dados); conteúdo centralizado; assuntos do e-mail sem "Staff" | 2026-10-14 |
| D8 | Escala das métricas | Só faixas ou ordem de grandeza (sem valores exatos) | 2026-10-14 |
| D9 | Âncora de custo | Gasto anual da plataforma antes do corte: seis dígitos em USD (faixa, nunca valor exato). Entra como fato confirmado pelo dono | 2026-10-14 |
| D10 | Contexto da empresa | Deixar sem contexto (fica só "Flutter Brazil") | 2026-10-14 |
| D11 | Disponibilidade no caminho Hiring | Não dizer nada | 2026-10-14 |
| D12 | Âncoras de escala (faixas) | Milhares de tabelas, milhares de pessoas usando a plataforma, milhares de jobs por dia. Frescor: "há diferentes frequências" (não publicado como valor único) | 2026-10-14 |
| D13 | Resumo do CV e bullet do Staff | Opção A nos dois: arquitetura e escala em primeiro, liderança do time em segundo plano (no CV PT/ES o bullet é mais curto, por causa do limite de 2 páginas) | 2026-10-14 |
| D14 | "MBA em Engenharia de Dados (XP Educação)" | É um MBA: mantém o rótulo. Registrado no ledger como confirmado pelo dono | 2026-10-14 |
| D15 | PDFs de certificados com nome completo | Manter como está | 2026-10-14 |
| D16 | Fim do Tech Lead | Jun/2026 confirmado (o aviso de data derivada saiu do ledger) | 2026-10-14 |
| D17 | Crédito do tema (Kards, StyleShout) no rodapé | Manter como está (só o crédito no cabeçalho do CSS) | 2026-10-14 |
| D18 | Decisão "por que Databricks" | Card 10, largura total, só com as suas seleções: pesou (uma plataforma para lote, ML e BI; governança com Unity Catalog; custo e desempenho; habilidades do time), alternativas consideradas (continuar no Redshift e na AWS nativa, Snowflake, BigQuery no Google Cloud), maiores riscos (migrar sem parar o negócio, paridade dos dados, custo na transição) e o que faria diferente (FinOps e domínios com donos mais cedo). Sem números, sem datas, sem dizer que o Databricks foi melhor ou mais barato (regra proibida no ledger) | 2026-10-14 |
| D19 | Decisão de FinOps | Card 11, largura total, categoria "Cost & reliability", só com as suas marcações: priorizou (visibilidade do gasto, os maiores geradores de custo, dimensionamento dos clusters, agendamento dos jobs), trade-offs administrados (custo x frescor, custo x desempenho, autonomia x regras, tempo de engenharia x economia), o que sustentou a economia (previsão de custo, atribuição por domínio ou dono, alertas e dashboards, políticas e guardrails) e o que faria diferente (tags e atribuição desde o primeiro dia, alertas automáticos mais cedo, envolver os domínios mais cedo). Não diz que algum pipeline ficou mais lento | 2026-10-14 |
| D20 | GDPR | Os processos de proteção de dados (Clicksign) "seguem também o GDPR": texto "alinhados ao GDPR" no card de proteção, no papel e no CV, e "seguem a LGPD e o GDPR" no card de serviço. SOC 2, ISO 27001 e "GDPR compliant/certified" ficam proibidos no ledger | 2026-10-14 |
| D21 | Certificações Databricks ou AWS | Não tem e não pretende agora: a seção de certificados fica como está | 2026-10-14 |
| D22 | Decisão de Unity Catalog por domínio | Card 12, largura total, categoria Governance, só com as suas marcações: por que por domínio (responsabilidade por área, acesso e segurança, atribuição de custo, descoberta e qualidade de dados), trade-offs (controle central x autonomia, quantos domínios, retrabalho em tabelas e permissões, padrão x flexibilidade), o que funcionou (donos e padrões, provisionamento como código, sem citar ferramenta) e o que faria diferente (automatizar o provisionamento e as permissões mais cedo, linhagem e documentação desde o início) | 2026-10-14 |
| D23 | Quarta decisão (CI/CD com trunk-based) e commit | Três cards de decisão bastam (o CI/CD já tem o card 05). Commit: ainda não, o site local fica para você olhar primeiro | 2026-10-15 |
| D4 | Os 13 projetos de ML antigos | Recolhidos atrás de um botão, fechado por padrão | 2026-10-14 |

## Fase 1: ajustes sem fatos novos (eu faço, cerca de uma sessão)

| ID | Ponto fraco | Mudança | Depende de |
|---|---|---|---|
| 1.1 | Custo não está em primeiro; Impact pesado no celular | **Feito.** Ordem: custo, incidentes, fontes, domínios, pipelines, time. No celular, 2 colunas. O CV (EN/PT/ES) segue a mesma ordem | D2 |
| 1.2 | "Staff liderando 15+ pessoas" soa como gestor | **Parcial.** Tagline e descrição do site (meta, Open Graph) já em Staff individual. About fica como está (D6). Falta o resumo do CV, que repete a frase do About: decidir se muda | D2 |
| 1.3 | Carrosséis escondem os papéis 2 a 7 | **Feito.** Faixa "carreira de relance": uma linha por papel, com o resultado, e clique que abre o papel no carrossel | D3 |
| 1.4 | 13 projetos de ML antigos diluem o perfil | **Feito.** O título e a frase continuam visíveis; o carrossel fica atrás do botão "Show the 13 projects" (e as imagens só baixam ao abrir) | D4 |
| 1.5 | Cards 08 (LTV) e 09 (GenAI) finos | Fundir os dois em um card "Also", ou enriquecer depois da Fase 2 | Fase 2 |
| 1.6 | About com 5 parágrafos antes das skills | **Decidido: manter** (D6) | decisão rápida |
| 1.7 | Ícones pretos sobre magenta no Impact | **Feito.** Rosa claro, branco ao passar o mouse | nenhuma |
| 1.8 | Contato só com links | **Feito:** dois caminhos (Hiring, Projects), com analytics por caminho (`email_hiring` e `email_projects`). Falta a linha de disponibilidade e fuso | D1 e 2.3 |
| 1.9 | Foto de 90 px, sem rosto na primeira tela | Foto maior no About, ou no hero | 2.9 |

## Fase 2: fatos que só você tem (uma pergunta por vez)

| ID | O que preciso | Resolve |
|---|---|---|
| 2.1 | Escala e linha de base. **Custo: feito** (seis dígitos USD por ano, no case de FinOps, no papel de Tech Lead e nos CVs). **Escala: feito** (milhares de pessoas no papel de Staff e nos CVs; milhares de tabelas e de jobs por dia no case de migração). Frescor não publicado: você disse que há frequências diferentes | Métricas relativas sem âncora; volume modesto |
| 2.2 | ~~Uma linha sobre o que a empresa faz~~ **Decidido: sem contexto (D10)** | "Flutter Brazil" ambíguo com o framework da Google (risco aceito) |
| 2.3 | Disponibilidade no Hiring: **decidido não dizer nada (D11)**. Ainda aberto: fuso (UTC-3), regime (CLT, PJ, contractor) e disponibilidade para o caminho Projects | Filtro de recrutador global |
| 2.4 | Stack realmente usado em produção: Spark/PySpark, Delta Lake, Terraform, streaming, Databricks Workflows, Docker/K8s, GitHub Actions | Lacuna que o par técnico procura |
| 2.5 | Decisões com trade-off. **Feito:** card 10 ("Por que Databricks, e o que eu mudaria", D18) e card 11 ("FinOps: prioridades e trade-offs", D19). **Feito:** card 12 ("Unity Catalog por domínio: motivos e trade-offs", D22). CI/CD com trunk-based **dispensado (D23)** | Falta de profundidade de Staff |
| 2.6 | **Feito (D20):** GDPR confirmado, SOC 2 e ISO 27001 não | LGPD sem referência global |
| 2.7 | **Decidido (D21):** sem certificação Databricks ou AWS por enquanto | Certificados só locais |
| 2.8 | Três pessoas que aceitariam deixar uma recomendação pública | Prova social |
| 2.9 | Foto profissional atual | Rosto na primeira tela |

## Fase 3: autoridade pública (fora do site; eu rascunho, você publica)

| ID | Entrega | Resolve |
|---|---|---|
| 3.1 | Artigo: "Como cortar mais de 50% do custo de uma plataforma Databricks" (com os números que você autorizar) | GitHub e web sem conteúdo seu |
| 3.2 | Artigo: Unity Catalog por domínio, decisões e armadilhas | Profundidade técnica pública |
| 3.3 | Repositório de referência sanitizado (lakehouse + dbt + CI/CD trunk-based) com diagrama no README | Par técnico abre o GitHub e vê só projetos de curso |
| 3.4 | Proposta de talk para um meetup ou evento de dados | Autoridade além do TDC de 2021 |
| 3.5 | README do perfil do GitHub apontando para o portfólio | Link de entrada |
| 3.6 | Seção "Writing" no site, só quando houver 2 itens publicados | Evidência visível |

## Fase 4: refresh visual (opcional, depois das fases 1 a 3)

| ID | Mudança | Resolve |
|---|---|---|
| 4.1 | Hero próprio (foto ou arte com a sua paleta) no lugar da placa de circuito | Cara de tema pronto |
| 4.2 | Diagrama simples em 2 ou 3 cases | Profundidade visual |
| 4.3 | Rever o rodapé "Design by" e os restos do tema | Cara de template |

## Fase 5: validar

| ID | Ação |
|---|---|
| 5.1 | Teste dos 5 segundos com 5 pessoas (recrutador, líder, par técnico, alguém de fora da área, alguém de fora do Brasil): "o que ele faz e quanto vale?" |
| 5.2 | Depois de 30 dias, ler no GA4: `cv_download`, `contact_click`, `section_dwell`, `scroll_depth`, idioma. Meta: subir os dois cliques em relação à base de hoje |
| 5.3 | Reler os CVs com as mesmas mudanças (o CV é o documento que mais circula) |

## Mapa: ponto fraco → onde é resolvido

| Ponto fraco | Fase |
|---|---|
| Visual de tema pronto, placa de circuito | 4.1, 4.3 |
| Ícones pretos no Impact, coluna longa no celular | 1.1, 1.7 |
| Foto pequena | 1.9, 2.9 |
| Carrosséis escondem conteúdo | 1.3 |
| About longo | 1.6 |
| Sem disponibilidade, fuso, contrato | 1.8, 2.3 |
| Soa como gestor, não como Staff | 1.2, 2.5 |
| "Flutter Brazil" ambíguo | 2.2 |
| Certificados só locais | 2.7 |
| LGPD sem GDPR | 2.6 |
| Métricas relativas, sem escala | 2.1 |
| Custo não é o primeiro número | 1.1 |
| Volume modesto | 2.1 (reenquadrar por complexidade, sem inflar) |
| Sem decisões e trade-offs | 2.5, 3.1, 3.2 |
| Stack incompleto | 2.4 |
| GitHub fraco, sem escrita nem diagramas | 3.1 a 3.6, 4.2 |
| Projetos antigos de ML | 1.4 |
| Cards finos | 1.5 |
| Sem prova social | 2.8 |
