// Testes funcionais das regras puras de horário (lib/horarios.ts).
// Cada `describe` aponta o RF / critério de aceite (AC) do README que cobre.
import { describe, expect, it } from 'vitest';
import {
  conflito,
  mascararPrecoCentavos,
  mascararTelefone,
  motivoConflito,
  motivoFechado,
  sugestoes,
} from '../../src/lib/horarios';
import type { AgendamentoComServico, ExpedienteDia, Feriado } from '../../src/lib/types';

const SEG_A_SAB_8_20: ExpedienteDia[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dia_semana: d,
  fechado: d === 0,
  hora_abre: d === 0 ? null : '08:00:00',
  hora_fecha: d === 0 ? null : '20:00:00',
  pausa_inicio: null,
  pausa_fim: null,
}));
const COM_ALMOCO = SEG_A_SAB_8_20.map((e) => (e.fechado ? e : { ...e, pausa_inicio: '12:00:00', pausa_fim: '13:00:00' }));
const FERIADOS: Feriado[] = [{ data: '2026-12-25', motivo: 'Natal' }];
const QUARTA = '2026-12-02';
const DOMINGO = '2026-12-06';

function ag(hora: string, duracao: number, status: AgendamentoComServico['status'] = 'ativo', id = hora): AgendamentoComServico {
  return {
    id,
    cliente_nome: 'Ana Lima',
    cliente_telefone: '(49) 99999-0000',
    servico_id: 's1',
    data: QUARTA,
    hora: `${hora}:00`,
    status,
    criado_em: '',
    servico: { id: 's1', nome: 'Corte feminino', duracao_min: duracao, preco: 80, criado_em: '' },
  };
}

describe('RF05 · US-03 · conflito de horário', () => {
  const dia = [ag('14:00', 60)];

  it('AC1 · bloqueia sobreposição parcial (14:30 sobre 14:00–15:00)', () => {
    expect(conflito(dia, '14:30', 30)?.cliente_nome).toBe('Ana Lima');
  });
  it('AC1 · bloqueia novo que começa antes e termina dentro (13:30 + 60 min)', () => {
    expect(conflito(dia, '13:30', 60)).toBeDefined();
  });
  it('AC1 · bloqueia novo que engloba o existente (13:00 + 180 min)', () => {
    expect(conflito(dia, '13:00', 180)).toBeDefined();
  });
  it('AC2 · permite consecutivo depois (15:00, quando o anterior termina às 15:00)', () => {
    expect(conflito(dia, '15:00', 30)).toBeUndefined();
  });
  it('AC2 · permite consecutivo antes (13:00 + 60 min termina às 14:00)', () => {
    expect(conflito(dia, '13:00', 60)).toBeUndefined();
  });
  it('AC3 · agendamento cancelado não gera conflito', () => {
    expect(conflito([ag('14:00', 60, 'cancelado')], '14:00', 60)).toBeUndefined();
  });
  it('US-05 · "não compareceu" não bloqueia o horário', () => {
    expect(conflito([ag('14:00', 60, 'noshow')], '14:00', 60)).toBeUndefined();
  });
  it('edição ignora o próprio agendamento (ignorarId)', () => {
    expect(conflito(dia, '14:00', 60, '14:00')).toBeUndefined();
  });
  it('serviço removido usa duração padrão de 30 min', () => {
    const semServico = { ...ag('14:00', 60), servico: null, servico_id: null };
    expect(conflito([semServico], '14:30', 30)).toBeUndefined();
    expect(conflito([semServico], '14:15', 30)).toBeDefined();
  });
});

describe('RF05 · calendário de funcionamento (v2)', () => {
  it('feriado fecha o dia com o motivo', () => {
    expect(motivoFechado('2026-12-25', FERIADOS, SEG_A_SAB_8_20)).toContain('Natal');
  });
  it('domingo fechado', () => {
    expect(motivoFechado(DOMINGO, FERIADOS, SEG_A_SAB_8_20)).toBe('O salão não abre aos domingos.');
  });
  it('dia útil aberto', () => {
    expect(motivoFechado(QUARTA, FERIADOS, SEG_A_SAB_8_20)).toBeNull();
  });
  it('sem expediente cadastrado = fechado (não assume 8h–20h)', () => {
    expect(motivoFechado(QUARTA, [], [])).not.toBeNull();
  });
  it('bloqueia início antes de abrir', () => {
    expect(motivoConflito([], QUARTA, '07:30', 30, FERIADOS, SEG_A_SAB_8_20)).toContain('Fora do horário');
  });
  it('bloqueia serviço que termina depois de fechar (19:30 + 60 min)', () => {
    expect(motivoConflito([], QUARTA, '19:30', 60, FERIADOS, SEG_A_SAB_8_20)).toContain('Fora do horário');
  });
  it('permite serviço que termina exatamente no fechamento (19:00 + 60 min)', () => {
    expect(motivoConflito([], QUARTA, '19:00', 60, FERIADOS, SEG_A_SAB_8_20)).toBeNull();
  });
  it('bloqueia horário que invade a pausa de almoço', () => {
    expect(motivoConflito([], QUARTA, '11:30', 60, FERIADOS, COM_ALMOCO)).toContain('almoço');
  });
  it('mensagem de conflito informa quem está no horário (AC1)', () => {
    expect(motivoConflito([ag('14:00', 60)], QUARTA, '14:30', 30, FERIADOS, SEG_A_SAB_8_20)).toContain('Ana Lima já está agendada às 14:00');
  });
});

describe('US-03 AC4 · sugestão de próximos horários livres', () => {
  it('sugere até 3 horários, pulando o ocupado', () => {
    expect(sugestoes([ag('14:00', 60)], QUARTA, '14:00', 60, FERIADOS, SEG_A_SAB_8_20)).toEqual(['15:00', '15:30', '16:00']);
  });
  it('não sugere nada que passe do fechamento', () => {
    expect(sugestoes([], QUARTA, '18:30', 60, FERIADOS, SEG_A_SAB_8_20)).toEqual(['19:00']);
  });
  it('não sugere nada em dia fechado', () => {
    expect(sugestoes([], DOMINGO, '10:00', 30, FERIADOS, SEG_A_SAB_8_20)).toEqual([]);
  });
});

describe('RF08 · máscaras de entrada', () => {
  it('telefone celular (11 dígitos)', () => {
    expect(mascararTelefone('49999990000')).toBe('(49) 99999-0000');
  });
  it('telefone fixo (10 dígitos)', () => {
    expect(mascararTelefone('4932220000')).toBe('(49) 3222-0000');
  });
  it('telefone ignora letras e corta em 11 dígitos', () => {
    expect(mascararTelefone('49a9999900001234')).toBe('(49) 99999-0000');
  });
  it('US-01 AC3 · preço formatado em R$ ao digitar (centavos)', () => {
    expect(mascararPrecoCentavos('125000').replace(/\s/g, ' ')).toBe('R$ 1.250,00');
  });
  it('US-01 AC3 · R$ 0,01', () => {
    expect(mascararPrecoCentavos('1').replace(/\s/g, ' ')).toBe('R$ 0,01');
  });
});
