-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."user" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR,
    "login" VARCHAR,
    "password" VARCHAR,

    CONSTRAINT "user_pk" PRIMARY KEY ("id")
);
