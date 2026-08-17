import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtendeIA",
  description: "Atendimento inteligente no WhatsApp para pequenas empresas.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
