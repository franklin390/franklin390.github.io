# Medição do portfólio (Google Tag Manager + GA4)

Este arquivo é **gerado** por `node build-gtm.mjs` a partir de `facts/analytics.json`. Não edite à mão: mude o catálogo e gere de novo. A gate **G13** confere, com um navegador real, que o site envia exatamente o que está descrito aqui.

## O que o site envia

O site empurra eventos para o `dataLayer` do contêiner **GTM-PNSXVNR** (arquivo `js/analytics.js`). Todo evento carrega `site_language` (en, pt ou es). **Nenhum dado pessoal** viaja: nada de e-mail, telefone, nome completo ou texto digitado.

| Evento | Quando dispara | Parâmetros |
|---|---|---|
| `site_context` | Once per page view, after the language is resolved. | `language_source`, `browser_language`, `device_class`, `reduced_motion` |
| `language_toggle` | The visitor switches language with the EN | PT | ES buttons. | `from_language`, `to_language`, `method` |
| `cv_download` | Click on a CV download button. | `file_name`, `cv_language`, `location` |
| `contact_click` | Click on e-mail (the top icon, or the Hiring / Projects button of the Contact section), LinkedIn or GitHub. | `method`, `location` |
| `outbound_click` | Click on a link that leaves the site (company, event, episode, project, Credly). | `link_type`, `link_domain`, `location` |
| `certificate_open` | Click on a certificate PDF. | `file_name`, `location` |
| `nav_click` | Click on the logo, a navigation link or a row of the career-at-a-glance list (via glance, item = the role id). | `item`, `via` |
| `menu_toggle` | Open or close of the hamburger menu (small screens). | `state` |
| `impact_stat_click` | Click on a number of the Impact section. | `item` |
| `case_filter` | A theme filter of the case studies is chosen. | `item` |
| `case_view` | A case card stays 2 s on screen (60% visible), once per card. | `item` |
| `project_open` | A project of the earlier-projects carousel is opened. | `item` |
| `carousel_navigate` | A carousel moves to another slide. | `item`, `slide` |
| `training_toggle` | The full list of courses (item courses) or the early machine learning projects (item early_projects) is opened or closed. | `item`, `state` |
| `content_toggle` | A button that folds content on phones is pressed: the rest of the About text (item about_more), all skills (skills_more), all case studies (work_more) or the role details of the Experience carousel (experience_detail). state: open or close. | `item`, `state` |
| `skill_hover` | The pointer rests 0.5 s on a skill tag (once per skill, at most 15 per visit). | `item` |
| `section_view` | A section is under the middle of the screen for 2 active seconds (once per section). | `item` |
| `section_dwell` | The tab is hidden or closed: one event per section with 3+ active seconds. | `item`, `seconds` |
| `scroll_depth` | 25, 50, 75 and 100% of the page height reached. | `percent` |
| `engagement_summary` | The tab is hidden or closed: totals for the visit so far. | `total_seconds`, `sections_seen`, `max_scroll_percent` |
| `back_to_top` | Click on the back-to-top button. | — |
| `page_print` | The page is printed. | — |
| `js_error` | A script of this site throws (at most 3 per visit). | `message`, `file` |

Quem envia o sinal **Global Privacy Control** ou **Do Not Track** não gera nenhum evento, e recebe consentimento de analytics "negado" antes de o GTM carregar.

## Como ligar no GTM (5 minutos)

1. No GTM, abra o contêiner **GTM-PNSXVNR** → **Administrador → Importar contêiner**.
2. Escolha `gtm/portfolio-container.json`, selecione um espaço de trabalho **novo** e a opção **Mesclar** (renomear itens em conflito).
3. Abra a variável **Const - GA4 Measurement ID** e troque `G-XXXXXXXXXX` pelo ID da sua propriedade GA4 (formato `G-…`, em *GA4 → Administrador → Fluxos de dados*). Esse ID é público (aparece no código de qualquer site); não é uma senha.
4. Se o contêiner **já tinha** uma tag "Google tag" / GA4 com o mesmo ID, apague a **GA4 - Google tag** importada (para não contar a visita duas vezes). Mantenha a **GA4 - Event - portfolio**.
5. **Visualizar** (Tag Assistant), navegue pelo site e confira os eventos. Depois **Enviar → Publicar**.

O contêiner importado tem 1 tag Google, 1 tag de evento GA4 (que repassa todos os eventos acima), 2 acionadores (evento personalizado e inicialização, os dois só no seu domínio) e 25 variáveis, mais a variável embutida **Page Hostname**. Se o GTM recusar o arquivo, crie à mão: um acionador "Evento personalizado" com regex `^(site_context|language_toggle|cv_download|contact_click|outbound_click|certificate_open|nav_click|menu_toggle|impact_stat_click|case_filter|case_view|project_open|carousel_navigate|training_toggle|content_toggle|skill_hover|section_view|section_dwell|scroll_depth|engagement_summary|back_to_top|page_print|js_error)$`, uma tag "Evento do Google Analytics: GA4" com nome de evento `{{Event}}` e, nos parâmetros, cada nome abaixo apontando para uma variável de camada de dados de mesmo nome.

## Cópias do site em outros domínios (dados que não são seus)

Quem copiar a página do jeito que está leva junto o código do GTM (`GTM-PNSXVNR`). Sem proteção, cada visita à cópia chegaria ao seu GA4 como se fosse sua, com o nome do host da cópia. Há três camadas:

1. **Na página** (`index.html`): o GTM só carrega se o endereço for `franklin390.github.io`. Uma cópia em outro domínio, ou um arquivo salvo aberto do disco, nem baixa o GTM. A gate G13 confere isso abrindo a página sob um domínio falso.
2. **No contêiner** (este arquivo): as duas tags só disparam quando a variável **Page Hostname** casa com `^(franklin390\.github\.io)$`. Vale mesmo que o copiador apague a camada 1, porque o contêiner mora no Google e ele não consegue editá-lo. Depois de publicar, `npm run check:gtm-live` prova isso com uma cópia sem a trava.
3. **No GA4**, para o que já entrou antes e para o que nenhuma trava impede: em **Explorar**, use a dimensão **Nome do host** (Hostname) igual a franklin390.github.io como filtro ou comparação. Os dados já gravados não são apagados; só deixam de aparecer nos relatórios filtrados.

**Se você já tinha importado o contêiner antes**, importe de novo no mesmo espaço de trabalho: **Importar contêiner → Mesclar → Substituir** os itens com o mesmo nome. Confira que a tag **GA4 - Google tag** usa o acionador **Init - my site only** e que **CE - portfolio events** ganhou a condição *Page Hostname corresponde à regex*. Se o GTM recusar o arquivo, faça à mão: ative a variável embutida **Page Hostname** (Variáveis → Configurar), crie o acionador "Inicialização" com a condição *Page Hostname corresponde à regex* `^(franklin390\.github\.io)$` e use-o na tag Google; no acionador de evento personalizado, adicione a mesma condição.

**Limites que nenhuma trava resolve:**

- O ID `G-…` é público. Quem quiser pode enviar visitas falsas direto ao Google, sem passar pelo seu site nem pelo GTM, e até forjar o nome do host. Os filtros de dados do GA4 existem só para tráfego interno e de desenvolvedor; não há lista de domínios permitidos. É raro, e o filtro por host nos relatórios é a defesa possível.
- Um site que **embute** o seu num `<iframe>` carrega a página no seu domínio de verdade, então esses acessos contam (o referenciador mostra de onde vieram).
- **O seu computador também fica de fora:** em `localhost` ou com o arquivo aberto do disco, nada é enviado, de propósito. Para testar o GTM, use a visualização (Tag Assistant) no site publicado.

## Contagem duplicada: o que já está garantido e o que só você controla

**Garantido no site** (a gate G13 confere isso em todo `npm run verify`):

- O GTM é o **único** carregador de analytics da página: nada de `gtag.js` direto, nem ID de medição ou outro rastreador fixo no HTML.
- **Cada ação gera exatamente os eventos planejados**, sem repetir: clique no CV, contato, link externo, menu, número de impacto, filtro, carrossel, projeto, troca de idioma. Um clique que também move um carrossel sozinho não conta como "navegação" no carrossel.
- O site **nunca chama `history.pushState/replaceState` de um jeito que o GTM/gtag interceptem**. A troca de idioma atualiza `?lang=` pelo método nativo do navegador. Sem isso, o GA4 (com a opção de histórico ligada) contava uma página nova a cada troca de idioma; medido com o GTM de verdade, era 1 `page_view` a mais por troca.
- Sair da página (aba oculta + fechamento) reporta **uma vez**: um `engagement_summary` e um `section_dwell` por seção.
- No contêiner gerado, a tag de evento dispara **uma vez por evento** e a tag do Google **uma vez por página**.

**Só você controla** (cinco minutos, uma vez):

1. **Só uma tag do Google com o seu ID** no contêiner. Se você restaurar a antiga "Google Analytics", cada visita passa a contar duas vezes.
2. **GA4 → Administrador → Fluxos de dados → seu fluxo Web → Métrica otimizada:** desligue **Rolagens**, **Cliques de saída** e **Downloads de arquivos**. Os eventos do site fazem o mesmo com mais detalhe (`scroll_depth`, `outbound_click`, `cv_download`). Na engrenagem de "Visualizações de página", desligue **Mudanças de página com base em eventos do histórico do navegador**. Se preferir manter algum deles ligado, **nunca marque `file_download` ou `click` como evento-chave junto com `cv_download`**, ou a conversão conta duas vezes.
3. **Eventos-chave:** apenas `cv_download`, `contact_click`.
4. **Filtros de dados** (Administrador → Coleta e modificação de dados → Filtros de dados): ative **Tráfego de desenvolvedor** (e, se quiser, **Tráfego interno** com o seu IP). Assim os testes com o Tag Assistant não entram nos relatórios.
5. **Depois de publicar o contêiner, rode `npm run check:gtm-live`** (precisa de internet). Ele carrega o seu contêiner publicado de verdade, faz cliques e conta quantos envios ao GA4 cada ação gera, sem mandar nada ao Google. Esperado: **1 `page_view` na visita inteira** e cada evento na quantidade certa.

## Configurar no GA4 (uma vez)

**Eventos-chave** (antes "conversões"): `cv_download`, `contact_click`.

**Definições personalizadas → dimensões (escopo: evento):** `site_language`, `item`, `slide`, `location`, `method`, `state`, `link_type`, `cv_language`, `from_language`, `to_language`, `language_source`, `browser_language`, `device_class`, `via`.

**Definições personalizadas → métricas (escopo: evento):** `seconds`, `percent`, `total_seconds`, `sections_seen`, `max_scroll_percent`.

(Sem registrar, os dados chegam, mas os parâmetros não aparecem nos relatórios. Leva até 24 h para começar a aparecer.)

## Perguntas que isso responde

| Pergunta | Onde olhar |
|---|---|
| Em que idioma o site é mais lido? | Explorar → evento `site_context` por `site_language` (usuários). `browser_language` × `site_language` mostra quem teve de trocar de idioma |
| As pessoas trocam de idioma? | Evento `language_toggle`, `from_language` → `to_language` |
| Que CV é baixado? | `cv_download` por `cv_language` e `site_language` |
| Em que botões clicam? | `contact_click` (`method`), `nav_click`, `impact_stat_click`, `case_filter`, `project_open`, `outbound_click` (`link_type`) |
| Onde passam mais tempo lendo? | `section_dwell`: média de `seconds` por `item` (seção) |
| Até onde rolam? | `scroll_depth` (`percent`) e `engagement_summary` (`max_scroll_percent`) |
| Que cases chamam atenção? | `case_view`, `impact_stat_click` (o clique leva ao case) |
| Que carrossel / cargo exploram? | `carousel_navigate` por `item` e `slide` (no de experiência, o id do cargo) |
| Que tecnologias despertam interesse? | `skill_hover` por `item` |
| Algo quebrou no site? | `js_error` |

**Funil sugerido** (Explorar → Exploração de funil): `site_context` → `section_view` (item = about) → `section_view` (resume) → `section_view` (portfolio) → `cv_download` ou `contact_click`.

## Privacidade (LGPD)

O GA4 usa cookies e identificadores. Em geral isso exige **aviso e, para analytics não essencial, consentimento**. Hoje o site não mostra aviso nenhum. Decidir entre (a) um aviso discreto com botão de aceitar/recusar ligado ao Consent Mode do GTM, ou (b) manter como está, é uma decisão sua; veja a pergunta no fim da conversa que gerou este guia.
