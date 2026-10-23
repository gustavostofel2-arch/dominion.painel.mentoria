import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export type Grupo = { id: string; nome: string; referencia: string | null };

export type Dia = {
  id: string;
  data: string;
  n_mensagens: number;
  n_participantes: number;
  msgs_por_hora: number[];
  clima_positivo: number;
  clima_neutro: number;
  clima_negativo: number;
  frase: string | null;
  visao_geral: string | null;
  tempo_resposta_min: number | null;
  nivel: string | null;
};

export const DIA_COLS =
  "id, data, n_mensagens, n_participantes, msgs_por_hora, clima_positivo, clima_neutro, clima_negativo, frase, visao_geral, tempo_resposta_min, nivel";

export const INSIGHT_COLS =
  "id, tipo, titulo, descricao, por_que, qtd_alunos, qtd_mencoes, intensidade, status, respondida_por, resposta_resumo, sugestao";

export type Insight = {
  id: string;
  temas?: { nome: string } | null;
  tipo: "dor" | "duvida" | "desejo" | "elogio" | "critica" | "dica";
  titulo: string;
  descricao: string | null;
  por_que: string | null;
  qtd_alunos: number;
  qtd_mencoes: number;
  intensidade: number | null;
  status: "resolvida" | "aberta" | "divergente" | null;
  respondida_por: "equipe" | "colegas" | null;
  resposta_resumo: string | null;
  sugestao: string | null;
};

export type Qualidade = { dimensao: string; nota: number | null };

export type Atividade = {
  mensagens: number;
  respostas_uteis: number;
  duvidas: number;
  participantes: { nome: string; eh_equipe: boolean } | null;
};

export type Acao = { id: string; texto: string; feita: boolean };

export type Contexto = {
  email: string | null;
  membro: boolean;
  grupo: Grupo | null;
};

/** Escolhe o grupo a mostrar: o real, se existir; senão o de exemplo. */
export const obterGrupo = cache(async function obterGrupo(supabase: SupabaseClient): Promise<Grupo | null> {
  const { data } = await supabase
    .from("grupos")
    .select("id, nome, referencia")
    .order("criado_em", { ascending: true });
  const lista = (data ?? []) as Grupo[];
  return lista.find((g) => !g.nome.includes("(EXEMPLO)")) ?? lista[0] ?? null;
});

export const obterContexto = cache(async function obterContexto(supabase: SupabaseClient): Promise<Contexto> {
  // getClaims confere o login localmente (sem ir ao servidor de login a cada tela)
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { email: null, membro: false, grupo: null };
  const email = (claims?.claims?.email as string | undefined) ?? null;

  // As duas consultas saem juntas. Quem não é da equipe não enxerga o grupo (regra do banco).
  const [{ data: linha }, grupo] = await Promise.all([
    supabase.from("membros_painel").select("user_id").eq("user_id", userId).maybeSingle(),
    obterGrupo(supabase),
  ]);
  const membro = Boolean(linha);
  return { email, membro, grupo: membro ? grupo : null };
});

export type VisaoGeral = {
  dia: Dia;
  diaAnterior: Dia | null;
  insights: Insight[];
  qualidade: Qualidade[];
  atividade: Atividade[];
  acoes: Acao[];
};

/** Tudo o que a tela "Visão geral" precisa, do dia mais recente do grupo. */
export async function obterVisaoGeral(
  supabase: SupabaseClient,
  grupoId: string,
): Promise<VisaoGeral | null> {
  const { data: dias } = await supabase
    .from("dias")
    .select(DIA_COLS)
    .eq("grupo_id", grupoId)
    .order("data", { ascending: false })
    .limit(2);

  const lista = (dias ?? []) as Dia[];
  const dia = lista[0];
  if (!dia) return null;

  const [insights, qualidade, atividade, acoes] = await Promise.all([
    supabase
      .from("insights")
      .select(INSIGHT_COLS)
      .eq("dia_id", dia.id)
      .order("qtd_mencoes", { ascending: false }),
    supabase.from("qualidade_dia").select("dimensao, nota").eq("dia_id", dia.id),
    supabase
      .from("atividade_dia")
      .select("mensagens, respostas_uteis, duvidas, participantes(nome, eh_equipe)")
      .eq("dia_id", dia.id),
    supabase
      .from("acoes")
      .select("id, texto, feita")
      .eq("dia_id", dia.id)
      .order("criado_em", { ascending: true }),
  ]);

  return {
    dia,
    diaAnterior: lista[1] ?? null,
    insights: (insights.data ?? []) as Insight[],
    qualidade: (qualidade.data ?? []) as Qualidade[],
    atividade: (atividade.data ?? []) as unknown as Atividade[],
    acoes: (acoes.data ?? []) as Acao[],
  };
}

// ---------- formatação ----------

export function dataPorExtenso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const texto = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function iniciais(nome: string): string {
  const partes = nome.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? partes[0]?.[1] ?? "")).toUpperCase();
}

export function rotuloTipo(tipo: Insight["tipo"]): string {
  return {
    dor: "Dor",
    duvida: "Dúvida",
    desejo: "Desejo",
    elogio: "Elogio",
    critica: "Crítica",
    dica: "Dica",
  }[tipo];
}
