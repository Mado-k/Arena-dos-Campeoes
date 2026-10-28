-- Para quem já tem a tabela "cartas" com as colunas antigas (dano e vida).
-- Renomeia para ataque/defesa e garante que nenhuma carta fique sem valor.
-- Rode uma única vez:  sudo mysql arena_campeoes < migracao-ataque-defesa.sql
USE arena_campeoes;

UPDATE cartas SET dano = 0 WHERE dano IS NULL;
UPDATE cartas SET vida = 0 WHERE vida IS NULL;

ALTER TABLE cartas
    CHANGE dano ataque INT NOT NULL DEFAULT 0,
    CHANGE vida defesa INT NOT NULL DEFAULT 0;