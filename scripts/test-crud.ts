import 'dotenv/config';
import { supabase } from '../lib/supabase.js';

// Aula 03 · Entregável "Teste CRUD completo": insere 3, lista, atualiza 1, exclui 1.
// Os 3 registros usam o prefixo "Teste CRUD" para não se confundir com os
// serviços reais inseridos por supabase/seed.sql. Depois de rodar, confira
// o resultado em Supabase > Table Editor > servicos (devem sobrar 2 linhas
// de teste: a atualizada e a que não foi tocada; uma terceira foi excluída).

async function main() {
  console.log('1) INSERT · criando 3 serviços de teste...');
  const { data: inseridos, error: erroInsert } = await supabase
    .from('servicos')
    .insert([
      { nome: 'Teste CRUD 1', duracao_min: 30, preco: 10 },
      { nome: 'Teste CRUD 2', duracao_min: 45, preco: 20 },
      { nome: 'Teste CRUD 3', duracao_min: 60, preco: 30 },
    ])
    .select();
  if (erroInsert) throw erroInsert;
  console.log(`   ok, ${inseridos.length} linhas criadas.`);

  console.log('2) LIST · listando serviços...');
  const { data: lista, error: erroList } = await supabase
    .from('servicos')
    .select('*')
    .order('criado_em', { ascending: false });
  if (erroList) throw erroList;
  console.log(`   ok, ${lista.length} serviços no total (seed + teste).`);

  const [primeiro, segundo, terceiro] = inseridos;

  console.log(`3) UPDATE · atualizando preço de "${primeiro.nome}"...`);
  const { error: erroUpdate } = await supabase
    .from('servicos')
    .update({ preco: 15 })
    .eq('id', primeiro.id);
  if (erroUpdate) throw erroUpdate;
  console.log('   ok.');

  console.log(`4) DELETE · excluindo "${terceiro.nome}"...`);
  const { error: erroDelete } = await supabase
    .from('servicos')
    .delete()
    .eq('id', terceiro.id);
  if (erroDelete) throw erroDelete;
  console.log('   ok.');

  console.log('\nFeito. Abra o Table Editor no Supabase e confira:');
  console.log(`  - "${primeiro.nome}" deve estar com preco = 15`);
  console.log(`  - "${segundo.nome}" deve continuar igual`);
  console.log(`  - "${terceiro.nome}" não deve mais existir`);
}

main().catch((erro) => {
  console.error('Falhou:', erro.message ?? erro);
  process.exit(1);
});
