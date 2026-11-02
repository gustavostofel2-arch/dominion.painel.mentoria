import Link from "next/link";
import { notFound } from "next/navigation";
import SeletorPeriodo from "@/components/SeletorPeriodo";
import { Linha } from "@/components/graficos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { iniciais, obterGrupo } from "@/lib/dados";
import { ultimoDia } from "@/lib/consultas";
import {
  PESOS,
  ROTULO_INTERACAO,
  dataBr,
  obterInteracoesDoAluno,
  obterRanking,
  resolverPeriodo,
  type TipoInteracao,
} from "@/lib/ranking";
import { milhar, somarDias } from "@/lib/util";

export const dynamic = "force-dynamic";

const TIPOS: TipoInteracao[] = ["resolveu", "ajuda", "contribuicao", "duvida"];
const CLASSE: Record<TipoInteracao, string> = {
  resolveu: "t-elogio",
  ajuda: "t-dica",
  contribuicao: "t-duvida",
  duvida: "t-neu",
};

export default async function AlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; dias?: string; nomes?: string }>;
}) {
  const { id } = await params;
  const consultaParams = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const mostrarNomes = consultaParams.nomes !== "0";

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  const ultima = grupo ? await ultimoDia(supabase, grupo.id) : null;
  if (!grupo || !ultima) notFound();

  const periodo = resolverPeriodo(consultaParams, ultima);
  const [ranking, interacoes] = await Promise.all([
    obterRanking(supabase, grupo.id, periodo.desde, periodo.ate),
    obterInteracoesDoAluno(supabase, grupo.id, id, periodo.desde, periodo.ate),
  ]);
  const posicao = ranking.findIndex((r) => r.id === id);
  const aluno = posicao >= 0 ? ranking[posicao] : null;

  const { data: pessoa } = await supabase.from("participantes").select("nome").eq("id", id).maybeSingle();
  const nomeReal = (pessoa as { nome: string } | null)?.nome ?? aluno?.nome;
  if (!nomeReal) notFound();
  const nome = mostrarNomes ? nomeReal : `${iniciais(nomeReal)}.`;

  const extra = mostrarNomes ? "" : "nomes=0";
  const volta = `/alunos?${periodo.consulta}${extra ? `&${extra}` : ""}`;

  // Pontos acumulados dia a dia
  const fimGrafico = periodo.ate < ultima ? periodo.ate : ultima;
  const valores: number[] = [];
  let acumulado = 0;
  for (let d = periodo.desde; d <= fimGrafico && valores.length < 370; d = somarDias(d, 1)) {
    acumulado += interacoes.filter((x) => x.data === d).reduce((s, x) => s + PESOS[x.tipo], 0);
    valores.push(acumulado);
  }

  return (
    <>
      <div className="top">
        <div>
          <Link href={volta} className="link">
            ← Voltar ao ranking
          </Link>
          <h1 className="titulo" style={{ marginTop: 8 }}>
            {nome}
          </h1>
          <p className="sub">
            {aluno && aluno.pontos > 0
              ? `${posicao + 1}º lugar de ${ranking.filter((r) => r.pontos > 0).length} com pontos neste período`
              : "Sem pontos neste período"}
          </p>
        </div>
      </div>

      <SeletorPeriodo periodo={periodo} caminho={`/alunos/${id}`} extra={extra} />

      <section className="grid4">
        <div className="card">
          <div className="lbl">Pontos</div>
          <div className="big">{milhar(aluno?.pontos ?? 0)}</div>
          <div className="sub">no período</div>
        </div>
        <div className="card">
          <div className="lbl">Resolveu / ajudas</div>
          <div className="big">
            {aluno?.resolveu ?? 0} / {aluno?.ajudas ?? 0}
          </div>
          <div className="sub">dúvidas resolvidas · respostas que ajudaram</div>
        </div>
        <div className="card">
          <div className="lbl">Contribuições</div>
          <div className="big">{aluno?.contribuicoes ?? 0}</div>
          <div className="sub">dicas e resultados úteis ao grupo</div>
        </div>
        <div className="card">
          <div className="lbl">Dias ativo</div>
          <div className="big">{aluno?.diasAtivos ?? 0}</div>
          <div className="sub">{milhar(aluno?.mensagens ?? 0)} mensagens no total</div>
        </div>
      </section>

      {valores.length > 1 && (
        <section className="card">
          <h2 className="h2">Pontos acumulados</h2>
          <div style={{ marginTop: 14 }}>
            <Linha valores={valores} area altura={120} rotulo={`Pontos acumulados de ${nome} no período`} />
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            Do dia {dataBr(periodo.desde)} até {dataBr(fimGrafico)}.
          </p>
        </section>
      )}

      {TIPOS.map((tipo) => {
        const lista = interacoes.filter((x) => x.tipo === tipo);
        if (lista.length === 0) return null;
        return (
          <section className="card" key={tipo}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2 className="h2">{ROTULO_INTERACAO[tipo]}</h2>
              <span className={`tag ${CLASSE[tipo]}`}>
                {lista.length} × {PESOS[tipo]} = {lista.length * PESOS[tipo]} pontos
              </span>
            </div>
            {lista.map((x, i) => (
              <blockquote className="citacao" key={`${x.data}-${i}`}>
                <div className="quem">{dataBr(x.data)}</div>
                <p>{x.texto}</p>
              </blockquote>
            ))}
          </section>
        );
      })}

      {interacoes.length === 0 && (
        <section className="card vazio">
          <h2>Nenhuma interação válida neste período</h2>
          <p>
            Ou o aluno não participou, ou só mandou mensagens soltas. Dias anteriores à atualização do critério não
            têm este detalhe.
          </p>
        </section>
      )}
    </>
  );
}
