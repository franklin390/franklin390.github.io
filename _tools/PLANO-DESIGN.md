# Plano para evoluir o design do portfólio

Criado em 2026-10-15. **As Fases 0 a 3 foram aplicadas em 2026-10-15** (resultado na seção 10). A Fase 4 (variáveis CSS) e a Fase 5 (aparelhos reais e teste com pessoas) seguem em aberto. Ele parte de uma medição do site como está hoje (tabelas abaixo) e de uma revisão visual das seções em 1280 px e 375 px. Os números vêm de `_tools/design-baseline.mjs` (`npm run measure:design`, resultado em `_tools/out/design-baseline.json`); as opiniões são minhas, a partir de capturas de tela. Não testei Safari, Firefox, aparelhos reais nem como um recrutador percorre a página.

Legenda dos itens:

- **[A]** não muda nenhum padrão de layout: eu faço sem pedir, mostro antes e depois.
- **[B]** muda um padrão visual ou de interação: só faço com a sua decisão (seção 6).
- **[C]** polimento, sem risco para o conteúdo.
- Esforço: **P** (um bloco curto de trabalho), **M** (uma sessão), **G** (mais de uma sessão).

## 1. Objetivo e princípios

**Objetivo.** Quem chega por busca, LinkedIn ou indicação deve entender em até 6 segundos quem você é e o nível do trabalho (Staff, arquitetura, decisões), e em 30 segundos ter provas (números, decisões, stack) e um caminho claro de contato, seja para vaga, projeto ou parceria. O design deve sustentar essa história, não decorá-la.

**Princípios.**
1. O conteúdo manda e o design organiza: nenhuma mudança visual pode acrescentar ou esconder um fato.
2. Celular primeiro na leitura: hoje o celular é a pior experiência do site (ver seção 2).
3. Um elemento só fica se ganhar o lugar: menos ruído, mais hierarquia.
4. Uma única verdade nos 3 idiomas (EN, PT, ES): todo ajuste é medido nos três, porque PT e ES são mais longos.
5. Desempenho e acessibilidade são requisitos, não extras (orçamentos na seção 5).
6. Mudar um padrão de layout só com a sua aprovação. Os carrosséis, a foto e a identidade (preto, magenta, Poppins e Lora) ficam como estão, salvo decisão sua.

**Restrições herdadas** (continuam valendo): nenhum dado pessoal público; EN primeiro; nunca inventar fato ou número; nada commitado nem publicado sem você pedir; todo ajuste passa pelos 16 gates e, quando criar regra nova, ganha um teste de defeito injetado.

## 2. Diagnóstico com números (EN, hoje)

**Altura da página por largura (px).**

| Seção | 1280 | 768 | 375 |
|---|---|---|---|
| Intro | 720 | 670 | 743 |
| About | 2.911 | 3.304 | **4.022** |
| Impact | 763 | 1.247 | 1.258 |
| Experience | 3.275 | 3.900 | **4.348** |
| Work | 4.318 | 5.964 | **8.533** |
| Chamada (CTA) | 426 | 426 | 465 |
| Expertise | 820 | 832 | 773 |
| Contact | 877 | 1.034 | 1.054 |
| Rodapé | 161 | 161 | 184 |
| **Total** | **14.272** | **17.539** | **21.380** |

No celular, o Work sozinho ocupa 40% da página, e a página inteira equivale a cerca de 26 telas de 800 px.

**Texto e toque.**

| Medida | 1280 | 768 | 375 |
|---|---|---|---|
| Texto com menos de 14 px (% dos caracteres) | 19% | 19% | **42%** |
| Menor tamanho de texto visível | 10,5 px | 10,5 px | **9,9 px** |
| Alvos de toque abaixo de 44 px | 57 de 91 | 56 de 85 | 50 de 85 |
| Carrosséis | 6 | 6 | 6 (agora 5, sem o de Education) |

Causa encontrada: o tema define `html { font-size: 10px }` e reduz para 9,4 px em telas de até 400 px (`css/main.css`). Tudo em `rem` encolhe 6% justamente nos celulares menores. Por isso o texto principal dos cards de case tem 13,6 px no celular contra 14,5 px no desktop, e o rótulo dos cards cai para 9,9 px. O normal seria o contrário.

Os alvos de toque abaixo de 44 px incluem links dentro de texto. O mínimo da WCAG 2.2 nível AA é 24 px, e o menor que medi tem 28 px de altura, então passa. O menu e os botões de idioma têm 40 px: ficam abaixo do 44 px recomendado para os controles principais.

**Código de estilo.** `css/staff.css` tem 0 variáveis CSS. O magenta aparece com 4 valores soltos (`#CC005F` 45 vezes, `#FF0077` 36, `#990047` 5, `#FF3D9A` 4) e há 32 cores hexadecimais distintas só nesse arquivo. Cada tamanho de fonte é um valor solto em `rem`. Funciona, mas cada ajuste vira busca e troca manual, e é fácil gerar inconsistência.

**Achados qualitativos** (F1 a F10, com a evidência das capturas):

- **F1.** O fundo do hero e da seção Expertise é a mesma placa de circuito com números binários: clichê genérico, que não conta a história de arquitetura do Staff.
- **F2.** O hero não entrega prova: a primeira tela tem nome, três palavras-chave e uma frase, mas nenhum número, e os dois botões têm o mesmo peso visual (os dois vazados).
- **F3.** O About no celular tem 4.022 px: 5 parágrafos, perfil, idiomas e cerca de 40 chips de skills em 8 grupos.
- **F4.** Os chips de skills com contorno rosa não têm legenda: o destaque não diz nada a quem lê.
- **F5.** A seção Experience empilha 5 padrões (tabela de relance, carrossel de papéis, carrossel de formação, cartões de certificados, carrossel de palestras). O slide de Education mostra só o título "MBA in Data Engineering" e parece inacabado.
- **F6.** O Work tem 12 cards. Os três de decisão (10 a 12) aparecem como "mais três cards", sem nada que os diferencie de um estudo de caso.
- **F7.** Há dois estilos de ícone: linha (Impact e Expertise) e sólido em círculo rosa (cards).
- **F8.** No Impact do celular há cerca de 100 px de espaço vazio entre uma linha de números e a seguinte.
- **F9.** O texto pequeno (tags, legendas, linhas da tabela de relance, datas) está em 12 a 13,5 px, com cinza claro sobre fundo claro. Passa no axe (contraste), mas cansa.
- **F10.** A foto de 90 px deixa a primeira tela sem rosto. Você decidiu manter, então fica só registrado.

**Pontos fortes a preservar:** a faixa Impact em magenta, o ritmo de seções escuras, claras e magenta, a hierarquia de títulos, o Contact com dois cartões, o seletor de idioma sempre visível, e a ausência de scroll horizontal em 320 a 1920 px.

## 3. Direção de design

**Manter:** preto `#0E0E0E`, magenta, Poppins para títulos e Lora para texto corrido.

**Evoluir, em quatro frentes:**
1. **Legibilidade:** escala tipográfica com piso (nada de texto corrido abaixo de 14 px no celular, rótulos em caixa alta a partir de 11 px) e `rem` que não encolhe no celular.
2. **Ritmo:** espaçamentos numa escala única (4, 8, 12, 16, 24, 32, 48, 64 px), com seções mais compactas no celular sem tirar conteúdo.
3. **Primeira tela com prova:** o hero passa a mostrar valor em 6 segundos (fundo sóbrio e específico, botão principal claro, três números).
4. **Sistema:** variáveis CSS (cores, espaços, raios, sombras, tipografia) para que o próximo ajuste seja uma linha, não uma busca no arquivo.

**Motivo visual proposto para o hero (decisão D24).** Uma ilustração abstrata em SVG de camadas e linhagem de dados: pontos de origem à esquerda, linhas que convergem para três camadas horizontais (contornos finos) e saem para pontos de consumo à direita, em traços de 1 px com magenta e cinza em 8 a 14% de opacidade, sem texto e sem afirmar nenhuma arquitetura específica (nada de "medalhão"). Estimativa: menos de 15 KB, estática, sem animação obrigatória, e respeita `prefers-reduced-motion`. Antes de aplicar, eu preparo duas prévias lado a lado para você escolher.

## 4. Fases e itens

### Fase 0. Preparação (P, sem mudança visível)

| ID | Item | Critério de aceite |
|---|---|---|
| 0.1 | **Feito.** Congelar o estado atual: capturas por largura (1280, 768, 375) e idioma (EN, PT, ES) com `layout-snap`, mais `design-baseline.json` | Arquivos salvos; `--diff` zerado antes de qualquer mudança |
| 0.2 | **Feito.** Criar o gate **G16 Design** com os orçamentos da seção 5 (começa só informando, depois passa a falhar quando cada fase fechar) | G16 roda no `npm run verify`; um teste de defeito injetado por regra |

### Fase 1. Legibilidade e ritmo [A] (M)

| ID | Item | O que muda | Meta |
|---|---|---|---|
| 1.1 | **Feito.** Escala tipográfica móvel | O `rem` não encolhe abaixo de 400 px; piso de 14,5 px no texto corrido dos cards, de 11 px nos rótulos em caixa alta e de 13,5 px nas tags e datas | Texto abaixo de 14 px: de 57% para 19% no celular (mesmo método, só texto visível); menor texto de 9,9 px para 11 px. A meta de 15% saiu do plano: o que sobra são rótulos em caixa alta e chips, mantidos entre 11 e 13,5 px de propósito |
| 1.2 | **Feito, com meta corrigida.** Compactar o celular | Reduzir os espaços entre as linhas do Impact e os paddings entre seções (escala de espaçamento), sem tirar conteúdo | Altura total no celular: sem crescimento (21.380 px para 21.552 px, +0,8%, já contando o novo subtítulo). A meta de 17.500 px não cabe na Fase 1: texto maior ocupa mais, e cortar altura de verdade exige esconder conteúdo, que é a Fase 3 |
| 1.3 | **Feito.** Alvos de toque | Menu e botões de idioma de 40 para 44 px; áreas de toque maiores nos links da tabela de relance e nos controles dos carrosséis | Controles principais com pelo menos 44 px; nada abaixo de 24 px |
| 1.4 | **Feito.** Subtítulo dos cards de decisão | Uma linha curta antes dos cards 10 a 12 (textos novos em EN, PT e ES, sem fato novo) | Os três cards de decisão ficam distinguíveis dos estudos de caso |
| 1.5 | **Feito** (foco). Estados de foco, hover e ativo | Revisar para que todo controle tenha os três estados com contraste suficiente | axe sem violações e teste de foco no G4 |
| 1.6 | **Feito.** Contraste do texto secundário | Escurecer cinzas de datas, emissores e legendas até pelo menos 4,5:1 com folga | Menos casos limítrofes de contraste |

### Fase 2. Primeira tela [B] (M)

| ID | Item | Decisão | Critério |
|---|---|---|---|
| 2.1 | **Feito (opção A).** Fundo do hero (e da Expertise): trocar a placa de circuito | D24 | LCP e peso não pioram (orçamentos da seção 5); texto com contraste mínimo de 4,5:1 sobre o fundo |
| 2.2 | **Feito.** Hierarquia dos botões: "Download CV" principal (sólido), "About me" secundário | D25 | Um só botão principal por tela |
| 2.3 | **Feito.** Faixa de prova no hero: 3 números (os mesmos do Impact, vindos do ledger) abaixo dos botões | D25 | Nenhum número novo; G3 e G4 verdes |
| 2.4 | **Conferido, sem mudança.** Tagline: tamanho e contraste sobre o novo fundo | junto com 2.1 | Contraste medido sobre o pior ponto do fundo |

### Fase 3. Seções longas [B] (G)

| ID | Item | Opções | Critério |
|---|---|---|---|
| 3.1 | **Feito.** About no celular | Recomendado: mostrar 2 parágrafos e "Read more" para os outros 3; skills com os 3 primeiros grupos e "Show all skills" (mesmo padrão já aprovado dos projetos antigos) | About no celular: 4.022 px para até 2.600 px; conteúdo continua no HTML |
| 3.2 | **Feito (destaque removido).** Chips destacados | Remover o destaque rosa **ou** manter com uma legenda (depende do que ele significa para você: D27) | Nenhum destaque sem significado |
| 3.3 | **Feito.** Education | Trocar o carrossel de 3 slides por uma lista compacta de 3 linhas (escola, curso, período), como a tabela de relance (D26) | Sem slide "vazio" |
| 3.4 | **Feito.** Work no celular | Mostrar os 4 primeiros cards e um botão "Show all 12" (D28); no desktop não muda | Work no celular: 8.533 px para até 5.500 px |
| 3.5 | **Feito (linha).** Ícones | Unificar o estilo (D29): todos em linha, ou todos sólidos | Um só estilo de ícone |
| 3.6 | **Feito.** Experience | Manter a tabela de relance e o carrossel (já decidido), mas no celular a tabela vira o ponto de entrada e o carrossel só abre ao tocar numa linha (D30) | Experience no celular: 4.348 px para até 3.400 px |

### Fase 4. Sistema visual [C] (M a G)

| ID | Item | Critério |
|---|---|---|
| 4.1 | Variáveis CSS: cores (marca no escuro `#FF0077`, marca no claro `#CC005F`, marca profunda `#990047`, realce `#FF3D9A`), espaços, raios, sombras, tipografia. **Sem mudança visual** | `layout-snap --diff` com diferença zero; sem cor da marca fora das variáveis (checado no G16) |
| 4.2 | Folha de componentes (`_tools/out/componentes.html`, não publicada): cartão, chip, rótulo, botão, tabela de relance com os estados | Serve de referência para próximos ajustes |
| 4.3 | Movimento: revelar blocos ao rolar de forma discreta, com `prefers-reduced-motion` respeitado, sem biblioteca nova | G4 passa com movimento reduzido; CLS 0 |

### Fase 5. Validação e medição (contínua)

| ID | Item | Quem |
|---|---|---|
| 5.1 | Antes e depois de cada fase: capturas por largura e idioma, `--diff`, revisão visual minha com as imagens mostradas a você | eu |
| 5.2 | Fim de cada fase: `npm run verify` completo, `selftest` dos casos novos, relatório curto | eu |
| 5.3 | Aparelhos reais: iPhone (Safari), Android (Chrome), Firefox no desktop e uma tela grande. Roteiro de 10 minutos, que eu escrevo | você |
| 5.4 | Teste de 5 segundos com 3 a 5 pessoas (um recrutador, um colega de dados, um leigo): "o que ele faz?", "qual o nível?", "você chamaria para conversar?" | você |
| 5.5 | Depois de publicado: os eventos do GA4 que já existem (`section_view`, `scroll_depth`, `case_view`, cliques na tabela de relance, `cv_download`, `contact_click`) comparam antes e depois. Meta de leitura, não de promessa: mais gente chegando ao Impact, mais cliques em contato por cem visitas | você, com a minha leitura |

## 5. Metas e orçamentos

| Medida | Hoje | Meta |
|---|---|---|
| Altura no celular (375 px) | 21.380 px | Fase 1: sem crescimento (21.552 px); Fase 3: até 16.000 px. **Resultado: 13.917 px (−35%)** |
| Altura no desktop (1280 px) | 14.272 px | sem aumento |
| Texto abaixo de 14 px no celular (só texto visível) | 57% | 19% (resultado da Fase 1; orçamento do G16: 20%) |
| Menor texto visível | 9,9 px | 11 px (resultado da Fase 1; piso do G16) |
| Controles principais abaixo de 44 px | menu e idioma em 40 px | todos com pelo menos 44 px (resultado da Fase 1; em telas de 320 a 360 px o menu fica em 40 px para o nome caber) |
| Cores hexadecimais da marca fora de variáveis | cerca de 90 usos | 0. **Resultado: 0** (180 trocas, 14 variáveis, imagens idênticas pixel a pixel) |
| Peso da primeira carga (Slow 4G, CPU 4x) | cerca de 309 KB | até 360 KB (orçamento do G15). **Resultado: 284 KB em 29 requisições** |
| Maior renderização (LCP) | cerca de 1,6 s | até 1,8 s. **Resultado: 1,65 s**, bloqueio total (TBT) 222 ms |
| Deslocamento de layout (CLS) | 0 | 0 |
| Gates | 16 verdes | 17 verdes (resultado da Fase 1, com o G16) |

## 6. Decisões (respondidas em 2026-10-15)

| ID | Pergunta | Minha recomendação |
|---|---|---|
| D24 **→ A** | Fundo do hero: (a) SVG de camadas e linhagem, (b) grade técnica sutil em gradiente, (c) manter a placa de circuito | (a), com duas prévias antes de aplicar |
| D25 **→ sim nos dois** | Hero: botão principal sólido (Download CV) e faixa com 3 números | Sim nos dois |
| D26 **→ sim** | Education: lista compacta no lugar do carrossel | Sim |
| D27 **→ remover** | O que significa o contorno rosa em alguns chips de skills? | Se não houver significado, remover |
| D28 **→ sim** | Work no celular: mostrar 4 cards e "Show all 12" | Sim |
| D29 **→ linha** | Estilo único de ícone: linha ou sólido | Linha (combina com o Impact e com a Expertise) |
| D30 **→ sim** | Experience no celular: tabela de relance como entrada, carrossel só ao tocar | Sim |
| D31 **→ sim** | About no celular: 2 parágrafos, "Read more" e skills recolhidas (padrão dos projetos antigos) | Sim |

As decisões D24 a D31 só afetaram as Fases 2 e 3.

## 7. Ordem de execução

1. **Fase 0** (preparação e G16 só informativo).
2. **Fase 1** inteira, com antes e depois mostrados (a de maior retorno e menor risco).
3. Você responde D24 a D31. Eu preparo as prévias do hero (D24) e do About e Work no celular (D28, D31).
4. **Fase 2**, depois **Fase 3**, um item por vez, cada um com seu antes e depois.
5. **Fase 4** (variáveis CSS) por último de propósito: com o visual já decidido, o refactor é uma troca mecânica com diferença visual zero, e fica mais seguro.
6. **Fase 5** em paralelo, e o G16 passa a falhar de verdade quando cada fase fecha.

## 8. Riscos e como lidar

| Risco | Mitigação |
|---|---|
| PT e ES são mais longos e estouram o novo layout | Toda medida nos 3 idiomas; G5 já compara a expansão EN para PT e ES |
| Texto maior muda a altura dos carrosséis | O `afterFonts()` já remede; mantemos o teste G15 de carrossel com fontes atrasadas |
| Novo SVG do hero piora o LCP | Orçamento de 15 KB, pré-carga como a imagem atual e medição com `npm run perf` antes de aceitar |
| Recolher conteúdo no celular reduz o que o Google vê | Usar `<details>` (o conteúdo continua no HTML, como nos projetos antigos) e checar no G14 e G8 |
| Os novos botões "Show all" precisam de medição | Novos valores em `training_toggle.item` no plano do GA4, e G13 atualizado |
| Variáveis CSS mudam um pixel sem querer | Fase 4 só fecha com `layout-snap --diff` zerado nos 9 pares largura x idioma |
| Fontes reduzidas (subset) sem um caractere novo | `npm run build:site` regera as fontes e o teste de glifos do G15 pega a falta |

## 9. Fora de escopo (a menos que você peça)

Trocar as fontes ou a paleta; modo escuro com alternância; remover carrosséis sem a sua decisão; mudar a foto; imagens de banco de imagens ou geradas por IA (licença e credibilidade); mexer nos CVs (design deles é outro trabalho); novas bibliotecas JavaScript.

## 10. Registro de execução

### Fases 0 e 1 (2026-10-15)

**O que foi feito**
- **Fase 0.** Capturas congeladas em `_tools/out/design/snap-before.json` (9 combinações de largura e idioma) e script `npm run measure:design`. Gate novo **G16** (`verify/g16-design.mjs`): orçamento de altura por largura e idioma, piso de tamanho de texto, pisos do texto corrido, alvos de toque de 44 px nos controles principais e de 24 px em todos (WCAG 2.2 AA), anel de foco visível em cada parada do teclado e contraste com margem.
- **1.1 Texto.** Cada tamanho pequeno virou `max(valor original em rem, piso em px)`: no desktop quase nada muda, e no celular nada cai abaixo do piso (texto corrido de cards 14,5 px, tags e datas 13,5 a 14 px, rótulos em caixa alta 11 px). O texto dos cards no celular passou de 13,6 px para 14,5 px.
- **1.2 Ritmo.** Paddings das seções no celular de 12rem para cerca de 8rem, e cards do Work mais compactos no celular.
- **1.3 Toque.** Menu, botões de idioma, nome no cabeçalho, ícones do hero e do rodapé, setas dos carrosséis, filtros do Work (até 768 px), links em forma de pílula e links de navegação do desktop chegam a 44 px. Os ícones do hero ganharam área de toque com margem negativa, então ficam exatamente onde estavam. Em 320 px reduzi o espaçamento do cabeçalho para o nome não ser cortado.
- **1.4 Subtítulo.** "Decisões e trade-offs" (EN, PT, ES) antes dos três cards de decisão; ele some junto com os cards quando um filtro não deixa nenhum.
- **1.5 Foco.** O teste do teclado achou dois controles sem anel de foco (o botão "Show all 33 courses" e os filtros do Work); os dois foram corrigidos.
- **1.6 Contraste.** O rosa `#CC005F` sobre as seções cinza dava 4,72:1 (passava, mas por pouco). O texto nessas posições usa `#B0004F`. Sobra um aviso: o rótulo "Contact" em `#FF0077` sobre fundo escuro dá 4,80:1.

**Antes e depois (EN, mesmo método, só texto visível)**

| Medida | Antes | Depois |
|---|---|---|
| Texto abaixo de 14 px, celular (375 px) | 57% | 19% |
| Texto abaixo de 14 px, desktop (1280 px) | 26% | 18% |
| Menor texto no celular | 9,9 px | 11 px |
| Elementos abaixo de 44 px, celular | 50 de 85 | 23 de 85, todos links dentro de listas de cursos e o crédito do rodapé (exceção de linha para o critério de 24 px) |
| Altura da página, celular, EN / PT / ES | 21.380 / 22.202 / 22.235 px | 21.552 / 22.355 / 22.357 px (+0,8% / +0,7% / +0,5%) |
| Altura da página, desktop, EN / PT / ES | 14.272 / 14.616 / 14.594 px | 14.524 / 14.813 / 14.809 px (+1,8% / +1,3% / +1,5%) |

Parte do crescimento é o próprio subtítulo (cerca de 190 px no celular), que é conteúdo novo de propósito.

**Verificação.** `npm run verify` completo: 17 gates verdes. Seis defeitos injetados novos, todos pegos pelo G16 e pelo G4: texto do card abaixo do piso, botões de idioma voltando a 40 px, uma seção estourando o orçamento de altura, perda do anel de foco, texto com contraste baixo e o subtítulo que não some com os cards.

**O que ficou para depois.** Fases 2 e 3 dependem das decisões D24 a D31. Os links de texto dentro das listas de cursos (17 px de altura) seguem como exceção documentada. Não testei Safari, Firefox nem aparelhos reais.

### Fases 2, 3 e 4 (2026-10-15)

Você respondeu às 8 decisões (D24 a D31) escolhendo todas as opções recomendadas.

**Fase 2. Primeira tela**
- **Fundo (D24, opção A).** `images/intro-bg.svg` (7,6 KB): fontes à esquerda, linhas de fluxo e consumidores à direita, brilho magenta. Serve também para "Where I can help" (a placa de circuito saiu do site inteiro). Sumiu a camada escura de 85% que escondia a foto. Os arquivos `images/bg.jpg` (196 KB), `intro-bg.jpg` e `intro-bg.webp` foram apagados, o código que carregava o fundo só quando a seção se aproximava saiu, e o cartão de compartilhamento (`og-card.png`) foi regerado sobre o mesmo SVG.
- **Botões e faixa (D25).** "Download CV" é o único botão sólido; abaixo, a faixa com >50%, ~50 e 15+ (os mesmos números do Impact, com a legenda traduzida). Os ícones sociais passaram para dentro do fluxo do hero, então nada se sobrepõe em tela baixa (testado em 1280x720, 1440x900, 768x1024, 375x740, 375x667 e 320x568).

**Fase 3. Seções longas**
- **About, skills, Work e Experience no celular (D28, D30, D31).** Até 600 px, e só com JavaScript: 2 parágrafos do About com "Read more", 3 grupos de skills com "Show all skills", 4 cards do Work com "Show all 12 case studies" e o carrossel de cargos que só abre ao tocar numa linha da tabela (ou em "Show role details"). Os saltos do Impact e da tabela de relance, os filtros e links como `/#case-cicd` abrem o que estiver recolhido. No desktop e sem JavaScript nada fica recolhido. Evento novo no GA4: `content_toggle` (item e estado).
- **Education (D26).** Lista compacta de 3 linhas (ids mantidos), em todas as larguras.
- **Chips (D27).** Contorno rosa removido; todos os chips têm o mesmo visual.
- **Ícones (D29).** Os 12 cards de case e os 8 cartões de certificado usam os ícones de linha do tema (os mesmos do Impact e da Expertise). Os ícones pequenos da linha do tempo (prédio, capelo, microfone) continuam sólidos dentro dos círculos escuros.

**Fase 4. Variáveis CSS.** As cores da marca e os cinzas principais viraram 14 variáveis em `:root` (`--brand*`, `--gray-*`, `--bg-dark*`). A conversão foi pixel-exata: 81 imagens (9 seções x 3 larguras x 3 idiomas) idênticas antes e depois (só ruído de 3 a 6 pixels com diferença de 1 nível de cor, num gradiente do fundo SVG, que também aparece entre duas fotos do mesmo estado). O G16 agora recusa a cor da marca escrita como valor solto e variável inexistente. A escala de espaçamento **não** virou variável: os espaços atuais não seguem uma escala, e forçá-la mudaria o visual.

**Antes e depois da Fase 3 (EN, celular, 375 px)**

| Seção | Antes (início) | Agora |
|---|---|---|
| About | 4.022 px | 2.603 px |
| Experience | 4.348 px | 3.587 px |
| Work | 8.533 px | 3.239 px |
| Página inteira | 21.380 px | 13.917 px (−35%) |

No desktop a página ficou 2,5% maior (14.272 para 14.632 px): o subtítulo dos cards de decisão e a faixa do hero são conteúdo novo. Em PT e ES o celular ficou em 14.418 e 14.406 px.

**Verificação.** `npm run verify` completo: 17 gates verdes (G4 com 343 checagens, G16 com 45). Defeitos injetados novos, todos pegos: recolhimentos (3 casos), botão do CV, ícones voltando ao fundo do hero, número do hero trocado, ícone sólido, chip destacado, evento do analytics, cor da marca solta e variável inexistente. Um outro caso (carrossel sem remedir ao abrir) não era detectável porque o Owl já se corrige sozinho; foi removido do selftest e a remedição ficou no código só como proteção.

**O que não testei.** Safari, Firefox e aparelhos reais, e como um recrutador percorre a página (Fase 5, que depende de você). Os links dentro das listas de cursos seguem como exceção documentada (17 px de altura).
