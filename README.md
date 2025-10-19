

# TelaViva - React Movie Platform

Plataforma moderna para exibição de filmes, desenvolvida com React, Tailwind CSS e integração à API TMDb.

## 📦 Funcionalidades
- Exibição de filmes populares, em cartaz, melhores avaliados e próximos lançamentos
- Detalhes completos de cada filme (sinopse, elenco, trailer, avaliações)
- Interface responsiva e acessível
- Scroll infinito nas listagens
- Marcar filmes como assistidos ou para ver depois
- Busca em tempo real com sugestões
- Recomendações personalizadas
- Navegação por gêneros
- Metadados dinâmicos (SEO, Open Graph, Twitter Cards, JSON-LD)
- Testes automatizados

## 🚀 Tecnologias
- React 18
- React Router DOM 6
- Tailwind CSS 3
- React Query 5
- React Helmet Async
- React Icons
- LDRS (loaders animados)
- Jest + React Testing Library 14
- MSW (Mock Service Worker)
- whatwg-fetch
- API TMDb

## 🛠️ Instalação e Execução
1. Clone o repositório:
   ```bash
   git clone https://github.com/higorxyz/telaviva.git
   cd telaviva
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure a API TMDb:
   - Crie uma conta em [TMDb](https://www.themoviedb.org/)
   - Obtenha sua chave de API
   - Crie um arquivo `.env` na raiz:
     ```env
     REACT_APP_TMDB_API_KEY=sua_chave_api_aqui
     ```
4. Inicie o projeto:
   ```bash
   npm start
   ```
   Acesse `http://localhost:3000`

## 🗂️ Estrutura do Projeto
```
src/
├── App.jsx
├── index.js
├── index.css
├── app/
│   ├── layout/
│   ├── providers/
│   └── router/
├── assets/
│   └── images/
├── components/
│   ├── accessibility/
│   ├── feedback/
│   ├── layout/
│   ├── logo/
│   ├── navigation/
│   └── seo/
├── features/
│   └── movies/
│       ├── api/
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── utils/
├── hooks/
├── lib/
├── pages/
├── test-utils/
```

## 📝 Scripts Disponíveis
```bash
npm start         # Inicia o servidor de desenvolvimento
npm build         # Cria build de produção
npm lint          # Executa ESLint com falha em warnings
npm format        # Formata arquivos com Prettier
npm test          # Executa testes
npm test:coverage # Gera relatório de cobertura de testes
npm eject         # Ejeta a configuração (irreversível)
```

## 🧪 Testes
Os testes estão em:
- `src/components/**/__tests__`
- `src/features/movies/components/__tests__`
- `src/features/movies/context/__tests__`
- `src/features/movies/pages/__tests__`

## 🔧 Melhorias Implementadas

### Performance
- Cache e revalidação automática com React Query nas listagens principais
- Scroll infinito com IntersectionObserver e fallback manual de “Carregar mais”
- Busca com debounce real e cancelamento de requisições obsoletas
- Telemetria centralizada para monitorar erros e status das requisições

### Código Limpo
- Camada de adapters para normalizar dados e facilitar internacionalização
- Contexto resiliente com deduplicação, persistência e tratamento de falhas do localStorage
- Test harness com React Testing Library 14, MSW e polyfills consolidados
- Scripts de lint/format e stack atualizada para manutenção contínua

### UX/UI
- Dropdown de busca acessível com destaque de resultados e navegação por teclado
- Skeletons, placeholders e fallback para imagens, trailers e elenco
- Controles de acessibilidade (ajuste de fonte, focus-visible) e tema consistente
- Metadados dinâmaicos em todas as páginas com JSON-LD, Open Graph e Twitter Cards

## 🎨 Características de Design
- **Cores principais:**
  - Primary: `#101010` (preto escuro)
  - Secondary: `#bd0003` (vermelho)
- **Tipografia:** Poppins (Google Fonts)
- **Responsividade:**
  - Mobile: 2 colunas
  - Tablet: 3 colunas
  - Desktop: 4-5 colunas

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
- GitHub: [@higorxyz](https://github.com/higorxyz)
- LinkedIn: [Higor Batista](https://www.linkedin.com/in/higorbatista)

## 🙏 Agradecimentos
- [The Movie Database (TMDb)](https://www.themoviedb.org/) pelos dados de filmes
- [React](https://reactjs.org/) pela biblioteca incrível
- [Tailwind CSS](https://tailwindcss.com/) pelo framework CSS
- Comunidade open source


**Desenvolvido com 💻 e ❤️ por Higor Batista**


