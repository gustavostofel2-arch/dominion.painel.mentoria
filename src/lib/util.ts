export function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Último dia (YYYY-MM-DD) do mês informado (YYYY-MM). */
export function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function diasNoMes(mes: string): number {
  return Number(ultimoDiaDoMes(mes).slice(8, 10));
}

/** Dia da semana de 0 (domingo) a 6 (sábado). */
export function diaDaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function dataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} de ${a}`;
}

/** "22 out" */
export function diaMesCurto(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_CURTOS[Number(iso.slice(5, 7)) - 1]}`;
}

export function periodoPorExtenso(inicio: string, fim: string): string {
  return `${diaMesCurto(inicio)} a ${diaMesCurto(fim)}`;
}

export function numero(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace(".", ",");
}

export function milhar(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

export function soma(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0);
}

export function media(valores: number[]): number | null {
  return valores.length ? soma(valores) / valores.length : null;
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

/** Variação percentual entre dois períodos; null se não houver base de comparação. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/** Agrupa uma lista por chave. */
export function agrupar<T>(lista: T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of lista) {
    const k = chave(item);
    const atual = mapa.get(k);
    if (atual) atual.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}
