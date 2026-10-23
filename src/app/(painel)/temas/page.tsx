import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterGrupo, rotuloTipo, type Insight } from "@/lib/dados";
import { obterInsightsPeriodo, ultimoDia } from "@/lib/consultas";
import { Linha, Spark } from "@/components/graficos";
import { agrupar, diaMesCurto, soma, somarDias, variacaoPct } from "@/lib/util";

export const dynamic = "force-dynamic";

type Tipo = Insight["tipo"];

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "dor", rotulo: "Dores" },
  { valor: "duvida", rotulo: "Dúvidas" },
  { valor: "desejo", rotulo: "Desejos" },
  { valor: "elogio", rotulo: "Elogios" },
  { valor: "critica", rotulo: "Críticas" },
  { valor: "dica", rotulo: "Dicas" },
];

/** Para dores e críticas, subir é ruim; para elogios, pedidos e dicas, subir é bom. */
function corTendencia(tipo: Tipo, subiu: boolean): string {
  if (tipo === "dor" || tipo === "critica") return subiu ? "#ff6b6b" : "#7fd99a";
  if (tipo === "duvida") return "#9d9ca6";
  return subiu ? "#7fd99a" : "#9d9ca6";
}

export default async function TemasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; tema?: string }>;
}) {
  const { tipo: tipoParam, tema: temaParam } = await searchParams;
  const filtro = FILTROS.some((f) => f.valor === tipoParam) ? (tipoParam as string) : "todos";

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  const ultima = grupo ? await ultimoDia(supabase, grupo.id) : null;

  if (!grupo || !ultima) {
    return (
      <section className="card vazio">
        <h2>Ainda não há dados de temas</h2>
        <p>Os temas aparecem assim que os primeiros dias forem gravados.</p>
      </section>
    );
  }

  const desde = somarDias(ultima, -29);
  const insights = (await obterInsightsPeriodo(supabase, grupo.id, desde, ultima)).filter((i) => i.temas);
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  const dataDe = (k: number) => somarDias(ultima, -k);

  // Só dá para dizer "subiu" ou "novo" quando existem pelo menos 14 dias de histórico (7 atuais + 7 anteriores)
  const primeiraData = insights.reduce((menor, i) => (i.dias.data < menor ? i.dias.data : menor), ultima);
  const diasDeHistorico =
    Math.round((new Date(`${ultima}T12:00:00Z`).getTime() - new Date(`${primeiraData}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  const temComparacao = diasDeHistorico >= 14;
  const grupos = agrupar(insights, (i) => i.temas!.id);

  const linhas = [...grupos.entries()].map(([id, lista]) => {
    const porTipo = agrupar(lista, (i) => i.tipo);
    const tipo = [...porTipo.entries()].sort((a, b) => b[1].length - a[1].length)[0][0] as Tipo;
    const mencoesEm = (inicio: string, fim: string) =>
      soma(lista.filter((i) => i.dias.data >= inicio && i.dias.data <= fim).map((i) => i.qtd_mencoes));
    const serie = (n: number) =>
      Array.from({ length: n }, (_, idx) => {
        const d = dataDe(n - 1 - idx);
        return soma(lista.filter((i) => i.dias.data === d).map((i) => i.qtd_mencoes));
      });
    const sete = mencoesEm(dataDe(6), ultima);
    const anterior7 = mencoesEm(dataDe(13), dataDe(7));
    return {
      id,
      nome: lista[0].temas!.nome,
      tipo,
      hoje: mencoesEm(ultima, ultima),
      sete,
      anterior7,
      variacao: temComparacao ? variacaoPct(sete, anterior7) : null,
      novo: temComparacao && anterior7 === 0 && sete > 0,
      serie14: serie(14),
      serie30: serie(30),
      dias: new Set(lista.map((i) => i.dias.data)).size,
      ocorrencias: [...lista].sort((a, b) => b.dias.data.localeCompare(a.dias.data)),
    };
  });

  const visiveis = linhas
    .filter((l) => filtro === "todos" || l.tipo === filtro)
    .sort((a, b) => b.sete - a.sete);
  const selecionado = visiveis.find((l) => l.id === temaParam) ?? visiveis[0] ?? null;
  const contexto = selecionado?.ocorrencias.find((o) => o.descricao || o.por_que) ?? null;

  return (
    <>
      <div className="top">
        <div>
          <h1 className="titulo">Temas e dores</h1>
          <p className="sub">Tudo o que os alunos falam, agrupado por assunto e contado ao longo do tempo.</p>
        </div>
        {exemplo && <span className="demo">Dados de exemplo</span>}
      </div>

      <div className="chips">
        {FILTROS.map((f) => (
          <Link key={f.valor} href={`/temas?tipo=${f.valor}`} className={f.valor === filtro ? "chip on" : "chip"}>
            {f.rotulo}
          </Link>
        ))}
        <span className="chip" style={{ marginLeft: "auto" }}>
          Últimos 7 dias · até {diaMesCurto(ultima)}
        </span>
      </div>

      <section className="row um" style={{ alignItems: "flex-start" }}>
        <div className="card" style={{ flex: "1 1 100%", minWidth: 0 }}>
          <div className="rolagem">
            <div className="tabela">
              <div className="tr cab">
                <span>Tema</span>
                <span>Tipo</span>
                <span style={{ textAlign: "right" }}>Hoje</span>
                <span style={{ textAlign: "right" }}>7 dias</span>
                <span>Tendência</span>
              </div>
              {visiveis.length === 0 && <p className="sub" style={{ padding: 12 }}>Nenhum tema desse tipo no período.</p>}
              {visiveis.map((l) => {
                const subiu = (l.variacao ?? 0) >= 0;
                const cor = corTendencia(l.tipo, subiu);
                return (
                  <Link
                    key={l.id}
                    href={`/temas?tipo=${filtro}&tema=${l.id}`}
                    className={selecionado?.id === l.id ? "tr ativa" : "tr"}
                  >
                    <span style={{ fontWeight: 700 }}>{l.nome}</span>
                    <span>
                      <span className={`tag t-${l.tipo}`}>{rotuloTipo(l.tipo)}</span>
                    </span>
                    <span className="num" data-l="Hoje">
                      {l.hoje}
                    </span>
                    <span className="num" data-l="7 dias">
                      {l.sete}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Spark valores={l.serie14} cor={cor} rotulo={`Evolução de ${l.nome}`} />
                      {l.novo ? (
                        <span className="tag t-critica">novo</span>
                      ) : l.variacao === null ? (
                        <span className="lbl" style={{ textTransform: "none" }}>–</span>
                      ) : (
                        <span style={{ color: cor, fontWeight: 700, fontSize: 12 }}>
                          {l.variacao >= 0 ? "+" : ""}
                          {l.variacao}%
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {selecionado && (
          <div className="card" style={{ flex: "1 1 100%", minWidth: 0 }}>
            <span className={`tag t-${selecionado.tipo}`}>{rotuloTipo(selecionado.tipo)}</span>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 10 }}>{selecionado.nome}</h2>
            <p className="sub" style={{ marginTop: 2 }}>
              Aparece em {selecionado.dias} dos últimos 30 dias
            </p>
            <div style={{ marginTop: 14 }}>
              <Linha
                valores={selecionado.serie30}
                cor={corTendencia(selecionado.tipo, true)}
                area
                altura={110}
                rotulo={`Evolução de ${selecionado.nome} nos últimos 30 dias`}
              />
            </div>

            {contexto && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 800, marginTop: 18 }}>Contexto</h3>
                {contexto.descricao && <p className="txt" style={{ fontSize: 14, marginTop: 6 }}>{contexto.descricao}</p>}
                {contexto.por_que && (
                  <p className="txt" style={{ fontSize: 14, marginTop: 8 }}>
                    <b>Por quê:</b> {contexto.por_que}
                  </p>
                )}
              </>
            )}

            <h3 style={{ fontSize: 14, fontWeight: 800, marginTop: 18 }}>Últimas ocorrências</h3>
            <div style={{ marginTop: 4 }}>
              {selecionado.ocorrencias.slice(0, 5).map((o, i) => (
                <div className="ocorr" key={i}>
                  <span className="dt">{diaMesCurto(o.dias.data)}</span>
                  <span style={{ flex: 1 }}>{o.titulo}</span>
                  <b>{o.qtd_mencoes}</b>
                </div>
              ))}
            </div>
            <Link href={`/dia/${selecionado.ocorrencias[0].dias.data}`} className="botao" style={{ marginTop: 16 }}>
              Abrir o resumo mais recente
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
