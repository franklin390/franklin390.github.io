# Ferramentas do portfólio (não publicadas)

Esta pasta começa com `_`, então o GitHub Pages (Jekyll) **não a publica**. Ela contém o que gera os PDFs do CV e o que **prova** que site e CV estão corretos e consistentes. Nada aqui é necessário para o site funcionar.

Para colocar o site no ar (commit, GTM, GA4, Search Console, divulgação), veja `PUBLICAR.md`. O plano de melhorias e as decisões estão em `PLANO-MELHORIAS.md`. O plano para evoluir o design (diagnóstico com números, fases, metas e decisões) está em `PLANO-DESIGN.md`; `npm run measure:design` mede a linha de base.

## Primeira vez

```bash
cd _tools
npm install
```

Requisitos já presentes nesta máquina: Node 24, Python 3 com `pypdf` e `PyMuPDF`, `pdftotext` (vem com o Git for Windows) e Google Chrome (os testes usam o Chrome instalado, sem baixar navegadores).

## Rotina de edição

| Quero… | Edite | Depois rode |
|---|---|---|
| Mudar um texto do site (EN) | `js/i18n/en.js` | `npm run build:site` |
| Mudar o texto em português ou espanhol | `js/i18n/pt.js` / `js/i18n/es.js` | `npm run build:site` |
| Mudar uma data de cargo/curso | `index.html` (`data-date`) ou `_tools/facts/training.json` | `npm run build:site` |
| Adicionar/remover curso, certificação ou projeto | `_tools/facts/training.json` + chaves `train.*`/`projects.*` nos três dicionários | `npm run build:site` |
| Usar um ícone novo (Font Awesome) ou um caractere que ainda não existia no texto (ex.: outro alfabeto, um símbolo) | só escreva a classe `fa-…` / o texto | `npm run build:site` (gera o CSS dos ícones **e** as fontes woff2 reduzidas) |
| Mudar o CV | `_cv/en.json`, `_cv/pt.json` e `_cv/es.json` | `npm run build:cv` (feche o PDF no leitor antes: o Windows trava o arquivo aberto) |
| Mudar um fato (cargo, data, métrica) | primeiro o PDF do LinkedIn → `_tools/facts/facts.json` (inclui os padrões `en`/`pt`/`es` de cada fato) | `npm run verify` |
| Acrescentar ou mudar um card de "Selected work" | dados em `_tools/facts/cases.json` (um card de decisão usa `blocks` e `wide: true`, como o "Por que Databricks"), textos em `js/i18n/*.js` (`case.<key>.*`), e, se o fato veio de você e não do LinkedIn, um claim `source: "owner"` em `facts/facts.json` | `npm run build:site` e `npm run verify` (o G4 conta os cards: hoje 10) |
| Mudar o CSS sem mudar o visual (variáveis, limpeza) | `css/staff.css` e `css/main.css`: as cores da marca vivem só em `:root` (variáveis `--brand*` e `--gray-*`) | `node pixel-snap.mjs antes`, mude, `node pixel-snap.mjs depois`, e `node pixel-snap.mjs --diff antes depois 3` (compara cada seção em 3 larguras e 3 idiomas, pixel a pixel; o 3 tolera o ruído de 1 nível de cor do gradiente do fundo) |
| Acrescentar uma tecnologia ou palavra-chave | só depois de confirmada: `_tools/facts/keywords.json` (`provenance.userConfirmed` e `keywords`) | `npm run verify` |
| Medir mais uma coisa no site | `_tools/facts/analytics.json` (o plano) + `js/analytics.js` | `node build-gtm.mjs` (regera o contêiner e o guia) e `npm run verify` |
| Adicionar um idioma | `LANGS` em `verify/lib/common.mjs`, `js/i18n/<l>.js`, `_cv/<l>.json`, formas no `glossary.json`/`facts.json`/`keywords.json`/`voice.json`, dicionário do cspell | `npm run verify` e `node verify/selftest.mjs` |

> `npm run build:site` = `sync` (cópia em inglês dentro do HTML) + `build:fa` (só os ícones usados, `css/font-awesome-6/css/subset.css`) + `build:fonts` (fontes woff2 reduzidas aos caracteres e ícones do site, em `fonts/subset/`, `css/font-awesome-6/webfonts/*-subset.woff2` e `css/micons/fonts/icomoon-subset.woff2`) + `build:pages` (as páginas `/pt/` e `/es/` e o `sitemap.xml`). Os gates G1, G14 e G15 avisam quando algum deles está desatualizado.

> O texto em inglês vive **só** em `js/i18n/en.js`. O `index.html` guarda uma cópia (para SEO e para quem desativa JavaScript) mantida por `npm run sync`. Se editar o texto direto no HTML, o gate G1 acusa a divergência.

## Verificação

```bash
npm run verify        # todos os gates (G0–G17), ~15 min, gera out/report.md
npm run verify:fast   # sem navegador, ~30 s
npm run verify:links  # só links externos (precisa de internet "normal")
node verify/selftest.mjs   # injeta defeitos de propósito e exige que os gates falhem
```

| Gate | O que garante |
|---|---|
| G0 | Todo fato do `facts.json` existe literalmente no PDF do LinkedIn (`fixtures/linkedin-profile.pdf`, ignorado pelo git) |
| G1 | HTML válido, links/arquivos existentes, ids únicos, cabeçalhos SEO, JSON-LD sem dados pessoais, nenhuma string proibida (telefone, nascimento, nome completo, cidade…) |
| G2 | Chaves EN = PT = ES, nada sem tradução, ES não é cópia do PT, números/siglas idênticos, glossário, vazamento entre idiomas (inclusive PT×ES), todo texto visível é traduzido |
| G3 | Site e CV (EN/PT/ES) batem com o ledger: cargos, datas, métricas; nenhum número inventado |
| G4 | Botões de idioma EN/PT/ES (posição, clique, URL, persistência, teclado, `file://`, sem JS, storage bloqueado), barra de navegação, hover e clique dos números de impacto, console limpo, os 6 carrosséis (slides, paginação, troca de idioma), lista de cursos recolhível, modais, contadores |
| G5 | Layout: expansão PT e ES × EN, texto cortado, peso da página |
| G6 | Links externos respondem; PDFs válidos |
| G7 | CV: A4, ≤2 páginas, fontes embutidas, texto extraível **na ordem certa do documento inteiro** (a ordem do fluxo de texto é a que um ATS lê), ordem cronológica de tudo (cargos, formação, certificações), trajetória derivada da experiência, links, metadados, paridade EN/PT/ES |
| G8 | Acessibilidade (axe-core, WCAG 2.2 AA) e SEO: um único `<h1>` (o nome) e as seções em `<h2>`, título/descrição no tamanho certo, nenhuma imagem acima de 250 KB, primeira carga no celular dentro de 1400 KB |
| G17 | Pronto para o GitHub Pages: cada arquivo que as páginas, os estilos e o sitemap pedem existe com a mesma caixa (maiúsculas e minúsculas) do nome real, nada do que o site usa está em pasta `_` ou `.` (o Jekyll não publica), tudo está no git (ou entraria num `git add -A`), não há `.nojekyll`, markdown nem front matter publicados, e tamanhos dentro dos limites. `node unused-files.mjs` lista os arquivos que ninguém usa mais |
| G16 | Design: orçamento de altura por largura e idioma, piso de tamanho de texto (nada abaixo de 11 px; texto corrido de cards, datas e legendas com piso próprio), no máximo 20% do texto abaixo de 14 px no celular, controles principais com 44 px (24 px para todos, com exceção documentada para links dentro de listas), anel de foco visível em cada parada do Tab e contraste de 4,5:1 (3:1 para texto grande) medido sobre fundo sólido. Os orçamentos só descem: veja `PLANO-DESIGN.md` |
| G15 | Performance: nenhum script no `<head>`, sem `@import`, fontes woff2 reduzidas e em dia, GTM só depois do carregamento, preloader com rede de segurança de 4 s, fundo decorativo só quando a seção chega perto, carrosséis sem texto cortado (medidos de novo depois das fontes) e orçamentos de bytes e tempo num celular com 4G lento (`perf.mjs`) |
| G14 | Páginas estáticas `/pt/` e `/es/`: arquivos idênticos ao que o gerador produz, cada página com canonical próprio, hreflang completo, og, JSON-LD e um `<h1>`; URLs relativas reescritas; com JavaScript desligado o texto já é o do idioma (igual ao que o motor escreve); no navegador, sem erro/404, mesma altura da versão `?lang=`, links e PDFs funcionam, o endereço manda no idioma, a troca no lugar continua funcionando; `sitemap.xml` e `robots.txt` |
| G9 | Ortografia EN, PT-BR e ES (com "canários" para provar que o corretor enxerga erros) |
| G10 | Nada do site antigo foi perdido; datas dos certificados conferidas com os PDFs |
| G13 | Medição (sem contagem duplicada): abre o site como visitantes reais (desktop, celular, navegador em português, quem envia GPC/Do Not Track), faz cliques e leituras e confere o `dataLayer` contra o plano (cada ação gera exatamente os eventos planejados, nenhum carregador extra de analytics, nenhuma chamada a `history.pushState/replaceState` que o GTM/GA4 contariam como página nova); uma **cópia da página em outro domínio** (ou um arquivo salvo aberto do disco) não carrega o GTM, e o contêiner gerado só dispara as tags quando o `Page Hostname` é o do site (`facts/analytics.json`): eventos, parâmetros, sem dado pessoal, sem evento para quem recusa rastreio; contêiner do GTM e guia em dia com o plano |
| G11 | Voz: nenhuma frase de efeito ou palavra de catálogo (EN/PT/ES, lista em `facts/voice.json`), bullets que não começam todos igual, frases curtas o bastante, nenhuma frase copiada em 3 lugares |
| G12 | Palavras-chave: cobertura (site e CV, 3 idiomas) sem repetição excessiva; procedência: toda ferramenta, sigla e nome próprio existe no LinkedIn, e tecnologia vista só em curso não vira experiência |

## Pendências que dependem de você

O gate G3 sempre lista como **WARN** o que só você pode confirmar (data de fim do cargo de Tech Lead e o MBA da XP). Elas somem quando o `facts.json` for atualizado com a resposta.

## Rodar com o CV aberto no leitor de PDF

O Windows impede gravar um PDF que está aberto (o Acrobat trava o arquivo). Para construir e testar sem mexer nos PDFs reais: `node out/mirror.mjs` cria uma cópia espelho do site em `out/site-copy` já com os CVs novos; depois rode os gates com `SITE_ROOT=<essa pasta>`.

`npm run check:gtm-live` (precisa de internet): carrega o contêiner do GTM **publicado de verdade**, faz cliques e conta quantos envios ao GA4 cada ação gera, sem mandar nada ao Google. Use depois de publicar o contêiner. Faz três visitas: o site de verdade (cada ação contada uma vez), uma cópia em outro domínio (nada pode ser enviado) e uma cópia **sem a trava da página** (só o contêiner a segura; falha enquanto o contêiner novo não estiver publicado).

## Páginas em português e espanhol (`/pt/`, `/es/`)

O Google só indexa bem uma língua que tem endereço próprio. Por isso `build-lang-pages.mjs` roda o **motor de idiomas de verdade** (`js/i18n.js` + dicionários) no Chrome sobre o `index.html`, salva o HTML já traduzido em `pt/index.html` e `es/index.html` e ajusta o que depende do endereço (URLs relativas começam com `../`, canonical, `og:url`, `url` do JSON-LD e `<html data-page-lang>`). Também escreve o `sitemap.xml` com os três endereços e os alternates `hreflang` (lista em `facts/seo.json`).

- Quem chega por `/pt/` vê português mesmo que tenha inglês salvo no navegador: **o endereço manda**. O botão EN/PT/ES continua trocando no lugar, sem recarregar; o endereço vira `/pt/?lang=en` (e volta a `/pt/` ao escolher PT).
- Na raiz (`/`) nada mudou: inglês por padrão, `?lang=` e a escolha salva continuam valendo.
- Os arquivos gerados são commitados. **Nunca edite `pt/` ou `es/` à mão**: o G14 recusa qualquer diferença do que o gerador produz.
- Para um domínio próprio no futuro, troque `origin` em `facts/seo.json` e `allowedHosts` em `facts/analytics.json`, e rode `npm run build:site` e `node build-gtm.mjs G-6TKSCE8X4Q`.

## Performance

`npm run perf` mede a página como um celular de 390 px com **4G lento** (1,6 Mb/s, 150 ms de latência) e CPU 4x mais lenta, vindo de um servidor HTTP/2 com gzip (como o GitHub Pages). Imprime a mediana de 5 execuções: FCP, LCP, TBT, CLS, quando o preloader some, bytes por tipo e os maiores arquivos. `node perf.mjs pt/` mede a página em português. O GTM fica bloqueado na medição (terceiro, não reproduzível offline).

| | antes | agora |
|---|---|---|
| Transferido na primeira carga | 808 KB | ~305 KB |
| Fontes | 387 KB | 113 KB |
| Imagens | 268 KB | 48 KB |
| Preloader some em | 6,2 s | ~2,8 s |
| TBT (bloqueio da thread principal) | ~600 ms | ~250 ms |

O que mudou e por quê:

- **Fontes só com o que o site usa** (`build-fonts.mjs`, usa `subset-font`): Font Awesome 226 KB → 4 KB, ícones de serviços 28 KB → 2,5 KB, Poppins/Lora em woff2 só com latim e pontuação. Os arquivos originais continuam no repositório, sem uso. Um caractere ou ícone novo pede `npm run build:site`; o G15 avisa.
- **Sem Pace, Modernizr e jQuery Migrate.** O Pace sozinho custava metade do TBT. A única coisa que as folhas de estilo liam do Modernizr (a classe `js`) agora vem de uma linha no `<head>`.
- **Sem `@import` em cadeia**: `fonts.css` e `micons.css` são linkados direto no `<head>`.
- **Imagens**: os 26 PNG dos projetos viraram WebP (2,5 MB → 0,6 MB), o fundo do hero também, a foto de perfil foi reduzida ao tamanho em que aparece e todas têm largura e altura declaradas. O fundo decorativo de "Onde posso ajudar" (196 KB, sob uma camada 90 % escura) só é baixado quando a seção chega perto. O hero tem `preload` (LCP de 2,1 s para 1,4 s).
- **Preloader**: some assim que a página carrega, com um único fade de 0,3 s (eram dois, somando ~1,5 s), e no máximo 4 s depois do início, mesmo que alguma imagem ou fonte demore.
- **GTM** só começa quando a página termina de carregar. Eventos empurrados antes ficam na fila do `dataLayer` e o GTM os processa em ordem.
- **Altura dos carrosséis**: era medida uma vez, antes de as fontes chegarem. No site anterior o carrossel de experiência em português ficava com 471 px para um conteúdo de 501 px (texto cortado embaixo). Agora é medida de novo quando as fontes chegam.

O que **não** dá para controlar no GitHub Pages: os cabeçalhos de cache (`max-age=600`, fixo). Por isso não há arquivos com hash no nome; o ganho vem de mandar menos bytes. Se um dia o site for servido por um CDN próprio (Cloudflare, por exemplo), `Cache-Control: immutable` nos arquivos estáticos é o próximo passo.

Ideias avaliadas e **não** feitas: minificar/concatenar CSS e JS (com gzip e HTTP/2 o ganho seria de poucos KB e quebraria a edição direta e os testes de mutação), carregar só o dicionário do idioma ativo (24 KB por idioma; causaria um flash de texto em inglês) e `content-visibility` nas seções (o Owl Carousel mede as alturas ao iniciar e ficaria errado).
