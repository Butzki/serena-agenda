// Regras de horário (RF05/RF06), portadas de prototipo/js/app.js para manter
// o mesmo comportamento já validado no teste heurístico da Aula 02.
import type { AgendamentoComServico } from './types';

export const HORA_ABRE = 8 * 60;
export const HORA_FECHA = 20 * 60;

// Suposição de negócio (ver docs/02-ux-ui.md § 6.2 e README § Validação humana,
// que já marcavam o expediente 8h-20h como hipótese, não dado confirmado):
// assumimos domingo fechado. 0 = domingo (Date#getDay()). Ajustar se o salão
// abrir aos domingos e fechar em outro dia, ou trocar por uma lista de dias.
export const DIA_SEMANA_FECHADO = 0;

/** Domingo (ou o dia configurado em DIA_SEMANA_FECHADO) é fechado o dia inteiro. */
export function salaoFechado(dataISO: string): boolean {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay() === DIA_SEMANA_FECHADO;
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function min(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataExtensa(dataISO: string): { dia: string; resto: string } {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return {
    dia: d.toLocaleDateString('pt-BR', { weekday: 'long' }),
    resto: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }),
  };
}

export function duracaoOuPadrao(ag: AgendamentoComServico): number {
  return ag.servico?.duracao_min ?? 30;
}

/** RF05: encontra o agendamento ativo que conflita com o intervalo informado. */
export function conflito(
  agendamentosDoDia: AgendamentoComServico[],
  hora: string,
  duracaoMin: number,
  ignorarId?: string
): AgendamentoComServico | undefined {
  const ini = min(hora);
  const fim = ini + duracaoMin;
  return agendamentosDoDia
    .filter((a) => a.status === 'ativo' && a.id !== ignorarId)
    .find((a) => {
      const ai = min(a.hora.slice(0, 5));
      const af = ai + duracaoOuPadrao(a);
      return ini < af && fim > ai; // consecutivos (fim == início) são permitidos
    });
}

/** Sugere até 3 horários livres após o horário desejado, a cada 30 min. */
export function sugestoes(
  agendamentosDoDia: AgendamentoComServico[],
  horaDesejada: string,
  duracaoMin: number
): string[] {
  const out: string[] = [];
  for (let t = min(horaDesejada) + 30; t + duracaoMin <= HORA_FECHA && out.length < 3; t += 30) {
    if (!conflito(agendamentosDoDia, hhmm(t), duracaoMin)) out.push(hhmm(t));
  }
  return out;
}

export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, d.length > 10 ? 7 : 6)}-${d.slice(d.length > 10 ? 7 : 6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

export function mascararPrecoCentavos(digitosCentavos: string): string {
  const n = parseInt(digitosCentavos || '0', 10);
  return brl(n / 100);
}
