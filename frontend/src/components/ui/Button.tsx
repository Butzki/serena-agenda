import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'perigo';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  bloco?: boolean;
  pequeno?: boolean;
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[var(--raio)] border-2 font-semibold font-[var(--fonte)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-[var(--cor-primaria)] text-white border-transparent hover:bg-[var(--cor-primaria-escura)]',
  secundario: 'bg-[var(--cor-superficie)] text-[var(--cor-primaria)] border-[var(--cor-primaria)]',
  perigo: 'bg-[var(--cor-superficie)] text-[var(--cor-perigo)] border-[var(--cor-perigo)]',
};

export function Button({ variante = 'primario', bloco, pequeno, className = '', ...resto }: Props) {
  const tamanho = pequeno
    ? 'min-h-[44px] px-[var(--esp-4)] text-[length:var(--texto-sm)]'
    : 'min-h-[var(--alvo-toque)] px-[var(--esp-5)]';
  return (
    <button
      className={`${BASE} ${VARIANTES[variante]} ${tamanho} ${bloco ? 'w-full' : ''} ${className}`}
      {...resto}
    />
  );
}
