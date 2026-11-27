# TelaViva v2 — Fase 4: offline, auditorias, docs e lançamento

**Data:** 2026-11-21 · **Branch:** `v2` · **Depende de:** [design da v2](2026-11-18-telaviva-v2-design.md) e Fases 1–3 concluídas.

## 1. Intenção

A v2 já tem catálogo, biblioteca e contas. A Fase 4 deixa o site pronto para os dois públicos de sempre: os amigos que usam todo dia (quase sempre no celular) e quem olha o projeto como portfólio. No fim, a v2 substitui a v1 em `telaviva.vercel.app`.

O caso real que guia o modo offline: alguém no metrô ou no avião abre o TelaViva instalado no celular, vê a própria lista, abre a série que está acompanhando e marca o episódio que acabou de ver. Quando a internet volta, isso aparece em todos os aparelhos sem a pessoa fazer nada.

## 2. Metas

1. **Abrir sem internet.** O app instalado (ou a aba) abre offline.
   - A Minha lista sempre abre.
   - As páginas que a pessoa já visitou abrem como estavam.
   - As séries que ela está assistindo ficam salvas para uso offline mesmo sem terem sido abertas neste aparelho (§6.3).
   - Abrir do zero uma página nunca visitada mostra a página "Sem conexão" no visual do site. Um link para uma página não salva, tocado dentro do app, mostra o carregamento com o aviso "Esta página abre quando a internet voltar" e abre sozinha quando a rede volta (§6.2).
2. **Agir sem internet.** Adicionar, mudar status, remover, dar nota e marcar episódios funcionam offline, para visitantes e para quem tem conta. As ações de quem tem conta vão para uma fila no aparelho e são enviadas quando a conexão volta, sem sobrescrever algo mais recente feito em outro aparelho.
3. **Saber o estado.** Um aviso discreto mostra quando a pessoa está offline e quantas ações esperam envio. Nada de tela de erro do navegador.
4. **Auditorias.** Desempenho (metas do design: LCP < 2,5 s no celular em 4G, CLS < 0,1, INP < 200 ms), acessibilidade (teclado, contraste, leitor de tela), segurança (cabeçalhos, dependências) e SEO básico, com o que for encontrado corrigido.
5. **Documentação.** README novo da v2, guias de contribuição e manutenção atualizados, guia de setup consolidado.
6. **Lançamento.** Produção configurada (Vercel, Firebase, Neon), merge da `v2` na `main`, verificação no ar e plano de volta.
7. **Pendências da Fase 3** (ver §8).

## 3. Não-metas

- Sincronização em segundo plano com o app fechado (Background Sync). O iPhone não suporta. O envio acontece com o app aberto.
- Notificações push.
- Busca, Descobrir e páginas nunca visitadas funcionando offline. Elas mostram a página "Sem conexão".
- Entrar, criar conta, exportar ou excluir conta offline. Essas ações exigem rede e dizem isso.
- Recursos sociais (continuam para depois).
- Banco de dados separado para previews (ver §7.3).

## 4. Anti-metas (falha mesmo que "funcione")

- **Amigos presos numa versão velha** depois de um deploy, ou uma página aberta que quebra porque os arquivos antigos sumiram.
- **Ação offline que desfaz algo mais novo** feito em outro aparelho. Ou ação perdida em silêncio.
- **Dados pessoais vazando entre contas** no mesmo aparelho. Exemplos: a lista guardada da conta A aparecendo depois que B entra, ou a fila de A sendo enviada para B.
- **Respostas privadas no cache do service worker** (`/api/library`, `/api/account`, `/api/auth`).
- Login quebrado por causa do service worker (o proxy `/__/auth/*` precisa passar direto).
- Visitante que fica offline sendo tratado como "deslogado", ou logado que fica offline caindo para visitante.

## 5. Abordagem escolhida

**Considerado:**

| Opção | O que é | Por que sim / não |
|---|---|---|
| A. Só página "sem conexão" | Mínimo do design original | Não cobre o caso do metrô. Descartada pelo autor. |
| B. Leitura offline | Lista e páginas visitadas abrem; ações bloqueadas | Útil, mas a ação mais comum (marcar episódio) não funcionaria. |
| **C. Leitura + ações offline com fila** | B mais fila de ações que sincroniza | **Escolhida pelo autor.** |

**Como construir a parte do service worker:**

| Opção | Por que sim / não |
|---|---|
| **Serwist (`@serwist/turbopack`)** | **Escolhida.** Indicada pelo guia do Next 16. Cuida da lista de arquivos por build, versionamento e limpeza. Nós escrevemos só as regras. |
| Service worker à mão | Controle total, mas é exatamente onde nasce o problema de "preso na versão velha". Mais código para manter. |

**Verificado num teste descartável (2026-11-21)**, com `@serwist/turbopack@9.5.13` + `serwist@9.5.13` + `esbuild` no projeto atual (Next 16.4.6, cacheComponents, Turbopack):
- build de produção passa;
- `/serwist/sw.js` é servido com `service-worker-allowed: /`;
- as páginas visitadas reabrem offline num recarregamento completo;
- as páginas não visitadas caem na página offline.

**Pontos a confirmar na implementação:**
- **Caminhos dos arquivos na Vercel.** Na Vercel os arquivos ficam em `/_next/static/immutable/...`, e localmente em `/_next/static/chunks/...`. A lista guardada pelo service worker precisa bater com o que a Vercel serve. Isso se verifica no preview logo na primeira tarefa.
- **Scripts de instalação do npm.** O npm local bloqueou os scripts de instalação de `esbuild` e `@swc/core`, mas o build funcionou mesmo assim. Confirmar o mesmo no build da Vercel.
- **Versões.** Fixar versões exatas, publicadas há pelo menos duas semanas: 9.5.13 é de 2026-10-04.

## 6. Design

### 6.1 Service worker

- **Integração:**
  - `withSerwist` no `next.config.ts`;
  - rota `src/app/serwist/[path]/route.ts` com `createSerwistRoute`;
  - fonte do worker fora de `src/app`, com `lib: webworker` em tsconfig próprio, sem quebrar o `typecheck`;
  - `SerwistProvider` (`swUrl="/serwist/sw.js"`) no layout.
- **Revisão da página offline e de entradas extras:**
  - usar `VERCEL_GIT_COMMIT_SHA`, com recuo para um hash do conteúdo;
  - não usar `git` no build, que pode não existir na Vercel.
- **Regras próprias, sem usar o `defaultCache` inteiro.** O padrão guarda `/api/*`, e isso inclui dados pessoais.

| O quê | Estratégia |
|---|---|
| Arquivos do build (`/_next/static/**`) | Precache pela lista do build. Uma cópia dos arquivos de versões anteriores fica num cache de reserva (CacheFirst, ~30 dias, com limite de entradas), para uma aba aberta antes do deploy não quebrar ao carregar um pedaço antigo. |
| Páginas (documentos) do próprio site | NetworkFirst com tempo limite curto (~3 s), guardando as visitadas (limite ~80 entradas, ~14 dias). Na falta, página offline. |
| Requisições RSC (navegação no app) | NetworkFirst, com as mesmas regras das páginas, para que a navegação dentro do app offline funcione nas páginas visitadas. |
| `/minha-lista`, `/` e a página offline | Pré-carregadas na instalação, para abrir sempre. |
| Dados públicos de catálogo do próprio site (GET em `/api/tv/*`, `/api/catalog/*`, `/api/discover`, `/api/search`) | NetworkFirst, limite e validade curtos. Em especial, a temporada de uma série visitada (`/api/tv/{id}/season/{n}`) precisa estar disponível offline para marcar episódios. |
| Imagens do TMDb (`image.tmdb.org`) | StaleWhileRevalidate ou CacheFirst com limite de entradas e de idade. Evitar respostas opacas infladas na cota: usar CORS onde o CDN permitir, ou limitar mais. Fica para a implementação, com medição. |
| `/api/library*`, `/api/account*`, `/api/auth*`, `/__/auth/*`, `/serwist/*` | NetworkOnly. Nunca guardados. |
| POST/PUT/DELETE | Nunca interceptados para cache. |

- **Atualização.** Usar `skipWaiting` + `clientsClaim`: a versão nova assume já, e a próxima navegação busca HTML novo (NetworkFirst). O cache de reserva cobre as abas abertas.
- **Botão de emergência.** Uma variável `NEXT_PUBLIC_SW_DISABLED=1` faz o provider desregistrar o service worker e apagar os caches dele. Ela serve para desligar tudo rápido na Vercel, se algo der errado.
- **Desenvolvimento e testes.** Desligado no `next dev`. No E2E, as specs atuais rodam com `serviceWorkers: 'block'`, e uma spec própria de offline liga o service worker.

### 6.2 Estado de conexão

- Ligar `experimental.useOffline`. Com isso, navegações e prefetches que falham ficam pendentes e são refeitos quando a rede volta, em vez de quebrarem.
- Usar o hook `useOffline` (de `next/offline`) num indicador global. Ele é mais confiável que `navigator.onLine`.
- O indicador fica discreto, no mesmo espaço fixo dos avisos (padrão da Fase 3), sem cobrir conteúdo. Mensagens:
  - "Sem conexão. Suas ações serão enviadas quando a internet voltar."
  - com fila: "N ações aguardando envio";
  - ao enviar tudo: confirmação breve.
- **Link para página não salva, tocado offline dentro do app** (*decisão minha*):
  - a navegação fica pendente, como o Next faz com `useOffline`, e abre sozinha quando a rede volta;
  - depois de ~1,5 s pendente, o indicador mostra "Esta página abre quando a internet voltar", com atalho para a Minha lista;
  - o service worker não força um salto para `/~offline` nesse caso.

  Recarregar a página do zero, offline, continua levando a `/~offline`.
- `partialPrefetching` fica como está. Muda só se a implementação provar que é necessário, com registro do motivo.

### 6.3 Biblioteca offline para quem tem conta

**Cópia local por conta:**
- A última lista conhecida do servidor fica guardada no aparelho, separada por uid, junto com a fila. Ela é usada para mostrar a Minha lista, os botões e o progresso quando o servidor não responde.
- A lista do visitante continua como hoje (`telaviva:library:v1`).
- Armazenamento: IndexedDB, porque a fila e a cópia podem crescer e não devem travar a página. Uma camada fina e testável fica sobre ele.

**Identidade offline:**
- Com o cookie de dica `tv_auth=1` e a cópia local da última identidade (uid, nome, e-mail, verificado), o app continua "logado" quando `/api/auth/me` falha por falta de rede.
- Só um 401 verdadeiro do servidor tira a pessoa da conta.
- Visitante offline continua visitante.

**Fila:**
- Cada ação feita com a conta é aplicada na hora, de forma otimista, na cópia local, e também entra na fila com:
  - um id único;
  - o uid;
  - o horário em que foi feita (`at`).
- Se a rede está boa, a ação é enviada imediatamente, como hoje. A fila só segura o que falhou por rede.
- **Quando enviar:**
  - ao voltar a conexão;
  - ao abrir ou focar o app;
  - depois de cada ação bem-sucedida.
- **Uma aba de cada vez.** Só uma aba envia por vez, usando Web Locks (`navigator.locks`, presente no iOS 15.4+). As outras abas sabem da mudança via `BroadcastChannel` ou evento de storage.
- **Ordem e idempotência:**
  - envio em ordem;
  - os comandos atuais já são absolutos (`setStatus`, `remove`, `rate`, `unrate`, `setEpisodes`, `restore`), então reenviar o mesmo comando não causa dano;
  - o servidor também ignora um id já aplicado, se isso for barato. Se não for, a idempotência dos comandos basta, com registro da decisão.
- **Erros no envio:**
  - Rede: tenta de novo depois, com espera crescente.
  - 401: renova a sessão (caminho da Fase 3) e tenta de novo.
  - 409 `wrong_account`: para e não envia.
  - 4xx de validação: descarta aquela ação, avisa a pessoa e registra.
  - 5xx: tenta de novo depois.
- **Fila de outra conta.** Ela nunca é enviada para a conta atual. Fica guardada até aquela conta entrar de novo, com um limite de idade de ~30 dias. Depois disso, é descartada com aviso na próxima vez que essa conta entrar.
- **Sair e excluir a conta:**
  - "Sair" com ações pendentes avisa: "Você tem N ações não enviadas. Sair agora descarta essas ações." A pessoa pode cancelar.
  - Ao sair, a cópia local e a fila daquela conta são apagadas do aparelho, para proteger quem usa aparelho compartilhado.
  - Excluir a conta já exige rede. Ao excluir, apaga tudo da conta no aparelho.
- **Sair offline** (*decisão minha*):
  - é permitido;
  - apaga na hora a cópia local e a fila, e encerra o Firebase no aparelho;
  - grava uma marca "saída pendente". O cookie `tv_session` é httpOnly e só o servidor o apaga.
  - Enquanto a marca existir, o app se comporta como visitante e ignora o cookie.
  - Na volta da rede, a primeira coisa enviada é o `DELETE /api/auth/session`, antes de qualquer outra chamada. Depois a marca sai.
- **Sessão que acaba sem "Sair"** (*decisão minha*). Vale para um 401 verdadeiro que a renovação não resolve, ou para outra aba que trocou de conta:
  - a fila daquela conta fica guardada, até ~30 dias, para não perder ações;
  - a cópia da lista é apagada e é baixada de novo quando a pessoa entrar.

**Séries assistidas salvas para offline** (*decisão minha*, porque é o caso do metrô):
- Com rede, o app salva em segundo plano, sem atrapalhar a navegação, as séries com status "assistindo" (até ~12, as mais recentes):
  - a página da série;
  - a temporada atual e a seguinte (`/api/tv/{id}/season/{n}`).
- O progresso da Minha lista ("Próximo: T…E…", vindo de `/api/tv/progress`) passa a ter a última resposta guardada no aparelho, por conta. A URL dessa chamada muda quando a lista muda, então o cache do service worker não basta.
- O aquecimento respeita um orçamento de cache:
  - só roda com o app visível;
  - no máximo uma vez a cada ~6 h por série;
  - não roda com `navigator.connection.saveData`.
- O mesmo vale para visitantes, com a lista local.
- **Desfazer:**
  - Desfazer uma ação que ainda está na fila simplesmente a retira da fila e reverte a cópia local.
  - Desfazer uma ação já enviada continua como hoje, com a pré-imagem que vem do servidor.
- **Mesclagem do primeiro login.** Não muda. Se estiver offline no momento, a mesclagem espera a rede, e a lista do visitante fica intacta até lá.

### 6.4 Servidor: horário da ação

- **Comando com horário opcional.** O comando aceita `at`, o horário em que foi feito no aparelho:
  - o servidor usa `at` como horário da escrita, limitado a "não depois de agora" (a regra do `clamp.ts` que já existe);
  - um `at` mais antigo que o limite de idade da fila (~30 dias) é recusado como inválido;
  - sem `at`, o comportamento atual continua: o servidor usa o próprio "agora".
- **Mais novo vence, nos dois sentidos** (*decisão minha*, consequência da anti-meta da §4):
  - **Remoção atrasada.** As escritas já usam "mais novo vence" (`updated_at <= excluded`). A remoção ganha a mesma proteção: só remove se a linha não foi atualizada depois de `at`. O mesmo vale para desmarcar episódio e tirar nota.
  - **Escrita atrasada.** Ela também não pode recriar algo que outro aparelho removeu depois. Exemplo: A marca um episódio offline às 10h, B remove a série às 11h, e a fila de A chega às 12h. A série não volta.
  - **Como.** Remoções viram **marcas de remoção** com horário, em vez de apagar a linha. Pode ser uma coluna `deleted_at` em itens, notas e episódios, ou uma tabela de marcas. A escolha fica para a implementação, com migração Drizzle.
  - **Regras que valem nos dois casos:**
    - as leituras ignoram o que está marcado;
    - uma escrita só vale se for mais nova que a remoção;
    - as marcas com mais de ~60 dias são apagadas, folga sobre o limite de 30 dias da fila;
    - a limpeza roda de forma oportunista nas escritas do usuário, sem job pago;
    - os limites por usuário (5.000 itens etc.) contam só linhas vivas;
    - exportação e exclusão de conta tratam as marcas: a exportação as ignora, e a exclusão apaga tudo.
- **Migração.** Com isso, a §6.8 passo 3 deixa de ser condicional: há migração, aplicada antes do merge.
- **Testes de conflito com dois aparelhos.** Cada tipo de comando ganha um teste. Exemplo: A marca offline às 10h, B muda às 11h, a fila de A chega às 12h, e o estado de B vence onde houver conflito.

### 6.5 Página "Sem conexão"

- A página fica em `/~offline` (caminho da Serwist) ou equivalente, no visual Sala Escura.
- Título "Sem *conexão*", com o mesmo padrão display + itálico âmbar das outras páginas de estado.
- Texto curto.
- Atalhos para o que funciona offline: Minha lista e Início.
- Botão "Tentar de novo".
- Sem dependência de dados do TMDb, para que funcione sempre.

### 6.6 Auditorias

- **Desempenho:**
  - Lighthouse mobile (Moto G / 4G simulado), nas páginas Início, Filmes, detalhe de filme, detalhe de série, Minha lista e Buscar;
  - **onde roda** (*decisão minha*): num build de produção local, com as variáveis reais, antes do merge, porque o preview tem SSO e liberar exigiria mudar a Vercel; e de novo em produção logo depois do lançamento;
  - comparar com as metas;
  - corrigir o que falhar, registrando antes e depois;
  - checar que o service worker não piora o LCP da primeira visita.
- **Acessibilidade:**
  - axe continua no E2E e passa a cobrir também `/entrar`, `/conta`, a página offline e o indicador offline;
  - passada manual de teclado em todos os fluxos (abrir, navegar, adicionar, marcar episódio, nota, entrar, excluir conta);
  - contraste do âmbar e do texto suave sobre todos os fundos;
  - leitor de tela nas mensagens de status (indicador offline, fila enviada).
- **Segurança:**
  - cabeçalhos em `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors`;
  - CSP só se couber sem quebrar Firebase, YouTube (trailers) e o proxy de login; se não couber, registrar o motivo;
  - `npm audit` sem alta ou crítica em produção;
  - revisão de segurança das rotas novas (fila, `at`).
- **SEO básico:** `robots.ts` e `sitemap.ts` com as páginas fixas e os hubs. As páginas de conta continuam `noindex`.
- **Visual:** passada de polimento nas telas novas das Fases 2–3 e na página offline, no celular e no desktop.

### 6.7 Documentação

- **README novo, em pt-BR, voltado a portfólio e a quem vai rodar o projeto:**
  - o que é;
  - capturas de tela (celular e desktop);
  - stack;
  - arquitetura em poucas linhas (domínios, biblioteca local/servidor, offline);
  - como rodar (variáveis, emulador, banco local);
  - testes;
  - créditos TMDb/JustWatch;
  - licença.
- **`docs/contributing/*` e `docs/maintenance/branch-protection.md`:** revisados para a v2 (CI atual, nomes dos checks).
- **`docs/setup/`:** guia único de configuração, juntando o guia da Fase 3 e os passos de produção.
- **`.env.example`:** conferido contra todas as variáveis usadas.

### 6.8 Lançamento

1. **Produção na Vercel:** variáveis do ambiente Production (TMDb, Firebase público, credencial de serviço, `DATABASE_URL`) conferidas. O autor configura. O plano traz o passo a passo e uma checagem automática que lista o que falta, sem mostrar valores.
2. **Firebase:** `telaviva.vercel.app` nos domínios autorizados. As URIs de retorno do Google OAuth estão conferidas.
3. **Neon:** migração das marcas de remoção aplicada (`db:migrate -- --confirm`) antes do merge. Ela precisa ser compatível com o código atual da `main`: só adiciona, não quebra a v1, que nem usa o banco.
4. **Pull request `v2` → `main`**, com descrição para portfólio, sem menção a IA. O CI precisa estar verde. O merge é um merge normal, sem squash, para manter o histórico. **Só com aprovação explícita do autor.**
5. **Verificação no ar:**
   - página inicial;
   - login com Google e com e-mail;
   - uma ação na lista;
   - offline no celular;
   - erros de execução na Vercel;
   - Lighthouse.
6. **Plano de volta:** rollback instantâneo da Vercel para o deploy anterior de produção, e a tag `v1` como referência. Se o service worker for o problema, usar o botão de emergência (§6.1).
7. **Amigos:** quem tinha a v1 instalada recebe a v2 no mesmo endereço. A importação da lista da v1 (Fase 2) já cobre os dados antigos.

## 7. Restrições

1. Tudo da v2 continua valendo:
   - Node 24;
   - versões fixadas;
   - pt-BR;
   - tokens só no `@theme`;
   - `prefers-reduced-motion`;
   - arquivos de até ~200 linhas;
   - TMDb só via Bearer;
   - imagens direto do CDN do TMDb;
   - crédito "Powered by TMDB API & JustWatch".
2. Commits pequenos em inglês, sem `Co-Authored-By` e sem menção a Claude ou IA. Nenhum push, merge ou mudança na Vercel sem aprovação do autor.
3. Banco único para produção e previews nesta fase (previews são só do autor, protegidos por SSO). Se uma mudança de esquema entrar antes do lançamento, ela é aplicada com cuidado, e um banco de preview separado (branch do Neon) fica recomendado para o futuro.
4. Custo zero: nada de serviço pago.
5. Nenhuma alteração no `.gitignore` sem pedido do autor.

## 8. Pendências da Fase 3 que entram aqui

- Formulário de confirmar senha (reautenticação) com campo de usuário escondido, para gerenciadores de senha.
- Regra de limite no Firewall da Vercel para `/api/recommendations`, `/api/tv/*` e rotas de login. Proposta pronta no plano; aplicar só com aprovação do autor.
- Lembrete ao autor sobre `!.env.example` no `.gitignore`.

## 9. Fica a critério de quem implementar

- Nomes de arquivos e módulos.
- Limites exatos de cache (entradas e idade) dentro das faixas acima.
- Biblioteca fina ou código próprio sobre IndexedDB.
- Textos finais dos avisos, dentro do tom do site.
- Ordem das correções de auditoria.
- Formato exato do id da ação e da deduplicação no servidor.
