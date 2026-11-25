import { addDias, iso } from '../src/lib/horarios';

const FERIADOS_SEED = ['12-25', '01-01'];

/** Próximo dia (a partir de hoje + `aPartirDe` dias) em que o salão abre no seed: seg–sáb e não feriado. */
export function proximoDiaAberto(aPartirDe = 1): string {
  let d = addDias(new Date(), aPartirDe);
  while (d.getDay() === 0 || FERIADOS_SEED.includes(iso(d).slice(5))) d = addDias(d, 1);
  return iso(d);
}

/** Próximo domingo a partir de amanhã (fechado no seed). */
export function proximoDomingo(): string {
  let d = addDias(new Date(), 1);
  while (d.getDay() !== 0) d = addDias(d, 1);
  return iso(d);
}
