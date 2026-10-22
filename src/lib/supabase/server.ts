import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Cliente do Supabase para usar em páginas e ações do servidor. */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesParaGravar) {
          try {
            cookiesParaGravar.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Em páginas (só leitura) não dá para gravar cookie; o proxy já cuida disso.
          }
        },
      },
    },
  );
}
