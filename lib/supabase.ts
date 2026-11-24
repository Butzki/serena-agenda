import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (copie .env.example para .env).'
  );
}

// Tipos das duas tabelas (supabase/schema.sql), usados pelo SDK e pela Aula 04.
export type Servico = {
  id: string;
  nome: string;
  duracao_min: number;
  preco: number;
  criado_em: string;
};

export type Agendamento = {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  servico_id: string | null;
  data: string;
  hora: string;
  status: 'ativo' | 'cancelado' | 'noshow';
  criado_em: string;
};

export const supabase = createClient(url, anonKey);
