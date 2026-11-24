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
