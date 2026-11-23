# Auditoria de desempenho — Fase 4 (novembro de 2026)

Registro da Task 9 do plano da Fase 4: medição com Lighthouse, correções e o que ficou de fora. Metas do design da v2
(§6 "Imagens e desempenho"): **LCP < 2,5 s** no celular em 4G, **CLS < 0,1** e **INP < 200 ms** (aqui o TBT serve de
indicador do INP, como pede o plano).

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
  trava do ambiente, não trabalho do site. Com `--disable-gpu` ela some (em `/buscar`, TBT de 1.510/83/201 ms passou a
  92/90/87/69 ms), então a comparação final usa essa flag nos dois builds.
- Os JSON brutos ficaram fora do repositório.

## Resultado

Mediana de três execuções intercaladas, Lighthouse mobile simulado, `--disable-gpu`.

| Página | LCP antes | LCP depois | CLS antes | CLS depois | TBT antes | TBT depois | Nota antes | Nota depois | Elemento do LCP |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 4,08 s | 3,84 s | 0 | 0 | 805 ms | 493 ms | 68 | 75 | backdrop do herói (`w780`) |
| `/filmes` | 3,92 s | 3,79 s | 0 | 0 | 402 ms | 594 ms | 78 | 74 | 1º pôster do 1º trilho (`w342`) |
| Filme | 5,95 s | 4,84 s | 0 | 0 | 303 ms | 240 ms | 73 | 77 | backdrop do herói (`w780`) |
| Série | 5,72 s | 5,48 s | 0 | 0 | 613 ms | 505 ms | 62 | 67 | backdrop do herói (`w780`) |
| `/minha-lista` | 3,60 s | 3,62 s | 0 | 0 | 517 ms | 516 ms | 77 | 76 | texto do estado vazio |
| `/buscar` | 0,78 s | 0,78 s | **0,079** | **0** | 388 ms | 440 ms | 89 | 89 | texto do rodapé |

O TBT varia ±200 ms entre execuções iguais nesta máquina (em `/filmes`, antes: 402/553/343 ms); diferenças menores que
isso não são conclusivas. O LCP e o CLS são estáveis.

**Conferência com rede e CPU limitadas de verdade** (DevTools: 150 ms de latência, 1,6 Mbps, CPU 4×, Pixel 7 emulado,
valores observados, mediana de três primeiras visitas intercaladas):

| Página | LCP antes → depois | `load` antes → depois | Imagens na 1ª carga | Bytes na 1ª carga |
|---|---|---|---|---|
| `/` | 3,51 s → 2,62 s | 8,3 s → 4,6 s | 29 → 13 | 1,39 MB → 0,79 MB |
| `/filmes` | 2,84 s → 2,16 s | 8,0 s → 6,0 s | 35 → 19 | 1,70 MB → 0,89 MB |
| Filme | 2,54 s → 2,25 s | 4,4 s → 4,2 s | 12 → 12 | 0,91 MB → 0,75 MB |
| Série | 3,61 s → 3,48 s | 3,7 s → 3,5 s | 5 → 5 | 0,76 MB → 0,63 MB |

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
   ligada à rolagem (`animation-timeline: scroll()`), no compositor. Fica parado onde não há suporte e com movimento
   reduzido, como antes. A dependência `motion` saiu do `package.json`.
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
  - A medição em produção, prevista no spec para logo depois do lançamento, vai mostrar o número sem a distorção do
    `localhost`.
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
