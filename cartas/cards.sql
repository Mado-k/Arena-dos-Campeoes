CREATE DATABASE IF NOT EXISTS arena_campeoes
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE arena_campeoes;

CREATE TABLE IF NOT EXISTS cartas (
    numero     INT AUTO_INCREMENT PRIMARY KEY,
    codigo     VARCHAR(10) UNIQUE,
    nome       VARCHAR(60) NOT NULL,
    elemento   VARCHAR(30),
    classe     VARCHAR(30) NOT NULL,
    universo   VARCHAR(30),
    origem     VARCHAR(30),
    dano       INT NULL,
    vida       INT NULL,
    habilidade TEXT,
    imagem     VARCHAR(255)
);
