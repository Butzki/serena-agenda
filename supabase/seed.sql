-- Serena Agenda · Seed (Aula 03)
-- Rode depois do schema.sql. Insere os mesmos 3 serviços do protótipo
-- (prototipo/js/app.js), para cumprir o entregável "3 serviços inseridos no banco".

insert into servicos (nome, duracao_min, preco) values
  ('Corte feminino', 60, 80.00),
  ('Manicure', 40, 35.00),
  ('Escova', 30, 50.00);

-- v2 (docs/04-frontend.md § 5): exemplo de feriados fixos. Datas por ano — a
-- proprietária precisa adicionar os próximos (e os de ano variável, tipo
-- Carnaval) ela mesma pelo Table Editor; o app não calcula feriados móveis.
insert into feriados (data, motivo) values
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Ano Novo')
on conflict (data) do nothing;

-- v2 (docs/04-frontend.md § 5): expediente padrão por dia da semana, mesma
-- suposição 8h-20h já documentada no README/docs 02 (domingo fechado é a
-- única exceção com evidência indireta: a maioria dos salões não abre aos
-- domingos). Sem pausa de almoço por padrão — não há dado real do salão
-- sobre isso; a proprietária define pausa_inicio/pausa_fim quando confirmar.
insert into expediente_semana (dia_semana, fechado, hora_abre, hora_fecha) values
  (0, true,  null,    null),
  (1, false, '08:00', '20:00'),
  (2, false, '08:00', '20:00'),
  (3, false, '08:00', '20:00'),
  (4, false, '08:00', '20:00'),
  (5, false, '08:00', '20:00'),
  (6, false, '08:00', '20:00')
on conflict (dia_semana) do nothing;
