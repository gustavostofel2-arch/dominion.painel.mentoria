import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterGrupo } from "@/lib/dados";
import {
  obterDiasPeriodo,
  obterInsightsPeriodo,
  obterQualidadePeriodo,
  ultimoDia,
} from "@/lib/consultas";
import { Linha } from "@/components/graficos";
import { agrupar, media, mediana, milhar, numero, somarDias, soma } from "@/lib/util";

export const dynamic = "force-dynamic";

function Delta({ valor, melhorSeSobe = true, sufixo = "" }: { valor: number | null; melhorSeSobe?: boolean; sufixo?: string }) {
  if (valor === null || valor === 0) return null;
  const bom = melhorSeSobe ? valor > 0 : valor < 0;
  return (
    <span className={bom ? "up" : "dn"}>
      {valor > 0 ? "+" : ""}
      {numero(valor, Math.abs(valor) < 10 && !Number.isInteger(valor) ? 1 : 0)}
      {sufixo}
    </span>
  );
}

export default async function DuvidasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; filtro?: string }>;
}) {
  const { dias: diasParam, filtro: filtroParam } = await searchParams;
  const janela = diasParam === "30" ? 30 : 7;
  const filtro = filtroParam === "abertas" || filtroParam === "resolvidas" ? filtroParam : "todas";

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  const ultima = grupo ? await ultimoDia(supabase, grupo.id) : null;
  if (!grupo || !ultima) {
    return (
      <section className="card vazio">
        <h2>Ainda não há dados</h2>
        <p>As dúvidas e a qualidade aparecem assim que os primeiros dias forem gravados.</p>
      </section>
    );
  }

  const desde = somarDias(ultima, -(janela - 1));
  const antesDesde = somarDias(desde, -janela);
  const antesAte = somarDias(desde, -1);

  const [duvidasTodas, diasTodos, qualidadeTodas] = await Promise.all([
    obterInsightsPeriodo(supabase, grupo.id, antesDesde, ultima, "duvida"),
    obterDiasPeriodo(supabase, grupo.id, antesDesde, ultima),
    obterQualidadePeriodo(supabase, grupo.id, antesDesde, ultima),
  ]);
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  const atuais = duvidasTodas.filter((d) => d.dias.data >= desde);
  const anteriores = duvidasTodas.filter((d) => d.dias.data <= antesAte);

  const taxa = (lista: typeof atuais) =>
    lista.length ? Math.round((lista.filter((d) => d.status === "resolvida").length / lista.length) * 100) : null;
  const taxaAtual = taxa(atuais);
  const taxaAnterior = taxa(anteriores);

  const tempoAtual = mediana(diasTodos.filter((d) => d.data >= desde).map((d) => d.tempo_resposta_min).filter((n): n is number => n !== null));
  const tempoAnterior = mediana(diasTodos.filter((d) => d.data <= antesAte).map((d) => d.tempo_resposta_min).filter((n): n is number => n !== null));

  // Perguntas agrupadas por tema (ou título, se não houver tema)
  const grupos = [...agrupar(atuais, (d) => d.temas?.id ?? d.titulo).values()].map((lista) => {
    const ordem = [...lista].sort((a, b) => b.dias.data.localeCompare(a.dias.data));
    const ultimo = ordem[0];
    const comResposta = ordem.find((o) => o.resposta_resumo);
    const abertas = ordem.filter((o) => o.status !== "resolvida");
    return {
      titulo: ultimo.titulo,
      vezes: soma(lista.map((l) => l.qtd_alunos)),
      dias: new Set(lista.map((l) => l.dias.data)).size,
      status: ultimo.status,
      resposta: comResposta?.resposta_resumo ?? null,
      respondidaPor: comResposta?.respondida_por ?? null,
      sugestao: ordem.find((o) => o.sugestao)?.sugestao ?? null,
      diasAberta: new Set(abertas.map((o) => o.dias.data)).size,
    };
  });

  // Contagem exata feita em código: mensagens de alunos com "?" e quantas ficaram sem resposta direta
  const diasAtuais = diasTodos.filter((d) => d.data >= desde);
  const perguntasTotal = soma(diasAtuais.map((d) => d.conteudo?.perguntas_total ?? 0));
  const perguntasSemResposta = soma(diasAtuais.map((d) => d.conteudo?.perguntas_sem_resposta ?? 0));
  const temContagem = diasAtuais.some((d) => d.conteudo?.perguntas_total !== undefined);

  const emAberto = grupos.filter((g) => g.status !== "resolvida");
  const repetidas = grupos.filter((g) => g.dias >= 3);
  const lista = grupos
    .filter((g) => filtro === "todas" || (filtro === "abertas" ? g.status !== "resolvida" : g.status === "resolvida"))
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, 10);

  // Qualidade: média por dimensão (janela atual x anterior) e experiência por dia
  const dimensoes = [...new Set(qualidadeTodas.map((q) => q.dimensao))];
  const porDimensao = dimensoes.map((nome) => {
    const doNome = qualidadeTodas.filter((q) => q.dimensao === nome && q.nota !== null);
    const a = media(doNome.filter((q) => q.dias.data >= desde).map((q) => Number(q.nota)));
    const b = media(doNome.filter((q) => q.dias.data <= antesAte).map((q) => Number(q.nota)));
    return { nome, atual: a, delta: a !== null && b !== null ? Math.round((a - b) * 10) / 10 : null };
  });
  const porData = agrupar(
    qualidadeTodas.filter((q) => q.nota !== null && q.dias.data >= desde),
    (q) => q.dias.data,
  );
  const experienciaPorDia = [...porData.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => media(v.map((q) => Number(q.nota))) ?? 0);

  return (
    <>
      <div className="top">
        <div>
          <h1 className="titulo">Dúvidas e qualidade</h1>
          <p className="sub">As dúvidas estão sendo resolvidas? Como está a experiência dos alunos?</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {exemplo && <span className="demo">Dados de exemplo</span>}
          <div className="pills">
            <Link className={janela === 7 ? "pill on" : "pill"} href="/duvidas?dias=7">
              7 dias
            </Link>
            <Link className={janela === 30 ? "pill on" : "pill"} href="/duvidas?dias=30">
              30 dias
            </Link>
          </div>
        </div>
      </div>

      <section className="grid3">
        <div className="card">
          <div className="lbl">Taxa de resolução</div>
          <div className="big">{taxaAtual === null ? "–" : `${taxaAtual}%`}</div>
          <div className="sub">
            {atuais.length} dúvidas no período{" "}
            {taxaAtual !== null && taxaAnterior !== null && <Delta valor={taxaAtual - taxaAnterior} sufixo=" pts" />}
          </div>
        </div>
        <div className="card">
          <div className="lbl">Tempo até a 1ª resposta</div>
          <div className="big">{tempoAtual === null ? "–" : `${Math.round(tempoAtual)} min`}</div>
          <div className="sub">
            mediana do período{" "}
            {tempoAtual !== null && tempoAnterior !== null && (
              <Delta valor={Math.round(tempoAtual - tempoAnterior)} melhorSeSobe={false} sufixo=" min" />
            )}
          </div>
        </div>
        <div className="card">
          <div className="lbl">Dúvidas em aberto</div>
          <div className="big">{emAberto.length}</div>
          <div className="sub">{emAberto.filter((g) => g.diasAberta >= 2).length} há 2 dias ou mais</div>
        </div>
        <div className="card">
          <div className="lbl">Perguntas dos alunos</div>
          <div className="big">{temContagem ? milhar(perguntasTotal) : "–"}</div>
          <div className="sub">mensagens com “?” (contagem exata)</div>
        </div>
        <div className="card">
          <div className="lbl">Sem resposta direta</div>
          <div className="big">{temContagem ? milhar(perguntasSemResposta) : "–"}</div>
          <div className="sub">
            {temContagem && perguntasTotal > 0
              ? `${Math.round((perguntasSemResposta / perguntasTotal) * 100)}% das perguntas, sem usar “responder” do Telegram`
              : "ninguém respondeu pelo recurso de resposta"}
          </div>
        </div>
        <div className="card">
          <div className="lbl">Perguntas que se repetem</div>
          <div className="big">{repetidas.length}</div>
          <div className="sub">sinal de que falta uma aula ou aviso</div>
        </div>
      </section>

      <section className="row dois-um" style={{ alignItems: "flex-start" }}>
        <div className="card" style={{ flex: "2 1 560px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 className="h2">Perguntas frequentes</h2>
            <div className="meta">
              {(["todas", "abertas", "resolvidas"] as const).map((f) => (
                <Link
                  key={f}
                  href={`/duvidas?dias=${janela}&filtro=${f}`}
                  className={f === filtro ? "chip on" : "chip"}
                  style={{ padding: "5px 12px" }}
                >
                  {f === "todas" ? "Todas" : f === "abertas" ? "Em aberto" : "Resolvidas"}
                </Link>
              ))}
            </div>
          </div>
          {lista.length === 0 && <p className="sub" style={{ marginTop: 12 }}>Nenhuma pergunta nesse filtro.</p>}
          {lista.map((g) => (
            <div className="topico" key={g.titulo}>
              <div className="meta">
                <span className={`tag ${g.status === "resolvida" ? "t-elogio" : "t-critica"}`}>
                  {g.status === "resolvida"
                    ? "Resolvida"
                    : g.status === "divergente"
                      ? "Respostas divergentes"
                      : g.diasAberta >= 2
                        ? `Em aberto há ${g.diasAberta} dias`
                        : "Em aberto"}
                </span>
                <span className="tag t-neu">
                  {g.vezes} {g.vezes === 1 ? "aluno perguntou" : "alunos perguntaram"}
                </span>
                {g.dias >= 3 && <span className="tag t-duvida">em {g.dias} dias diferentes</span>}
              </div>
              <h3>{g.titulo}</h3>
              {g.resposta && (
                <div className="porque">
                  <b>Resposta{g.respondidaPor ? ` (${g.respondidaPor === "equipe" ? "equipe" : "colegas"})` : ""}:</b>{" "}
                  {g.resposta}
                </div>
              )}
              {g.status !== "resolvida" && g.sugestao && (
                <div className="sugestao">
                  <b>Sugestão para a equipe:</b> {g.sugestao}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h2 className="h2">Qualidade da mentoria</h2>
            <p className="sub">
              Notas de 0 a 10, calculadas pela proporção de elogios e críticas ditas pelos alunos. Servem para ver a
              direção, não são uma pesquisa.
            </p>
            {porDimensao.length === 0 && <p className="sub" style={{ marginTop: 12 }}>Sem notas no período.</p>}
            {porDimensao.map((d) => (
              <div className="kp" key={d.nome}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>{d.nome}</span>
                  <span>
                    {d.atual === null ? "–" : numero(d.atual)} <Delta valor={d.delta} />
                  </span>
                </div>
                <div className="medidor">
                  <i
                    style={{
                      width: `${((d.atual ?? 0) / 10) * 100}%`,
                      background: (d.atual ?? 0) < 6 ? "#ff6b6b" : "var(--marca)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {experienciaPorDia.length > 1 && (
            <div className="card">
              <h2 className="h2">Experiência no período</h2>
              <div style={{ marginTop: 12 }}>
                <Linha valores={experienciaPorDia} altura={100} rotulo="Nota média de experiência por dia" />
              </div>
              <p className="sub" style={{ marginTop: 8 }}>
                Média das notas de cada dia. Olhe a direção da linha, não o valor isolado.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
