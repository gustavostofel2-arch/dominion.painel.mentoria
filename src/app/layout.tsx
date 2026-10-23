import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const corpo = DM_Sans({ subsets: ["latin"], variable: "--fonte" });
const display = Unbounded({ subsets: ["latin"], variable: "--fonte-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono" });

export const metadata: Metadata = {
  title: "Painel Chat Alunos | DOMINION MENTORY",
  description: "Resumos, dores, dúvidas e qualidade da mentoria, dia a dia.",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export const viewport: Viewport = { themeColor: "#0a0a0b", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${corpo.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
