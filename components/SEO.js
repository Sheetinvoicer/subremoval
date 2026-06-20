import Head from 'next/head';

export default function SEO({ 
  title = 'SheetInvoicer - AI-Powered Invoicing Platform',
  description = 'Global invoicing platform with AI automation, 10+ currencies, and client portal',
  keywords = 'invoicing, AI, payments, global business, automation',
  image = '/og-image.png',
  url = 'https://www.sheetinvoicer.com',
  type = 'website'
}) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="SheetInvoicer" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Canonical */}
      <link rel="canonical" href={url} />
      
      {/* Alternate languages */}
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="es" href={`${url}/es`} />
      <link rel="alternate" hrefLang="fr" href={`${url}/fr`} />
      <link rel="alternate" hrefLang="ar" href={`${url}/ar`} />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "SheetInvoicer",
          "description": description,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web, iOS, Android",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        })}
      </script>
    </Head>
  );
}
