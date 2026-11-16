import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flow Builder — Automação WhatsApp',
  description: 'Construtor Visual de Automações Conversacionais para WhatsApp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark h-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden bg-slate-950 font-sans text-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
