import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterGrupo } from "@/lib/dados";
import { ultimoDia } from "@/lib/consultas";

export const dynamic = "force-dynamic";

/** /dia leva para o resumo do dia mais recente, ou para o dia pedido em /dia?data=AAAA-MM-DD. */
export default async function Page({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { data: pedida } = await searchParams;
  if (pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida)) redirect(`/dia/${pedida}`);

  const supabase = await criarClienteServidor();
  const grupo = await obterGrupo(supabase);
  const data = grupo ? await ultimoDia(supabase, grupo.id) : null;

  if (data) redirect(`/dia/${data}`);

  return (
    <section className="card vazio">
      <h2>Ainda não há resumos</h2>
      <p>Assim que o primeiro dia for gravado, ele aparece aqui.</p>
    </section>
  );
}
