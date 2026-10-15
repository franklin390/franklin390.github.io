# Roteiro para publicar o portfólio

Nada foi publicado no site (a `master` continua como estava). **Já existe um commit na branch** `feat/staff-bilingual-refresh` (`ad1668b`, "Add new version.", autor franklin390, 15/10/2026 00:43) e ele já foi enviado ao GitHub (`origin/feat/staff-bilingual-refresh`); não foi feito por mim. Depois dele, 37 arquivos mudaram só na pasta de trabalho: o trabalho de design das Fases 0 a 4 e a correção de privacidade abaixo. Esta é a ordem que eu seguiria, com o que cada passo prova e o que fica por sua conta. Os passos marcados **(você)** exigem a sua conta, o seu navegador ou a sua decisão.

## 0. Antes de commitar: o que vai para o repositório público

O repositório é público, então tudo o que for commitado fica visível, inclusive o que o site não publica.

| Pasta | Vai ao ar no site? | Aparece no repositório? | Observação |
|---|---|---|---|
| `index.html`, `pt/`, `es/`, `css/`, `js/`, `images/`, `pdf/`, `fonts/subset/`, `sitemap.xml`, `robots.txt` | Sim | Sim | O site de fato |
| `_cv/` | Não (pasta com `_` não é publicada) | Sim | Fonte dos CVs: só texto de CV, sem telefone, nascimento nem cidade |
| `_tools/` | Não | Sim | Ledger de fatos (`facts/`), plano e os validadores. O PDF do LinkedIn fica em `_tools/fixtures/`, que está no `.gitignore` |

- **(você)** Decida se `_tools/` e `_cv/` ficam no repositório público. Eu recomendo que fiquem: mostram o método de verificação. O que não pode ir: o PDF do LinkedIn (já ignorado) e qualquer coisa nova com dado pessoal.
- O histórico do git antigo ainda contém o telefone, a data de nascimento e o nome completo das versões anteriores. Reescrever o histórico é destrutivo e eu não faço sem você pedir. Se isso importa, a opção é `git filter-repo` (e depois um push forçado), e vale fazer **antes** de divulgar o link.
- Rode `npm run verify` na pasta `_tools` imediatamente antes do commit (cerca de 14 minutos). Última rodada: 16 gates verdes.

## 1. Commit e publicação **(você decide o momento)**

Você está na branch `feat/staff-bilingual-refresh`. O GitHub Pages publica o que estiver na branch configurada (em geral `master`).

1. Commitar o que mudou depois do `ad1668b` (eu faço quando você pedir). Sugestão: dois commits, um com a limpeza (arquivos antigos removidos: `less/`, `scss/`, `images/z/`, FontAwesome 4) e outro com o conteúdo novo.
2. Abrir um pull request para `master` e olhar o diff antes de mesclar.
3. Mesclar. O GitHub Pages leva alguns minutos para atualizar.

## 2. Conferir o site publicado (eu faço depois que você publicar)

- `https://franklin390.github.io/`, `/pt/`, `/es/` abrem e trocam de idioma.
- `https://franklin390.github.io/sitemap.xml` lista as três páginas e `robots.txt` aponta para ele.
- Os três PDFs de CV baixam e o PDF antigo (`Franklin_Ferreira_Cientista_de_Dados_CV.pdf`) continua abrindo (é cópia do PT).
- O gate de links (`npm run verify:links`) deve zerar os avisos de `/pt/` e `/es/` (hoje eles dão 404 porque ainda não estão no ar).
- Não testei Safari, Firefox nem aparelhos reais. Vale abrir no seu celular e, se puder, no Safari do iPhone.

## 3. Medição: GTM e GA4 **(você)**

O passo a passo completo está em `_tools/gtm/LEIA-ME.md`. Resumo da ordem:

1. Importar `_tools/gtm/portfolio-container.json` no GTM (modo Mesclar → Substituir, se já havia um contêiner) e publicar a versão.
2. Rodar `npm run check:gtm-live` (precisa de internet): carrega o contêiner publicado de verdade e conta os envios ao GA4 por ação.
3. Fazer no GA4 os ajustes da seção "Configurar no GA4": desligar as medições aprimoradas que duplicam eventos, marcar `cv_download` e `contact_click` como eventos-chave, filtros de tráfego interno e de nome do host.

## 4. Busca (Google Search Console) **(você)**

1. Criar uma propriedade do tipo **prefixo de URL** com `https://franklin390.github.io/` (a propriedade de domínio pede verificação por DNS, que você não controla em `github.io`).
2. Verificar a propriedade. O método mais simples para este site é a **tag HTML**: o Search Console entrega uma linha `<meta name="google-site-verification" content="...">`. Me passe o código e eu coloco no `<head>` do `index.html`, de `pt/` e de `es/` e rodo os gates (a tag não é dado pessoal, mas os gates precisam aceitá-la). Não escolha o método "Google Tag Manager": o GTM deste site carrega só depois do evento `load` e só em domínios permitidos, então a verificação pode falhar.
3. Enviar o `sitemap.xml`.
4. Em "Inspeção de URL", pedir indexação de `/`, `/pt/` e `/es/`.
5. Depois de alguns dias, olhar "Páginas" para confirmar que as três foram indexadas e que o Google entendeu `hreflang` (EN, PT-BR e ES).

## 5. Divulgação **(você)**

- No LinkedIn: colocar o link do portfólio em "Informações de contato" e no "Em destaque". Atualizar o cargo atual para Staff Data Engineer, se ainda não estiver, e corrigir lá a sobreposição do Tech Lead (jul/2025 em diante) para terminar em jun/2026, para o LinkedIn e o site contarem a mesma história.
- Anexar os CVs novos onde você os envia. O nome do arquivo antigo continua funcionando, mas com o conteúdo novo em português.
- Dar o link `?lang=en` ou `/` para vagas fora do Brasil, `/pt/` para o mercado brasileiro e `/es/` para a América Latina de língua espanhola.

## 6. Se algo der errado

- Desfazer a publicação: reverter o merge em `master` (`git revert -m 1 <commit>` se foi um commit de merge; `git revert <commit>` se o pull request foi mesclado com squash); o GitHub Pages volta ao estado anterior em poucos minutos. Nada disso apaga histórico.
- Medição com dados estranhos: o filtro de nome do host e o `HOSTS` do `index.html` existem para isso; confira `_tools/gtm/LEIA-ME.md`.

## O que ainda está em aberto (não bloqueia a publicação)

- Revisão sua do espanhol (a tradução é minha).
- Uma terceira decisão no formato de card de decisão (Unity Catalog por domínio ou CI/CD com trunk-based), se você quiser.
- Recomendações públicas do LinkedIn, artigos e um repositório de referência (fase 3 do `PLANO-MELHORIAS.md`).
- Confirmar o link do Let's Code: hoje aponta para https://ada.tech porque o endereço antigo não resolve mais.

## Aviso de privacidade sobre o commit já enviado (2026-10-15)

O commit `ad1668b`, que já está no GitHub, traz em `_tools/facts/facts.json` e `_tools/facts/analytics.json` o sobrenome do nome legal escrito como regra de bloqueio. A regra foi movida para a lista privada `_tools/fixtures/private-forbidden.json` (fora do git), e os dois arquivos já estão limpos na pasta de trabalho. Quem vê o repositório continua podendo ver o sobrenome **no histórico** desse commit. Opções, todas suas:

1. Deixar como está: o nome completo já aparece em certificados em PDF que estão na `master` (decisão D15 do plano), então o ganho de esconder só este trecho é pequeno.
2. Reescrever só esse commit (amend ou squash dos commits da branch) e atualizar a branch com `git push --force-with-lease`. Isso é destrutivo na branch remota e só faço se você pedir.
3. Reescrever todo o histórico (inclui o telefone e a data de nascimento das versões antigas na `master`): `git filter-repo`, e depois push forçado. Vale fazer **antes** de divulgar o link.

A lista privada não está no repositório: faça uma cópia de `_tools/fixtures/` (e do PDF do LinkedIn que está nela) em algum lugar seguro.
