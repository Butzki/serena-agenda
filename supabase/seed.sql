-- Serena Agenda · Seed (Aula 03)
-- Rode depois do schema.sql. Insere os mesmos 3 serviços do protótipo
-- (prototipo/js/app.js), para cumprir o entregável "3 serviços inseridos no banco".

insert into servicos (nome, duracao_min, preco) values
  ('Corte feminino', 60, 80.00),
  ('Manicure', 40, 35.00),
  ('Escova', 30, 50.00);
