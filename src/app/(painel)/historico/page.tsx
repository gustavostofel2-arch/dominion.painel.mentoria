import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataPorExtenso, obterGrupo, rotuloTipo } from "@/lib/dados";
import { obterInsightsDoDia, obterMes, ultimoDia } from "@/lib/consultas";
import { Linha } from "@/components/graficos";
import {
  agrupar,
  diaDaSemana,
  diasNoMes,
  diaMesCurto,
  media,
  milhar,
  nomeDoMes,
  soma,
} from "@/lib/util";

export const dynamic = "force-dynamic";

function nivelCalor(valor: number, max: number): string {
  if (max <= 0) return "h0";
  const r = valor / max;
  if (r <= 0.2) return "h0";
  if (r <= 0.4) return "h1";
  if (r <= 0.6) return "h2c";
  if (r <= 0.8) return "h3";
  return "h4";
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string }>;
}) {
  const { mes: mesParam, dia: diaParam } = await searchParams;

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  if (!grupo) {
    return (
      <section className="card vazio">
        <h2>Ainda não há nenhum grupo cadastrado</h2>
      </section>
    );
  }

  const ultimo = await ultimoDia(supabase, grupo.id);
  if (!ultimo) {
    return (
      <section className="card vazio">
        <h2>Ainda não há dias gravados</h2>
        <p>O histórico aparece assim que o primeiro resumo diário for gravado.</p>
      </section>
    );
  }

  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : ultimo.slice(0, 7);
  const { dias, dores, mesAnterior, mesSeguinte } = await obterMes(supabase, grupo.id, mes);

  const porData = new Map(dias.map((d) => [d.data, d]));
  const maximo = Math.max(...dias.map((d) => d.n_mensagens), 0);
  const selecionado =
    (diaParam && porData.get(diaParam)) || dias[dias.length - 1] || null;
  const topInsights = selecionado ? await obterInsightsDoDia(supabase, selecionado.id) : [];

  const totalDiasMes = diasNoMes(mes);
  const parcial = dias.length < totalDiasMes && mes === ultimo.slice(0, 7);
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  // Dor mais recorrente: tema (ou título) com mais dias diferentes no mês
  const porTema = agrupar(dores, (d) => d.temas?.nome ?? d.titulo);
  const dorTop = [...porTema.entries()]
    .map(([nome, lista]) => ({ nome, dias: new Set(lista.map((l) => l.dias.data)).size }))
    .sort((a, b) => b.dias - a.dias)[0];

  const maisAtivo = [...dias].sort((a, b) => b.n_mensagens - a.n_mensagens)[0];
  const mensagens = dias.map((d) => d.n_mensagens);

  // Calendário: espaços vazios até o primeiro dia da semana
  const vazios = diaDaSemana(`${mes}-01`);
  const celulas = Array.from({ length: totalDiasMes }, (_, i) => {
    const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
    return { numero: i + 1, iso: dia, dados: porData.get(dia) ?? null };
  });

  return (
    <>
      <div className="top">
        <div>
          <h1 className="titulo">Histórico</h1>
          <p className="sub">Cada dia guarda um resumo. Toque num dia para abrir.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {exemplo && <span className="demo">Dados de exemplo</span>}
          <div className="pills">
            <Link className="pill" href="/dia">
              Dia
            </Link>
            <Link className="pill" href="/relatorios?tipo=semanal">
              Semana
            </Link>
            <span className="pill on">Mês</span>
          </div>
        </div>
      </div>

      {parcial && (
        <div className="aviso">
          <b>Mês em andamento.</b> Este mês tem {dias.length} de {totalDiasMes} dias com dados; os números
          abaixo usam só os dias que existem.
        </div>
      )}

      <section className="row dois-um" style={{ alignItems: "flex-start" }}>
        <div className="card" style={{ flex: "2 1 560px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {mesAnterior ? (
                <Link className="seta" href={`/historico?mes=${mesAnterior}`} aria-label="Mês anterior">
                  ‹
                </Link>
              ) : (
                <span className="seta off">‹</span>
              )}
              <h2 className="h2">{nomeDoMes(mes)}</h2>
              {mesSeguinte ? (
                <Link className="seta" href={`/historico?mes=${mesSeguinte}`} aria-label="Próximo mês">
                  ›
                </Link>
              ) : (
                <span className="seta off">›</span>
              )}
            </div>
            <div className="legenda">
              menos
              <span className="d h1" />
              <span className="d h2c" />
              <span className="d h3" />
              <span className="d h4" />
              mais mensagens
            </div>
          </div>

          <div className="cal">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((n) => (
              <div className="wd" key={n}>
                {n}
              </div>
            ))}
            {Array.from({ length: vazios }, (_, i) => (
              <div key={`v${i}`} />
            ))}
            {celulas.map((c) =>
              c.dados ? (
                <Link
                  key={c.iso}
                  href={`/historico?mes=${mes}&dia=${c.iso}`}
                  className={`dia ${nivelCalor(c.dados.n_mensagens, maximo)}${selecionado?.data === c.iso ? " sel" : ""}`}
                >
                  {c.numero}
                  <small>{c.dados.n_mensagens}</small>
                </Link>
              ) : (
                <div key={c.iso} className="dia sem">
                  {c.numero}
                </div>
              ),
            )}
          </div>
        </div>

        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {selecionado && (
            <div className="card">
              <div className="lbl">Dia selecionado</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{dataPorExtenso(selecionado.data)}</h2>
              {selecionado.frase && (
                <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8, color: "#d8d6d0" }}>{selecionado.frase}</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {topInsights.slice(0, 3).map((i) => (
                  <span key={i.titulo} className={`tag t-${i.tipo}`}>
                    {rotuloTipo(i.tipo)}: {i.titulo.length > 34 ? `${i.titulo.slice(0, 34)}…` : i.titulo}
                  </span>
                ))}
              </div>
              <Link href={`/dia/${selecionado.data}`} className="botao" style={{ marginTop: 16 }}>
                Abrir resumo do dia
              </Link>
            </div>
          )}

          <div className="card">
            <h2 className="h2">Resumo do mês{parcial ? " até agora" : ""}</h2>
            <div className="kp">
              <div className="lbl">Mensagens no mês</div>
              <div className="kv">{milhar(soma(mensagens))}</div>
            </div>
            <div className="kp">
              <div className="lbl">Média por dia</div>
              <div className="kv">{milhar(Math.round(media(mensagens) ?? 0))}</div>
            </div>
            {maisAtivo && (
              <div className="kp">
                <div className="lbl">Dia mais ativo</div>
                <div className="kv">{diaMesCurto(maisAtivo.data)}</div>
                <div className="sub" style={{ marginTop: 2 }}>
                  {milhar(maisAtivo.n_mensagens)} mensagens
                </div>
              </div>
            )}
            {dorTop && (
              <div className="kp">
                <div className="lbl">Dor mais recorrente</div>
                <div className="kv" style={{ fontSize: 17 }}>
                  {dorTop.nome}
                </div>
                <div className="sub" style={{ marginTop: 2 }}>
                  presente em {dorTop.dias} {dorTop.dias === 1 ? "dia" : "dias"}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {mensagens.length > 1 && (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 className="h2">Mensagens por dia</h2>
            <span className="sub" style={{ margin: 0 }}>
              {diaMesCurto(dias[0].data)} a {diaMesCurto(dias[dias.length - 1].data)}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Linha valores={mensagens} altura={140} rotulo="Volume diário de mensagens no mês" />
          </div>
        </section>
      )}
    </>
  );
}
