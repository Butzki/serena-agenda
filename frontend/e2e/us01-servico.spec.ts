// US-01 · Cadastrar serviço — 1 AC = pelo menos 1 caso positivo + 1 negativo.
// IDs (CT-01..CT-12) são os mesmos da tabela em docs/05-testes-validacao.md § 3.
import { expect, test } from '@playwright/test';
import { criarServicoPelaTela, resetarBanco, sql } from './support/helpers';

test.beforeEach(async () => resetarBanco());

test.describe('US-01 · Cadastrar serviço', () => {
  test('CT-01 · AC1 · nome com 3+ caracteres salva com sucesso', async ({ page }) => {
    await criarServicoPelaTela(page, 'Pés', '30', '2500');
    await expect(page).toHaveURL(/\/servicos$/);
    await expect(page.getByRole('status')).toHaveText('Serviço salvo.');
  });

  test('CT-02 · AC1 · nome com 2 caracteres (ou 2 + espaço) bloqueia com erro', async ({ page }) => {
    await criarServicoPelaTela(page, 'Pé ', '30', '2500'); // espaços nas pontas não contam
    await expect(page.getByText('O nome precisa ter pelo menos 3 letras.')).toBeVisible();
    await expect(page.getByLabel('Nome do serviço')).toHaveAttribute('aria-invalid', 'true');
    expect(await sql(`select 1 from servicos where nome = 'Pé'`)).toHaveLength(0);
  });

  test('CT-03 · AC1 · duração nos limites (10 e 480) salva', async ({ page }) => {
    await criarServicoPelaTela(page, 'Retoque', '10', '1000');
    await expect(page).toHaveURL(/\/servicos$/);
    await criarServicoPelaTela(page, 'Dia da noiva', '480', '90000');
    await expect(page).toHaveURL(/\/servicos$/);
  });

  test('CT-04 · AC1 · duração 5 ou 500 bloqueia com erro de faixa', async ({ page }) => {
    for (const d of ['5', '500']) {
      await criarServicoPelaTela(page, 'Escova longa', d, '5000');
      await expect(page.getByText('Informe a duração em minutos inteiros, de 10 a 480.')).toBeVisible();
    }
    expect(await sql(`select 1 from servicos where nome = 'Escova longa'`)).toHaveLength(0);
  });

  test('CT-05 · AC2 · duração aceita apenas inteiros (letras, sinal e vírgula são descartados)', async ({ page }) => {
    await page.goto('/servicos/novo');
    const duracao = page.getByLabel('Duração (min)');
    await duracao.fill('-4,5a');
    await expect(duracao).toHaveValue('45');
  });

  test('CT-06 · AC3 · preço formatado em R$ ao digitar', async ({ page }) => {
    await page.goto('/servicos/novo');
    const preco = page.getByLabel('Preço');
    await preco.fill('125000');
    await expect(preco).toHaveValue(/R\$\s1\.250,00/);
  });

  test('CT-07 · AC1/AC3 · preço R$ 0,01 salva; R$ 0,00 bloqueia', async ({ page }) => {
    await criarServicoPelaTela(page, 'Grátis', '30', '0');
    await expect(page.getByText('Informe um preço maior que R$ 0,00.')).toBeVisible();
    await criarServicoPelaTela(page, 'Simbólico', '30', '1');
    await expect(page).toHaveURL(/\/servicos$/);
    expect(await sql(`select preco from servicos where nome = 'Simbólico'`)).toEqual([{ preco: '0.01' }]);
  });

  test('CT-08 · AC4 · após salvar, o serviço aparece na lista em menos de 1 s', async ({ page }) => {
    await page.goto('/servicos/novo');
    await page.getByLabel('Nome do serviço').fill('Hidratação');
    await page.getByLabel('Duração (min)').fill('45');
    await page.getByLabel('Preço').fill('6000');
    const inicio = Date.now();
    await page.getByRole('button', { name: 'Salvar serviço' }).click();
    await expect(page.getByRole('list', { name: 'Serviços cadastrados' }).getByText('Hidratação')).toBeVisible();
    const ms = Date.now() - inicio;
    test.info().annotations.push({ type: 'tempo-ac4', description: `${ms} ms` });
    expect(ms).toBeLessThan(1000);
  });

  test('CT-09 · AC5 · cancelar descarta os dados, nada é persistido', async ({ page }) => {
    await page.goto('/servicos/novo');
    await page.getByLabel('Nome do serviço').fill('Luzes');
    await page.getByLabel('Duração (min)').fill('120');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page).toHaveURL(/\/servicos$/);
    await expect(page.getByText('Luzes')).toHaveCount(0);
    expect(await sql(`select 1 from servicos where nome = 'Luzes'`)).toHaveLength(0);
  });

  test('CT-10 · AC6 · erro de rede no salvar mostra mensagem amigável e mantém o formulário', async ({ page }) => {
    await page.route('**/rest/v1/servicos*', (r) => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue()));
    await criarServicoPelaTela(page, 'Progressiva', '180', '25000');
    await expect(page.getByRole('alert')).toHaveText('Não foi possível salvar. Verifique sua conexão e tente de novo.');
    await expect(page.getByLabel('Nome do serviço')).toHaveValue('Progressiva');
    await expect(page.getByLabel('Duração (min)')).toHaveValue('180');
    await expect(page.getByLabel('Preço')).toHaveValue(/250,00/);
  });

  test('CT-11 · RF03 · editar serviço altera o preço na lista', async ({ page }) => {
    await page.goto('/servicos');
    await page.getByRole('link', { name: 'Editar Escova' }).click();
    await page.getByLabel('Preço').fill('5500');
    await page.getByRole('button', { name: 'Salvar serviço' }).click();
    await expect(page.getByText(/30 min · R\$\s55,00/)).toBeVisible();
  });

  test('CT-12 · RF03 · excluir serviço exige confirmação e remove da lista', async ({ page }) => {
    await page.goto('/servicos');
    await page.getByRole('link', { name: 'Editar Manicure' }).click();
    await page.getByRole('button', { name: 'Excluir serviço' }).click();
    await expect(page.getByRole('dialog')).toContainText('Excluir "Manicure"?');
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page.getByRole('status')).toHaveText('Serviço excluído.');
    await expect(page.getByRole('list', { name: 'Serviços cadastrados' }).getByText('Manicure')).toHaveCount(0);
  });
});

// BUG-04 (corrigido na Aula 05): preço acima do limite do banco virava "verifique sua conexão".
test('BUG-04 · a máscara de preço para no limite do banco (R$ 99.999.999,99) e salva', async ({ page }) => {
  await resetarBanco();
  await criarServicoPelaTela(page, 'Pacote anual', '60', '999999999999'); // 12 dígitos: o excesso é descartado
  await expect(page.getByRole('status')).toHaveText('Serviço salvo.');
  expect(await sql(`select preco::text as preco from servicos where nome = 'Pacote anual'`)).toEqual([{ preco: '99999999.99' }]);
});

test('BUG-04 · erro de dado inválido vindo do banco não culpa a conexão', async ({ page }) => {
  await resetarBanco();
  await page.route('**/rest/v1/servicos*', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '22003', message: 'numeric field overflow' }) })
      : r.continue()
  );
  await criarServicoPelaTela(page, 'Pacote anual', '60', '5000');
  const alerta = page.getByRole('alert');
  await expect(alerta).toContainText('O banco recusou algum valor');
  await expect(alerta).not.toContainText('Verifique sua conexão');
});
