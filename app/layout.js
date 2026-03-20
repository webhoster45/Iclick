import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Iclick — Injective 1-Click Alpha Gateway',
  description: 'Turn a single Alpha Link into an on-chain trade on Injective.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-background selection:bg-primary selection:text-on-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
