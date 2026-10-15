// Generates, from facts/analytics.json, (1) a Google Tag Manager container to import and (2) its guide in English.
// Usage: node build-gtm.mjs [GA4 measurement id]   -> _tools/gtm/portfolio-container.json + _tools/gtm/README.md
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
  return `# Measurement setup (Google Tag Manager + GA4)

This file is **generated** by \`node build-gtm.mjs\` from \`facts/analytics.json\`. Do not edit it by hand: change the catalogue and generate again. Gate **G13** checks, with a real browser, that the site sends exactly what is described here.

## What the site sends

The site pushes events to the \`dataLayer\` of container **${cat.gtmContainer}** (file \`js/analytics.js\`). Every event carries \`site_language\` (en, pt or es). **No personal data** travels: no e-mail address, phone number, full name or typed text.

| Event | When it fires | Parameters |
|---|---|---|
${ev.map(([n, e]) => `| \`${n}\` | ${e.when} | ${e.params.length ? e.params.map((p) => `\`${p}\``).join(', ') : '-'} |`).join('\n')}

A visitor who sends **Global Privacy Control** or **Do Not Track** generates no event at all, and gets analytics consent "denied" before GTM loads.

## Connecting it to GTM (5 minutes)

1. In GTM, open container **${cat.gtmContainer}** → **Admin → Import Container**.
2. Choose \`gtm/portfolio-container.json\`, select a **new** workspace and the **Merge** option (rename conflicting items).
3. Open the variable **Const - GA4 Measurement ID** and replace \`${PLACEHOLDER_ID}\` with the ID of your GA4 property (format \`G-...\`, found under *GA4 → Admin → Data streams*). The ID is public (it appears in the code of any site that uses it); it is not a secret.
4. If the container **already had** a "Google tag" / GA4 tag with the same ID, delete the imported **GA4 - Google tag** (otherwise every visit is counted twice). Keep **GA4 - Event - portfolio**.
5. Use **Preview** (Tag Assistant), browse the site and check the events. Then **Submit → Publish**.

The imported container has 1 Google tag, 1 GA4 event tag (which forwards all the events above), 2 triggers (custom event and initialization, both limited to your domain) and ${Object.keys(cat.params).length + 1} variables, plus the built-in variable **Page Hostname**. If GTM rejects the file, build it by hand: a "Custom Event" trigger with the regex \`^(${Object.keys(cat.events).join('|')})$\`, a "Google Analytics: GA4 Event" tag with event name \`{{Event}}\`, and, under parameters, each name from the table above pointing to a data layer variable with the same name.

## Copies of the site on other domains (data that is not yours)

Anyone who copies the page as it is takes the GTM snippet (\`${cat.gtmContainer}\`) with it. Unprotected, every visit to the copy would reach your GA4 as if it were yours, tagged with the copy's hostname. There are three layers:

1. **In the page** (\`index.html\`): GTM only loads when the address is ${cat.allowedHosts.map((h) => `\`${h}\``).join(', ')}. A copy on another domain, or a saved file opened from disk, never even downloads GTM. Gate G13 checks this by opening the page under a fake domain.
2. **In the container** (this file): both tags only fire when the **Page Hostname** variable matches \`${hostRegex(cat)}\`. This holds even if the copier deletes layer 1, because the container lives at Google and cannot be edited by them. After publishing, \`npm run check:gtm-live\` proves it with a copy that has no guard.
3. **In GA4**, for data that arrived before and for whatever no guard can stop: in **Explore**, use the **Hostname** dimension equal to ${cat.allowedHosts.join(', ')} as a filter or comparison. Data already stored is not deleted; it just stops showing in filtered reports.

**If you imported the container before**, import it again into the same workspace: **Import Container → Merge → Overwrite** items with the same name. Check that the tag **GA4 - Google tag** uses the trigger **Init - my site only** and that **CE - portfolio events** gained the condition *Page Hostname matches regex*. If GTM rejects the file, do it by hand: enable the built-in variable **Page Hostname** (Variables → Configure), create the "Initialization" trigger with the condition *Page Hostname matches regex* \`${hostRegex(cat)}\` and use it on the Google tag; on the custom event trigger, add the same condition.

**Limits that no guard can fix:**

- The \`G-...\` ID is public. Anyone can send fake visits straight to Google, bypassing your site and GTM, and even forge the hostname. GA4 data filters only exist for internal and developer traffic; there is no allow-list of domains. It is rare, and filtering by hostname in reports is the available defence.
- A site that **embeds** yours in an \`<iframe>\` loads the page on your real domain, so those visits count (the referrer shows where they came from).
- **Your own computer is left out too:** on \`localhost\`, or with the file opened from disk, nothing is sent, on purpose. To test GTM, use Preview (Tag Assistant) on the published site.

## Double counting: what is guaranteed and what only you control

**Guaranteed by the site** (gate G13 checks this on every \`npm run verify\`):

- GTM is the **only** analytics loader on the page: no direct \`gtag.js\`, no hard-coded measurement ID or other tracker in the HTML.
- **Each action produces exactly the planned events**, without repeats: CV click, contact, external link, menu, impact number, filter, carousel, project, language switch. A click that also moves a carousel by itself does not count as carousel navigation.
- The site **never calls \`history.pushState/replaceState\` in a way that GTM/gtag intercept**. The language switch updates \`?lang=\` with the browser's native method. Without that, GA4 (with the history option on) counted a new page on every language switch; measured with the real GTM, that was one extra \`page_view\` per switch.
- Leaving the page (tab hidden + closing) reports **once**: one \`engagement_summary\` and one \`section_dwell\` per section.
- In the generated container the event tag fires **once per event** and the Google tag **once per page**.

**Only you control** (five minutes, once):

1. **Only one Google tag with your ID** in the container. If you restore the old "Google Analytics" tag, every visit counts twice.
2. **GA4 → Admin → Data streams → your Web stream → Enhanced measurement:** turn off **Scrolls**, **Outbound clicks** and **File downloads**. The site's events do the same in more detail (\`scroll_depth\`, \`outbound_click\`, \`cv_download\`). In the gear icon of "Page views", turn off **Page changes based on browser history events**. If you prefer to keep any of them on, **never mark \`file_download\` or \`click\` as a key event together with \`cv_download\`**, or the conversion counts twice.
3. **Key events:** only ${keyEv}.
4. **Data filters** (Admin → Data collection and modification → Data filters): activate **Developer traffic** (and, if you like, **Internal traffic** with your IP). That keeps Tag Assistant tests out of the reports.
5. **After publishing the container, run \`npm run check:gtm-live\`** (needs internet). It loads your really published container, performs clicks and counts how many sends to GA4 each action produces, without sending anything to Google. Expected: **1 \`page_view\` for the whole visit** and each event the right number of times.

## Configuring GA4 (once)

**Key events** (formerly "conversions"): ${keyEv}.

**Custom definitions → dimensions (scope: event):** ${dims.map(([n]) => `\`${n}\``).join(', ')}.

**Custom definitions → metrics (scope: event):** ${mets.map(([n]) => `\`${n}\``).join(', ')}.

(Without registering them the data still arrives, but the parameters do not show in reports. It takes up to 24 h to start appearing.)

## Questions this answers

| Question | Where to look |
|---|---|
| Which language is the site read in most? | Explore → event \`site_context\` by \`site_language\` (users). \`browser_language\` vs \`site_language\` shows who had to switch language |
| Do people switch language? | Event \`language_toggle\`, \`from_language\` → \`to_language\` |
| Which CV gets downloaded? | \`cv_download\` by \`cv_language\` and \`site_language\` |
| What do they click? | \`contact_click\` (\`method\`), \`nav_click\`, \`impact_stat_click\`, \`case_filter\`, \`project_open\`, \`outbound_click\` (\`link_type\`) |
| Where do they spend the most reading time? | \`section_dwell\`: average \`seconds\` per \`item\` (section) |
| How far do they scroll? | \`scroll_depth\` (\`percent\`) and \`engagement_summary\` (\`max_scroll_percent\`) |
| Which case studies catch attention? | \`case_view\`, \`impact_stat_click\` (the click leads to the case) |
| Which carousel / role do they explore? | \`carousel_navigate\` by \`item\` and \`slide\` (for experience, the role id) |
| Which technologies draw interest? | \`skill_hover\` by \`item\` |
| Did something break on the site? | \`js_error\` |

**Suggested funnel** (Explore → Funnel exploration): \`site_context\` → \`section_view\` (item = about) → \`section_view\` (resume) → \`section_view\` (portfolio) → \`cv_download\` or \`contact_click\`.

## Privacy (LGPD / GDPR)

GA4 uses cookies and identifiers. In general that requires **a notice and, for non-essential analytics, consent**. Today the site shows no notice (it does honour Global Privacy Control and Do Not Track). Choosing between (a) a discreet notice with accept/reject buttons wired to GTM Consent Mode, or (b) keeping it as it is, is the site owner's decision.
`;
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const cat = loadCatalog();
  const id = process.argv[2] || PLACEHOLDER_ID;
  const dir = path.join(TOOLS, 'gtm');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'portfolio-container.json'), JSON.stringify(buildContainer(cat, id), null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'README.md'), buildReadme(cat));
  console.log(`GTM container + guide written to _tools/gtm/ (${Object.keys(cat.events).length} events, ${allParams(cat).length} parameters, measurement id ${id})`);
}
