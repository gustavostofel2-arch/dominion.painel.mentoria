import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataPorExtenso, obterGrupo, rotuloTipo, type Insight } from "@/lib/dados";
import { obterDia } from "@/lib/consultas";
import { milhar, numero } from "@/lib/util";

export const dynamic = "force-dynamic";

async function alternarAcao(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const feita = String(formData.get("feita")) === "true";
  const data = String(formData.get("data") ?? "");
  if (!id) return;

  const supabase = await criarClienteServidor();
  await supabase
    .from("acoes")
    .update({ feita, feita_em: feita ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath(`/dia/${data}`);
}

function Item({ insight }: { insight: Insight }) {
  return (
    <div className="topico">
      <div className="meta">
        <span className={`tag t-${insight.tipo}`}>{rotuloTipo(insight.tipo)}</span>
        {insight.qtd_alunos > 0 && (
          <span className="tag t-neu">
            {insight.qtd_alunos} {insight.qtd_alunos === 1 ? "aluno" : "alunos"}
          </span>
        )}
      </div>
      <h3>{insight.titulo}</h3>
      {insight.descricao && <p className="txt">{insight.descricao}</p>}
      {insight.por_que && (
        <div className="porque">
          <b>Por quê:</b> {insight.por_que}
        </div>
      )}
    </div>
  );
}

export default async function ResumoDoDia({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) notFound();

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  if (!grupo) notFound();

  const completo = await obterDia(supabase, grupo.id, data);
  if (!completo) {
    return (
      <section className="card vazio">
        <h2>Não há resumo para esse dia</h2>
        <p>
          <Link href="/historico" className="link">
            Voltar ao histórico
          </Link>
        </p>
      </section>
    );
  }

  const { dia, anterior, proximo, insights, qualidade, acoes } = completo;
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  const assuntos = insights.slice(0, 3);
  const duvidas = insights.filter((i) => i.tipo === "duvida");
  const resolvidas = duvidas.filter((i) => i.status === "resolvida").length;
  const desejos = insights.filter((i) => i.tipo === "desejo");
  const criticas = insights.filter((i) => i.tipo === "critica");
  const dicas = insights.filter((i) => i.tipo === "dica");

  return (
    <>
      <div className="top">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {anterior ? (
            <Link className="seta" href={`/dia/${anterior}`} aria-label="Dia anterior">
              ‹
            </Link>
          ) : (
            <span className="seta off">‹</span>
          )}
          <div>
            <h1 className="titulo">{dataPorExtenso(dia.data)}</h1>
            <p className="sub" style={{ marginTop: 2 }}>
              {milhar(dia.n_mensagens)} mensagens · {dia.n_participantes} alunos ativos
              {dia.nivel ? ` · nível ${dia.nivel}` : ""}
            </p>
          </div>
          {proximo ? (
            <Link className="seta" href={`/dia/${proximo}`} aria-label="Próximo dia">
              ›
            </Link>
          ) : (
            <span className="seta off">›</span>
          )}
        </div>
        {exemplo && <span className="demo">Dados de exemplo</span>}
      </div>

      {dia.frase && (
        <section className="card destaque">
          <div className="lbl">
            O dia em uma frase
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.4, marginTop: 8, maxWidth: 900 }}>{dia.frase}</p>
        </section>
      )}

      {dia.visao_geral && (
        <section className="card">
          <h2 className="h2">Visão geral</h2>
          <p className="txt" style={{ marginTop: 8 }}>
            {dia.visao_geral}
          </p>
        </section>
      )}

      {assuntos.length > 0 && (
        <section className="card">
          <h2 className="h2">Assuntos do dia</h2>
          <div style={{ marginTop: 6 }}>
            {assuntos.map((i) => (
              <Item key={i.id} insight={i} />
            ))}
          </div>
        </section>
      )}

      <section className="row dois-um" style={{ alignItems: "stretch" }}>
        <div className="card" style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h2 className="h2">Dúvidas e respostas</h2>
            {duvidas.length > 0 && (
              <span className="tag t-duvida">
                {resolvidas} de {duvidas.length} resolvidas
              </span>
            )}
          </div>
          {duvidas.length === 0 && <p className="sub" style={{ marginTop: 10 }}>Nenhuma dúvida neste dia.</p>}
          {duvidas.map((d) => (
            <div className="chk" key={d.id}>
              <span
                className={`tag ${d.status === "resolvida" ? "t-elogio" : "t-critica"}`}
                style={{ alignSelf: "flex-start" }}
              >
                {d.status === "resolvida" ? "Resolvida" : d.status === "divergente" ? "Divergente" : "Em aberto"}
              </span>
              <span>
                <b>{d.titulo}</b>
                {d.resposta_resumo && (
                  <>
                    <br />
                    {d.resposta_resumo}
                    {d.respondida_por ? ` (${d.respondida_por === "equipe" ? "equipe" : "colegas"})` : ""}
                  </>
                )}
                {d.status !== "resolvida" && d.sugestao && (
                  <>
                    <br />
                    <span style={{ color: "#ffcf7a" }}>Sugestão: {d.sugestao}</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <h2 className="h2">Desejos e pedidos</h2>
          {desejos.length === 0 && <p className="sub" style={{ marginTop: 10 }}>Nenhum pedido neste dia.</p>}
          {desejos.map((d) => (
            <div className="chk" key={d.id}>
              <span className="tag t-desejo">Pedido</span>
              <span>
                {d.titulo} ({d.qtd_alunos} {d.qtd_alunos === 1 ? "aluno" : "alunos"})
              </span>
            </div>
          ))}
          {criticas.length > 0 && <h2 className="h2" style={{ marginTop: 20 }}>Críticas</h2>}
          {criticas.map((d) => (
            <div className="chk" key={d.id}>
              <span className="tag t-critica">Crítica</span>
              <span>
                {d.titulo} ({d.qtd_alunos} {d.qtd_alunos === 1 ? "aluno" : "alunos"})
              </span>
            </div>
          ))}
          {dicas.length > 0 && <h2 className="h2" style={{ marginTop: 20 }}>Dicas compartilhadas</h2>}
          {dicas.map((d) => (
            <div className="chk" key={d.id}>
              <span className="tag t-dica">Dica</span>
              <span>{d.titulo}</span>
            </div>
          ))}
        </div>
      </section>

      {qualidade.length > 0 && (
        <section className="card">
          <h2 className="h2">Qualidade da mentoria neste dia</h2>
          <div className="row compacta" style={{ marginTop: 14 }}>
            {qualidade.map((q) => (
              <div key={q.dimensao} style={{ flex: "1 1 200px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>{q.dimensao}</span>
                  <span>{q.nota === null ? "–" : numero(Number(q.nota))}</span>
                </div>
                <div className="medidor">
                  <i
                    style={{
                      width: `${(Number(q.nota ?? 0) / 10) * 100}%`,
                      background: Number(q.nota ?? 0) < 6 ? "#ff6b6b" : "var(--marca)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="sub" style={{ marginTop: 14 }}>
            Notas de 0 a 10, calculadas pela proporção de elogios e críticas ditas pelos alunos.
          </p>
        </section>
      )}

      {acoes.length > 0 && (
        <section className="card">
          <h2 className="h2">Ações sugeridas para a equipe</h2>
          {acoes.map((a) => (
            <form className="chk" action={alternarAcao} key={a.id}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="data" value={dia.data} />
              <input type="hidden" name="feita" value={String(!a.feita)} />
              <button
                type="submit"
                className={a.feita ? "caixa feita" : "caixa"}
                aria-label={a.feita ? "Marcar como não feita" : "Marcar como feita"}
              >
                {a.feita ? "✓" : ""}
              </button>
              <span style={{ textDecoration: a.feita ? "line-through" : "none", color: a.feita ? "var(--suave)" : "inherit" }}>
                {a.texto}
              </span>
            </form>
          ))}
        </section>
      )}
    </>
  );
}
