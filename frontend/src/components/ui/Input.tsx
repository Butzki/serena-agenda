import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

type PropsBase = {
  label: string;
  erro?: string;
  dica?: string;
  id: string;
};

type PropsInput = PropsBase & InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };
type PropsSelect = PropsBase &
  SelectHTMLAttributes<HTMLSelectElement> & { as: 'select'; children: ReactNode };

const CAMPO =
  'w-full min-h-[var(--alvo-toque)] px-[var(--esp-3)] font-[var(--fonte)] text-[var(--cor-texto)] bg-[var(--cor-superficie)] border-2 rounded-[var(--raio-sm)]';

export function Input(props: PropsInput | PropsSelect) {
  const { label, erro, dica, id } = props;
  const borda = erro ? 'border-[var(--cor-perigo)]' : 'border-[var(--cor-borda-campo)]';

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block font-semibold mb-[var(--esp-1)]">
        {label}
      </label>
      {props.as === 'select' ? (
        <select id={id} className={`${CAMPO} ${borda}`} aria-invalid={!!erro} {...omitirExtras(props)}>
          {props.children}
        </select>
      ) : (
        <input id={id} className={`${CAMPO} ${borda}`} aria-invalid={!!erro} {...omitirExtras(props)} />
      )}
      {dica && !erro && <p className="text-[length:var(--texto-sm)] text-[var(--cor-texto-suave)] mt-[var(--esp-1)]">{dica}</p>}
      {erro && (
        <p className="text-[length:var(--texto-sm)] font-semibold text-[var(--cor-perigo)] mt-[var(--esp-1)]">{erro}</p>
      )}
    </div>
  );
}

function omitirExtras<T extends PropsBase>(props: T) {
  const { label: _label, erro: _erro, dica: _dica, id: _id, ...resto } = props as PropsBase & Record<string, unknown>;
  delete (resto as Record<string, unknown>).as;
  delete (resto as Record<string, unknown>).children;
  return resto;
}
