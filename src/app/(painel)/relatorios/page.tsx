import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterGrupo } from "@/lib/dados";
import {
  listarRelatorios,
  obterDiasPeriodo,
  obterQualidadePeriodo,
  ultimoDia,
} from "@/lib/consultas";
import { Barras } from "@/components/graficos";
import {
  agrupar,
  diaDaSemana,
  diaMesCurto,
  media,
  milhar,
  numero,
  periodoPorExtenso,
  soma,
  somarDias,
} from "@/lib/util";

export const dynamic = "force-dynamic";

const COR_TIPO: Record<string, string> = {
  dor: "#E5484D",
  elogio: "#2F9E6E",
  duvida: "#3B82F6",
  desejo: "#8B5CF6",
  dica: "#F59E0B",
  critica: "#F59E0B",
};

function lista<T>(conteudo: Record<string, unknown>, chave: string): T[] {
  const valor = conteudo?.[chave];
  return Array.isArray(valor) ? (valor as T[]) : [];
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; inicio?: string }>;
}) {
  const { tipo: tipoParam, inicio: inicioParam } = await searchParams;
  const tipo = tipoParam === "mensal" ? "mensal" : "semanal";

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  const ultima = grupo ? await ultimoDia(supabase, grupo.id) : null;
  if (!grupo || !ultima) {
    return (
      <section className="card vazio">
        <h2>Ainda não há dados</h2>
        <p>Os relatórios aparecem depois que o sistema tiver alguns dias gravados.</p>
      </section>
    );
  }

  const relatorios = await listarRelatorios(supabase, grupo.id, tipo);
  const exemplo = grupo.nome.includes("(EXEMPLO)");
  const selecionado = relatorios.find((r) => r.inicio === inicioParam) ?? relatorios[0] ?? null;

  const cabecalho = (
    <div className="top">
      <div>
        <h1 className="titulo">Relatório {tipo}</h1>
        <p className="sub">
          Escrito pela IA a partir dos resumos diários. Períodos incompletos são marcados como parciais.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {exemplo && <span className="demo">Dados de exemplo</span>}
        <div className="pills">
          <Link className={tipo === "semanal" ? "pill on" : "pill"} href="/relatorios?tipo=semanal">
            Semana
          </Link>
          <Link className={tipo === "mensal" ? "pill on" : "pill"} href="/relatorios?tipo=mensal">
            Mês
          </Link>
        </div>
      </div>
    </div>
  );

  if (!selecionado) {
    return (
      <>
        {cabecalho}
        <section className="card vazio">
          <h2>Nenhum relatório {tipo} gerado ainda</h2>
          <p>
            O relatório {tipo === "semanal" ? "semanal sai todo domingo" : "mensal sai no fim de cada mês"}, e
            também pode ser gerado com poucos dias de dados (aparece como parcial).
          </p>
        </section>
      </>
    );
  }

  const fimDados = selecionado.fim > ultima ? ultima : selecionado.fim;
  const [dias, qualidade] = await Promise.all([
    obterDiasPeriodo(supabase, grupo.id, selecionado.inicio, fimDados),
    obterQualidadePeriodo(supabase, grupo.id, selecionado.inicio, fimDados),
  ]);

  const mensagens = dias.map((d) => d.n_mensagens);
  const maisAtivo = [...dias].sort((a, b) => b.n_mensagens - a.n_mensagens)[0];
  const tamanhoPeriodo =
    Math.round(
      (new Date(`${selecionado.fim}T12:00:00Z`).getTime() - new Date(`${selecionado.inicio}T12:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;
  const parcial = selecionado.parcial || dias.length < tamanhoPeriodo;

  // Barras: um dia por barra (semana) ou uma semana por barra (mês)
  const barras =
    tipo === "semanal"
      ? dias.map((d) => ({ rotulo: d.data.slice(8, 10), valor: d.n_mensagens }))
      : [
          ...agrupar(dias, (d) => somarDias(d.data, -diaDaSemana(d.data))).entries(),
        ]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, grupoSemana]) => ({
            rotulo: `${Number(grupoSemana[0].data.slice(8, 10))}–${Number(grupoSemana[grupoSemana.length - 1].data.slice(8, 10))}`,
            valor: soma(grupoSemana.map((d) => d.n_mensagens)),
            parcial: grupoSemana.length < 7,
          }));

  const notas = [...agrupar(qualidade.filter((q) => q.nota !== null), (q) => q.dimensao).entries()].map(
    ([nome, v]) => ({ nome, nota: media(v.map((q) => Number(q.nota))) ?? 0 }),
  );

  const c = selecionado.conteudo ?? {};
  const assuntos = lista<{ titulo: string; pct: number; tipo: string }>(c, "assuntos");
  const mudancas = lista<{ tipo: string; texto: string }>(c, "mudancas");
  const marcos = lista<{ data: string; texto: string }>(c, "marcos");
  const perguntas = lista<{ texto: string; vezes: number }>(c, "perguntas");
  const desejos = lista<{ texto: string; alunos: number }>(c, "desejos");
  const recomendacoes = lista<{ titulo: string; texto: string }>(c, "recomendacoes");

  return (
    <>
      {cabecalho}

      <div className="chips">
        {relatorios.map((r) => (
          <Link
            key={r.id}
            href={`/relatorios?tipo=${tipo}&inicio=${r.inicio}`}
            className={r.id === selecionado.id ? "chip on" : "chip"}
          >
            {periodoPorExtenso(r.inicio, r.fim)}
            {r.parcial ? " · parcial" : ""}
          </Link>
        ))}
      </div>

      {parcial && (
        <div className="aviso">
          <b>{tipo === "mensal" ? "Mês em andamento" : "Semana incompleta"}.</b> Este relatório usa os{" "}
          {dias.length} {dias.length === 1 ? "dia" : "dias"} com dados (de {tamanhoPeriodo} do período). Médias são
          calculadas sobre os dias que existem, e a comparação com o período anterior só vale quando os dois têm
          tamanho parecido.
        </div>
      )}

      {selecionado.frase && (
        <section className="card escuro">
          <div className="lbl" style={{ color: "#9fb3ae" }}>
            {tipo === "mensal" ? "O mês em poucas linhas" : "A semana em poucas linhas"}
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.55, marginTop: 8, maxWidth: 960 }}>
            {selecionado.frase}
          </p>
        </section>
      )}

      <section className="grid4">
        <div className="card">
          <div className="lbl">Mensagens no período</div>
          <div className="big">{milhar(soma(mensagens))}</div>
          <div className="sub">{dias.length} dias com dados</div>
        </div>
        <div className="card">
          <div className="lbl">Média por dia</div>
          <div className="big">{milhar(Math.round(media(mensagens) ?? 0))}</div>
          <div className="sub">calculada sobre os dias existentes</div>
        </div>
        <div className="card">
          <div className="lbl">Dia mais ativo</div>
          <div className="big">{maisAtivo ? diaMesCurto(maisAtivo.data) : "–"}</div>
          <div className="sub">{maisAtivo ? `${milhar(maisAtivo.n_mensagens)} mensagens` : ""}</div>
        </div>
        <div className="card">
          <div className="lbl">Gerado por</div>
          <div className="big" style={{ fontSize: 20 }}>
            {selecionado.modelo_ia ?? "IA"}
          </div>
          <div className="sub">atualizar gera um novo relatório</div>
        </div>
      </section>

      <section className="row" style={{ alignItems: "flex-start" }}>
        <div className="card" style={{ flex: "1.2 1 460px", minWidth: 0 }}>
          <h2 className="h2">{tipo === "semanal" ? "Mensagens por dia" : "Mensagens por semana"}</h2>
          <div style={{ marginTop: 14 }}>
            {barras.length > 0 ? (
              <Barras itens={barras} rotulo={`Mensagens por ${tipo === "semanal" ? "dia" : "semana"} no período`} />
            ) : (
              <p className="sub">Sem dados no período.</p>
            )}
          </div>
          {tipo === "mensal" && <p className="sub">Semanas das pontas podem ser parciais.</p>}
        </div>

        {assuntos.length > 0 && (
          <div className="card" style={{ flex: "1 1 380px", minWidth: 0 }}>
            <h2 className="h2">Assuntos mais falados</h2>
            {assuntos.map((a, i) => (
              <div className="kp" key={a.titulo}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, fontWeight: 700 }}>
                  <span>
                    {i + 1}. {a.titulo}
                  </span>
                  <span>{a.pct}%</span>
                </div>
                <div className="medidor">
                  <i style={{ width: `${Math.min(100, (a.pct / (assuntos[0].pct || 1)) * 100)}%`, background: COR_TIPO[a.tipo] ?? "var(--marca)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="row" style={{ alignItems: "flex-start" }}>
        {mudancas.length > 0 && (
          <div className="card" style={{ flex: "1 1 360px", minWidth: 0 }}>
            <h2 className="h2">O que mudou desde o período anterior</h2>
            {mudancas.map((m, i) => (
              <div className="chk" key={i}>
                <span
                  className={`tag ${m.tipo === "subiu" ? "t-dor" : m.tipo === "novo" ? "t-critica" : "t-neu"}`}
                  style={{ alignSelf: "flex-start" }}
                >
                  {m.tipo === "subiu" ? "Subiu" : m.tipo === "novo" ? "Novo" : "Caiu"}
                </span>
                <span>{m.texto}</span>
              </div>
            ))}
          </div>
        )}
        {marcos.length > 0 && (
          <div className="card" style={{ flex: "1 1 360px", minWidth: 0 }}>
            <h2 className="h2">Marcos do período</h2>
            {marcos.map((m, i) => (
              <div className="ocorr" key={i}>
                <span className="dt" style={{ minWidth: 56 }}>
                  {m.data}
                </span>
                <span style={{ flex: 1 }}>{m.texto}</span>
              </div>
            ))}
          </div>
        )}
        {notas.length > 0 && (
          <div className="card" style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h2 className="h2">Qualidade no período</h2>
            {notas.map((n) => (
              <div className="kp" key={n.nome}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>{n.nome}</span>
                  <span>{numero(n.nota)}</span>
                </div>
                <div className="medidor">
                  <i style={{ width: `${(n.nota / 10) * 100}%`, background: n.nota < 6 ? "#E5484D" : "var(--marca)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="row" style={{ alignItems: "flex-start" }}>
        {perguntas.length > 0 && (
          <div className="card" style={{ flex: "1 1 340px", minWidth: 0 }}>
            <h2 className="h2">Perguntas mais repetidas</h2>
            {perguntas.map((p, i) => (
              <div className="chk" key={i}>
                <span className="numero">{i + 1}</span>
                <span>
                  {p.texto} <b>({p.vezes} vezes)</b>
                </span>
              </div>
            ))}
          </div>
        )}
        {desejos.length > 0 && (
          <div className="card" style={{ flex: "1 1 340px", minWidth: 0 }}>
            <h2 className="h2">Desejos mais pedidos</h2>
            {desejos.map((d, i) => (
              <div className="chk" key={i}>
                <span className="tag t-desejo">
                  {d.alunos} {d.alunos === 1 ? "aluno" : "alunos"}
                </span>
                <span>{d.texto}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {recomendacoes.length > 0 && (
        <section className="card">
          <h2 className="h2">Recomendações para o próximo período</h2>
          {recomendacoes.map((r, i) => (
            <div className="chk" key={i}>
              <span className="numero">{i + 1}</span>
              <span>
                <b>{r.titulo}</b> {r.texto}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
