# franklin390.github.io

Personal portfolio of **Franklin Ferreira**, Staff Data Engineer: data architecture, Big Data platforms, governance, FinOps, ML and generative AI.

**Live site:** <https://franklin390.github.io/> (English) · [Português](https://franklin390.github.io/pt/) · [Español](https://franklin390.github.io/es/)
**LinkedIn:** <https://www.linkedin.com/in/franklinfs390/>

The site is plain static HTML, CSS and JavaScript served by GitHub Pages: no framework and no build step for the site itself. What makes the repository more than a template is the tooling around it, which generates the CVs, builds the language pages and **checks that every claim, translation, layout and link is still correct** before anything is published.

## Highlights

- **Three languages.** English is the default; Portuguese (pt-BR) and Spanish are available through an EN | PT | ES switch and as static pages at `/pt/` and `/es/` (own canonical, hreflang cluster, sitemap entries). The page language is resolved from `?lang=`, then the page itself, then the saved choice, then English. The browser language is not sniffed.
- **Facts that can be traced.** Every date, title and number on the site and in the CVs is checked against an independent ledger (`_tools/facts/`), whose entries come from the LinkedIn export or were confirmed by the owner. An invented number fails the verification.
- **CVs as data.** The three CVs (`pdf/cv/`) are rendered from `_cv/{en,pt,es}.json` with headless Chrome: two A4 pages, one column, real selectable text (ATS friendly).
- **Fast.** About 0.3 MB on first load, subset web fonts, WebP images, one 8 KB SVG background, no render-blocking script. Largest paint around 1.6 s on a simulated Slow 4G phone.
- **Accessible.** axe-core checks, keyboard operation, visible focus on every control, contrast measured against solid backgrounds, 44 px touch targets for the main controls, reduced-motion support.
- **Private by design.** The site text and the CVs contain no phone number, birth date, full legal name or city (the certificate PDFs are published as they were issued). Analytics only report from the real hostname and respect Global Privacy Control and Do Not Track.
- **Verified.** 18 automated gates (G0 to G17) plus a mutation self-test that injects defects on purpose and requires the gates to catch them.

## Repository layout

```
index.html            the page (English text inline; texts are swapped by js/i18n.js)
pt/  es/              static Portuguese and Spanish pages, generated from index.html
js/                   main.js, analytics.js, i18n.js and the dictionaries in js/i18n/
css/                  theme, staff.css (this site's layer) and the icon fonts
images/  fonts/       optimised images and subset web fonts
pdf/                  CVs (en, pt, es) and certificates
_cv/                  CV sources (JSON) and template, not published
_tools/               build scripts, fact ledger and the verification gates, not published
sitemap.xml  robots.txt  _config.yml
```

Folders starting with `_` are skipped by Jekyll, so `_cv/` and `_tools/` are in the repository but not on the site.

## Working on the site

Edit `index.html` and the dictionaries in `js/i18n/`, then regenerate what is derived from them:

```bash
cd _tools
npm install
npm run build:site   # inline English copy, icon and font subsets, /pt/ and /es/ pages, sitemap
npm run build:cv     # the three CV PDFs
npm run verify       # all gates (about 15 minutes)
```

Requirements: Node.js 24, Google Chrome (the tests drive the installed Chrome through Playwright), Python 3 with PyMuPDF and pypdf, and `pdftotext`. Scripts, gates and the release checklist are documented in [`_tools/README.md`](_tools/README.md); the analytics setup is in [`_tools/gtm/README.md`](_tools/gtm/README.md).

Some gates compare the site with the owner's LinkedIn export, which is private and kept outside the repository (`_tools/fixtures/`). Those gates cannot run without it; the others (HTML, i18n, layout, accessibility, performance, language pages, GitHub Pages readiness) do not need it.

## Deployment

GitHub Pages serves the `master` branch from the repository root. Gate G17 checks the things Pages is strict about: file names with the exact capitalisation the pages use, nothing the site needs inside a `_` or `.` folder, no `.nojekyll` (it would publish `_tools/` and `_cv/`), no front matter, and this README listed under `exclude` in `_config.yml` so Jekyll does not turn it into a page.

## Analytics

Events go through Google Tag Manager to Google Analytics 4 and are free of personal data. A host allow-list keeps copies of the page on other domains from reporting to this account. If you fork the site, replace the tag IDs and the allowed hosts first; the catalogue of events is in `_tools/facts/analytics.json`.

## Credits and license

- Code: MIT, see [LICENSE](LICENSE).
- Layout based on the **Kards** template by [StyleShout](https://www.styleshout.com/) (Creative Commons Attribution 3.0), heavily modified.
- Fonts: Poppins and Lora (SIL Open Font License). Icons: [Font Awesome Free](https://fontawesome.com/) 6 (icons CC BY 4.0, fonts SIL OFL, code MIT; subset in `css/font-awesome-6/`) and the icon font bundled with the template.
- Carousel, lightbox and scroll plugins: Owl Carousel, Magnific Popup, Waypoints, jQuery.
- The personal content (texts, photo, CVs, certificates) belongs to Franklin Ferreira.
