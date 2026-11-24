import type { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLElement> & { borda?: 'normal' | 'primaria' | 'aviso' };

const BORDAS: Record<NonNullable<Props['borda']>, string> = {
  normal: 'border-[var(--cor-borda)]',
  primaria: 'border-l-[6px] border-l-[var(--cor-primaria)]',
  aviso: 'border-l-[6px] border-l-[var(--cor-aviso)]',
};

export function Card({ borda = 'normal', className = '', ...resto }: Props) {
  return (
    <article
      className={`bg-[var(--cor-superficie)] border rounded-[var(--raio)] p-[var(--esp-4)] shadow-[var(--sombra)] ${BORDAS[borda]} ${className}`}
      {...resto}
    />
  );
}
