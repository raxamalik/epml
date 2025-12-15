-- Migration: Add password_reset_tokens table
-- Description: Stores password reset tokens for users and companies

CREATE TABLE "password_reset_tokens" (
  "id"           integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "email"        varchar(255) NOT NULL,
  "reset_token"  varchar(255) NOT NULL UNIQUE,
  "user_type"    varchar(20)  NOT NULL, -- 'user' or 'company'
  "expires_at"   timestamp    NOT NULL,
  "is_used"      boolean      DEFAULT false,
  "used_at"      timestamp,
  "created_at"   timestamp    DEFAULT now()
);

CREATE INDEX "IDX_password_reset_token"
  ON "password_reset_tokens" ("reset_token");

CREATE INDEX "IDX_password_reset_email"
  ON "password_reset_tokens" ("email");

CREATE INDEX "IDX_password_reset_expires"
  ON "password_reset_tokens" ("expires_at");


