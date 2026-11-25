-- Preserva todos os registros existentes como ativos.
ALTER TABLE "Cliente" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Equipamento" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
