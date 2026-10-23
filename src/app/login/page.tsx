import { redirect } from "next/navigation";
import { criarClienteServidor, supabaseConfigurado } from "@/lib/supabase/server";
import Configuracao from "@/components/Configuracao";
import Logo from "@/components/Logo";

async function entrar(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) redirect("/login?erro=1");
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (!supabaseConfigurado()) {
    return (
      <div className="login-pagina">
        <Configuracao />
      </div>
    );
  }

  const { erro } = await searchParams;

  return (
    <div className="login-pagina">
      <form className="login-card" action={entrar}>
        <div className="brand" style={{ padding: "0 0 16px" }}>
          <Logo tamanho={30} />
          <div className="sub">Painel da mentoria</div>
        </div>

        <h1>Entrar</h1>

        {erro && <div className="erro">E-mail ou senha incorretos. Tente de novo.</div>}

        <label className="campo">
          E-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="campo">
          Senha
          <input name="senha" type="password" autoComplete="current-password" required />
        </label>

        <button className="botao" type="submit" style={{ padding: "12px 16px", fontSize: 15 }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
