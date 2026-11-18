# TelaViva v2 — Documento de design

**Data:** 2026-11-18
**Status:** aprovado pelo autor em 2026-11-18

---

## 1. Intenção e porquê

O TelaViva é uma plataforma pt-BR para descobrir filmes, com dados do TMDb. Ele está publicado em `telaviva.vercel.app` e ficou um tempo sem manutenção. A v2 é uma modernização completa, com liberdade para refazer ou remover o que não estiver bom.

O projeto atende **dois públicos ao mesmo tempo**, e os dois pesam igual:

1. **Vitrine (portfólio).** Precisa surpreender no primeiro olhar e ter um código que dê orgulho de mostrar.
2. **Uso diário real.** Amigos do autor usam o site todo dia, principalmente no celular. Tudo precisa funcionar bem, rápido e sem quebrar.

**Regra do projeto:** quando houver escolha entre "simples e rápido" e "melhor e mais demorado", fica o melhor e mais demorado.

## 2. Metas, não-metas e antimetas

### Metas
- Identidade visual nova, cinematográfica e moderna, a direção **"Sala Escura"** (seção 5).
- **Filmes e séries**, com **acompanhamento de séries episódio por episódio** ("você parou no T2E5, o próximo é este").
- **Nota pessoal** de 1 a 10 para filmes e séries. Ela aparece para o próprio usuário e alimenta as recomendações.
- **Login opcional** com Google ou e-mail e senha. Listas e progresso ficam salvos na conta e sincronizados entre aparelhos. Quem não loga usa o site normalmente, com os dados no navegador.
- Stack atual, com chave do TMDb escondida no servidor, páginas renderizadas no servidor (SEO real) e prévia rica ao compartilhar links (WhatsApp, redes sociais).
- Experiência de app no celular: barra de navegação inferior e instalação na tela inicial (PWA).
- Código limpo e tipado, com testes automatizados de unidade e de ponta a ponta e CI.

### Não-metas (desta fase)
- **Recursos sociais**, como ver o que os amigos assistiram. Ficam para a fase seguinte, mas o modelo de dados já nasce preparado para eles.
- Apps nativos, reprodução de vídeo além de trailers, notificações push, interface em outros idiomas, resenhas ou comentários.

### Antimetas (seria um fracasso mesmo que "funcionasse")
- Quebrar o uso diário dos amigos durante a transição.
- Ficar lento ou desconfortável no celular.
- Parecer mais um clone genérico do Netflix.
- Expor segredos (chave do TMDb, credenciais) no navegador.
- Perder dados de usuários, inclusive ao trocar de visitante para logado.

## 3. Restrições

- **Mesmo endereço e mesmo projeto Vercel** (`telaviva.vercel.app`, projeto `telaviva`).
- **Custo zero.** Apenas planos gratuitos: Vercel Hobby, Firebase Spark e Neon Free. Sem domínio próprio por enquanto.
- **Atribuição exigida pelo TMDb.** É obrigatório exibir o logo do TMDb e o aviso *"Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB"*. Os dados de "onde assistir" vêm do JustWatch e exigem crédito a ele.
- **Idioma pt-BR e região BR** por padrão (datas, classificação indicativa, provedores de streaming).
- **O site atual continua no ar** até a v2 estar pronta e validada.
- **Acessibilidade WCAG 2.1 AA**: contraste, teclado, leitores de tela e respeito a `prefers-reduced-motion`.

## 4. Caminhos considerados

| | Caminho | Prós | Contras |
|---|---|---|---|
| **A** ✅ | **Next.js (App Router) completo na Vercel** | Chave escondida no servidor; cache por página; SEO e prévias de link reais; rotas de API e Server Actions no mesmo projeto; integração nativa com a Vercel | Reescrita quase total |
| B | Vite (SPA) + Supabase | Migração menor | SEO e prévias de link continuam fracos; duas plataformas para manter |
| C | React Router 7 (modo framework) | Também renderiza no servidor; evolução natural do roteador atual | Login e integração com a Vercel menos maduros que no Next.js |

**Escolhido: A**, decidido em conjunto. É o caminho mais completo, o que segue a regra do projeto.

**Subdecisão sobre login.** A primeira proposta era Better Auth com envio de e-mails pelo Resend, mas isso exige domínio próprio. Foi trocada por **Firebase Auth**, que envia os e-mails de verificação e recuperação pelo próprio domínio do Firebase, sem custo. O autor já usa Firebase em outro projeto. Os **dados ficam em Postgres (Neon)**, e não no Firestore, porque os recursos sociais futuros dependem de consultas entre usuários, que são naturais em SQL. O TelaViva terá um **projeto Firebase próprio e novo**. O outro site do autor não tem relação com este.

## 5. Identidade visual: "Sala Escura"

Validada com mockups durante o brainstorming. A sensação buscada é a de entrar num cinema de rua antes da sessão: elegante, autoral e quente.

### Elementos
- **Cores**
  - Fundo quase preto e quente: `#0c0a08`.
  - Texto em marfim: `#f3ede4`.
  - Destaque âmbar de letreiro: `#e8b25a`.
  - Apoio em vinho escuro: `#6e1f1f`.
  - As superfícies são tons intermediários derivados do fundo.
  - O vermelho da v1 sai.
- **Tipografia**
  - *Instrument Serif* nos títulos. Nos títulos de destaque e de seção, uma palavra em itálico âmbar, como em "A *Odisseia*" e "Séries *em alta*".
  - *Inter Tight* no texto corrido e na interface.
- **Motivos cinematográficos**
  - Granulado de película sutil sobre a página.
  - Faixas pretas de widescreen no destaque principal.
  - Botões em pílula.
  - Pôsteres com contorno âmbar discreto.
- **Anel de nota** (trazido da direção B, a pedido do autor). Um anel circular preenchido proporcionalmente à nota, com o número no centro. Aparece grande nos destaques e pequeno no canto dos pôsteres.
- **Nota pessoal** usa o mesmo anel, em marfim e com o rótulo "Sua nota", para não ser confundida com a nota do TMDb, que é âmbar. Para dar nota, há um seletor de 1 a 10 que funciona com toque, mouse e teclado.
- **Selo "Série"** nos pôsteres de séries, para diferenciar dos filmes em listas mistas.
- **Celular**
  - Barra de navegação fixa embaixo: Início, Filmes, Séries, Buscar e Minha lista.
  - Destaque com a imagem no alto e os textos sobre o degradê.
  - Botões de ação largos.
- **Movimento:** transições suaves de página e de hover, revelação ao rolar e efeito parallax leve no destaque. Tudo é desativado com `prefers-reduced-motion`.

Os tokens de design (cores, espaçamentos, raios, sombras e tipografia) vivem num único lugar, as variáveis do tema do Tailwind 4, e nenhum componente usa valor solto.

## 6. Arquitetura

### Stack
- **Next.js** (App Router, versão estável mais recente) com **React 19**, **TypeScript estrito** e **Tailwind CSS 4**.
- **Firebase Auth** no cliente para login. **firebase-admin** no servidor, para validar o token e criar um *session cookie* httpOnly. O servidor sempre sabe quem é o usuário, sem depender do navegador.
- **Postgres (Neon via Vercel Marketplace)** com **Drizzle ORM** e migrações versionadas.
- **TanStack Query** apenas para o que é interativo no cliente: sugestões de busca, listas, progresso e atualizações otimistas.
- **Zod** para validar respostas do TMDb, entradas de formulários e variáveis de ambiente.
- Ícones com **lucide-react**, substituindo react-icons. **Motion** para animações.

### Camada TMDb (servidor)
- Cliente tipado em `server-only`, autenticado com o **token de leitura v4 (Bearer)**, que substitui a `api_key` na URL.
- Cada recurso tem seu tempo de cache. Por exemplo: tendências 1 h, detalhes 24 h, gêneros 7 dias.
- As regras de curadoria da v1 que fazem sentido são portadas para cá: filtros de qualidade, nota ponderada, pontuação do destaque e recomendações.
- **Os trilhos da home não repetem títulos entre si.** Hoje o mesmo filme aparece em vários trilhos.

### Rotas e páginas
| Rota | Conteúdo |
|---|---|
| `/` | Destaque editorial; trilhos curados de filmes e séries sem repetição; "Continue assistindo" (séries em andamento) e "Recomendados para você" quando houver biblioteca |
| `/filmes` | Hub de filmes: em cartaz, populares, mais bem avaliados, em breve e por gênero |
| `/series` | Hub de séries: no ar hoje, populares, mais bem avaliadas e por gênero |
| `/filme/[id]-[slug]` | Detalhe: trailer, sinopse, elenco, onde assistir (BR), classificação, recomendados, ações de lista, nota pessoal |
| `/serie/[id]-[slug]` | Detalhe da série, mais temporadas e episódios com marcação individual, progresso, próximo episódio, próximo lançamento e nota pessoal |
| `/pessoa/[id]-[slug]` | Perfil, filmografia de filmes e séries e "conhecido por" |
| `/buscar` | Busca unificada (filmes, séries e pessoas) com filtros. No desktop também existe uma paleta de busca rápida (Ctrl+K) |
| `/descobrir` | Filtros avançados para filmes e séries, refletidos na URL |
| `/generos` e `/genero/[tipo]/[id]` | Navegação por gênero |
| `/minha-lista` | Abas **Assistindo**, **Quero ver** e **Assistidos**, com filtro filme ou série e o painel de estatísticas da biblioteca |
| `/entrar` | Login com Google ou e-mail e senha; cadastro; recuperação de senha |
| `/conta` | Perfil, sair, **exportar meus dados** e **excluir minha conta** (LGPD) |

As URLs antigas da v1 (`/movie/:id`, `/popular-movies`, `/to-watch-movies` etc.) **não são mantidas**. Por decisão do autor, só existem as URLs novas em pt-BR, e as antigas caem na página 404. Páginas de 404 e de erro seguem a identidade nova e oferecem busca e atalhos para as seções principais.

Toda página de filme, série e pessoa gera seus metadados no servidor e uma **imagem de prévia própria** (capa, título e anel de nota) para compartilhamento.

### Modelo de dados (Postgres)
- **`users`**: `id` (uid do Firebase), e-mail, nome, foto e datas de criação e atualização.
- **`library_items`**: `user_id`, `media_type` (`movie` | `tv`), `tmdb_id`, `status` (`want` | `watching` | `watched`), `added_at`, `updated_at` e `watched_at`. Guarda também um retrato mínimo do título (nome, pôster, ano e gêneros), para renderizar listas sem chamar o TMDb. A chave única é (`user_id`, `media_type`, `tmdb_id`).
- **`episode_progress`**: `user_id`, `tv_id`, `season_number`, `episode_number` e `watched_at`. A chave única cobre os quatro primeiros campos.
- **`ratings`**: `user_id`, `media_type`, `tmdb_id`, `score` (inteiro de 1 a 10), `rated_at` e `updated_at`. A chave única é (`user_id`, `media_type`, `tmdb_id`). A nota fica separada do status: dá para avaliar sem mexer na lista e mudar a lista sem perder a nota.
- Todo registro guarda data e hora. Isso permite derivar um feed de atividade quando os recursos sociais chegarem, sem refazer nada.

### Regras de acompanhamento de séries
- Marcar um episódio coloca a série em **Assistindo**, se ela ainda não estiver.
- É possível marcar ou desmarcar um episódio, uma temporada inteira ou "até aqui", que marca todos os episódios anteriores.
- **Próximo episódio** é o primeiro episódio já exibido e ainda não marcado.
- Com todos os episódios exibidos marcados:
  - se a série terminou, ela vai para **Assistidos**;
  - se ainda está no ar, fica em **Assistindo** com o aviso "em dia" e a data do próximo episódio, quando o TMDb informar.
- Episódios futuros aparecem com a data de estreia e não podem ser marcados.

### Regras da nota pessoal
- Avaliar um **filme** que não está como Assistido o move para **Assistidos**, porque quem dá nota assistiu.
- Avaliar uma **série** não muda o status dela, porque é possível dar nota no meio da série.
- A nota pode ser alterada ou removida a qualquer momento.
- **Recomendações:** títulos com nota de 8 a 10 pesam bastante a favor de títulos parecidos. Notas de 1 a 4 reduzem o peso de títulos parecidos. Sem nota, vale a lógica atual baseada na biblioteca.
- A **Minha lista** permite ordenar por "Sua nota" e mostra a média das suas notas no painel de estatísticas.

### Detalhes decididos na revisão (decisões minhas, para conferência)
- **Status por tipo.** Filmes usam só **Quero ver** e **Assistido**. **Assistindo** é exclusivo de séries.
- **Especiais (temporada 0)** aparecem na página da série, mas não contam para o progresso nem para "em dia".
- **Rever** um título não é registrado nesta fase. Marcar de novo apenas atualiza a data.
- **Verificação de e-mail.** Quem cria conta com e-mail e senha pode usar o site logo, com um aviso para verificar o e-mail. A recuperação de senha só funciona para e-mails verificados.
- **Excluir conta** apaga o usuário no Firebase e todos os registros dele no banco, de forma imediata e irreversível, com confirmação.
- **"Onde assistir"** vale para filmes e séries.
- **"Recomendados para você"** funciona também para visitantes, a partir da biblioteca local.
- **Datas de estreia** são exibidas no fuso de Brasília.
- Conteúdo adulto fica sempre excluído (`include_adult=false`).

### Visitante e logado
- O visitante usa o mesmo modelo, guardado no navegador numa chave versionada. A camada de dados tem uma interface única e duas implementações: local e servidor.
- No primeiro login, os dados locais são **mesclados** na conta. Itens repetidos ficam com o status e a nota de atualização mais recente, e com a união dos episódios. Depois, a cópia local é limpa.
- As ações (marcar, adicionar, remover) são **otimistas**: a interface responde na hora e desfaz com aviso se o servidor falhar.

### Imagens e desempenho
- As imagens vêm direto do CDN do TMDb, com `srcset` nos tamanhos que o próprio TMDb oferece. Não usam a otimização de imagens da Vercel, que tem limite no plano gratuito.
- Streaming com `Suspense` e esqueletos de carregamento com o formato real do conteúdo.
- Metas: LCP menor que 2,5 s no celular em 4G; CLS menor que 0,1; INP menor que 200 ms.

### PWA
- Manifesto, ícones na identidade nova e instalação na tela inicial, com abertura em tela cheia e cor do tema. Não há modo offline completo nesta fase. Sem rede, aparece uma página "sem conexão" na identidade visual.

## 7. Qualidade

- **TypeScript estrito**, ESLint (flat config) e Prettier.
- **Vitest + Testing Library** para regras puras e componentes: progresso de séries, regras da nota pessoal, mesclagem visitante e conta, curadoria, recomendações e anel de nota.
- **MSW v2** para simular o TMDb nos testes.
- **Playwright** de ponta a ponta nos fluxos críticos: navegar e buscar; adicionar à lista como visitante; marcar episódios e ver o próximo episódio; login com mesclagem (Firebase Auth Emulator); experiência no celular.
- **CI no GitHub Actions** com lint, checagem de tipos, testes, E2E e build. O Dependabot continua.
- **Acessibilidade:** auditoria automática com axe nos testes E2E, verificação de contraste do âmbar sobre os fundos e navegação completa por teclado.
- Código organizado **por domínio** (`media`, `library`, `auth`, `tmdb`, `ui`), com arquivos curtos e componentes reutilizáveis. Os componentes de 1.000 linhas e as duplicações da v1 não se repetem.

## 8. O que sai da v1

Create React App, react-helmet-async, ldrs, react-icons, MovieContext (substituído pela camada de biblioteca), o stub de telemetria, `PageContainer`, `App.css`, as duas pastas de imagens não usadas, `.vscode/settings.json` vazio e o domínio fictício `telaviva.example.com`. Também sai `docs/qa/sprint-2026-05-signoff.md`, que é um registro de uma sprint antiga. O README e os guias em `docs/contributing` são reescritos para a v2.

## 9. Entrega sem quebrar o uso diário

1. A v2 é construída numa branch própria. Cada push gera um link de pré-visualização na Vercel com alias estável por branch, e os amigos podem testar por ele.
2. O estado atual da `main` recebe a tag `v1`, para referência e eventual retorno.
3. Com a v2 validada, o merge na `main` publica em `telaviva.vercel.app`.

## 10. O que o autor precisa fazer (contas e chaves)

Nenhum destes passos tem custo. O passo a passo detalhado entra no plano de implementação.

- **Firebase:**
  - criar um projeto novo, exclusivo do TelaViva, e ativar os provedores Google e E-mail/senha;
  - adicionar `telaviva.vercel.app` e o alias de preview da branch aos domínios autorizados;
  - gerar a credencial de serviço para o servidor.
- **Neon:** criar o banco pela aba Storage/Marketplace do projeto na Vercel. As variáveis de ambiente são configuradas automaticamente.
- **TMDb:** copiar o **token de leitura da API (v4)** nas configurações da conta TMDb. A chave v3 atual continua válida, mas deixa de ser usada.

## 11. Fica a critério de quem implementar

Estrutura exata de pastas dentro de cada domínio; nomes de componentes; quais trilhos curados entram em cada hub, desde que não repitam títulos e mantenham o espírito das curadorias atuais; textos finais da interface; detalhes de animação dentro da linguagem definida; tempos exatos de cache.
