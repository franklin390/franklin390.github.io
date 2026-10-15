# Tooling (not published)

This folder starts with `_`, so GitHub Pages (Jekyll) **does not publish it**. It holds what generates the CV PDFs, the language pages and the font and icon subsets, the fact ledger, and the gates that **prove** the site and the CVs are correct and consistent. Nothing here is needed for the site to work.

## First time

```bash
cd _tools
npm install
```

Requirements: Node 24, Python 3 with `pypdf` and `PyMuPDF`, `pdftotext` (ships with Git for Windows, or install poppler) and Google Chrome (the tests drive the installed Chrome through Playwright, so no browser is downloaded).

## Everyday workflow

| I want to... | Edit | Then run |
|---|---|---|
| Change a text of the site (English) | `js/i18n/en.js` | `npm run build:site` |
| Change the Portuguese or Spanish text | `js/i18n/pt.js` / `js/i18n/es.js` | `npm run build:site` |
| Change a role or course date | `index.html` (`data-date`) or `_tools/facts/training.json` | `npm run build:site` |
| Add or remove a course, certification or project | `_tools/facts/training.json` + the `train.*` / `projects.*` keys in the three dictionaries | `npm run build:site` |
| Use a new icon (Font Awesome) or a character that was not in the text yet (another alphabet, a symbol) | just write the `fa-...` class or the text | `npm run build:site` (regenerates the icon CSS **and** the reduced woff2 fonts) |
| Change a CV | `_cv/en.json`, `_cv/pt.json` and `_cv/es.json` | `npm run build:cv` (close the PDF in your reader first: Windows locks an open file) |
| Change a fact (role, date, metric) | the LinkedIn export first, then `_tools/facts/facts.json` (it includes the `en`/`pt`/`es` patterns of each fact) | `npm run verify` |
| Add or change a "Selected work" card | data in `_tools/facts/cases.json` (a decision card uses `blocks` and `wide: true`), texts in `js/i18n/*.js` (`case.<key>.*`), and, if the fact came from the owner and not from LinkedIn, a claim with `source: "owner"` in `facts/facts.json` | `npm run build:site` and `npm run verify` (G4 counts the cards: currently 12) |
| Change the CSS without changing the look (variables, clean-up) | `css/staff.css` and `css/main.css`: the brand colours live only in `:root` (`--brand*` and `--gray-*` variables) | `node pixel-snap.mjs before`, change, `node pixel-snap.mjs after`, then `node pixel-snap.mjs --diff before after 3` (compares every section at 3 widths and 3 languages, pixel by pixel; the `3` tolerates the 1-level colour noise of the background gradient) |
| Add a technology or keyword | only once confirmed: `_tools/facts/keywords.json` (`provenance.userConfirmed` and `keywords`) | `npm run verify` |
| Measure one more thing on the site | `_tools/facts/analytics.json` (the plan) + `js/analytics.js` | `node build-gtm.mjs` (regenerates the container and the guide) and `npm run verify` |
| Add a language | `LANGS` in `verify/lib/common.mjs`, `js/i18n/<l>.js`, `_cv/<l>.json`, forms in `glossary.json` / `facts.json` / `keywords.json` / `voice.json`, the cspell dictionary | `npm run verify` and `node verify/selftest.mjs` |

> `npm run build:site` = `sync` (English copy inside the HTML) + `build:fa` (only the icons in use, `css/font-awesome-6/css/subset.css`) + `build:fonts` (woff2 fonts reduced to the characters and icons the site uses, in `fonts/subset/`, `css/font-awesome-6/webfonts/*-subset.woff2` and `css/micons/fonts/icomoon-subset.woff2`) + `build:pages` (the `/pt/` and `/es/` pages and `sitemap.xml`). Gates G1, G14 and G15 warn when any of them is out of date.

> The English text lives **only** in `js/i18n/en.js`. `index.html` keeps a copy (for SEO and for visitors with JavaScript off) maintained by `npm run sync`. If you edit the text directly in the HTML, gate G1 reports the difference.

## Verification

```bash
npm run verify        # all gates (G0 to G17), about 15 min, writes out/report.md
npm run verify:fast   # no browser, about 30 s
npm run verify:links  # external links only (needs a normal internet connection)
node verify/selftest.mjs   # injects defects on purpose and requires the gates to fail
```

| Gate | What it guarantees |
|---|---|
| G0 | Every fact of `facts.json` exists literally in the LinkedIn export (`fixtures/linkedin-profile.pdf`, ignored by git) |
| G1 | Valid HTML, existing links and files, unique ids, SEO headers, JSON-LD without personal data, no forbidden string (phone, birth date, full name, city...) |
| G2 | Keys EN = PT = ES, nothing untranslated, ES is not a copy of PT, identical numbers and acronyms, glossary, leaks between languages (PT vs ES included), every visible text is translated |
| G3 | Site and CVs (EN/PT/ES) match the ledger: roles, dates, metrics; no invented number; owner-confirmed claims stay present |
| G4 | The EN/PT/ES buttons (position, click, URL, persistence, keyboard, `file://`, no JS, blocked storage), navigation bar, hover and click of the impact numbers, clean console, the 5 carousels (slides, pagination, language switch), collapsible lists and the phone folds, hero layout at several screen sizes, modals, counters |
| G5 | Layout: PT and ES expansion vs EN, clipped text, page weight |
| G6 | External links respond; PDFs are valid |
| G7 | CVs: A4, at most 2 pages, embedded fonts, text extractable **in the right order across the whole document** (the text stream order is what an ATS reads), chronological order of everything, career path derived from the experience, links, metadata, EN/PT/ES parity |
| G8 | Accessibility (axe-core, WCAG 2.2 AA) and SEO: a single `<h1>` (the name) and sections as `<h2>`, title and description lengths, no image above 250 KB, first load on a phone under 1400 KB |
| G9 | EN, PT-BR and ES spelling (with "canaries" that prove the checker still sees errors) |
| G10 | Nothing from the old site was lost; certificate dates checked against the PDFs |
| G11 | Voice: no stock phrase or catalogue word (EN/PT/ES, list in `facts/voice.json`), bullets that do not all start the same way, sentences short enough, no sentence copied in 3 places |
| G12 | Keywords: coverage (site and CV, 3 languages) without excessive repetition; provenance: every tool, acronym and proper noun exists in LinkedIn or was confirmed by the owner, and a technology seen only in a course never becomes experience; positioning: the headline copy names no single vendor |
| G13 | Measurement without double counting: opens the site as real visitors (desktop, phone, browser in Portuguese, visitors who send GPC / Do Not Track), clicks and reads, and compares the `dataLayer` with the plan (each action produces exactly the planned events, no extra analytics loader, no `history.pushState/replaceState` call that GTM/GA4 would count as a new page); a **copy of the page on another domain** (or a saved file opened from disk) does not load GTM, and the generated container only fires its tags when `Page Hostname` is the site's (`facts/analytics.json`): events, parameters, no personal data, no event for visitors who refuse tracking; the GTM container and the guide match the plan |
| G14 | Static `/pt/` and `/es/` pages: files identical to what the generator produces, each page with its own canonical, complete hreflang, og, JSON-LD and one `<h1>`; relative URLs rewritten; with JavaScript off the text is already in the page language; in the browser, no error or 404, same height as the `?lang=` version, links and PDFs work, the address decides the language, switching in place still works; `sitemap.xml` and `robots.txt` |
| G15 | Performance: no script in the `<head>`, no `@import`, reduced woff2 fonts that are up to date, GTM only after load, a 4 s safety net for the preloader, one small SVG background, carousels without clipped text (measured again after fonts), and byte and time budgets on a slow-4G phone (`perf.mjs`) |
| G16 | Design: page-height budget per width and language, text size floors (nothing under 11 px; running text of cards, dates and captions with their own floors), at most 20% of the text under 14 px on a phone, 44 px main controls (24 px for all, with a documented exception for links inside lists), a visible focus ring on every Tab stop, contrast of 4.5:1 (3:1 for large text) measured against solid backgrounds, one line-icon family in the cards, one look for the skill chips, and the brand colours defined once as CSS variables. Budgets only go down |
| G17 | GitHub Pages readiness: every file the pages, styles and sitemap ask for exists with the exact capitalisation of its real name, nothing the site uses sits under a `_` or `.` folder (Jekyll does not publish those), everything is in git (or would be added by `git add -A`), no `.nojekyll`, no front matter, every markdown file outside `_` folders (the root `README.md`) is listed under `exclude` in `_config.yml` (otherwise Jekyll would publish it as a page), and sizes are within the limits. `node unused-files.mjs` lists files that nothing uses any more |

## Private inputs

`_tools/fixtures/` is ignored by git and holds what must not be public:

- `linkedin-profile.pdf`: the LinkedIn export that the fact ledger is checked against (gate G0 needs it).
- `private-forbidden.json`: exact private values (phone, birth date, legal name) that no published file may contain. Gate G1 only warns when it is missing; without it only the generic shapes are checked.

Back this folder up somewhere safe: it is not in the repository.

## Language pages (`/pt/`, `/es/`)

Google only indexes a language well when it has its own address. So `build-lang-pages.mjs` runs the **real language engine** (`js/i18n.js` + dictionaries) in Chrome over `index.html`, saves the already translated HTML as `pt/index.html` and `es/index.html`, and adjusts what depends on the address (relative URLs start with `../`, canonical, `og:url`, JSON-LD `url` and `<html data-page-lang>`). It also writes `sitemap.xml` with the three addresses and the `hreflang` alternates (list in `facts/seo.json`).

- A visitor who arrives at `/pt/` sees Portuguese even with English saved in the browser: **the address wins**. The EN/PT/ES buttons still switch in place, without reloading; the address becomes `/pt/?lang=en` (and goes back to `/pt/` when PT is chosen).
- At the root (`/`) nothing changed: English by default, `?lang=` and the saved choice still apply. The browser language is never sniffed.
- The generated files are committed. **Never edit `pt/` or `es/` by hand**: G14 rejects any difference from what the generator produces.
- For a custom domain, change `origin` in `facts/seo.json` and `allowedHosts` in `facts/analytics.json`, then run `npm run build:site` and `node build-gtm.mjs <GA4 measurement id>`.

## Measurement

`js/analytics.js` pushes personal-data-free events to the GTM `dataLayer`. The plan is `facts/analytics.json`; `node build-gtm.mjs [GA4 measurement id]` generates the GTM container (`gtm/portfolio-container.json`) and its guide ([`gtm/README.md`](gtm/README.md)) from it. After importing and publishing the container, `npm run check:gtm-live` (needs internet) loads the really published container, clicks around and counts how many sends to GA4 each action produces, without sending anything to Google. It makes three visits: the real site (each action counted once), a copy on another domain (nothing may be sent) and a copy **without the page guard** (only the container holds it back; it fails until the new container is published).

## Performance

`npm run perf` measures the page as a 390 px phone on **slow 4G** (1.6 Mb/s, 150 ms latency) and a CPU 4x slower, served by an HTTP/2 server with gzip (like GitHub Pages). It prints the median of 5 runs: FCP, LCP, TBT, CLS, when the preloader disappears, bytes per type and the biggest files. `node perf.mjs pt/` measures the Portuguese page. GTM is blocked during the measurement (third party, not reproducible offline). Typical result: about 285 KB in 29 requests, LCP about 1.6 s, TBT about 220 ms, CLS 0.

What keeps it light:

- **Fonts hold only what the site uses** (`build-fonts.mjs`, using `subset-font`): the Font Awesome fonts shrink from 226 KB to a few KB, and Poppins and Lora ship as woff2 with Latin and punctuation only. A new character or icon needs `npm run build:site`; G15 warns.
- **No Pace, Modernizr or jQuery Migrate.** The only thing the stylesheets read from Modernizr (the `js` class) now comes from one line in the `<head>`.
- **No chained `@import`:** `fonts.css` and `micons.css` are linked directly in the `<head>`.
- **Images:** the project images are WebP with width and height declared, the profile photo is cut to the size it is shown at, and the decorative background of the hero and of "Where I can help" is one 8 KB SVG.
- **Preloader:** disappears as soon as the page loads, with a single 0.3 s fade, and at most 4 s after the start, even if an image or font is slow.
- **GTM** only starts when the page has finished loading. Events pushed earlier wait in the `dataLayer` queue and GTM processes them in order.
- **Carousel heights** are measured again when the fonts arrive (they used to be measured once, before the fonts, which clipped text in Portuguese).

What cannot be controlled on GitHub Pages: the cache headers (`max-age=600`, fixed). That is why there are no hashed file names; the gain comes from sending fewer bytes. If the site is ever served by its own CDN, `Cache-Control: immutable` on the static files is the next step.

Evaluated and **not** done: minifying or concatenating CSS and JS (with gzip and HTTP/2 the gain would be a few KB and it would break direct editing and the mutation tests), loading only the active language's dictionary (24 KB per language; it would flash English text), and `content-visibility` on the sections (Owl Carousel measures heights at start-up and would get them wrong).

## Design tooling

- `npm run measure:design` measures section heights, text sizes, carousels and tap targets at 1280, 768 and 375 px (`out/design-baseline.json`); `STRIP_P1=1` measures without the phase 1 block of `css/staff.css`.
- `node pixel-snap.mjs <tag>` and `node pixel-snap.mjs --diff <tagA> <tagB> [tolerance]` photograph and compare every section at 3 widths and 3 languages.
- `node unused-files.mjs [--files]` lists the files that nothing uses (read-only).

## Release checklist

1. `npm run verify` is green (and `node verify/selftest.mjs` when a gate changed).
2. Commit, open a pull request into `master`, review the diff and merge. GitHub Pages rebuilds in a few minutes. Never add a `.nojekyll` file (G17 checks).
3. Check the published site: `/`, `/pt/`, `/es/`, `sitemap.xml`, `robots.txt` and the three CV PDFs; then `npm run verify:links`.
4. Analytics: import `gtm/portfolio-container.json` into the GTM container, publish it, follow [`gtm/README.md`](gtm/README.md) for the GA4 settings, then run `npm run check:gtm-live`.
5. Search Console: add a URL-prefix property for `https://franklin390.github.io/`, verify it with the HTML tag method (a `<meta name="google-site-verification">` line in the `<head>` of the three pages), submit `sitemap.xml` and request indexing of the three URLs.
6. To undo a release, revert the merge on `master` (`git revert -m 1 <merge commit>`, or a plain `git revert <commit>` for a squash merge); Pages goes back to the previous state within minutes.
