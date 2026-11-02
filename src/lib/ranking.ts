import type { SupabaseClient } from "@supabase/supabase-js";
import { somarDias } from "./util";

/** A competição interna entre os mentorados. Para mudar as datas, é só trocar aqui. */
export const COMPETICAO = { nome: "Competição de novembro", inicio: "2026-11-01", fim: "2026-11-30" };

/** Pontos por tipo de interação válida (a IA classifica; o painel só soma). */
export const PESOS = { resolveu: 5, ajuda: 3, contribuicao: 2, duvida: 1 } as const;

export type TipoInteracao = keyof typeof PESOS;

export const ROTULO_INTERACAO: Record<TipoInteracao, string> = {
  resolveu: "Resolveu a dúvida de um colega",
  ajuda: "Ajudou um colega",
  contribuicao: "Contribuiu com o grupo",
  duvida: "Fez uma dúvida válida",
};

export type Periodo = {
  chave: "1" | "7" | "30" | "comp" | "custom";
  desde: string;
  ate: string;
  rotulo: string;
  /** Parâmetros de URL que repetem este período (para os links de dentro da tela). */
  consulta: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(valor: string | undefined): valor is string {
  return Boolean(valor && ISO.test(valor) && !Number.isNaN(new Date(`${valor}T12:00:00Z`).getTime()));
}

export function dataBr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Descobre o período pedido na URL. `ultima` é o último dia com dados (usado nos períodos "últimos N dias"). */
export function resolverPeriodo(
  params: { periodo?: string; de?: string; ate?: string; dias?: string },
  ultima: string,
  padrao: "1" | "7" | "30" = "7",
): Periodo {
  const chave = params.periodo ?? params.dias;

  if (chave === "custom" && dataValida(params.de) && dataValida(params.ate)) {
    let [desde, ate] = [params.de, params.ate];
    if (desde > ate) [desde, ate] = [ate, desde];
    if (diasEntre(desde, ate) > 366) desde = somarDias(ate, -365);
    return {
      chave: "custom",
      desde,
      ate,
      rotulo: `${dataBr(desde)} a ${dataBr(ate)}`,
      consulta: `periodo=custom&de=${desde}&ate=${ate}`,
    };
  }

  if (chave === "comp") {
    return {
      chave: "comp",
      desde: COMPETICAO.inicio,
      ate: COMPETICAO.fim,
      rotulo: `${COMPETICAO.nome} · ${dataBr(COMPETICAO.inicio)} a ${dataBr(COMPETICAO.fim)}`,
      consulta: "periodo=comp",
    };
  }

  const escolhida = chave === "1" || chave === "7" || chave === "30" ? chave : padrao;
  const janela = Number(escolhida);
  const desde = somarDias(ultima, -(janela - 1));
  return {
    chave: escolhida,
    desde,
    ate: ultima,
    rotulo: janela === 1 ? `Último dia · ${dataBr(ultima)}` : `Últimos ${janela} dias · ${dataBr(desde)} a ${dataBr(ultima)}`,
    consulta: `periodo=${janela}`,
  };
}

export type LinhaRanking = {
  id: string;
  nome: string;
  resolveu: number;
  ajudas: number;
  contribuicoes: number;
  duvidas: number;
  diasAtivos: number;
  mensagens: number;
  pontos: number;
};

export function pontosDe(l: { resolveu: number; ajudas: number; contribuicoes: number; duvidas: number }): number {
  return (
    l.resolveu * PESOS.resolveu + l.ajudas * PESOS.ajuda + l.contribuicoes * PESOS.contribuicao + l.duvidas * PESOS.duvida
  );
}

/** Ranking do período, já somado no banco. Ordem: pontos, depois quem mais resolveu, mais ajudou e mais dias ativo. */
export async function obterRanking(
  supabase: SupabaseClient,
  grupoId: string,
  desde: string,
  ate: string,
): Promise<LinhaRanking[]> {
  const { data } = await supabase.rpc("ranking_alunos", { p_grupo: grupoId, p_desde: desde, p_ate: ate });
  const linhas = ((data ?? []) as {
    participante_id: string;
    nome: string;
    ajudas: number;
    resolveu: number;
    contribuicoes: number;
    duvidas_validas: number;
    dias_ativos: number;
    mensagens: number;
  }[]).map((r) => {
    const base = {
      id: r.participante_id,
      nome: r.nome,
      resolveu: r.resolveu,
      ajudas: r.ajudas,
      contribuicoes: r.contribuicoes,
      duvidas: r.duvidas_validas,
      diasAtivos: r.dias_ativos,
      mensagens: r.mensagens,
    };
    return { ...base, pontos: pontosDe(base) };
  });
  return linhas.sort(
    (a, b) =>
      b.pontos - a.pontos ||
      b.resolveu - a.resolveu ||
      b.ajudas - a.ajudas ||
      b.diasAtivos - a.diasAtivos ||
      a.nome.localeCompare(b.nome),
  );
}

export type InteracaoDoAluno = {
  tipo: TipoInteracao;
  texto: string | null;
  data: string;
};

export async function obterInteracoesDoAluno(
  supabase: SupabaseClient,
  grupoId: string,
  participanteId: string,
  desde: string,
  ate: string,
): Promise<InteracaoDoAluno[]> {
  const { data } = await supabase
    .from("interacoes_validas")
    .select("tipo, texto, dias!inner(data, grupo_id)")
    .eq("participante_id", participanteId)
    .eq("dias.grupo_id", grupoId)
    .gte("dias.data", desde)
    .lte("dias.data", ate);
  return ((data ?? []) as unknown as { tipo: TipoInteracao; texto: string | null; dias: { data: string } }[])
    .map((r) => ({ tipo: r.tipo, texto: r.texto, data: r.dias.data }))
    .sort((a, b) => b.data.localeCompare(a.data));
}
