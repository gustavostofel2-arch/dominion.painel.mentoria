import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DIA_COLS,
  INSIGHT_COLS,
  type Acao,
  type Dia,
  type Insight,
  type Qualidade,
} from "./dados";
import { ultimoDiaDoMes } from "./util";

export async function ultimoDia(supabase: SupabaseClient, grupoId: string): Promise<string | null> {
  const { data } = await supabase
    .from("dias")
    .select("data")
    .eq("grupo_id", grupoId)
    .order("data", { ascending: false })
    .limit(1);
  return (data?.[0] as { data: string } | undefined)?.data ?? null;
}

// ---------- Resumo do dia ----------

export type DiaCompleto = {
  dia: Dia;
  anterior: string | null;
  proximo: string | null;
  insights: Insight[];
  qualidade: Qualidade[];
  acoes: Acao[];
};

export async function obterDia(
  supabase: SupabaseClient,
  grupoId: string,
  data: string,
): Promise<DiaCompleto | null> {
  const { data: dia } = await supabase
    .from("dias")
    .select(DIA_COLS)
    .eq("grupo_id", grupoId)
    .eq("data", data)
    .maybeSingle();
  if (!dia) return null;
  const d = dia as unknown as Dia;

  const [anterior, proximo, insights, qualidade, acoes] = await Promise.all([
    supabase
      .from("dias")
      .select("data")
      .eq("grupo_id", grupoId)
      .lt("data", data)
      .order("data", { ascending: false })
      .limit(1),
    supabase
      .from("dias")
      .select("data")
      .eq("grupo_id", grupoId)
      .gt("data", data)
      .order("data", { ascending: true })
      .limit(1),
    supabase
      .from("insights")
      .select(`${INSIGHT_COLS}, temas(nome)`)
      .eq("dia_id", d.id)
      .order("qtd_mencoes", { ascending: false }),
    supabase.from("qualidade_dia").select("dimensao, nota").eq("dia_id", d.id),
    supabase
      .from("acoes")
      .select("id, texto, feita")
      .eq("dia_id", d.id)
      .order("criado_em", { ascending: true }),
  ]);

  return {
    dia: d,
    anterior: (anterior.data?.[0] as { data: string } | undefined)?.data ?? null,
    proximo: (proximo.data?.[0] as { data: string } | undefined)?.data ?? null,
    insights: (insights.data ?? []) as unknown as Insight[],
    qualidade: (qualidade.data ?? []) as Qualidade[],
    acoes: (acoes.data ?? []) as Acao[],
  };
}

// ---------- Histórico ----------

export type DiaResumo = { id: string; data: string; n_mensagens: number; frase: string | null };

export async function obterMes(supabase: SupabaseClient, grupoId: string, mes: string) {
  const inicio = `${mes}-01`;
  const fim = ultimoDiaDoMes(mes);

  const [dias, dores, anterior, proximo] = await Promise.all([
    supabase
      .from("dias")
      .select("id, data, n_mensagens, frase")
      .eq("grupo_id", grupoId)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: true }),
    supabase
      .from("insights")
      .select("titulo, temas(nome), dias!inner(data, grupo_id)")
      .eq("tipo", "dor")
      .eq("dias.grupo_id", grupoId)
      .gte("dias.data", inicio)
      .lte("dias.data", fim),
    supabase
      .from("dias")
      .select("data")
      .eq("grupo_id", grupoId)
      .lt("data", inicio)
      .order("data", { ascending: false })
      .limit(1),
    supabase
      .from("dias")
      .select("data")
      .eq("grupo_id", grupoId)
      .gt("data", fim)
      .order("data", { ascending: true })
      .limit(1),
  ]);

  return {
    dias: (dias.data ?? []) as DiaResumo[],
    dores: (dores.data ?? []) as unknown as {
      titulo: string;
      temas: { nome: string } | null;
      dias: { data: string };
    }[],
    mesAnterior: ((anterior.data?.[0] as { data: string } | undefined)?.data ?? "").slice(0, 7) || null,
    mesSeguinte: ((proximo.data?.[0] as { data: string } | undefined)?.data ?? "").slice(0, 7) || null,
  };
}

export async function obterInsightsDoDia(supabase: SupabaseClient, diaId: string) {
  const { data } = await supabase
    .from("insights")
    .select("tipo, titulo, qtd_mencoes")
    .eq("dia_id", diaId)
    .order("qtd_mencoes", { ascending: false })
    .limit(4);
  return (data ?? []) as { tipo: Insight["tipo"]; titulo: string; qtd_mencoes: number }[];
}

// ---------- Temas, dúvidas e qualidade (janela de dias) ----------

export type InsightComDia = {
  tipo: Insight["tipo"];
  titulo: string;
  descricao: string | null;
  por_que: string | null;
  qtd_alunos: number;
  qtd_mencoes: number;
  intensidade: number | null;
  status: Insight["status"];
  respondida_por: Insight["respondida_por"];
  resposta_resumo: string | null;
  sugestao: string | null;
  tema_id: string | null;
  temas: { id: string; nome: string } | null;
  dias: { data: string; grupo_id: string };
};

export async function obterInsightsPeriodo(
  supabase: SupabaseClient,
  grupoId: string,
  desde: string,
  ate: string,
  tipo?: Insight["tipo"],
): Promise<InsightComDia[]> {
  let consulta = supabase
    .from("insights")
    .select(
      "tipo, titulo, descricao, por_que, qtd_alunos, qtd_mencoes, intensidade, status, respondida_por, resposta_resumo, sugestao, tema_id, temas(id, nome), dias!inner(data, grupo_id)",
    )
    .eq("dias.grupo_id", grupoId)
    .gte("dias.data", desde)
    .lte("dias.data", ate);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  const { data } = await consulta;
  return (data ?? []) as unknown as InsightComDia[];
}

export async function obterDiasPeriodo(
  supabase: SupabaseClient,
  grupoId: string,
  desde: string,
  ate: string,
) {
  const { data } = await supabase
    .from("dias")
    .select("id, data, n_mensagens, n_participantes, tempo_resposta_min, conteudo")
    .eq("grupo_id", grupoId)
    .gte("data", desde)
    .lte("data", ate)
    .order("data", { ascending: true });
  return (data ?? []) as {
    id: string;
    data: string;
    n_mensagens: number;
    n_participantes: number;
    tempo_resposta_min: number | null;
    conteudo: { perguntas_total?: number; perguntas_sem_resposta?: number } | null;
  }[];
}

/** Dias com todas as colunas (inclusive mensagens por hora e clima). */
export async function obterDiasCompletos(
  supabase: SupabaseClient,
  grupoId: string,
  desde: string,
  ate: string,
): Promise<Dia[]> {
  const { data } = await supabase
    .from("dias")
    .select(DIA_COLS)
    .eq("grupo_id", grupoId)
    .gte("data", desde)
    .lte("data", ate)
    .order("data", { ascending: true });
  return (data ?? []) as unknown as Dia[];
}

export async function obterAcoesDoDia(supabase: SupabaseClient, diaId: string): Promise<Acao[]> {
  const { data } = await supabase
    .from("acoes")
    .select("id, texto, feita")
    .eq("dia_id", diaId)
    .order("criado_em", { ascending: true });
  return (data ?? []) as Acao[];
}

export async function obterQualidadePeriodo(
  supabase: SupabaseClient,
  grupoId: string,
  desde: string,
  ate: string,
) {
  const { data } = await supabase
    .from("qualidade_dia")
    .select("dimensao, nota, dias!inner(data, grupo_id)")
    .eq("dias.grupo_id", grupoId)
    .gte("dias.data", desde)
    .lte("dias.data", ate);
  return (data ?? []) as unknown as {
    dimensao: string;
    nota: number | null;
    dias: { data: string };
  }[];
}

// ---------- Alunos ----------

export async function obterAtividadePeriodo(
  supabase: SupabaseClient,
  grupoId: string,
  desde: string,
  ate: string,
) {
  const { data } = await supabase
    .from("atividade_dia")
    .select(
      "mensagens, respostas_uteis, duvidas, participantes(id, nome, eh_equipe), dias!inner(data, grupo_id)",
    )
    .eq("dias.grupo_id", grupoId)
    .gte("dias.data", desde)
    .lte("dias.data", ate);
  return (data ?? []) as unknown as {
    mensagens: number;
    respostas_uteis: number;
    duvidas: number;
    participantes: { id: string; nome: string; eh_equipe: boolean } | null;
    dias: { data: string };
  }[];
}

// ---------- Relatórios ----------

export type Relatorio = {
  id: string;
  tipo: "semanal" | "mensal";
  inicio: string;
  fim: string;
  parcial: boolean;
  dias_com_dados: number;
  frase: string | null;
  texto: string | null;
  conteudo: Record<string, unknown>;
  modelo_ia: string | null;
};

export async function listarRelatorios(
  supabase: SupabaseClient,
  grupoId: string,
  tipo: "semanal" | "mensal",
): Promise<Relatorio[]> {
  const { data } = await supabase
    .from("relatorios")
    .select("id, tipo, inicio, fim, parcial, dias_com_dados, frase, texto, conteudo, modelo_ia")
    .eq("grupo_id", grupoId)
    .eq("tipo", tipo)
    .order("inicio", { ascending: false })
    .limit(12);
  return (data ?? []) as Relatorio[];
}
