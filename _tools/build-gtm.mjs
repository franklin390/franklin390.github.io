// Generates, from facts/analytics.json, (1) a Google Tag Manager container to import and (2) its guide in Portuguese.
// Usage: node build-gtm.mjs [GA4 measurement id]   -> _tools/gtm/portfolio-container.json + _tools/gtm/LEIA-ME.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
export const PLACEHOLDER_ID = 'G-XXXXXXXXXX';

export const loadCatalog = () => JSON.parse(fs.readFileSync(path.join(TOOLS, 'facts/analytics.json'), 'utf8'));

/** hosts allowed to report to analytics, as one anchored regex for the GTM "Page Hostname" condition (no sub-domain or look-alike passes) */
export const hostRegex = (cat) => '^(' + cat.allowedHosts.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$';

/** every parameter an event can carry, common ones first */
export function allParams(cat) {
  const set = new Set(cat.commonParams);
  for (const e of Object.values(cat.events)) for (const p of e.params) set.add(p);
  return [...set];
}

export function buildContainer(cat, measurementId = PLACEHOLDER_ID) {
  const base = { accountId: '0', containerId: '0' };
  const names = Object.keys(cat.events);
  const params = allParams(cat);
  const variables = [
    { ...base, variableId: '1', name: 'Const - GA4 Measurement ID', type: 'c', parameter: [{ type: 'TEMPLATE', key: 'value', value: measurementId }], fingerprint: '0', formatValue: {} },
    ...params.map((p, i) => ({
      ...base, variableId: String(10 + i), name: `DLV - ${p}`, type: 'v',
      parameter: [{ type: 'INTEGER', key: 'dataLayerVersion', value: '2' }, { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' }, { type: 'TEMPLATE', key: 'name', value: p }],
      fingerprint: '0', formatValue: {}
    }))
  ];
  // Both tags fire only on the real site: a copy of the page on another domain keeps the GTM snippet, but nothing reaches GA4.
  const onlyMySite = { type: 'MATCH_REGEX', parameter: [{ type: 'TEMPLATE', key: 'arg0', value: '{{Page Hostname}}' }, { type: 'TEMPLATE', key: 'arg1', value: hostRegex(cat) }] };
  const triggers = [
    {
      ...base, triggerId: '2', name: 'CE - portfolio events', type: 'CUSTOM_EVENT',
      customEventFilter: [{ type: 'MATCH_REGEX', parameter: [{ type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' }, { type: 'TEMPLATE', key: 'arg1', value: '^(' + names.join('|') + ')$' }] }],
      filter: [onlyMySite],
      fingerprint: '0'
    },
    { ...base, triggerId: '5', name: 'Init - my site only', type: 'INIT', filter: [onlyMySite], fingerprint: '0' }
  ];
  const tags = [
    {
      ...base, tagId: '3', name: 'GA4 - Google tag', type: 'googtag',
      parameter: [{ type: 'TEMPLATE', key: 'tagId', value: '{{Const - GA4 Measurement ID}}' }],
      fingerprint: '0', firingTriggerId: ['5'], tagFiringOption: 'ONCE_PER_EVENT', monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' }
    },
    {
      ...base, tagId: '4', name: 'GA4 - Event - portfolio', type: 'gaawe',
      parameter: [
        { type: 'BOOLEAN', key: 'sendEcommerceData', value: 'false' },
        { type: 'TEMPLATE', key: 'eventName', value: '{{Event}}' },
        { type: 'LIST', key: 'eventSettingsTable', list: params.map((p) => ({ type: 'MAP', map: [{ type: 'TEMPLATE', key: 'parameter', value: p }, { type: 'TEMPLATE', key: 'parameterValue', value: `{{DLV - ${p}}}` }] })) },
        { type: 'TEMPLATE', key: 'measurementIdOverride', value: '{{Const - GA4 Measurement ID}}' }
      ],
      fingerprint: '0', firingTriggerId: ['2'], tagFiringOption: 'ONCE_PER_EVENT', monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' }
    }
  ];
  return {
    exportFormatVersion: 2,
    exportTime: '2026-10-14 00:00:00',
    containerVersion: {
      path: 'accounts/0/containers/0/versions/0', accountId: '0', containerId: '0', containerVersionId: '0',
      name: 'franklin390.github.io - measurement plan',
      container: { path: 'accounts/0/containers/0', accountId: '0', containerId: '0', name: 'franklin390.github.io', publicId: cat.gtmContainer, usageContext: ['WEB'], fingerprint: '0' },
      tag: tags, trigger: triggers, variable: variables,
      builtInVariable: [{ accountId: '0', containerId: '0', type: 'EVENT', name: 'Event' }, { accountId: '0', containerId: '0', type: 'PAGE_HOSTNAME', name: 'Page Hostname' }],
      fingerprint: '0'
    }
  };
}

export function buildReadme(cat) {
  const ev = Object.entries(cat.events);
  const dims = Object.entries(cat.params).filter(([, p]) => p.dimension);
  const mets = Object.entries(cat.params).filter(([, p]) => p.metric);
  const keyEv = ev.filter(([, e]) => e.keyEvent).map(([n]) => `\`${n}\``).join(', ');
  return `# Medição do portfólio (Google Tag Manager + GA4)

Este arquivo é **gerado** por \`node build-gtm.mjs\` a partir de \`facts/analytics.json\`. Não edite à mão: mude o catálogo e gere de novo. A gate **G13** confere, com um navegador real, que o site envia exatamente o que está descrito aqui.

## O que o site envia

O site empurra eventos para o \`dataLayer\` do contêiner **${cat.gtmContainer}** (arquivo \`js/analytics.js\`). Todo evento carrega \`site_language\` (en, pt ou es). **Nenhum dado pessoal** viaja: nada de e-mail, telefone, nome completo ou texto digitado.

| Evento | Quando dispara | Parâmetros |
|---|---|---|
${ev.map(([n, e]) => `| \`${n}\` | ${e.when} | ${e.params.length ? e.params.map((p) => `\`${p}\``).join(', ') : '—'} |`).join('\n')}

Quem envia o sinal **Global Privacy Control** ou **Do Not Track** não gera nenhum evento, e recebe consentimento de analytics "negado" antes de o GTM carregar.

## Como ligar no GTM (5 minutos)

1. No GTM, abra o contêiner **${cat.gtmContainer}** → **Administrador → Importar contêiner**.
2. Escolha \`gtm/portfolio-container.json\`, selecione um espaço de trabalho **novo** e a opção **Mesclar** (renomear itens em conflito).
3. Abra a variável **Const - GA4 Measurement ID** e troque \`${PLACEHOLDER_ID}\` pelo ID da sua propriedade GA4 (formato \`G-…\`, em *GA4 → Administrador → Fluxos de dados*). Esse ID é público (aparece no código de qualquer site); não é uma senha.
4. Se o contêiner **já tinha** uma tag "Google tag" / GA4 com o mesmo ID, apague a **GA4 - Google tag** importada (para não contar a visita duas vezes). Mantenha a **GA4 - Event - portfolio**.
5. **Visualizar** (Tag Assistant), navegue pelo site e confira os eventos. Depois **Enviar → Publicar**.

O contêiner importado tem 1 tag Google, 1 tag de evento GA4 (que repassa todos os eventos acima), 2 acionadores (evento personalizado e inicialização, os dois só no seu domínio) e ${Object.keys(cat.params).length + 1} variáveis, mais a variável embutida **Page Hostname**. Se o GTM recusar o arquivo, crie à mão: um acionador "Evento personalizado" com regex \`^(${Object.keys(cat.events).join('|')})$\`, uma tag "Evento do Google Analytics: GA4" com nome de evento \`{{Event}}\` e, nos parâmetros, cada nome abaixo apontando para uma variável de camada de dados de mesmo nome.

## Cópias do site em outros domínios (dados que não são seus)

Quem copiar a página do jeito que está leva junto o código do GTM (\`${cat.gtmContainer}\`). Sem proteção, cada visita à cópia chegaria ao seu GA4 como se fosse sua, com o nome do host da cópia. Há três camadas:

1. **Na página** (\`index.html\`): o GTM só carrega se o endereço for ${cat.allowedHosts.map((h) => `\`${h}\``).join(', ')}. Uma cópia em outro domínio, ou um arquivo salvo aberto do disco, nem baixa o GTM. A gate G13 confere isso abrindo a página sob um domínio falso.
2. **No contêiner** (este arquivo): as duas tags só disparam quando a variável **Page Hostname** casa com \`${hostRegex(cat)}\`. Vale mesmo que o copiador apague a camada 1, porque o contêiner mora no Google e ele não consegue editá-lo. Depois de publicar, \`npm run check:gtm-live\` prova isso com uma cópia sem a trava.
3. **No GA4**, para o que já entrou antes e para o que nenhuma trava impede: em **Explorar**, use a dimensão **Nome do host** (Hostname) igual a ${cat.allowedHosts.join(', ')} como filtro ou comparação. Os dados já gravados não são apagados; só deixam de aparecer nos relatórios filtrados.

**Se você já tinha importado o contêiner antes**, importe de novo no mesmo espaço de trabalho: **Importar contêiner → Mesclar → Substituir** os itens com o mesmo nome. Confira que a tag **GA4 - Google tag** usa o acionador **Init - my site only** e que **CE - portfolio events** ganhou a condição *Page Hostname corresponde à regex*. Se o GTM recusar o arquivo, faça à mão: ative a variável embutida **Page Hostname** (Variáveis → Configurar), crie o acionador "Inicialização" com a condição *Page Hostname corresponde à regex* \`${hostRegex(cat)}\` e use-o na tag Google; no acionador de evento personalizado, adicione a mesma condição.

**Limites que nenhuma trava resolve:**

- O ID \`G-…\` é público. Quem quiser pode enviar visitas falsas direto ao Google, sem passar pelo seu site nem pelo GTM, e até forjar o nome do host. Os filtros de dados do GA4 existem só para tráfego interno e de desenvolvedor; não há lista de domínios permitidos. É raro, e o filtro por host nos relatórios é a defesa possível.
- Um site que **embute** o seu num \`<iframe>\` carrega a página no seu domínio de verdade, então esses acessos contam (o referenciador mostra de onde vieram).
- **O seu computador também fica de fora:** em \`localhost\` ou com o arquivo aberto do disco, nada é enviado, de propósito. Para testar o GTM, use a visualização (Tag Assistant) no site publicado.

## Contagem duplicada: o que já está garantido e o que só você controla

**Garantido no site** (a gate G13 confere isso em todo \`npm run verify\`):

- O GTM é o **único** carregador de analytics da página: nada de \`gtag.js\` direto, nem ID de medição ou outro rastreador fixo no HTML.
- **Cada ação gera exatamente os eventos planejados**, sem repetir: clique no CV, contato, link externo, menu, número de impacto, filtro, carrossel, projeto, troca de idioma. Um clique que também move um carrossel sozinho não conta como "navegação" no carrossel.
- O site **nunca chama \`history.pushState/replaceState\` de um jeito que o GTM/gtag interceptem**. A troca de idioma atualiza \`?lang=\` pelo método nativo do navegador. Sem isso, o GA4 (com a opção de histórico ligada) contava uma página nova a cada troca de idioma; medido com o GTM de verdade, era 1 \`page_view\` a mais por troca.
- Sair da página (aba oculta + fechamento) reporta **uma vez**: um \`engagement_summary\` e um \`section_dwell\` por seção.
- No contêiner gerado, a tag de evento dispara **uma vez por evento** e a tag do Google **uma vez por página**.

**Só você controla** (cinco minutos, uma vez):

1. **Só uma tag do Google com o seu ID** no contêiner. Se você restaurar a antiga "Google Analytics", cada visita passa a contar duas vezes.
2. **GA4 → Administrador → Fluxos de dados → seu fluxo Web → Métrica otimizada:** desligue **Rolagens**, **Cliques de saída** e **Downloads de arquivos**. Os eventos do site fazem o mesmo com mais detalhe (\`scroll_depth\`, \`outbound_click\`, \`cv_download\`). Na engrenagem de "Visualizações de página", desligue **Mudanças de página com base em eventos do histórico do navegador**. Se preferir manter algum deles ligado, **nunca marque \`file_download\` ou \`click\` como evento-chave junto com \`cv_download\`**, ou a conversão conta duas vezes.
3. **Eventos-chave:** apenas ${keyEv}.
4. **Filtros de dados** (Administrador → Coleta e modificação de dados → Filtros de dados): ative **Tráfego de desenvolvedor** (e, se quiser, **Tráfego interno** com o seu IP). Assim os testes com o Tag Assistant não entram nos relatórios.
5. **Depois de publicar o contêiner, rode \`npm run check:gtm-live\`** (precisa de internet). Ele carrega o seu contêiner publicado de verdade, faz cliques e conta quantos envios ao GA4 cada ação gera, sem mandar nada ao Google. Esperado: **1 \`page_view\` na visita inteira** e cada evento na quantidade certa.

## Configurar no GA4 (uma vez)

**Eventos-chave** (antes "conversões"): ${keyEv}.

**Definições personalizadas → dimensões (escopo: evento):** ${dims.map(([n]) => `\`${n}\``).join(', ')}.

**Definições personalizadas → métricas (escopo: evento):** ${mets.map(([n]) => `\`${n}\``).join(', ')}.

(Sem registrar, os dados chegam, mas os parâmetros não aparecem nos relatórios. Leva até 24 h para começar a aparecer.)

## Perguntas que isso responde

| Pergunta | Onde olhar |
|---|---|
| Em que idioma o site é mais lido? | Explorar → evento \`site_context\` por \`site_language\` (usuários). \`browser_language\` × \`site_language\` mostra quem teve de trocar de idioma |
| As pessoas trocam de idioma? | Evento \`language_toggle\`, \`from_language\` → \`to_language\` |
| Que CV é baixado? | \`cv_download\` por \`cv_language\` e \`site_language\` |
| Em que botões clicam? | \`contact_click\` (\`method\`), \`nav_click\`, \`impact_stat_click\`, \`case_filter\`, \`project_open\`, \`outbound_click\` (\`link_type\`) |
| Onde passam mais tempo lendo? | \`section_dwell\`: média de \`seconds\` por \`item\` (seção) |
| Até onde rolam? | \`scroll_depth\` (\`percent\`) e \`engagement_summary\` (\`max_scroll_percent\`) |
| Que cases chamam atenção? | \`case_view\`, \`impact_stat_click\` (o clique leva ao case) |
| Que carrossel / cargo exploram? | \`carousel_navigate\` por \`item\` e \`slide\` (no de experiência, o id do cargo) |
| Que tecnologias despertam interesse? | \`skill_hover\` por \`item\` |
| Algo quebrou no site? | \`js_error\` |

**Funil sugerido** (Explorar → Exploração de funil): \`site_context\` → \`section_view\` (item = about) → \`section_view\` (resume) → \`section_view\` (portfolio) → \`cv_download\` ou \`contact_click\`.

## Privacidade (LGPD)

O GA4 usa cookies e identificadores. Em geral isso exige **aviso e, para analytics não essencial, consentimento**. Hoje o site não mostra aviso nenhum. Decidir entre (a) um aviso discreto com botão de aceitar/recusar ligado ao Consent Mode do GTM, ou (b) manter como está, é uma decisão sua; veja a pergunta no fim da conversa que gerou este guia.
`;
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const cat = loadCatalog();
  const id = process.argv[2] || PLACEHOLDER_ID;
  const dir = path.join(TOOLS, 'gtm');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'portfolio-container.json'), JSON.stringify(buildContainer(cat, id), null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'LEIA-ME.md'), buildReadme(cat));
  console.log(`GTM container + guide written to _tools/gtm/ (${Object.keys(cat.events).length} events, ${allParams(cat).length} parameters, measurement id ${id})`);
}
