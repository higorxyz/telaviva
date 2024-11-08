# TelaViva - React Movie Platform

TelaViva é uma plataforma para exibição de filmes, com funcionalidades de visualização de filmes populares, em cartaz, melhores avaliados e próximos lançamentos. O projeto foi desenvolvido utilizando React, Tailwind CSS e a API The Movie Database (TMDb) para buscar e exibir informações sobre filmes.

## Funcionalidades

- Exibição de filmes populares, em cartaz, melhores avaliados e próximos lançamentos.
- Detalhes completos de cada filme, incluindo elenco, trailers e avaliações.
- Interface responsiva para dispositivos móveis e desktops.
- Sistema de rolagem infinita para carregar filmes conforme o usuário rola a página.
- Funcionalidade de "Filmes Assistidos" e "Filmes para Ver Depois", salvando essas informações no LocalStorage.

## Tecnologias Usadas

- React
- Tailwind CSS
- API The Movie Database (TMDb)
- LocalStorage

## Instalação

### Clonando o repositório

```bash
git clone https://github.com/SEU_USUARIO/telaviva-react-project.git
```

### Passos para rodar o projeto localmente

1. Instale as dependências do projeto:

```bash
cd telaviva-react-project
npm install
```

2. Crie um arquivo `.env` na raiz do projeto e adicione sua chave de API da TMDb:

```
REACT_APP_TMDB_API_KEY=SUA_CHAVE_DE_API
```

3. Rode o projeto localmente:

```bash
npm start
```

Isso abrirá o projeto no navegador, geralmente em `http://localhost:3000`.

## Licença

Este projeto é licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para mais detalhes.
