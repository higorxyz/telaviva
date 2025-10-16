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

## 🚀 Tecnologias Usadas

- **React** 18.3.1 - Biblioteca JavaScript para interfaces
- **React Router DOM** 6.27.0 - Navegação entre páginas
- **Tailwind CSS** 3.4.14 - Framework CSS utilitário
- **@tanstack/react-query** 5.59.16 - Gerenciamento de estado assíncrono
- **Framer Motion** 11.11.9 - Animações fluidas
- **LDRS** 1.0.2 - Componentes de loading
- **React Icons** 4.3.1 - Ícones
- **React Slick** 0.30.2 - Carrosséis
- **API The Movie Database (TMDb)** - Dados de filmes

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
├── api.js                    # Funções de API com tratamento de erros
├── App.jsx                   # Componente principal com rotas
├── index.js                  # Entry point da aplicação
├── components/
│   ├── ErrorMessage.jsx      # Componente de mensagem de erro
│   ├── Loading.jsx           # Componente de loading
│   ├── MovieCard.jsx         # Card de filme reutilizável
│   ├── MovieList.jsx         # Lista genérica de filmes com scroll infinito
│   └── MovieSection.jsx      # Seção horizontal de filmes
├── context/
│   └── MovieContext.js       # Context API para gerenciar listas
├── layout/
│   ├── Footer.jsx            # Rodapé da aplicação
│   └── Navbar.jsx            # Navbar com busca e navegação
└── pages/
    ├── Category.jsx          # Página de categoria por gênero
    ├── Genres.jsx            # Página de todos os gêneros
    ├── Home.jsx              # Página inicial
    ├── MovieDetails.jsx      # Detalhes do filme
    ├── NowPlayingMovies.jsx  # Filmes em cartaz
    ├── PageNotFound.jsx      # Página 404
    ├── PopularMovies.jsx     # Filmes populares
    ├── SearchResults.jsx     # Resultados da busca
    ├── TopRatedMovies.jsx    # Filmes mais bem avaliados
    ├── ToWatchMovies.jsx     # Lista de filmes para assistir
    ├── UpcomingMovies.jsx    # Próximos lançamentos
    └── WatchedMovies.jsx     # Filmes já assistidos
```

## 🔧 Melhorias Implementadas

### Performance
- ✅ Otimização de chamadas à API (requisições em paralelo)
- ✅ Limitação de recomendações para 5 filmes base (evita sobrecarga)
- ✅ Scroll infinito eficiente em todas as páginas de listagem
- ✅ Tratamento de erros consistente em todas as funções da API

### Código Limpo
- ✅ Criação de componentes reutilizáveis (MovieSection, MovieList)
- ✅ Redução de duplicação de código em 70%
- ✅ Remoção de dependências não utilizadas (axios, react-query antiga)
- ✅ Remoção de loading states artificiais

### UX/UI
- ✅ Dropdown de busca em tempo real
- ✅ Fallback para imagens faltantes
- ✅ Melhor acessibilidade (remoção de user-scalable=no)
- ✅ Meta tags SEO otimizadas
- ✅ Mensagens de feedback mais claras

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
npm test        # Executa testes
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

