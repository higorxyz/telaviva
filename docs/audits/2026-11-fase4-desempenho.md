# Auditoria de desempenho — Fase 4 (novembro de 2026)

Registro da auditoria de desempenho da Fase 4: medição com Lighthouse, correções e o que ficou de fora. Metas da v2:
**LCP < 2,5 s** no celular em 4G, **CLS < 0,1** e **INP < 200 ms** (aqui o TBT serve de indicador do INP).

## Como foi medido

- Build de produção local (`npm run build` + `npx next start`) com o `.env.local` real, imagens direto do CDN do TMDb.
- `npx lighthouse@13.6.0 <url> --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate`
  (Moto G Power, 4G lento simulado: 150 ms de RTT, 1,6 Mbps, CPU 4×), no Chromium do Playwright, headless, perfil novo a
  cada execução (sempre uma primeira visita).
- Páginas: `/`, `/filmes`, `/filme/1022789-divertida-mente-2`, `/serie/1396-breaking-bad`, `/minha-lista` (visitante, lista
  vazia) e `/buscar`. Três execuções por página; a tabela mostra a **mediana de cada métrica**.
- **Antes e depois lado a lado.** O build de antes (commit `d8c9d10`) e o de depois rodaram ao mesmo tempo, em portas
  diferentes, e as execuções foram intercaladas (antes, depois, antes, depois…), para que a carga da máquina pesasse igual
  nos dois. A máquina é de uso diário e estava com outros programas abertos, o que explica a variação entre execuções.
- **`--disable-gpu` na medição final.** Na primeira rodada, várias execuções (de antes e de depois, em qualquer página)
  tiveram uma única tarefa "Unattributable" de 1,5–2 s simulados. O trace mostrou que, nesse intervalo, o processo de GPU do
  Chromium headless estava parado (`GPUTask` de ~400 ms com ~0,7 ms de CPU) e a thread principal só esperava por ele: uma
  trava do ambiente, não trabalho do site. Com `--disable-gpu` ela some: em `/buscar`, TBT de 1.510/83/201 ms (três
  execuções sem a flag) contra 92/90/87/69 ms numa sondagem de quatro execuções com a flag. Por isso a comparação final
  usa essa flag nos dois builds.
- Os JSON brutos ficaram fora do repositório.

## Resultado

Mediana de três execuções intercaladas, Lighthouse mobile simulado, `--disable-gpu`.

| Página         | LCP antes | LCP depois | CLS antes | CLS depois | TBT antes | TBT depois | Nota antes | Nota depois | Elemento do LCP                 |
| -------------- | --------- | ---------- | --------- | ---------- | --------- | ---------- | ---------- | ----------- | ------------------------------- |
| `/`            | 4,08 s    | 3,84 s     | 0         | 0          | 805 ms    | 493 ms     | 68         | 75          | backdrop do herói (`w780`)      |
| `/filmes`      | 3,92 s    | 3,79 s     | 0         | 0          | 402 ms    | 594 ms     | 78         | 74          | 1º pôster do 1º trilho (`w342`) |
| Filme          | 5,95 s    | 4,84 s     | 0         | 0          | 303 ms    | 240 ms     | 73         | 77          | backdrop do herói (`w780`)      |
| Série          | 5,72 s    | 5,48 s     | 0         | 0          | 613 ms    | 505 ms     | 62         | 67          | backdrop do herói (`w780`)      |
| `/minha-lista` | 3,60 s    | 3,62 s     | 0         | 0          | 517 ms    | 516 ms     | 77         | 76          | texto do estado vazio           |
| `/buscar`      | 0,78 s    | 0,78 s     | **0,079** | **0**      | 388 ms    | 440 ms     | 89         | 89          | texto do rodapé                 |

As medianas escondem bastante variação, e só as diferenças maiores que ela contam:

- **TBT** varia ±200 ms entre execuções iguais nesta máquina (em `/filmes`, antes: 402/553/343 ms).
- **LCP simulado** também varia, em até ~1 s numa mesma página. Por execução:
  - `/`: antes 3,80/4,08/4,11 s, depois 3,70/3,84/4,92 s;
  - `/filmes`: antes 3,92/3,93/3,92 s, depois 3,79/3,73/4,69 s;
  - filme: antes 5,95/6,01/5,65 s, depois 4,84/4,60/5,15 s;
  - série: antes 5,54/6,15/5,72 s, depois 5,63/5,37/5,48 s.
- **No LCP simulado de `/` e `/filmes`, a melhora é inconclusiva**, porque os conjuntos de execuções se sobrepõem. A
  evidência de ganho nessas duas páginas é a tabela com rede e CPU limitadas de verdade, logo abaixo.
- **No filme, os conjuntos se separam** (5,65–6,01 s antes, 4,60–5,15 s depois). **Na série, quase** (só 5,54–5,63 s em
  comum).
- **O CLS é estável**: os mesmos valores em todas as execuções.

**Conferência com rede e CPU limitadas de verdade** (DevTools: 150 ms de latência, 1,6 Mbps, CPU 4×, Pixel 7 emulado,
valores observados, mediana de três primeiras visitas intercaladas):

| Página    | LCP antes → depois | `load` antes → depois | Imagens na 1ª carga | Bytes na 1ª carga |
| --------- | ------------------ | --------------------- | ------------------- | ----------------- |
| `/`       | 3,51 s → 2,62 s    | 8,3 s → 4,6 s         | 29 → 13             | 1,39 MB → 0,79 MB |
| `/filmes` | 2,84 s → 2,16 s    | 8,0 s → 6,0 s         | 35 → 19             | 1,70 MB → 0,89 MB |
| Filme     | 2,54 s → 2,25 s    | 4,4 s → 4,2 s         | 12 → 12             | 0,91 MB → 0,75 MB |
| Série     | 3,61 s → 3,48 s    | 3,7 s → 3,5 s         | 5 → 5               | 0,76 MB → 0,63 MB |

Sem a limitação de banda (rede local rápida, como na rodada do Lighthouse), o Chrome pedia 83 imagens do TMDb (2,6 MB) no
carregamento da página inicial no celular; depois, 13 (420 KB).

### Primeira visita com o service worker

- A Serwist só registra o worker depois do evento `load` (`register()` espera o `load` quando `document.readyState` ainda
  não é `complete`). Numa primeira visita com rede e CPU limitadas, o download do precache começou em 4,93 s, depois do LCP
  (4,74 s) e do `load` (4,90 s). Ele não disputa banda com o herói, então nada mudou no registro.
- Lighthouse em `/` com o worker liberado e com `/serwist/sw.js` bloqueado, três execuções de cada: LCP 3,79 s e 3,49 s,
  com as execuções se sobrepondo (3,47–4,51 s e 3,46–4,98 s). A diferença está dentro do ruído e é coerente com o precache
  começar só depois do `load`.

## O que foi corrigido e por quê

1. **Parallax do herói sem JavaScript** (`perf:`). O movimento de 40 px do backdrop era o único uso da `motion`, cujo
   pedaço (cerca de 47 KB gzip, três quartos sem uso) carregava e rodava em toda página com herói. Virou uma animação
   ligada à rolagem (`animation-timeline: scroll()`), no compositor. Fica parado com movimento reduzido, como antes, e
   também onde não há suporte a `animation-timeline` (Firefox por padrão, Safari anterior ao 26), que antes tinha o
   movimento via JS. A dependência `motion` saiu do `package.json`.
2. **Formatador de datas criado no primeiro uso** (`perf:`). `lib/format` carrega em toda página, e montar um
   `Intl.DateTimeFormat` com fuso no carregamento do módulo custava ~50 ms de thread principal com a CPU limitada.
3. **Preconnect com o CDN do TMDb** (`perf:`). Vai no cabeçalho `Link` da resposta, então a conexão com
   `image.tmdb.org` abre enquanto o HTML ainda chega.
4. **Sem pôsteres antecipados sob o herói** (`perf:`). Na página inicial, o 1º trilho fica abaixo da dobra (no celular e
   no desktop), mas seus dois primeiros pôsteres eram `eager` e pré-carregados, disputando os primeiros bytes com o
   backdrop, que é o LCP.
5. **Só os campos do cartão para os trilhos** (`perf:`). Os trilhos são componentes de cliente, então cada título vai
   serializado no payload RSC, embutido no HTML e lido antes da hidratação. Iam inteiros (sinopse, título original,
   backdrop, popularidade…). Agora os componentes de servidor passam só o que o cartão mostra (`CardItem`). O HTML gzip caiu
   de 72 KB para 44 KB na página inicial (payload RSC de 45 KB para 17 KB), de 54 KB para 33 KB em `/filmes`, de 29 KB para
   24 KB no filme e de 33 KB para 30 KB na série.
6. **Trilhos abaixo da primeira tela renderizados ao se aproximar** (`perf:`). A margem do carregamento preguiçoso do
   Chrome também vale na horizontal de cada trilho, então uma página com uma dúzia de trilhos fazia layout, pintava e baixava
   os pôsteres de quase todos já no primeiro carregamento. Os trilhos que não abrem a página usam
   `content-visibility: auto` com a altura real como tamanho intrínseco. O primeiro trilho (o LCP de `/filmes`) continua
   igual. O preenchimento lateral, compensado por margens negativas, mantém o anel de foco e o brilho dos pôsteres das
   pontas fora do recorte da contenção de pintura.
7. **`/buscar` sem deslocamento** (`fix:`). A página é pré-renderizada com só o campo de busca como estado de carregamento.
   Depois, a view acrescentava o bloco "Comece a digitar" e empurrava o rodapé dentro da primeira tela (CLS 0,079 no
   celular). O estado de carregamento agora reserva o espaço desse bloco, invisível, porque com `?q=` os resultados ocupam o
   lugar dele.

## O que ficou e por quê

- **LCP acima de 2,5 s no Lighthouse simulado** em `/`, `/filmes`, filme, série e `/minha-lista` (série e
  `/minha-lista` têm itens próprios abaixo). O modelo do Lighthouse
  (Lantern) conta para o LCP tudo o que terminou antes do LCP observado, e não só o que de fato o bloqueia. Num build
  local, o HTML, os ~245 KB gzip de JavaScript, as fontes e os prefetches do roteador chegam do `localhost` em
  milissegundos, antes do backdrop, que vem do CDN do TMDb pela internet de verdade (RTT de ~110 ms e ~220 ms de resposta
  observados daqui). Tudo isso é então refeito a 1,6 Mbps somado ao LCP. Medido com a rede e a CPU limitadas de verdade, o
  LCP observado depois das correções fica em 2,6 s (`/`), 2,2 s (`/filmes`) e 2,2 s (filme).
  - Chegar a 2,5 s no modelo simulado exigiria cortar pela metade o JavaScript inicial, que é quase todo do Next e do React,
    ou não usar as fontes da identidade. As duas coisas estão fora do escopo de uma auditoria.
  - A medição em produção, feita logo depois do lançamento (seção "Medição em produção", abaixo), mostra o número sem a
    distorção do `localhost`.
- **Série (3,5 s observados, 5,5 s simulados)**: é a página que segue fora da meta mesmo com a rede limitada de verdade.
  O backdrop de Breaking Bad tem 101 KB em `w780` (o de Divertida Mente 2, 77 KB; o da página inicial, 51 KB), e a página
  carrega mais JavaScript que as outras (~307 KB gzip em 21 pedaços, contra ~245 KB em 15 na página inicial: seletor
  de temporada, lista de episódios, nota, ações da série). `w780` já é o menor tamanho do TMDb que cobre 412 px a 1,75×. O próximo passo é ver
  o que da página da série pode carregar depois do LCP.
- **`/minha-lista` (3,6 s)**: o LCP é o texto do estado vazio, que só existe depois que o JavaScript lê a lista guardada no
  aparelho (localStorage ou IndexedDB). Isso vem da biblioteca ser local primeiro: o servidor não conhece a lista. O tempo
  acompanha o peso do JavaScript inicial.
- **TBT entre ~250 e ~600 ms** com a CPU 4× simulada, quase todo na hidratação do React (`react-dom`) e na avaliação dos
  módulos. Próximo passo provável: trocar `zod` por `zod/mini` nos esquemas que rodam no cliente (biblioteca, fila offline,
  sessão). Hoje são ~30 KB gzip carregados em toda página, três quartos sem uso no carregamento. Ficou de fora porque mexe
  na validação compartilhada com as rotas do servidor e merece uma tarefa própria, com os testes dela.
- **CLS**: 0 em todas as páginas medidas depois das correções.

## Medição em produção (27 de novembro de 2026, depois do lançamento)

A medição prevista para depois do lançamento, agora em `https://telaviva.vercel.app` em vez do `localhost`. Mesmo
Lighthouse e mesma configuração (mobile simulado, `--disable-gpu`, perfil novo a cada execução), mediana de três
execuções por página. "Antes" é a produção no começo do dia; "depois" é a produção com os dois ajustes abaixo.

| Página         | LCP antes | LCP depois | TBT antes | TBT depois | Nota antes | Nota depois |
| -------------- | --------- | ---------- | --------- | ---------- | ---------- | ----------- |
| `/`            | 4,17 s    | 4,12 s     | 1.225 ms  | 649 ms     | 62         | 68          |
| `/filmes`      | 3,66 s    | 3,94 s     | 762 ms    | 690 ms     | 71         | 70          |
| Filme          | 4,83 s    | 4,39 s     | 658 ms    | 476 ms     | 65         | 72          |
| Série          | 4,54 s    | 4,68 s     | 674 ms    | 498 ms     | 67         | 69          |
| `/minha-lista` | 2,60 s    | 2,44 s     | 823 ms    | 653 ms     | 78         | 81          |

CLS 0 em todas as páginas, nas duas medições.

O que mudou entre as duas medições:

- **`zod/mini` no navegador** (PR #37): os esquemas da biblioteca, dos comandos e da sessão deixaram o `zod` clássico.
  No build de produção, o JavaScript do cliente foi de 449 KB para 436 KB gzip; o pedaço de 30 KB do `zod` clássico saiu.
- **Capa do trailer** (PR #38): `sddefault` (640×480) no celular e `maxresdefault` (1280×720) só a partir de 768 px.
  As imagens da primeira carga caíram de 778 KB para 731 KB na página da série e de 586 KB para 517 KB na de filme.

Como ler a tabela:

- **O TBT caiu em todas as páginas**, mas ele varia ±200 ms entre execuções iguais (ver acima). Só a queda da página
  inicial (1.225 → 649 ms) passa com folga dessa margem.
- **O LCP não mudou de forma mensurável.** As diferenças, para cima e para baixo, ficam dentro da variação de uma mesma
  página (em `/filmes`, 3,93/5,44/3,94 s na mesma rodada).
- **Divisão do LCP observado na página inicial** (sem a simulação): 0,28 s até o primeiro byte, 0,05 s até o pedido da
  imagem, 1,26 s baixando a imagem e 0,04 s até pintar. A imagem é descoberta cedo e pedida com prioridade alta; o que
  pesa é a banda dividida com o JavaScript (~260–300 KB), as fontes (75 KB) e as imagens abaixo da dobra.

### Depois: imagens da série e trilhos (mesmo dia)

- **Página da série** (PR #40): a sondagem num Pixel 7 emulado mostrou que as 20 fotos do elenco (a ~8.700 px do topo)
  eram baixadas no carregamento. A lista de episódios é transmitida depois (Suspense); no shell estático, o elenco
  ficava logo abaixo do espaço reservado de 24rem, a ~2.100 px do topo enquanto o HTML chegava, perto o bastante para o
  Chrome baixar as imagens `loading="lazy"`. As seções abaixo dos episódios passaram a ser transmitidas junto com eles.
  No Lighthouse da produção, a primeira carga da série foi de **27 imagens (778 KB) para 9 (391 KB)**, iguais nas três
  execuções. O LCP simulado não mudou (o backdrop já era pedido primeiro, com prioridade alta); o ganho é de banda para
  quem tem conexão lenta ou plano de dados limitado. Um E2E com temporadas que respondem com atraso protege isso.
- **Trilhos** (PR #41): o perfil de CPU da página inicial (CPU 4× mais lenta) mostrou ~240 ms de layout forçado: cada
  trilho lia `scrollWidth` no efeito de montagem para decidir as setas. A primeira medição agora fica com o
  `ResizeObserver`, que roda depois do layout do navegador. O pedaço do trilho foi de 261 ms de tempo próprio para 0 ms
  em quatro perfis. O TBT do Lighthouse segue variando demais entre execuções (649 e 853 ms na página inicial, com o
  mesmo código) para mostrar isso sozinho.
- **Hidratação, o resto:** o JavaScript da página inicial já é enxuto (`react-dom` 70 KB, Next 44 KB, o resto em
  pedaços pequenos; os polyfills são `noModule` e os navegadores atuais não os baixam). O que sobra é o custo normal de
  hidratar a página e de avaliar os módulos.

Próximo passo:

- **Medir usuários reais** (Vercel Speed Insights ou `web-vitals`), porque o modelo simulado do Lighthouse soma ao LCP
  tudo o que terminou antes dele. Depende de uma decisão do autor: o Speed Insights envia métricas de cada visita à
  Vercel e pode ter custo conforme o plano.
