CREATE DATABASE IF NOT EXISTS arena_campeoes
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE arena_campeoes;

-- Toda carta tem ataque e defesa (0 quando a carta não tem valor).

CREATE TABLE IF NOT EXISTS cartas (
    numero     INT AUTO_INCREMENT PRIMARY KEY,
    codigo     VARCHAR(10) UNIQUE,      -- n001, D001... (opcional)
    nome       VARCHAR(60) NOT NULL,
    elemento   VARCHAR(30),             -- fogo, planta, água, vento...
    classe     VARCHAR(30) NOT NULL,    -- campeão, besta, item, arma, auxiliar, feitiço, representante
    universo   VARCHAR(30),
    origem     VARCHAR(30),
    ataque     INT NOT NULL DEFAULT 0,
    defesa     INT NOT NULL DEFAULT 0,
    habilidade TEXT,
    imagem     VARCHAR(255)             -- caminho do arquivo em /uploads
);