CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "perfil" VARCHAR(20) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Usuario_perfil_check"
        CHECK ("perfil" IN ('ATENDENTE', 'TECNICO'))
);

CREATE UNIQUE INDEX "Usuario_email_key"
ON "Usuario"("email");

CREATE INDEX "Usuario_nome_idx"
ON "Usuario"("nome");