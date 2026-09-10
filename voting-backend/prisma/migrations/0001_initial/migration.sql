-- ============================================================
-- SQL Migration: 0001_initial
-- Description: Create initial schema for College Colors Voting
-- Database: PostgreSQL 14+
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Enum for Vote Status
CREATE TYPE "VoteStatus" AS ENUM ('active', 'ended');

-- 1. Table: universities
CREATE TABLE "universities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- 2. Table: colleges
CREATE TABLE "colleges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "fixed_entity_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "colleges_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "colleges_university_id_idx" ON "colleges"("university_id");

-- 3. Table: representatives
CREATE TABLE "representatives" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "phone_number" VARCHAR(20) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "representatives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "representatives_phone_number_key" ON "representatives"("phone_number");
CREATE INDEX "representatives_phone_number_idx" ON "representatives"("phone_number");

-- 4. Table: otp_codes
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "representative_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "otp_codes_representative_id_fkey" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "otp_codes_representative_id_idx" ON "otp_codes"("representative_id");

-- 5. Table: votes
CREATE TABLE "votes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "college_id" UUID NOT NULL,
    "representative_id" UUID NOT NULL,
    "fixed_entity_id" VARCHAR(100) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'active',
    "share_token" VARCHAR(64) NOT NULL DEFAULT uuid_generate_v4(),
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "votes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "votes_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_representative_id_fkey" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "votes_share_token_key" ON "votes"("share_token");
CREATE INDEX "votes_share_token_idx" ON "votes"("share_token");
CREATE INDEX "votes_college_id_idx" ON "votes"("college_id");
CREATE INDEX "votes_representative_id_idx" ON "votes"("representative_id");
CREATE INDEX "votes_status_idx" ON "votes"("status");

-- 6. Table: vote_colors
CREATE TABLE "vote_colors" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "vote_id" UUID NOT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "label" VARCHAR(100),
    CONSTRAINT "vote_colors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vote_colors_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "vote_colors_vote_id_idx" ON "vote_colors"("vote_id");

-- 7. Table: vote_choices
CREATE TABLE "vote_choices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "vote_id" UUID NOT NULL,
    "student_identifier" VARCHAR(255) NOT NULL,
    "selected_color_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vote_choices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vote_choices_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vote_choices_selected_color_id_fkey" FOREIGN KEY ("selected_color_id") REFERENCES "vote_colors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "vote_choices_vote_id_student_identifier_key" ON "vote_choices"("vote_id", "student_identifier");
CREATE INDEX "vote_choices_vote_id_idx" ON "vote_choices"("vote_id");
CREATE INDEX "vote_choices_selected_color_id_idx" ON "vote_choices"("selected_color_id");
