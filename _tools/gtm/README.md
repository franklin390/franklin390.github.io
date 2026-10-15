# Measurement setup (Google Tag Manager + GA4)

This file is **generated** by `node build-gtm.mjs` from `facts/analytics.json`. Do not edit it by hand: change the catalogue and generate again. Gate **G13** checks, with a real browser, that the site sends exactly what is described here.

## What the site sends

The site pushes events to the `dataLayer` of container **GTM-PNSXVNR** (file `js/analytics.js`). Every event carries `site_language` (en, pt or es). **No personal data** travels: no e-mail address, phone number, full name or typed text.

| Event | When it fires | Parameters |
|---|---|---|
| `site_context` | Once per page view, after the language is resolved. | `language_source`, `browser_language`, `device_class`, `reduced_motion` |
| `language_toggle` | The visitor switches language with the EN, PT or ES buttons. | `from_language`, `to_language`, `method` |
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
| `back_to_top` | Click on the back-to-top button. | - |
| `page_print` | The page is printed. | - |
| `js_error` | A script of this site throws (at most 3 per visit). | `message`, `file` |

A visitor who sends **Global Privacy Control** or **Do Not Track** generates no event at all, and gets analytics consent "denied" before GTM loads.

## Connecting it to GTM (5 minutes)

1. In GTM, open container **GTM-PNSXVNR** → **Admin → Import Container**.
2. Choose `gtm/portfolio-container.json`, select a **new** workspace and the **Merge** option (rename conflicting items).
3. Open the variable **Const - GA4 Measurement ID** and replace `G-XXXXXXXXXX` with the ID of your GA4 property (format `G-...`, found under *GA4 → Admin → Data streams*). The ID is public (it appears in the code of any site that uses it); it is not a secret.
4. If the container **already had** a "Google tag" / GA4 tag with the same ID, keep only one of them (otherwise every visit is counted twice). Keep the imported **GA4 - Google tag**, which only fires on your own domain (see "Copies of the site on other domains"), and delete the old one. Also keep **GA4 - Event - portfolio**.
5. Use **Preview** (Tag Assistant), browse the site and check the events. Then **Submit → Publish**.

The imported container has 1 Google tag, 1 GA4 event tag (which forwards all the events above), 2 triggers (custom event and initialization, both limited to your domain) and 25 variables, plus the built-in variable **Page Hostname**. If GTM rejects the file, build it by hand: a "Custom Event" trigger with the regex `^(site_context|language_toggle|cv_download|contact_click|outbound_click|certificate_open|nav_click|menu_toggle|impact_stat_click|case_filter|case_view|project_open|carousel_navigate|training_toggle|content_toggle|skill_hover|section_view|section_dwell|scroll_depth|engagement_summary|back_to_top|page_print|js_error)$`, a "Google Analytics: GA4 Event" tag with event name `{{Event}}`, and, under parameters, each name from the table above pointing to a data layer variable with the same name.

## Copies of the site on other domains (data that is not yours)

Anyone who copies the page as it is takes the GTM snippet (`GTM-PNSXVNR`) with it. Unprotected, every visit to the copy would reach your GA4 as if it were yours, tagged with the copy's hostname. There are three layers:

1. **In the page** (`index.html`): GTM only loads when the address is `franklin390.github.io`. A copy on another domain, or a saved file opened from disk, never even downloads GTM. Gate G13 checks this by opening the page under a fake domain.
2. **In the container** (this file): both tags only fire when the **Page Hostname** variable matches `^(franklin390\.github\.io)$`. This holds even if the copier deletes layer 1, because the container lives at Google and cannot be edited by them. After publishing, `npm run check:gtm-live` proves it with a copy that has no guard.
3. **In GA4**, with a data filter: **Admin → Data collection and modification → Data filters → Create filter → Web hostname traffic filter**, operation **Include only**, hostname **exactly matches** `franklin390.github.io`. It applies to the whole property (every report, exploration, Realtime and export) and keeps any other hostname out of **new** data. It starts 24-36 h after you activate it and an active filter is permanent, so leave it in **Testing** first and check it with a free-form exploration (rows "Test data filter name" and "Event name", filter "Test data filter name" contains the filter's name). If the site ever moves to another domain, update this filter, the page guard and the container, otherwise the new domain is dropped. Data that arrived **before** stays as it is: in reports apply a **comparison** (Hostname exactly matches `franklin390.github.io`); comparisons reset when you change report or reload the page, but a saved one comes back in two clicks.

**If you imported the container before**, import it again into the same workspace: **Import Container → Merge → Overwrite** items with the same name. Check that the tag **GA4 - Google tag** uses the trigger **Init - my site only** and that **CE - portfolio events** gained the condition *Page Hostname matches regex*. If GTM rejects the file, do it by hand: enable the built-in variable **Page Hostname** (Variables → Configure), create the "Initialization" trigger with the condition *Page Hostname matches regex* `^(franklin390\.github\.io)$` and use it on the Google tag; on the custom event trigger, add the same condition.

**Limits that no guard can fix:**

- The `G-...` ID is public. Anyone can send fake visits straight to Google, bypassing your site and GTM, and even forge the hostname. The hostname data filter (layer 3) drops hits that claim any other hostname, but it cannot tell a forged hit that claims the allowed hostname from a real one. It is rare.
- A site that **embeds** yours in an `<iframe>` loads the page on your real domain, so those visits count (the referrer shows where they came from).
- **Your own computer is left out too:** on `localhost`, or with the file opened from disk, nothing is sent, on purpose. To test GTM, use Preview (Tag Assistant) on the published site.

## Double counting: what is guaranteed and what only you control

**Guaranteed by the site** (gate G13 checks this on every `npm run verify`):

- GTM is the **only** analytics loader on the page: no direct `gtag.js`, no hard-coded measurement ID or other tracker in the HTML.
- **Each action produces exactly the planned events**, without repeats: CV click, contact, external link, menu, impact number, filter, carousel, project, language switch. A click that also moves a carousel by itself does not count as carousel navigation.
- The site **never calls `history.pushState/replaceState` in a way that GTM/gtag intercept**. The language switch updates `?lang=` with the browser's native method. Without that, GA4 (with the history option on) counted a new page on every language switch; measured with the real GTM, that was one extra `page_view` per switch.
- Leaving the page (tab hidden + closing) reports **once**: one `engagement_summary` and one `section_dwell` per section.
- In the generated container the event tag fires **once per event** and the Google tag **once per page**.

**Only you control** (five minutes, once):

1. **Only one Google tag with your ID** in the container. If you restore the old "Google Analytics" tag, every visit counts twice.
2. **GA4 → Admin → Data streams → your Web stream → Enhanced measurement:** turn off **Scrolls**, **Outbound clicks** and **File downloads**. The site's events do the same in more detail (`scroll_depth`, `outbound_click`, `cv_download`). In the gear icon of "Page views", turn off **Page changes based on browser history events**. If you prefer to keep any of them on, **never mark `file_download` or `click` as a key event together with `cv_download`**, or the conversion counts twice.
3. **Key events:** only `cv_download`, `contact_click`.
4. **Data filters** (Admin → Data collection and modification → Data filters): activate **Developer traffic** (and, if you like, **Internal traffic** with your IP). That keeps Tag Assistant tests out of the reports. Also create the **Web hostname traffic** filter from layer 3 (Testing first).
5. **After publishing the container, run `npm run check:gtm-live`** (needs internet). It loads your really published container, performs clicks and counts how many sends to GA4 each action produces, without sending anything to Google. Expected: **1 `page_view` for the whole visit** and each event the right number of times.

## Configuring GA4 (once)

**Key events** (formerly "conversions"): `cv_download`, `contact_click`.

**Custom definitions → dimensions (scope: event):** `site_language`, `item`, `slide`, `location`, `method`, `state`, `link_type`, `cv_language`, `from_language`, `to_language`, `language_source`, `browser_language`, `device_class`, `via`.

**Custom definitions → metrics (scope: event):** `seconds`, `percent`, `total_seconds`, `sections_seen`, `max_scroll_percent`.

(Without registering them the data still arrives, but the parameters do not show in reports. It takes up to 24 h to start appearing.)

## Questions this answers

| Question | Where to look |
|---|---|
| Which language is the site read in most? | Explore → event `site_context` by `site_language` (users). `browser_language` vs `site_language` shows who had to switch language |
| Do people switch language? | Event `language_toggle`, `from_language` → `to_language` |
| Which CV gets downloaded? | `cv_download` by `cv_language` and `site_language` |
| What do they click? | `contact_click` (`method`), `nav_click`, `impact_stat_click`, `case_filter`, `project_open`, `outbound_click` (`link_type`) |
| Where do they spend the most reading time? | `section_dwell`: average `seconds` per `item` (section) |
| How far do they scroll? | `scroll_depth` (`percent`) and `engagement_summary` (`max_scroll_percent`) |
| Which case studies catch attention? | `case_view`, `impact_stat_click` (the click leads to the case) |
| Which carousel / role do they explore? | `carousel_navigate` by `item` and `slide` (for experience, the role id) |
| Which technologies draw interest? | `skill_hover` by `item` |
| Did something break on the site? | `js_error` |

**Suggested funnel** (Explore → Funnel exploration): `site_context` → `section_view` (item = about) → `section_view` (resume) → `section_view` (portfolio) → `cv_download` or `contact_click`.

## Privacy (LGPD / GDPR)

GA4 uses cookies and identifiers. In general that requires **a notice and, for non-essential analytics, consent**. Today the site shows no notice (it does honour Global Privacy Control and Do Not Track). Choosing between (a) a discreet notice with accept/reject buttons wired to GTM Consent Mode, or (b) keeping it as it is, is the site owner's decision.
