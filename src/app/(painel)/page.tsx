import Link from "next/link";
import GraficoHorario from "@/components/GraficoHorario";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataPorExtenso, iniciais, obterGrupo, rotuloTipo } from "@/lib/dados";
import {
  obterAcoesDoDia,
  obterAtividadePeriodo,
  obterDiasCompletos,
  obterInsightsPeriodo,
  obterQualidadePeriodo,
  ultimoDia,
  type InsightComDia,
} from "@/lib/consultas";
import { agrupar, media, milhar, numero, periodoPorExtenso, soma, somarDias, variacaoPct } from "@/lib/util";

export const dynamic = "force-dynamic";

const OPCOES = [
  { dias: 1, rotulo: "Último dia" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
];

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias: diasParam } = await searchParams;
  const janela = diasParam === "30" ? 30 : diasParam === "7" ? 7 : 1;

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);

  if (!grupo) {
    return (
      <section className="card vazio">
        <h2>Ainda não há nenhum grupo cadastrado</h2>
        <p>
          Rode o arquivo <code>supabase/seed.sql</code> no Supabase para ver dados de exemplo, ou ligue o programa do
          GitHub para começar a gravar o grupo real.
        </p>
      </section>
    );
  }

  const ultima = await ultimoDia(supabase, grupo.id);
  if (!ultima) {
    return (
      <section className="card vazio">
        <h2>O grupo ainda não tem nenhum dia gravado</h2>
        <p>Assim que o primeiro resumo diário for gravado, ele aparece aqui.</p>
      </section>
    );
  }

  const desde = somarDias(ultima, -(janela - 1));
  const antesDesde = somarDias(desde, -janela);

  const [diasTodos, insights, qualidade, atividade] = await Promise.all([
    obterDiasCompletos(supabase, grupo.id, antesDesde, ultima),
    obterInsightsPeriodo(supabase, grupo.id, desde, ultima),
    obterQualidadePeriodo(supabase, grupo.id, desde, ultima),
    obterAtividadePeriodo(supabase, grupo.id, desde, ultima),
  ]);

  const dias = diasTodos.filter((d) => d.data >= desde);
  const anteriores = diasTodos.filter((d) => d.data < desde);
  const ultimoDiaDados = dias[dias.length - 1];
  const acoes = ultimoDiaDados ? await obterAcoesDoDia(supabase, ultimoDiaDados.id) : [];
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  // ----- Números do período -----
  const mensagens = soma(dias.map((d) => d.n_mensagens));
  const mensagensAntes = soma(anteriores.map((d) => d.n_mensagens));
  const variacao = anteriores.length ? variacaoPct(mensagens, mensagensAntes) : null;

  const alunosUnicos = new Set(
    atividade.filter((a) => a.participantes && !a.participantes.eh_equipe).map((a) => a.participantes!.id),
  ).size;
  const alunosAtivos = alunosUnicos || Math.max(0, ...dias.map((d) => d.n_participantes));

  const duvidas = insights.filter((i) => i.tipo === "duvida");
  const resolvidas = duvidas.filter((i) => i.status === "resolvida");
  const grupoDuvidas = [...agrupar(duvidas, (d) => d.temas?.id ?? d.titulo).values()];
  const abertas = grupoDuvidas
    .map((lista) => [...lista].sort((a, b) => b.dias.data.localeCompare(a.dias.data))[0])
    .filter((d) => d.status !== "resolvida");
  const taxa = duvidas.length ? Math.round((resolvidas.length / duvidas.length) * 100) : null;

  const notas = qualidade.map((q) => q.nota).filter((n): n is number => n !== null).map(Number);
  const experiencia = media(notas);

  // Assunto mais falado: o tema com mais menções somadas no período
  const temas = [...agrupar(insights, (i) => i.temas?.id ?? i.titulo).values()]
    .map((lista) => {
      const ordem = [...lista].sort((a, b) => b.dias.data.localeCompare(a.dias.data));
      const comTexto = ordem.find((o) => o.descricao || o.por_que) ?? ordem[0];
      const tipos = agrupar(lista, (i) => i.tipo);
      const tipo = [...tipos.entries()].sort((a, b) => b[1].length - a[1].length)[0][0] as InsightComDia["tipo"];
      return {
        id: ordem[0].temas?.id ?? null,
        nome: ordem[0].temas?.nome ?? ordem[0].titulo,
        titulo: comTexto.titulo,
        descricao: comTexto.descricao,
        por_que: comTexto.por_que,
        tipo,
        mencoes: soma(lista.map((l) => l.qtd_mencoes)),
        alunos: Math.max(...lista.map((l) => l.qtd_alunos)),
        dias: new Set(lista.map((l) => l.dias.data)).size,
        intensidade: Math.max(0, ...lista.map((l) => l.intensidade ?? 0)),
      };
    })
    .sort((a, b) => b.mencoes - a.mencoes);
  const principal = temas[0] ?? null;
  const pctPrincipal = principal && mensagens > 0 ? Math.round((principal.mencoes / mensagens) * 100) : null;

  // Clima e horário somados no período
  const clima = {
    pos: soma(dias.map((d) => d.clima_positivo)),
    neu: soma(dias.map((d) => d.clima_neutro)),
    neg: soma(dias.map((d) => d.clima_negativo)),
  };
  const totalClima = clima.pos + clima.neu + clima.neg;
  const pct = (v: number) => (totalClima ? Math.round((v / totalClima) * 100) : 0);
  const porHora = Array.from({ length: 24 }, (_, h) => soma(dias.map((d) => d.msgs_por_hora?.[h] ?? 0)));

  // Quem mais ajudou: soma de respostas úteis dos alunos (não da equipe)
  const ajudantes = [
    ...agrupar(
      atividade.filter((a) => a.participantes && !a.participantes.eh_equipe),
      (a) => a.participantes!.id,
    ).values(),
  ]
    .map((lista) => ({
      nome: lista[0].participantes!.nome,
      respostas: soma(lista.map((l) => l.respostas_uteis)),
      mensagens: soma(lista.map((l) => l.mensagens)),
    }))
    .sort((a, b) => b.respostas - a.respostas || b.mensagens - a.mensagens)
    .slice(0, 3);

  const acao = acoes.find((a) => !a.feita) ?? null;
  const unidade = janela === 1 ? "no dia" : `em ${janela} dias`;
  const quando =
    dias.length <= 1
      ? dataPorExtenso(ultima)
      : `${periodoPorExtenso(dias[0].data, ultima)} · ${dias.length} dias com dados`;

  return (
    <>
      <div className="top">
        <div>
          <h1 className="titulo">Visão geral</h1>
          <p className="sub">
            {quando} · {grupo.nome}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {exemplo && <span className="demo">Dados de exemplo</span>}
          <div className="pills">
            {OPCOES.map((o) => (
              <Link key={o.dias} href={`/?dias=${o.dias}`} className={janela === o.dias ? "pill on" : "pill"}>
                {o.rotulo}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {janela > 1 && dias.length < janela && (
        <div className="aviso">
          <b>Período incompleto.</b> Há {dias.length} {dias.length === 1 ? "dia" : "dias"} com dados de {janela}; os
          números usam só os dias que existem.
        </div>
      )}

      <section className="grid4">
        <div className="card">
          <div className="lbl">Mensagens {unidade}</div>
          <div className="big">{milhar(mensagens)}</div>
          <div className="sub">
            {variacao === null ? (
              janela === 1 ? "Sem dia anterior para comparar" : "Sem período anterior para comparar"
            ) : (
              <>
                <span className={variacao >= 0 ? "up" : "dn"}>
                  {variacao >= 0 ? "+" : ""}
                  {variacao}%
                </span>{" "}
                {janela === 1 ? "em relação ao dia anterior" : "em relação ao período anterior"}
              </>
            )}
          </div>
        </div>
        <div className="card">
          <div className="lbl">Alunos ativos</div>
          <div className="big">{alunosAtivos}</div>
          <div className="sub">{janela === 1 ? "participaram no dia" : "alunos diferentes no período"}</div>
        </div>
        <div className="card">
          <div className="lbl">Dúvidas resolvidas</div>
          <div className="big">{taxa === null ? "–" : `${taxa}%`}</div>
          <div className="sub">
            {duvidas.length
              ? `${resolvidas.length} de ${duvidas.length} · ${abertas.length} em aberto`
              : "Nenhuma dúvida no período"}
          </div>
        </div>
        <div className="card">
          <div className="lbl">Experiência da mentoria</div>
          <div className="big">
            {experiencia === null ? "–" : numero(experiencia)}
            {experiencia !== null && (
              <span style={{ fontSize: 16, color: "var(--suave)", fontWeight: 700 }}> / 10</span>
            )}
          </div>
          <div className="sub">Estimada pelo que os alunos dizem</div>
        </div>
      </section>

      <section className="row dois-um" style={{ alignItems: "stretch" }}>
        <div className="card" style={{ flex: "2 1 460px", minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <span className="lbl">Assunto mais falado {janela === 1 ? "no dia" : `em ${janela} dias`}</span>
            {principal && (
              <span className={`tag t-${principal.tipo}`}>
                {rotuloTipo(principal.tipo)}
                {principal.intensidade >= 3 ? " · intensidade alta" : ""}
              </span>
            )}
          </div>
          {principal ? (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 12, lineHeight: 1.25 }}>
                {janela === 1 ? principal.titulo : principal.nome}
              </h2>
              {principal.descricao && (
                <p className="txt" style={{ marginTop: 12 }}>
                  {principal.descricao}
                </p>
              )}
              {principal.por_que && (
                <p className="txt" style={{ marginTop: 10 }}>
                  <b>Por que importa:</b> {principal.por_que}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 24,
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "1px solid var(--fundo)",
                }}
              >
                {pctPrincipal !== null && (
                  <div>
                    <div className="lbl">Das mensagens</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{pctPrincipal}%</div>
                  </div>
                )}
                <div>
                  <div className="lbl">{janela === 1 ? "Alunos que falaram" : "Dias em que apareceu"}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
                    {janela === 1 ? principal.alunos : `${principal.dias} de ${dias.length}`}
                  </div>
                </div>
                <Link
                  href={principal.id ? `/temas?tema=${principal.id}` : "/temas"}
                  className="botao"
                  style={{ marginLeft: "auto", alignSelf: "center" }}
                >
                  Ver evolução do tema
                </Link>
              </div>
            </>
          ) : (
            <p className="sub" style={{ marginTop: 12 }}>
              Nenhum assunto extraído neste período.
            </p>
          )}
        </div>

        <div className="card" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="lbl">Mensagens por horário</div>
          <GraficoHorario porHora={porHora} />
        </div>
      </section>

      <section className="row" style={{ alignItems: "stretch" }}>
        <div className="card" style={{ flex: "1 1 340px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="h2">Dúvidas em aberto</h2>
            <Link href="/duvidas?filtro=abertas" className="link">
              Ver todas
            </Link>
          </div>
          <div style={{ marginTop: 8 }}>
            {abertas.length === 0 && <p className="sub">Nenhuma dúvida em aberto.</p>}
            {abertas.slice(0, 4).map((d, i) => (
              <div className="li" key={i}>
                <span className="tag t-duvida">{d.status === "divergente" ? "divergente" : "aberta"}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{d.titulo}</div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    {d.qtd_alunos} {d.qtd_alunos === 1 ? "aluno perguntou" : "alunos perguntaram"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 340px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="h2">Quem mais ajudou</h2>
            <Link href="/alunos" className="link">
              Ver alunos
            </Link>
          </div>
          <div style={{ marginTop: 8 }}>
            {ajudantes.length === 0 && <p className="sub">Sem dados de atividade neste período.</p>}
            {ajudantes.map((a, i) => (
              <div className="li" key={a.nome}>
                <div className="av">{iniciais(a.nome)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    {a.respostas} respostas úteis · {a.mensagens} mensagens
                  </div>
                </div>
                {i === 0 && a.respostas > 0 && <span className="tag t-elogio">Ajuda mais</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <h2 className="h2">Clima do grupo</h2>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginTop: 18, gap: 3 }}>
            <div style={{ flex: pct(clima.pos) || 0.001, background: "#2F9E6E" }} />
            <div style={{ flex: pct(clima.neu) || 0.001, background: "#C7D2CF" }} />
            <div style={{ flex: pct(clima.neg) || 0.001, background: "#E5484D" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, fontWeight: 700, color: "#3f4b48" }}>
            <span>{pct(clima.pos)}% positivo</span>
            <span>{pct(clima.neu)}% neutro</span>
            <span>{pct(clima.neg)}% negativo</span>
          </div>
          <p className="sub" style={{ marginTop: 14 }}>
            Tom das mensagens, classificado pela IA.
          </p>
        </div>
      </section>

      {ultimoDiaDados?.frase && (
        <section className="card" style={{ background: "var(--marca)", color: "#fff", borderColor: "var(--marca)" }}>
          <div className="lbl" style={{ color: "#cdebe5" }}>
            {janela === 1 ? "O dia em uma frase" : "O último dia em uma frase"}
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.45, marginTop: 8, maxWidth: 900 }}>
            {ultimoDiaDados.frase}
          </p>
        </section>
      )}

      {acao && (
        <section className="card escuro">
          <div className="lbl" style={{ color: "#9fb3ae" }}>
            Ação recomendada para a equipe
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, marginTop: 8, maxWidth: 820 }}>{acao.texto}</p>
        </section>
      )}
    </>
  );
}
