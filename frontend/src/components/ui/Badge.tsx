type Tom = 'ocupado' | 'cancelado' | 'noshow' | 'sucesso';

const TONS: Record<Tom, string> = {
  ocupado: 'bg-[var(--cor-ocupado-fundo)] text-[var(--cor-ocupado-texto)]',
  cancelado: 'bg-[#ECE6E8] text-[#4A3D43]',
  noshow: 'bg-[var(--cor-aviso-fundo)] text-[var(--cor-aviso)]',
  sucesso: 'bg-[var(--cor-sucesso-fundo)] text-[var(--cor-sucesso)]',
};

export function Badge({ tom, texto }: { tom: Tom; texto: string }) {
  // Nunca só cor: todo chip de status leva um ícone + texto (RNF03 / teste heurístico H1).
  return (
    <span className={`inline-flex items-center gap-1 px-[10px] py-[2px] rounded-full text-[length:var(--texto-xs)] font-bold ${TONS[tom]}`}>
      {texto}
    </span>
  );
}
