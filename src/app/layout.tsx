import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--fonte" });

export const metadata: Metadata = {
  title: "Painel Chat Alunos",
  description: "Resumos, dores, dúvidas e qualidade da mentoria, dia a dia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
