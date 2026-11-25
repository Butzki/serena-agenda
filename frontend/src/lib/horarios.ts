// Regras de horário (RF05/RF06), portadas de prototipo/js/app.js e estendidas
// na v2 (docs/04-frontend.md § 5) com expediente configurável por dia da
// semana e pausa (almoço) opcional — tudo vindo da tabela `expediente_semana`,
// para a proprietária poder ajustar sem precisar de um dev/deploy novo.
import type { AgendamentoComServico, ExpedienteDia, Feriado } from './types';

const NOME_DIA_FECHADO = [
  'aos domingos',
  'às segundas-feiras',
  'às terças-feiras',
  'às quartas-feiras',
  'às quintas-feiras',
  'às sextas-feiras',
  'aos sábados',
];

/** Nomes dos dias para a tela de Horários (frontend/src/pages/HorariosPage.tsx). */
export const NOME_DIA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diaDaSemana(dataISO: string): number {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay();
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

export function buscarFeriado(dataISO: string, feriados: Feriado[]): Feriado | undefined {
  return feriados.find((f) => f.data === dataISO);
}

export function expedienteDoDia(dataISO: string, expedientes: ExpedienteDia[]): ExpedienteDia | undefined {
  return expedientes.find((e) => e.dia_semana === diaDaSemana(dataISO));
}

/** Motivo pelo qual o dia inteiro está fechado (feriado específico ou dia da semana sem expediente), ou null se abre. */
export function motivoFechado(dataISO: string, feriados: Feriado[], expedientes: ExpedienteDia[]): string | null {
  const feriado = buscarFeriado(dataISO, feriados);
  if (feriado) return `O salão não abre em ${dataISO.split('-').reverse().join('/')}: ${feriado.motivo}.`;
  const expediente = expedienteDoDia(dataISO, expedientes);
  if (!expediente || expediente.fechado) return `O salão não abre ${NOME_DIA_FECHADO[diaDaSemana(dataISO)]}.`;
  return null;
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

/** Combina agendamentos ativos + a pausa (se houver) num só eixo de intervalos ocupados, para montar a lista de horários livres da agenda. */
export function intervalosOcupados(
  ativos: AgendamentoComServico[],
  expediente: ExpedienteDia | undefined
): { ini: number; fim: number }[] {
  const out = ativos.map((a) => {
    const ini = min(a.hora.slice(0, 5));
    return { ini, fim: ini + duracaoOuPadrao(a) };
  });
  if (expediente?.pausa_inicio && expediente?.pausa_fim) {
    out.push({ ini: min(expediente.pausa_inicio.slice(0, 5)), fim: min(expediente.pausa_fim.slice(0, 5)) });
  }
  return out.sort((a, b) => a.ini - b.ini);
}

/** Única fonte de verdade para "por que não posso agendar aqui": fechado, fora do expediente, pausa, ou conflito com outro agendamento. Retorna null se o horário é válido. */
export function motivoConflito(
  agendamentosDoDia: AgendamentoComServico[],
  dataISO: string,
  hora: string,
  duracaoMin: number,
  feriados: Feriado[],
  expedientes: ExpedienteDia[],
  ignorarId?: string
): string | null {
  const fechado = motivoFechado(dataISO, feriados, expedientes);
  if (fechado) return fechado;

  const expediente = expedienteDoDia(dataISO, expedientes)!; // garantido por motivoFechado acima
  const abre = min(expediente.hora_abre!.slice(0, 5));
  const fecha = min(expediente.hora_fecha!.slice(0, 5));
  const ini = min(hora);
  const fim = ini + duracaoMin;

  if (ini < abre || fim > fecha) {
    return `Fora do horário de funcionamento (${expediente.hora_abre!.slice(0, 5)} às ${expediente.hora_fecha!.slice(0, 5)}).`;
  }

  if (expediente.pausa_inicio && expediente.pausa_fim) {
    const pIni = min(expediente.pausa_inicio.slice(0, 5));
    const pFim = min(expediente.pausa_fim.slice(0, 5));
    if (ini < pFim && fim > pIni) {
      return `Esse horário cai no intervalo de almoço (${expediente.pausa_inicio.slice(0, 5)} às ${expediente.pausa_fim.slice(0, 5)}).`;
    }
  }

  const c = conflito(agendamentosDoDia, hora, duracaoMin, ignorarId);
  if (c) return `${c.cliente_nome} já está agendada às ${c.hora.slice(0, 5)} (${c.servico?.nome ?? 'serviço'}). Escolha outro horário.`;

  return null;
}

/** Sugere até 3 horários livres após o horário desejado, a cada 30 min, já respeitando expediente e pausa. */
export function sugestoes(
  agendamentosDoDia: AgendamentoComServico[],
  dataISO: string,
  horaDesejada: string,
  duracaoMin: number,
  feriados: Feriado[],
  expedientes: ExpedienteDia[]
): string[] {
  const expediente = expedienteDoDia(dataISO, expedientes);
  if (!expediente || expediente.fechado) return [];
  const fecha = min(expediente.hora_fecha!.slice(0, 5));
  const out: string[] = [];
  for (let t = min(horaDesejada) + 30; t + duracaoMin <= fecha && out.length < 3; t += 30) {
    if (!motivoConflito(agendamentosDoDia, dataISO, hhmm(t), duracaoMin, feriados, expedientes)) out.push(hhmm(t));
  }
  return out;
}

export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, d.length > 10 ? 7 : 6)}-${d.slice(d.length > 10 ? 7 : 6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

/** Padrão do limite de antecedência (dias) quando a tabela `configuracao` não existe ou não responde. */
export const ANTECEDENCIA_PADRAO_DIAS = 30;

/** Última data (YYYY-MM-DD) em que ainda é permitido criar um agendamento: hoje + N dias. */
export function dataLimiteAgendamento(dias: number, hoje: Date = new Date()): string {
  return iso(addDias(hoje, dias));
}

/** Preço máximo aceito pelo banco: numeric(10,2) = 10 dígitos em centavos (R$ 99.999.999,99). */
export const PRECO_MAX_DIGITOS = 10;

export function mascararPrecoCentavos(digitosCentavos: string): string {
  const n = parseInt((digitosCentavos || '0').slice(0, PRECO_MAX_DIGITOS), 10);
  return brl(n / 100);
}
