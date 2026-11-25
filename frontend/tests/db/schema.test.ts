// Testes de integração do banco: roda o supabase/schema.sql + seed.sql REAIS
// num Postgres em memória (PGlite) e verifica constraints e o trigger de
// conflito (defesa em profundidade do RF05). Nunca toca o banco de produção.
import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { addDias, iso } from '../../src/lib/horarios';
import { proximoDiaAberto, proximoDomingo } from '../datas';
// @ts-expect-error módulo JS sem tipos (compartilhado com o servidor dos E2E)
import { criarBanco } from '../../e2e/support/fake-supabase.mjs';

let db: PGlite;
let corte: string; // Corte feminino, 60 min (seed)
// Datas relativas a hoje: o trigger agora recusa data passada e além do limite de antecedência.
const QUARTA = proximoDiaAberto(1); // dia aberto (seg–sáb), amanhã ou depois
const DOMINGO = proximoDomingo();
const DOW = new Date(`${QUARTA}T12:00`).getDay();

beforeEach(async () => {
  db = await criarBanco();
  corte = (await db.query<{ id: string }>(`select id from servicos where nome = 'Corte feminino'`)).rows[0].id;
});

async function erro(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await db.query(sql, params);
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}

const insServico = (nome: string, duracao: number, preco: number) =>
  erro('insert into servicos (nome, duracao_min, preco) values ($1, $2, $3)', [nome, duracao, preco]);

const insAg = (hora: string, data = QUARTA, status = 'ativo', servico: string | null = null) =>
  erro(
    `insert into agendamentos (cliente_nome, cliente_telefone, servico_id, data, hora, status)
     values ('Ana Lima', '(49) 99999-0000', $1, $2, $3, $4)`,
    [servico ?? corte, data, hora, status]
  );

describe('US-01 · constraints de serviço (RF01, RF08)', () => {
  it('AC1 · nome com 3 caracteres é aceito', async () => expect(await insServico('Pé ', 30, 10)).toBe(''));
  it('AC1 · nome com 2 caracteres é rejeitado', async () => expect(await insServico('Pé', 30, 10)).toMatch(/servicos_nome_check/));
  it('AC1 · duração 10 e 480 aceitas (limites)', async () => {
    expect(await insServico('Mínimo', 10, 10)).toBe('');
    expect(await insServico('Máximo', 480, 10)).toBe('');
  });
  it('AC1 · duração 5 e 500 rejeitadas', async () => {
    expect(await insServico('Curto', 5, 10)).toMatch(/duracao_min_check/);
    expect(await insServico('Longo', 500, 10)).toMatch(/duracao_min_check/);
  });
  it('AC1 · preço R$ 0,01 aceito', async () => expect(await insServico('Barato', 30, 0.01)).toBe(''));
  it('AC1 · preço R$ 0,00 e negativo rejeitados', async () => {
    expect(await insServico('Grátis', 30, 0)).toMatch(/preco_check/);
    expect(await insServico('Negativo', 30, -5)).toMatch(/preco_check/);
  });
});

describe('US-02 · constraints de agendamento (RF04, RF08)', () => {
  it('AC1 · telefone com 9 dígitos é rejeitado', async () => {
    const sql = `insert into agendamentos (cliente_nome, cliente_telefone, servico_id, data, hora)
                 values ('Ana Lima', '(49) 9999-000', $1, $2, '10:00')`;
    expect(await erro(sql, [corte, QUARTA])).toMatch(/cliente_telefone_check/);
  });
  it('status fora da lista é rejeitado', async () => expect(await insAg('10:00', QUARTA, 'pago')).toMatch(/status_check/));
});

describe('RF05 · trigger checar_conflito_agendamento', () => {
  it('US-03 AC1 · bloqueia sobreposição', async () => {
    expect(await insAg('14:00')).toBe('');
    expect(await insAg('14:30')).toMatch(/Conflito de horário/);
  });
  it('US-03 AC2 · permite consecutivo (15:00 após 14:00 + 60 min)', async () => {
    await insAg('14:00');
    expect(await insAg('15:00')).toBe('');
  });
  it('US-03 AC3 · cancelado não bloqueia', async () => {
    await insAg('14:00', QUARTA, 'cancelado');
    expect(await insAg('14:00')).toBe('');
  });
  it('feriado bloqueia', async () => {
    const dia = iso(addDias(new Date(), 2));
    await db.query(`insert into feriados (data, motivo) values ($1, 'Natal de teste')`, [dia]);
    expect(await insAg('10:00', dia)).toMatch(/Natal de teste/);
  });
  it('domingo bloqueia', async () => expect(await insAg('10:00', DOMINGO)).toMatch(/não abre nesse dia/));
  it('fora do expediente bloqueia (19:30 + 60 min)', async () => expect(await insAg('19:30')).toMatch(/Fora do horário/));
  it('pausa de almoço configurada bloqueia', async () => {
    await db.query(`update expediente_semana set pausa_inicio = '12:00', pausa_fim = '13:00' where dia_semana = ${DOW}`);
    expect(await insAg('11:30')).toMatch(/almoço/);
  });
  it('excluir serviço mantém o agendamento (on delete set null)', async () => {
    await insAg('10:00');
    await db.query('delete from servicos where id = $1', [corte]);
    const { rows } = await db.query<{ servico_id: string | null }>('select servico_id from agendamentos');
    expect(rows).toEqual([{ servico_id: null }]);
  });
});

describe('BUG-05 · o banco também recusa data passada (US-02 AC2)', () => {
  it('insert ativo com data passada é recusado', async () => {
    expect(await insAg('10:00', '2020-01-01')).toMatch(/já passou/);
  });
  it('cancelar / "não compareceu" de um agendamento que já passou continua permitido (a regra só vale no insert)', async () => {
    // Histórico entra com status diferente de ativo; mudar de status depois não pode ser barrado.
    expect(await insAg('10:00', '2020-01-01', 'noshow')).toBe('');
    expect(await erro(`update agendamentos set status = 'cancelado'`)).toBe('');
  });
});

describe('Aula 05 · limite de antecedência (padrão 30 dias, configurável)', () => {
  const dias = (n: number) => iso(addDias(new Date(), n));
  const diaAbertoApos = (n: number) => proximoDiaAberto(n);

  it('configuração padrão é 30 dias', async () => {
    const { rows } = await db.query('select antecedencia_max_dias from configuracao where id = 1');
    expect(rows).toEqual([{ antecedencia_max_dias: 30 }]);
  });
  it('além de 30 dias é recusado', async () => {
    expect(await insAg('10:00', dias(31))).toMatch(/até 30 dias/);
  });
  it('dentro de 30 dias é aceito', async () => {
    expect(await insAg('10:00', diaAbertoApos(29))).toBe('');
  });
  it('a proprietária aumenta o limite para 60 e passa a valer', async () => {
    await db.query('update configuracao set antecedencia_max_dias = 60 where id = 1');
    expect(await insAg('10:00', diaAbertoApos(45))).toBe('');
    expect(await insAg('10:00', dias(61))).toMatch(/até 60 dias/);
  });
  it('limite fora de 1–365 é rejeitado pela constraint', async () => {
    expect(await erro('update configuracao set antecedencia_max_dias = 0')).toMatch(/antecedencia_max_dias_check/);
    expect(await erro('update configuracao set antecedencia_max_dias = 400')).toMatch(/antecedencia_max_dias_check/);
  });
});
