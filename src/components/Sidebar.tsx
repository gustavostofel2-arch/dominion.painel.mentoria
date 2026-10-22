"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const itens = [
  { href: "/", rotulo: "Visão geral" },
  { href: "/dia", rotulo: "Resumo do dia" },
  { href: "/historico", rotulo: "Histórico" },
  { href: "/temas", rotulo: "Temas e dores" },
  { href: "/duvidas", rotulo: "Dúvidas e qualidade" },
  { href: "/alunos", rotulo: "Alunos" },
  { href: "/relatorios", rotulo: "Relatórios" },
];

function estaAtivo(href: string, caminho: string): boolean {
  return href === "/" ? caminho === "/" : caminho.startsWith(href);
}

export default function Sidebar({
  grupoNome,
  grupoReferencia,
  email,
  sair,
}: {
  grupoNome: string | null;
  grupoReferencia: string | null;
  email: string | null;
  sair: () => Promise<void>;
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  // Fecha o menu do celular ao trocar de página e com a tecla Esc
  useEffect(() => {
    setAberto(false);
  }, [caminho]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  const paginaAtual = itens.find((i) => estaAtivo(i.href, caminho))?.rotulo ?? "Painel";

  return (
    <>
      {/* Computador: barra lateral */}
      <aside className="side">
        <div className="brand">
          <div className="logo">D</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Dominion</div>
            <div style={{ fontSize: 12, color: "var(--suave)" }}>Painel da mentoria</div>
          </div>
        </div>

        {itens.map((item) => {
          const ativo = estaAtivo(item.href, caminho);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={ativo ? "nav on" : "nav"}
              aria-current={ativo ? "page" : undefined}
            >
              <i />
              {item.rotulo}
            </Link>
          );
        })}

        <div className="grupo-box">
          <div className="lbl">Grupo</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{grupoNome ?? "Sem grupo ainda"}</div>
          {grupoReferencia && (
            <div className="sub" style={{ marginTop: 2 }}>
              {grupoReferencia}
            </div>
          )}
        </div>

        <form action={sair}>
          {email && (
            <div className="sub" style={{ marginTop: 10, wordBreak: "break-all" }}>
              {email}
            </div>
          )}
          <button className="sair" type="submit">
            Sair
          </button>
        </form>
      </aside>

      {/* Celular: barra de cima com os três pontinhos */}
      <header className="mobile-bar">
        <div className="mobile-topo">
          <div className="logo">D</div>
          <div className="mobile-titulo">
            <strong>{paginaAtual}</strong>
            <span>{grupoNome ?? "Painel da mentoria"}</span>
          </div>
          <button
            type="button"
            className="tres-pontos"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            onClick={() => setAberto((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>

        {aberto && (
          <>
            <button type="button" className="mobile-fundo" aria-label="Fechar menu" onClick={() => setAberto(false)} />
            <nav id="menu-mobile" className="mobile-menu" aria-label="Menu principal">
              {itens.map((item) => {
                const ativo = estaAtivo(item.href, caminho);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={ativo ? "nav on" : "nav"}
                    aria-current={ativo ? "page" : undefined}
                  >
                    <i />
                    {item.rotulo}
                  </Link>
                );
              })}
              <div className="grupo-box" style={{ marginTop: 8 }}>
                <div className="lbl">Grupo</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{grupoNome ?? "Sem grupo ainda"}</div>
                {grupoReferencia && (
                  <div className="sub" style={{ marginTop: 2 }}>
                    {grupoReferencia}
                  </div>
                )}
              </div>
              <form action={sair}>
                {email && (
                  <div className="sub" style={{ marginTop: 10, wordBreak: "break-all" }}>
                    {email}
                  </div>
                )}
                <button className="sair" type="submit">
                  Sair
                </button>
              </form>
            </nav>
          </>
        )}
      </header>
    </>
  );
}
