// Mesmas entidades de ../../../supabase/schema.sql (Aula 03).
export type Servico = {
  id: string;
  nome: string;
  duracao_min: number;
  preco: number;
  criado_em: string;
};

export type StatusAgendamento = 'ativo' | 'cancelado' | 'noshow';

export type Agendamento = {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  servico_id: string | null;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS (Postgres time)
  status: StatusAgendamento;
  criado_em: string;
};

export type AgendamentoComServico = Agendamento & { servico: Servico | null };

// v2 (docs/04-frontend.md § 5): dias em que o salão não abre (ex.: Natal).
export type Feriado = {
  data: string; // YYYY-MM-DD
  motivo: string;
};

// v2 (docs/04-frontend.md § 5): expediente configurável por dia da semana,
// com pausa (almoço) opcional. dia_semana: 0 = domingo ... 6 = sábado.
export type ExpedienteDia = {
  dia_semana: number;
  fechado: boolean;
  hora_abre: string | null; // HH:MM:SS
  hora_fecha: string | null;
  pausa_inicio: string | null;
  pausa_fim: string | null;
};
