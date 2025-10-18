# TelaViva - React Movie Platform

TelaViva é uma plataforma moderna para exibição de filmes, com funcionalidades de visualização de filmes populares, em cartaz, melhores avaliados e próximos lançamentos. O projeto foi desenvolvido utilizando React, Tailwind CSS e a API The Movie Database (TMDb).

## 🎬 Funcionalidades

- ✅ Exibição de filmes populares, em cartaz, melhores avaliados e próximos lançamentos
- ✅ Detalhes completos de cada filme, incluindo elenco, trailers e avaliações
- ✅ Interface responsiva para dispositivos móveis e desktops
- ✅ Sistema de scroll infinito para carregar filmes automaticamente
- ✅ Funcionalidade de "Filmes Assistidos" e "Filmes para Ver Depois" com LocalStorage
- ✅ Sistema de busca em tempo real com dropdown de sugestões
- ✅ Recomendações personalizadas baseadas em filmes salvos
- ✅ Navegação por gêneros
- ✅ Design moderno com Tailwind CSS
- ✅ Controles de acessibilidade com ajuste de fonte e suporte total a teclado
- ✅ Metadados dinâmicos em cada página com react-helmet-async
- ✅ Testes automatizados cobrindo fluxos críticos com Jest, React Testing Library e MSW

## 🚀 Tecnologias Usadas

- **React** 18.3.1 – biblioteca para construção de interfaces
- **React Router DOM** 6.27.0 – navegação entre rotas
- **Tailwind CSS** 3.4.14 – estilização com utilitários
- **@tanstack/react-query** 5.59.16 – cache e sincronização de requisições
- **React Helmet Async** 1.3.0 – gerenciamento de metadados e SEO
- **React Icons** 4.3.1 – biblioteca de ícones
- **LDRS** 1.0.2 – componentes de loading acessíveis
- **Jest + React Testing Library** 29/14 – suíte de testes
- **MSW** 1.3.3 – mocking de API em testes
- **whatwg-fetch** – polyfill de Fetch API para o Jest
- **API The Movie Database (TMDb)** – dados oficiais de filmes

## 📦 Instalação

### Clonando o repositório

```bash
git clone https://github.com/SEU_USUARIO/telaviva-react-project.git
cd telaviva-react-project
```

### Instalando dependências

```bash
npm install
```

### Configuração da API

1. Crie uma conta em [The Movie Database](https://www.themoviedb.org/)
2. Obtenha sua chave de API em Settings > API
3. Crie um arquivo `.env` na raiz do projeto:

```env
REACT_APP_TMDB_API_KEY=sua_chave_api_aqui
```

### Executando o projeto

```bash
npm start
```

O projeto abrirá em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
src/
├── api.js                    # Camada de comunicação com a TMDb
├── App.jsx                   # Rotas e layout raiz
├── index.js                  # Ponto de entrada da aplicação
├── components/
│   ├── AccessibilityControls.jsx
│   ├── ErrorMessage.jsx
│   ├── Loading.jsx
│   ├── MovieCard.jsx
│   ├── MovieCardSkeleton.jsx
│   ├── MovieList.jsx
│   ├── MovieSection.jsx
│   └── PageSEO.jsx
├── context/
│   └── MovieContext.js
├── hooks/
│   ├── useDebouncedValue.js
│   └── useIntersectionObserver.js
├── layout/
│   ├── Footer.jsx
│   ├── Navbar.jsx
│   └── PageContainer.jsx
├── pages/
│   ├── Category.jsx
│   ├── Genres.jsx
│   ├── Home.jsx
│   ├── MovieDetails.jsx
│   ├── NowPlayingMovies.jsx
│   ├── PageNotFound.jsx
│   ├── PopularMovies.jsx
│   ├── SearchResults.jsx
│   ├── TopRatedMovies.jsx
│   ├── ToWatchMovies.jsx
│   ├── UpcomingMovies.jsx
│   └── WatchedMovies.jsx
├── test-utils/
│   ├── renderWithProviders.js
│   └── server.js
└── utils/
  ├── movieAdapter.js
  └── telemetry.js
```

## 🔧 Melhorias Implementadas

### Performance
- ✅ Cache e revalidação automática com React Query nas listagens principais
- ✅ Scroll infinito com IntersectionObserver e fallback manual de “Carregar mais”
- ✅ Busca com debounce real e cancelamento de requisições obsoletas
- ✅ Telemetria centralizada para monitorar erros e status das requisições

### Código Limpo
- ✅ Camada de adapters para normalizar dados e facilitar internacionalização
- ✅ Contexto resiliente com deduplicação, persistência e tratamento de falhas do localStorage
- ✅ Test harness com React Testing Library 14, MSW e polyfills consolidados
- ✅ Scripts de lint/format e stack atualizada para manutenção contínua

### UX/UI
- ✅ Dropdown de busca acessível com destaque de resultados e navegação por teclado
- ✅ Skeletons, placeholders e fallback para imagens, trailers e elenco
- ✅ Controles de acessibilidade (ajuste de fonte, focus-visible) e tema consistente
- ✅ Metadados dinâmicos em todas as páginas com JSON-LD, Open Graph e Twitter Cards

## 🎨 Características de Design

- **Cores principais:**
  - Primary: `#101010` (preto escuro)
  - Secondary: `#bd0003` (vermelho)
  
- **Tipografia:** Poppins (Google Fonts)

- **Responsividade:** 
  - Mobile: 2 colunas
  - Tablet: 3 colunas
  - Desktop: 4-5 colunas

## 📝 Scripts Disponíveis

```bash
npm start       # Inicia o servidor de desenvolvimento
npm build       # Cria build de produção
npm lint        # Executa ESLint com falha em warnings
npm format      # Formata arquivos com Prettier
npm test        # Executa testes
npm test:coverage # Gera relatório de cobertura de testes
npm eject       # Ejeta a configuração (irreversível)
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**Higor Batista**

- GitHub: [@Hiigorx](https://github.com/Hiigorx)
- LinkedIn: [Higor Batista](https://www.linkedin.com/in/higorbatista)

## 🙏 Agradecimentos

- [The Movie Database (TMDb)](https://www.themoviedb.org/) pelos dados de filmes
- [React](https://reactjs.org/) pela biblioteca incrível
- [Tailwind CSS](https://tailwindcss.com/) pelo framework CSS
- Comunidade open source

---

**Desenvolvido com 💻 e ❤️ por Higor Batista**

