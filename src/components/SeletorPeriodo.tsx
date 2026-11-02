import Link from "next/link";
import type { Periodo } from "@/lib/ranking";

type Opcao = "1" | "7" | "30" | "comp";

const ROTULOS: Record<Opcao, string> = { "1": "Último dia", "7": "7 dias", "30": "30 dias", comp: "Competição" };

/** Escolha do período: dias prontos (último dia, 7, 30, competição) ou um intervalo de datas. */
export default function SeletorPeriodo({
  periodo,
  caminho,
  extra = "",
  opcoes = ["7", "30", "comp"],
}: {
  periodo: Periodo;
  caminho: string;
  /** Parâmetros que devem continuar na URL, no formato "a=b&c=d" (ex.: tipo=dor). */
  extra?: string;
  opcoes?: Opcao[];
}) {
  const sufixo = extra ? `&${extra}` : "";
  const pares = extra
    ? extra.split("&").map((p) => {
        const [k, ...v] = p.split("=");
        return [k, v.join("=")] as const;
      })
    : [];

  return (
    <div className="seletor-periodo">
      <div className="pills">
        {opcoes.map((o) => (
          <Link
            key={o}
            href={`${caminho}?periodo=${o}${sufixo}`}
            className={periodo.chave === o ? "pill on" : "pill"}
          >
            {ROTULOS[o]}
          </Link>
        ))}
        <span className={periodo.chave === "custom" ? "pill on" : "pill"} aria-current={periodo.chave === "custom"}>
          Personalizado
        </span>
      </div>
      <form method="get" action={caminho} className="periodo-form">
        <input type="hidden" name="periodo" value="custom" />
        {pares.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label>
          <span>De</span>
          <input type="date" name="de" defaultValue={periodo.desde} required />
        </label>
        <label>
          <span>Até</span>
          <input type="date" name="ate" defaultValue={periodo.ate} required />
        </label>
        <button type="submit" className="botao">
          Aplicar
        </button>
      </form>
      <div className="sub" style={{ marginTop: 0, flexBasis: "100%" }}>
        {periodo.rotulo}
      </div>
    </div>
  );
}
