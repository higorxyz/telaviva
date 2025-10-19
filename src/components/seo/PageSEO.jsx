import React from 'react';
import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://telaviva.example.com';
const DEFAULT_IMAGE = `${BASE_URL}/social-share.png`;
const SITE_NAME = 'TelaViva';

const buildCanonical = (url) => {
  if (!url) {
    return BASE_URL;
  }
  try {
    return new URL(url, BASE_URL).toString();
  } catch (error) {
    return BASE_URL;
  }
};

const PageSEO = ({
  title = 'TelaViva - Descubra filmes e séries',
  description = 'Explore lançamentos, filmes populares e personalize suas listas de reprodução na TelaViva.',
  image = DEFAULT_IMAGE,
  url = '/',
  type = 'website',
  jsonLd,
  children,
}) => {
  const canonicalUrl = buildCanonical(url);
  const metaTitle = title.includes(SITE_NAME) ? title : `${title} • ${SITE_NAME}`;

  const structuredData = jsonLd ? JSON.stringify(jsonLd) : null;

  return (
    <Helmet prioritizeSeoTags>
      <html lang="pt-BR" />
      <title>{metaTitle}</title>
      <link rel="canonical" href={canonicalUrl} />
      <meta name="description" content={description} />
      <meta name="theme-color" content="#0b0b0f" />
      <meta name="application-name" content="TelaViva" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="index, follow" />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={canonicalUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {structuredData && (
        <script type="application/ld+json">{structuredData}</script>
      )}

      {children}
    </Helmet>
  );
};

export default PageSEO;


