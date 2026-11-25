import { expect, type Page } from '@playwright/test';
export { proximoDiaAberto, proximoDomingo } from '../../tests/datas';

const API = 'http://localhost:54321';

/** Recria o banco de teste (schema + seed) antes de cada teste: isolamento total. */
export async function resetarBanco(seed = true) {
  const r = await fetch(`${API}/__reset${seed ? '' : '?seed=0'}`);
  expect(r.ok).toBeTruthy();
}

/** SQL direto no banco de teste, para preparar cenários e conferir persistência. */
export async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const r = await fetch(`${API}/__sql`, { method: 'POST', body: JSON.stringify({ sql: query }) });
  return r.json();
}

export async function criarServicoPelaTela(page: Page, nome: string, duracao: string, precoDigitos: string) {
  await page.goto('/servicos/novo');
  await page.getByLabel('Nome do serviço').fill(nome);
  await page.getByLabel('Duração (min)').fill(duracao);
  await page.getByLabel('Preço').fill(precoDigitos);
  await page.getByRole('button', { name: 'Salvar serviço' }).click();
}

export async function criarAgendamentoPelaTela(
  page: Page,
  { cliente, telefone = '49999990000', servico, data, hora }: { cliente: string; telefone?: string; servico?: string; data: string; hora: string }
) {
  await page.goto(`/agenda/novo?data=${data}`);
  await page.getByLabel('Nome da cliente').fill(cliente);
  await page.getByLabel('Telefone (WhatsApp)').fill(telefone);
  if (servico) await page.getByLabel('Serviço').selectOption({ label: servico });
  await page.getByLabel('Data').fill(data);
  await page.getByLabel('Hora').fill(hora);
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
}

/** Insere agendamento direto no banco (atalho de preparação, não é o que está sendo testado). */
export async function agendarNoBanco(cliente: string, servico: string, data: string, hora: string, status = 'ativo') {
  await sql(`insert into agendamentos (cliente_nome, cliente_telefone, servico_id, data, hora, status)
             select '${cliente}', '(49) 99999-0000', id, '${data}', '${hora}', '${status}' from servicos where nome = '${servico}'`);
}
