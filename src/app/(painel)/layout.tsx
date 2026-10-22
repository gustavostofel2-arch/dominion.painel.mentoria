import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Configuracao from "@/components/Configuracao";
import { criarClienteServidor, supabaseConfigurado } from "@/lib/supabase/server";
import { obterContexto } from "@/lib/dados";

export const dynamic = "force-dynamic";

async function sair() {
  "use server";
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigurado()) {
    return (
      <div className="login-pagina">
        <Configuracao />
      </div>
    );
  }

  const supabase = await criarClienteServidor();
  const contexto = await obterContexto(supabase);
  if (!contexto.email) redirect("/login");

  return (
    <div className="app">
      <Sidebar
        grupoNome={contexto.grupo?.nome ?? null}
        grupoReferencia={contexto.grupo?.referencia ?? null}
        email={contexto.email}
        sair={sair}
      />
      <main className="main">
        {contexto.membro ? (
          children
        ) : (
          <section className="card vazio">
            <h2>Acesso ainda não liberado</h2>
            <p>
              Você entrou como {contexto.email}, mas esse usuário ainda não está na lista da
              equipe. Peça para quem administra o painel liberar o seu acesso.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
