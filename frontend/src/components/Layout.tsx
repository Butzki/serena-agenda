import { type ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

type Props = {
  titulo: string;
  marca?: boolean;
  voltarPara?: string;
  ariaVoltar?: string;
  children: ReactNode;
};

function linkClasses(ativo: boolean) {
  const base =
    'flex-1 flex flex-col items-center justify-center gap-[2px] min-h-[64px] no-underline text-[length:var(--texto-xs)] font-semibold';
  return ativo
    ? `${base} text-[var(--cor-primaria)] shadow-[inset_0_3px_0_var(--cor-primaria)]`
    : `${base} text-[var(--cor-texto-suave)]`;
}

function IconeAgenda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-6 h-6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconeServicos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-6 h-6">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.5 8 20 19M8.5 16 20 5" />
    </svg>
  );
}

/** Casca comum às 4 telas: cabeçalho (marca ou voltar), toast de status e navegação inferior.
    Mesma estrutura do protótipo HTML da Aula 02 (topo, main#conteudo, nav-inf). */
export function Layout({ titulo, marca, voltarPara, ariaVoltar, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const msg = (location.state as { toast?: string } | null)?.toast;
    if (!msg) return;
    setToast(msg);
    navigate(location.pathname + location.search, { replace: true, state: {} });
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-[var(--cor-fundo)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-[var(--esp-2)] focus:top-[var(--esp-2)] bg-[var(--cor-superficie)] px-[var(--esp-3)] py-[var(--esp-2)] rounded-[var(--raio-sm)] z-20"
      >
        Ir para o conteúdo
      </a>
      <header className="flex items-center gap-[var(--esp-2)] px-[var(--esp-4)] py-[var(--esp-3)] bg-[var(--cor-superficie)] border-b border-[var(--cor-borda)] sticky top-0 z-10">
        {marca ? (
          <div className="flex-1">
            <span className="block text-[length:var(--texto-xs)] font-bold text-[var(--cor-primaria)] tracking-wider uppercase">
              Serena Agenda
            </span>
            <h1 className="text-[length:var(--texto-lg)] font-bold">{titulo}</h1>
          </div>
        ) : (
          <>
            <Link
              to={voltarPara ?? '/agenda'}
              aria-label={ariaVoltar ?? 'Voltar'}
              className="-ml-[var(--esp-2)] inline-flex items-center justify-center min-w-[var(--alvo-toque)] min-h-[var(--alvo-toque)] text-[var(--cor-texto)] no-underline text-[length:var(--texto-xl)] rounded-full"
            >
              ←
            </Link>
            <h1 className="text-[length:var(--texto-lg)] font-bold flex-1">{titulo}</h1>
          </>
        )}
      </header>

      <main id="conteudo" className="flex-1 px-[var(--esp-4)] pt-[var(--esp-4)] pb-[88px]">
        {toast && (
          <p
            role="status"
            className="rounded-[var(--raio)] px-[var(--esp-4)] py-[var(--esp-3)] text-[length:var(--texto-sm)] border bg-[var(--cor-sucesso-fundo)] text-[#0F4A31] border-[var(--cor-sucesso)] mb-[var(--esp-4)]"
          >
            {toast}
          </p>
        )}
        {children}
      </main>

      <nav aria-label="Navegação principal" className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-[var(--cor-superficie)] border-t border-[var(--cor-borda)] flex z-10">
        <NavLink to="/agenda" className={({ isActive }) => linkClasses(isActive)} aria-current={undefined}>
          <IconeAgenda />
          Agenda
        </NavLink>
        <NavLink to="/servicos" className={({ isActive }) => linkClasses(isActive)}>
          <IconeServicos />
          Serviços
        </NavLink>
      </nav>
    </div>
  );
}
