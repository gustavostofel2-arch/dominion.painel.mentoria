import Link from "next/link";
import AlertasAlunos from "@/components/AlertasAlunos";
import SeletorPeriodo from "@/components/SeletorPeriodo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { iniciais, obterGrupo } from "@/lib/dados";
import {
  obterAlertasPeriodo,
  obterDiasPeriodo,
  obterEquipePeriodo,
  obterInsightsPeriodo,
  resumirAlertas,
  ultimoDia,
} from "@/lib/consultas";
import { COMPETICAO, PESOS, dataBr, diasEntre, obterRanking, resolverPeriodo } from "@/lib/ranking";
import { agrupar, mediana, milhar, soma } from "@/lib/util";

export const dynamic = "force-dynamic";

const COLUNAS = "44px minmax(0, 2.2fr) 84px 84px 76px 116px 80px 60px 70px";

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; dias?: string; nomes?: string }>;
}) {
  const params = await searchParams;
  const mostrarNomes = params.nomes !== "0";

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  const ultima = grupo ? await ultimoDia(supabase, grupo.id) : null;
  if (!grupo || !ultima) {
    return (
      <section className="card vazio">
        <h2>Ainda não há dados</h2>
        <p>O ranking de alunos aparece assim que os primeiros dias forem gravados.</p>
      </section>
    );
  }

  const periodo = resolverPeriodo(params, ultima);
  const [ranking, equipeAtividade, duvidas, dias, alertasBrutos] = await Promise.all([
    obterRanking(supabase, grupo.id, periodo.desde, periodo.ate),
    obterEquipePeriodo(supabase, grupo.id, periodo.desde, periodo.ate),
    obterInsightsPeriodo(supabase, grupo.id, periodo.desde, periodo.ate, "duvida"),
    obterDiasPeriodo(supabase, grupo.id, periodo.desde, periodo.ate),
    obterAlertasPeriodo(supabase, grupo.id, periodo.desde, periodo.ate),
  ]);
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  const nomeDe = (nome: string) => (mostrarNomes ? nome : `${iniciais(nome)}.`);
  const alertas = resumirAlertas(alertasBrutos, nomeDe);
  const extra = mostrarNomes ? "" : "nomes=0";
  const consulta = `${periodo.consulta}${extra ? `&${extra}` : ""}`;

  const pontuados = ranking.filter((r) => r.pontos > 0);
  const podio = pontuados.slice(0, 3);
  const maxPontos = Math.max(...ranking.map((r) => r.pontos), 1);

  // Competição: em que dia estamos
  const totalDiasComp = diasEntre(COMPETICAO.inicio, COMPETICAO.fim);
  const diaAtualComp = Math.min(totalDiasComp, Math.max(0, diasEntre(COMPETICAO.inicio, ultima)));
  const pctComp = Math.round((diaAtualComp / totalDiasComp) * 100);

  // Equipe e suporte
  const msgsEquipe = soma(equipeAtividade.map((e) => e.mensagens));
  const respostasEquipe = soma(equipeAtividade.map((e) => e.respostas_uteis));
  const tempo = mediana(dias.map((d) => d.tempo_resposta_min).filter((n): n is number => n !== null));
  const resolvidas = duvidas.filter((d) => d.status === "resolvida");
  const porEquipe = resolvidas.filter((d) => d.respondida_por === "equipe").length;
  const porColegas = resolvidas.filter((d) => d.respondida_por === "colegas").length;
  const totalQuem = porEquipe + porColegas;
  const pctEquipe = totalQuem ? Math.round((porEquipe / totalQuem) * 100) : 0;
  const abertas = [...agrupar(duvidas, (d) => d.temas?.id ?? d.titulo).values()].filter((lista) => {
    const ultimo = [...lista].sort((a, b) => b.dias.data.localeCompare(a.dias.data))[0];
    return ultimo.status !== "resolvida";
  }).length;

  const detalhe = (id: string) => `/alunos/${id}?${consulta}`;

  return (
    <>
      <div className="top">
        <div>
          <h1 className="titulo">Alunos</h1>
          <p className="sub">
            Quem mais participa de verdade, ajuda e resolve problemas dos colegas. Só contam interações válidas (nada de
            “kkk” ou “ok”).
          </p>
        </div>
        {exemplo && <span className="demo">Dados de exemplo</span>}
      </div>

      <SeletorPeriodo periodo={periodo} caminho="/alunos" extra={extra} />

      {periodo.chave === "comp" && (
        <section className="card destaque">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span className="lbl">{COMPETICAO.nome}</span>
            <span className="lbl">
              {diaAtualComp === 0
                ? "ainda não começou"
                : `dia ${diaAtualComp} de ${totalDiasComp} · termina em ${dataBr(COMPETICAO.fim)}`}
            </span>
          </div>
          <div className="medidor" style={{ height: 12 }}>
            <i style={{ width: `${pctComp}%`, background: "var(--marca)" }} />
          </div>
          {pontuados[0] && (
            <p style={{ marginTop: 12, fontSize: 15 }}>
              Líder agora: <b>{nomeDe(pontuados[0].nome)}</b> com <b>{milhar(pontuados[0].pontos)} pontos</b>
              {pontuados[1] ? ` (${milhar(pontuados[0].pontos - pontuados[1].pontos)} à frente do 2º)` : ""}.
            </p>
          )}
        </section>
      )}

      {podio.length > 0 && (
        <section className="podio" aria-label="Pódio">
          {podio.map((p, i) => (
            <Link href={detalhe(p.id)} className={`card podio-item lugar-${i + 1}`} key={p.id}>
              <div className="posicao">{i + 1}º</div>
              <div className="podio-nome">{nomeDe(p.nome)}</div>
              <div className="big">
                {milhar(p.pontos)} <span className="unidade">pontos</span>
              </div>
              <div className="sub">
                {p.resolveu} resolveu · {p.ajudas} {p.ajudas === 1 ? "ajuda" : "ajudas"} · {p.contribuicoes} {p.contribuicoes === 1 ? "contribuição" : "contribuições"} · {p.duvidas} {p.duvidas === 1 ? "dúvida" : "dúvidas"}
              </div>
              <div className="sub">
                ativo em {p.diasAtivos} {p.diasAtivos === 1 ? "dia" : "dias"}
              </div>
            </Link>
          ))}
        </section>
      )}

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 className="h2">Ranking completo</h2>
          <Link
            href={`/alunos?${periodo.consulta}${mostrarNomes ? "&nomes=0" : ""}`}
            className="chave"
            aria-pressed={mostrarNomes}
          >
            <i className={mostrarNomes ? "lig" : ""} />
            Mostrar nomes
          </Link>
        </div>

        <div className="rolagem" style={{ marginTop: 10 }}>
          <div className="tabela" style={{ minWidth: 900 }}>
            <div className="tr cab" style={{ gridTemplateColumns: COLUNAS }}>
              <span>#</span>
              <span>Aluno</span>
              <span style={{ textAlign: "right" }}>Pontos</span>
              <span style={{ textAlign: "right" }}>Resolveu</span>
              <span style={{ textAlign: "right" }}>Ajudas</span>
              <span style={{ textAlign: "right" }}>Contribuições</span>
              <span style={{ textAlign: "right" }}>Dúvidas</span>
              <span style={{ textAlign: "right" }}>Dias</span>
              <span style={{ textAlign: "right" }}>Msgs</span>
            </div>
            {ranking.length === 0 && (
              <p className="sub" style={{ padding: 12 }}>
                Sem atividade de alunos neste período.
              </p>
            )}
            {ranking.map((p, i) => (
              <Link href={detalhe(p.id)} className="tr tr-aluno" key={p.id} style={{ gridTemplateColumns: COLUNAS }}>
                <span className={i < 3 && p.pontos > 0 ? "num posicao-mini top" : "num posicao-mini"} data-l="Posição">
                  {i + 1}
                </span>
                <div>
                  <b>{nomeDe(p.nome)}</b>
                  <div className="medidor" style={{ height: 6, marginTop: 6 }}>
                    <i style={{ width: `${(p.pontos / maxPontos) * 100}%`, background: "var(--marca)" }} />
                  </div>
                </div>
                <span className="num destaque-num" data-l="Pontos">
                  {milhar(p.pontos)}
                </span>
                <span className="num" data-l="Resolveu">
                  {p.resolveu}
                </span>
                <span className="num" data-l="Ajudas">
                  {p.ajudas}
                </span>
                <span className="num" data-l="Contribuições">
                  {p.contribuicoes}
                </span>
                <span className="num" data-l="Dúvidas">
                  {p.duvidas}
                </span>
                <span className="num" data-l="Dias ativos">
                  {p.diasAtivos}
                </span>
                <span className="num" data-l="Mensagens">
                  {milhar(p.mensagens)}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <p className="sub" style={{ marginTop: 12 }}>
          Clique em um aluno para ver cada interação que gerou pontos.
        </p>
      </section>

      {alertas.length > 0 && <AlertasAlunos alertas={alertas} />}

      <section className="row dois-um" style={{ alignItems: "flex-start" }}>
        <div className="card">
          <h2 className="h2">Como a pontuação funciona</h2>
          <p className="sub">
            A IA lê o grupo todo dia e marca as mensagens de alunos que são interação de verdade. Cada uma vale pontos
            conforme o tipo. A equipe não entra no ranking.
          </p>
          <div className="kp">
            <div className="lbl">Resolveu · {PESOS.resolveu} pontos</div>
            <div className="sub">Resposta que resolveu a dúvida de um colega (completa e correta ou confirmada por ele).</div>
          </div>
          <div className="kp">
            <div className="lbl">Ajuda · {PESOS.ajuda} pontos</div>
            <div className="sub">Resposta que ajuda um colega: explica, orienta ou indica o caminho.</div>
          </div>
          <div className="kp">
            <div className="lbl">Contribuição · {PESOS.contribuicao} pontos</div>
            <div className="sub">Dica prática, resultado compartilhado com detalhes ou aprendizado útil ao grupo.</div>
          </div>
          <div className="kp">
            <div className="lbl">Dúvida válida · {PESOS.duvida} ponto</div>
            <div className="sub">Pergunta clara e específica. Quem pergunta bem também participa.</div>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            Não pontuam: risadas, “ok”, “valeu” sozinho, “não sei”, spam e conversa solta. Em empate, vence quem mais
            resolveu, depois quem mais ajudou e depois quem esteve ativo em mais dias. Só vale a partir do dia em que a
            IA já usa estes critérios.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="card">
            <h2 className="h2">Equipe da mentoria</h2>
            <div className="kp">
              <div className="lbl">Mensagens da equipe</div>
              <div className="kv">{milhar(msgsEquipe)}</div>
            </div>
            <div className="kp">
              <div className="lbl">Respostas úteis</div>
              <div className="kv">{milhar(respostasEquipe)}</div>
            </div>
            <div className="kp">
              <div className="lbl">Tempo até a 1ª resposta</div>
              <div className="kv">{tempo === null ? "–" : `${Math.round(tempo)} min`}</div>
            </div>
            <div className="kp">
              <div className="lbl">Dúvidas respondidas por quem</div>
              {totalQuem === 0 ? (
                <p className="sub">Sem dúvidas resolvidas no período.</p>
              ) : (
                <>
                  <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 3, marginTop: 10 }}>
                    <div style={{ flex: pctEquipe || 0.001, background: "#ffb020" }} />
                    <div style={{ flex: 100 - pctEquipe || 0.001, background: "#8ab4ff" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#9d9ca6", marginTop: 8 }}>
                    <span>{pctEquipe}% equipe</span>
                    <span>{100 - pctEquipe}% colegas</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="h2">Atenção</h2>
            <p className="txt" style={{ fontSize: 14, marginTop: 8 }}>
              {abertas === 0
                ? "Não há dúvidas em aberto no período."
                : `${abertas} ${abertas === 1 ? "dúvida segue" : "dúvidas seguem"} sem resposta completa. Vale a equipe olhar primeiro.`}
            </p>
            {abertas > 0 && (
              <Link href="/duvidas?filtro=abertas" className="botao" style={{ marginTop: 12 }}>
                Ver dúvidas em aberto
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
