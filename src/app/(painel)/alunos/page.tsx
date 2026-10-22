import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { iniciais, obterGrupo } from "@/lib/dados";
import {
  obterAtividadePeriodo,
  obterDiasPeriodo,
  obterInsightsPeriodo,
  ultimoDia,
} from "@/lib/consultas";
import { agrupar, mediana, milhar, soma, somarDias } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; nomes?: string }>;
}) {
  const { dias: diasParam, nomes: nomesParam } = await searchParams;
  const janela = diasParam === "30" ? 30 : 7;
  const mostrarNomes = nomesParam !== "0";

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

  const desde = somarDias(ultima, -(janela - 1));
  const [atividade, duvidas, dias] = await Promise.all([
    obterAtividadePeriodo(supabase, grupo.id, desde, ultima),
    obterInsightsPeriodo(supabase, grupo.id, desde, ultima, "duvida"),
    obterDiasPeriodo(supabase, grupo.id, desde, ultima),
  ]);
  const exemplo = grupo.nome.includes("(EXEMPLO)");

  const pessoas = [
    ...agrupar(
      atividade.filter((a) => a.participantes),
      (a) => a.participantes!.id,
    ).values(),
  ].map((lista) => ({
    id: lista[0].participantes!.id,
    nome: lista[0].participantes!.nome,
    equipe: lista[0].participantes!.eh_equipe,
    mensagens: soma(lista.map((l) => l.mensagens)),
    respostas: soma(lista.map((l) => l.respostas_uteis)),
    duvidas: soma(lista.map((l) => l.duvidas)),
  }));

  const alunos = pessoas.filter((p) => !p.equipe).sort((a, b) => b.mensagens - a.mensagens);
  const equipe = pessoas.filter((p) => p.equipe);
  const ranking = alunos.slice(0, 10);
  const maxMsgs = Math.max(...ranking.map((p) => p.mensagens), 1);

  const topAjuda = [...alunos].sort((a, b) => b.respostas - a.respostas)[0]?.id;
  const topAtivo = alunos[0]?.id;
  const topPergunta = [...alunos].sort((a, b) => b.duvidas - a.duvidas)[0]?.id;
  const selo = (id: string) =>
    id === topAjuda
      ? { texto: "Ajuda mais", classe: "t-elogio" }
      : id === topAtivo
        ? { texto: "Mais ativo", classe: "t-duvida" }
        : id === topPergunta
          ? { texto: "Pergunta muito", classe: "t-desejo" }
          : null;

  const msgsEquipe = soma(equipe.map((e) => e.mensagens));
  const respostasEquipe = soma(equipe.map((e) => e.respostas));
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

  const nomeDe = (nome: string) => (mostrarNomes ? nome : `${iniciais(nome)}.`);
  const base = `/alunos?dias=${janela}`;

  return (
    <>
      <div className="top">
        <div>
          <h1 className="titulo">Alunos</h1>
          <p className="sub">Quem mais participa e quem mais ajuda. Só contagens: nenhuma mensagem é guardada.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {exemplo && <span className="demo">Dados de exemplo</span>}
          <div className="pills">
            <Link className={janela === 7 ? "pill on" : "pill"} href={`/alunos?dias=7${mostrarNomes ? "" : "&nomes=0"}`}>
              7 dias
            </Link>
            <Link className={janela === 30 ? "pill on" : "pill"} href={`/alunos?dias=30${mostrarNomes ? "" : "&nomes=0"}`}>
              30 dias
            </Link>
          </div>
        </div>
      </div>

      <section className="row dois-um" style={{ alignItems: "flex-start" }}>
        <div className="card" style={{ flex: "2 1 560px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h2 className="h2">Ranking do período</h2>
            <Link href={mostrarNomes ? `${base}&nomes=0` : base} className="chave" aria-pressed={mostrarNomes}>
              <i className={mostrarNomes ? "lig" : ""} />
              Mostrar nomes
            </Link>
          </div>

          <div className="rolagem" style={{ marginTop: 10 }}>
            <div className="tabela" style={{ minWidth: 640 }}>
              <div className="tr cab" style={{ gridTemplateColumns: "36px minmax(0,2fr) 90px 110px 80px 130px" }}>
                <span />
                <span>Aluno</span>
                <span style={{ textAlign: "right" }}>Mensagens</span>
                <span style={{ textAlign: "right" }}>Respostas úteis</span>
                <span style={{ textAlign: "right" }}>Dúvidas</span>
                <span>Destaque</span>
              </div>
              {ranking.length === 0 && <p className="sub" style={{ padding: 12 }}>Sem atividade no período.</p>}
              {ranking.map((p) => {
                const s = selo(p.id);
                return (
                  <div className="tr" key={p.id} style={{ gridTemplateColumns: "36px minmax(0,2fr) 90px 110px 80px 130px" }}>
                    <div className="av" style={{ width: 36, height: 36 }}>
                      {iniciais(p.nome)}
                    </div>
                    <div>
                      <b>{nomeDe(p.nome)}</b>
                      <div className="medidor" style={{ height: 8, marginTop: 6 }}>
                        <i style={{ width: `${(p.mensagens / maxMsgs) * 100}%`, background: "var(--marca)" }} />
                      </div>
                    </div>
                    <span className="num" data-l="Mensagens">
                      {milhar(p.mensagens)}
                    </span>
                    <span className="num" data-l="Respostas úteis">
                      {milhar(p.respostas)}
                    </span>
                    <span className="num" data-l="Dúvidas">
                      {milhar(p.duvidas)}
                    </span>
                    <span>{s && <span className={`tag ${s.classe}`}>{s.texto}</span>}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
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
                    <div style={{ flex: pctEquipe || 0.001, background: "#0E7C6B" }} />
                    <div style={{ flex: 100 - pctEquipe || 0.001, background: "#86CDBF" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#3f4b48", marginTop: 8 }}>
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

          <div className="card" style={{ background: "var(--cinza)" }}>
            <div className="lbl">Privacidade</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6, color: "#26332f" }}>
              O painel guarda apenas números por aluno (mensagens, respostas e dúvidas). Com “Mostrar nomes”
              desligado, aparecem só as iniciais.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
