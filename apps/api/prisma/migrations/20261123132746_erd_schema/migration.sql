-- PawCare ERD schema (docs/design/erd-and-flows.md + docs/design/erd-review.md fixes).
-- Prisma generated the tables, enums, indexes and FKs from schema.prisma. The sections marked
-- "Hand-written" are not expressible in Prisma and must be kept when the schema changes.

-- =============================================================================================
-- Hand-written: UUIDv7 primary keys (D-ERD-4)
-- =============================================================================================
-- RFC 9562 UUIDv7: 48-bit Unix milliseconds, then 12 bits of sub-millisecond time (so IDs made
-- one after another sort in creation order), then random bits. PostgreSQL 18 ships a built-in
-- uuidv7() in pg_catalog, which takes precedence over this one; this can be dropped after
-- upgrading.
CREATE FUNCTION uuidv7() RETURNS uuid
LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS $$
DECLARE
  now_ms numeric := extract(epoch FROM clock_timestamp()) * 1000;
  unix_ms bigint := floor(now_ms);
  sub_ms int := floor((now_ms - unix_ms) * 4096);
  bytes bytea := uuid_send(gen_random_uuid()); -- random bits; variant bits already RFC 9562
BEGIN
  bytes := overlay(bytes PLACING substring(int8send(unix_ms) FROM 3) FROM 1 FOR 6);
  bytes := set_byte(bytes, 6, (7 << 4) | (sub_ms >> 8)); -- version 7 + high 4 bits of sub_ms
  bytes := set_byte(bytes, 7, sub_ms & 255);
  RETURN encode(bytes, 'hex')::uuid;
END
$$;

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'DELETION_REQUESTED');

-- CreateEnum
CREATE TYPE "file_purpose" AS ENUM ('ATTACHMENT', 'PET_PHOTO', 'OWNER_AVATAR');

-- CreateEnum
CREATE TYPE "scan_status" AS ENUM ('PENDING_UPLOAD', 'SCANNING', 'CLEAN', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "species" AS ENUM ('DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "care_record_kind" AS ENUM ('MEDICAL', 'VACCINE', 'PRESCRIPTION', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "care_record_status" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "provenance" AS ENUM ('OWNER_ENTERED');

-- CreateEnum
CREATE TYPE "medical_event_type" AS ENUM ('VISIT', 'DIAGNOSIS', 'PROCEDURE', 'ALLERGY', 'GENERAL_NOTE');

-- CreateEnum
CREATE TYPE "schedule_mode" AS ENUM ('FIXED_DAILY', 'AS_NEEDED', 'MANUAL');

-- CreateEnum
CREATE TYPE "dose_log_status" AS ENUM ('TAKEN', 'SKIPPED');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELED', 'MISSED');

-- CreateEnum
CREATE TYPE "inventory_category" AS ENUM ('FOOD', 'MEDICATION', 'SUPPLEMENT', 'SUPPLY');

-- CreateEnum
CREATE TYPE "inventory_unit" AS ENUM ('PIECE', 'TABLET', 'CAPSULE', 'SACHET', 'GRAM', 'MILLILITER');

-- CreateEnum
CREATE TYPE "stock_transaction_type" AS ENUM ('OPENING', 'RESTOCK', 'USE', 'DISPOSE', 'ADJUST', 'REVERSE');

-- CreateEnum
CREATE TYPE "inventory_alert_type" AS ENUM ('LOW_STOCK', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "recurrence" AS ENUM ('NONE', 'DAILY');

-- CreateEnum
CREATE TYPE "reminder_occurrence_state" AS ENUM ('PENDING', 'AVAILABLE', 'CANCELED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "push_delivery_state" AS ENUM ('PENDING', 'ACCEPTED', 'RETRY', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "idempotency_state" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "outbox_state" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "deletion_job_state" AS ENUM ('REQUESTED', 'RUNNING', 'FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "owners" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "auth_subject" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "phone" TEXT,
    "time_zone" TEXT NOT NULL,
    "avatar_asset_id" UUID,
    "account_status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "purpose" "file_purpose" NOT NULL,
    "scan_status" "scan_status" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "removed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" "species" NOT NULL,
    "species_other" TEXT,
    "breed" TEXT,
    "sex" "sex" NOT NULL DEFAULT 'UNKNOWN',
    "birth_date" DATE,
    "birth_date_estimated" BOOLEAN NOT NULL DEFAULT false,
    "current_weight_kg" DECIMAL(7,3),
    "weight_measured_on" DATE,
    "microchip" TEXT,
    "photo_asset_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_records" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "kind" "care_record_kind" NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "status" "care_record_status" NOT NULL DEFAULT 'ACTIVE',
    "provenance" "provenance" NOT NULL DEFAULT 'OWNER_ENTERED',
    "void_reason" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "care_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_events" (
    "record_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "kind" "care_record_kind" NOT NULL DEFAULT 'MEDICAL',
    "appointment_id" UUID,
    "event_type" "medical_event_type" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "provider_name" TEXT,

    CONSTRAINT "medical_events_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "record_kind" "care_record_kind" NOT NULL,
    "file_asset_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccinations" (
    "record_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "kind" "care_record_kind" NOT NULL DEFAULT 'VACCINE',
    "vaccine_name" TEXT NOT NULL,
    "administered_on" DATE NOT NULL,
    "provider_name" TEXT,
    "batch_label" TEXT,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "vaccine_due_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "vaccination_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "fulfilled_by_vaccination_id" UUID,
    "schedule_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vaccine_due_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "record_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "kind" "care_record_kind" NOT NULL DEFAULT 'PRESCRIPTION',
    "medication_name" TEXT NOT NULL,
    "dose_instructions" TEXT NOT NULL,
    "prescriber_name" TEXT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "schedule_mode" "schedule_mode" NOT NULL,
    "time_zone" TEXT NOT NULL,
    "follows_owner_zone" BOOLEAN NOT NULL DEFAULT true,
    "inventory_item_id" UUID,
    "stopped_at" TIMESTAMPTZ(3),
    "schedule_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "prescription_times" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "local_time" TIME(0) NOT NULL,

    CONSTRAINT "prescription_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dose_occurrences" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "scheduled_at_utc" TIMESTAMPTZ(3) NOT NULL,
    "schedule_version" INTEGER NOT NULL,
    "invalidated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dose_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dose_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "dose_occurrence_id" UUID NOT NULL,
    "status" "dose_log_status" NOT NULL,
    "acted_at" TIMESTAMPTZ(3) NOT NULL,
    "actor_owner_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "dose_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "record_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "kind" "care_record_kind" NOT NULL DEFAULT 'APPOINTMENT',
    "title" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "provider_contact" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "starts_at_utc" TIMESTAMPTZ(3) NOT NULL,
    "ends_at_utc" TIMESTAMPTZ(3) NOT NULL,
    "time_zone" TEXT NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'PLANNED',
    "cancel_reason" TEXT,
    "outcome_recorded_at" TIMESTAMPTZ(3),
    "outcome_actor_id" UUID,
    "schedule_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "inventory_category" NOT NULL,
    "unit" "inventory_unit" NOT NULL,
    "low_stock_threshold" DECIMAL(12,3),
    "expiry_lead_days" INTEGER NOT NULL DEFAULT 7,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_pets" (
    "owner_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pets_pkey" PRIMARY KEY ("item_id","pet_id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_label" TEXT,
    "expires_on" DATE,
    "remaining_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" "stock_transaction_type" NOT NULL,
    "reason" TEXT,
    "pet_id" UUID,
    "prescription_id" UUID,
    "reverses_transaction_id" UUID,
    "request_key" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "transaction_type" "stock_transaction_type" NOT NULL,
    "batch_id" UUID NOT NULL,
    "signed_quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_alerts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_id" UUID,
    "type" "inventory_alert_type" NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_preferences" (
    "owner_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "appointment_lead_minutes" INTEGER NOT NULL DEFAULT 1440,
    "vaccine_lead_days" INTEGER NOT NULL DEFAULT 7,
    "date_only_delivery_time" TIME(0) NOT NULL DEFAULT '09:00:00'::time,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reminder_preferences_pkey" PRIMARY KEY ("owner_id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "device_platform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_reminders" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at_local" TIMESTAMP(0) NOT NULL,
    "time_zone" TEXT NOT NULL,
    "recurrence" "recurrence" NOT NULL DEFAULT 'NONE',
    "ends_on" DATE,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "custom_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "care_record_id" UUID,
    "care_record_kind" "care_record_kind",
    "custom_reminder_id" UUID,
    "inventory_alert_id" UUID,
    "schedule_version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "suppressed_by_archive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_occurrences" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "schedule_version" INTEGER NOT NULL,
    "occurrence_key" TEXT NOT NULL,
    "dose_occurrence_id" UUID,
    "trigger_at_utc" TIMESTAMPTZ(3) NOT NULL,
    "state" "reminder_occurrence_state" NOT NULL DEFAULT 'PENDING',
    "available_at" TIMESTAMPTZ(3),
    "read_at" TIMESTAMPTZ(3),
    "dismissed_at" TIMESTAMPTZ(3),
    "custom_done_at" TIMESTAMPTZ(3),
    "snoozed_from_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_deliveries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "reminder_occurrence_id" UUID NOT NULL,
    "device_token_id" UUID NOT NULL,
    "state" "push_delivery_state" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "provider_message_id" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "request_key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "state" "idempotency_state" NOT NULL DEFAULT 'IN_PROGRESS',
    "result_reference" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_owner_id" UUID,
    "action" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "state" "outbox_state" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_jobs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID,
    "state" "deletion_job_state" NOT NULL DEFAULT 'REQUESTED',
    "completed_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owners_auth_subject_key" ON "owners"("auth_subject");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_object_key_key" ON "file_assets"("object_key");

-- CreateIndex
CREATE INDEX "file_assets_scan_status_created_at_idx" ON "file_assets"("scan_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_owner_id_id_key" ON "file_assets"("owner_id", "id");

-- CreateIndex
CREATE INDEX "pets_owner_id_archived_at_idx" ON "pets"("owner_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "pets_owner_id_id_key" ON "pets"("owner_id", "id");

-- CreateIndex
CREATE INDEX "care_records_owner_id_pet_id_occurrence_date_id_idx" ON "care_records"("owner_id", "pet_id", "occurrence_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "care_records_owner_id_id_kind_key" ON "care_records"("owner_id", "id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "care_records_owner_id_pet_id_id_kind_key" ON "care_records"("owner_id", "pet_id", "id", "kind");

-- CreateIndex
CREATE INDEX "medical_events_owner_id_pet_id_appointment_id_idx" ON "medical_events"("owner_id", "pet_id", "appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_events_owner_id_pet_id_record_id_kind_key" ON "medical_events"("owner_id", "pet_id", "record_id", "kind");

-- CreateIndex
CREATE INDEX "attachments_owner_id_record_id_idx" ON "attachments"("owner_id", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_owner_id_file_asset_id_key" ON "attachments"("owner_id", "file_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "vaccinations_owner_id_pet_id_record_id_kind_key" ON "vaccinations"("owner_id", "pet_id", "record_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "vaccinations_owner_id_pet_id_record_id_key" ON "vaccinations"("owner_id", "pet_id", "record_id");

-- CreateIndex
CREATE INDEX "vaccine_due_items_owner_id_due_on_idx" ON "vaccine_due_items"("owner_id", "due_on");

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_due_items_owner_id_pet_id_vaccination_id_key" ON "vaccine_due_items"("owner_id", "pet_id", "vaccination_id");

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_due_items_fulfilled_by_vaccination_id_key" ON "vaccine_due_items"("owner_id", "pet_id", "fulfilled_by_vaccination_id");

-- CreateIndex
CREATE INDEX "prescriptions_owner_id_inventory_item_id_idx" ON "prescriptions"("owner_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_owner_id_pet_id_record_id_kind_key" ON "prescriptions"("owner_id", "pet_id", "record_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_owner_id_record_id_key" ON "prescriptions"("owner_id", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_times_prescription_id_local_time_key" ON "prescription_times"("prescription_id", "local_time");

-- CreateIndex
CREATE INDEX "dose_occurrences_owner_id_scheduled_at_utc_idx" ON "dose_occurrences"("owner_id", "scheduled_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX "dose_occurrences_owner_id_id_key" ON "dose_occurrences"("owner_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "dose_occurrences_schedule_version_scheduled_at_utc_key" ON "dose_occurrences"("prescription_id", "schedule_version", "scheduled_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX "dose_occurrences_one_valid_per_instant_key" ON "dose_occurrences"("prescription_id", "scheduled_at_utc") WHERE (invalidated_at IS NULL);

-- CreateIndex
CREATE INDEX "dose_logs_actor_owner_id_idx" ON "dose_logs"("actor_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "dose_logs_owner_id_dose_occurrence_id_key" ON "dose_logs"("owner_id", "dose_occurrence_id");

-- CreateIndex
CREATE INDEX "appointments_owner_id_starts_at_utc_record_id_idx" ON "appointments"("owner_id", "starts_at_utc", "record_id");

-- CreateIndex
CREATE INDEX "appointments_owner_id_pet_id_status_starts_at_utc_idx" ON "appointments"("owner_id", "pet_id", "status", "starts_at_utc");

-- CreateIndex
CREATE INDEX "appointments_outcome_actor_id_idx" ON "appointments"("outcome_actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_owner_id_pet_id_record_id_kind_key" ON "appointments"("owner_id", "pet_id", "record_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_owner_id_pet_id_record_id_key" ON "appointments"("owner_id", "pet_id", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_owner_id_id_key" ON "inventory_items"("owner_id", "id");

-- CreateIndex
CREATE INDEX "inventory_pets_owner_id_pet_id_idx" ON "inventory_pets"("owner_id", "pet_id");

-- CreateIndex
CREATE INDEX "stock_batches_item_id_expires_on_idx" ON "stock_batches"("item_id", "expires_on");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_owner_id_item_id_id_key" ON "stock_batches"("owner_id", "item_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_reverses_transaction_id_key" ON "stock_transactions"("reverses_transaction_id");

-- CreateIndex
CREATE INDEX "stock_transactions_item_id_recorded_at_idx" ON "stock_transactions"("item_id", "recorded_at");

-- CreateIndex
CREATE INDEX "stock_transactions_owner_id_pet_id_idx" ON "stock_transactions"("owner_id", "pet_id");

-- CreateIndex
CREATE INDEX "stock_transactions_owner_id_prescription_id_idx" ON "stock_transactions"("owner_id", "prescription_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_owner_id_request_key_key" ON "stock_transactions"("owner_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_owner_id_item_id_id_key" ON "stock_transactions"("owner_id", "item_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_owner_id_item_id_id_type_key" ON "stock_transactions"("owner_id", "item_id", "id", "type");

-- CreateIndex
CREATE INDEX "stock_entries_batch_id_idx" ON "stock_entries"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_entries_transaction_id_batch_id_key" ON "stock_entries"("transaction_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_owner_id_id_key" ON "inventory_alerts"("owner_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_batch_id_type_key" ON "inventory_alerts"("batch_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_one_open_low_stock_key" ON "inventory_alerts"("item_id") WHERE (type = 'LOW_STOCK' AND resolved_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_low_stock_episode_key" ON "inventory_alerts"("item_id", "episode_number") WHERE (type = 'LOW_STOCK');

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_owner_id_id_key" ON "device_tokens"("owner_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_one_enabled_token_key" ON "device_tokens"("token") WHERE (enabled);

-- CreateIndex
CREATE UNIQUE INDEX "custom_reminders_owner_id_id_key" ON "custom_reminders"("owner_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_care_record_id_key" ON "reminder_schedules"("care_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_custom_reminder_id_key" ON "reminder_schedules"("custom_reminder_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_inventory_alert_id_key" ON "reminder_schedules"("inventory_alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_owner_id_id_key" ON "reminder_schedules"("owner_id", "id");

-- CreateIndex
CREATE INDEX "reminder_occurrences_state_trigger_at_utc_idx" ON "reminder_occurrences"("state", "trigger_at_utc");

-- CreateIndex
CREATE INDEX "reminder_occurrences_owner_id_trigger_at_utc_id_idx" ON "reminder_occurrences"("owner_id", "trigger_at_utc", "id");

-- CreateIndex
CREATE INDEX "reminder_occurrences_owner_id_dose_occurrence_id_idx" ON "reminder_occurrences"("owner_id", "dose_occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_occurrences_owner_id_id_key" ON "reminder_occurrences"("owner_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_occurrences_owner_id_snoozed_from_id_key" ON "reminder_occurrences"("owner_id", "snoozed_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_occurrences_occurrence_key_key" ON "reminder_occurrences"("schedule_id", "schedule_version", "occurrence_key");

-- CreateIndex
CREATE INDEX "push_deliveries_state_next_attempt_at_idx" ON "push_deliveries"("state", "next_attempt_at");

-- CreateIndex
CREATE INDEX "push_deliveries_owner_id_device_token_id_idx" ON "push_deliveries"("owner_id", "device_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_deliveries_reminder_occurrence_id_device_token_id_key" ON "push_deliveries"("reminder_occurrence_id", "device_token_id");

-- CreateIndex
CREATE INDEX "idempotency_requests_expires_at_idx" ON "idempotency_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_requests_owner_id_operation_request_key_key" ON "idempotency_requests"("owner_id", "operation", "request_key");

-- CreateIndex
CREATE INDEX "audit_events_actor_owner_id_occurred_at_idx" ON "audit_events"("actor_owner_id", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_state_next_attempt_at_idx" ON "outbox_events"("state", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_owner_id_idx" ON "outbox_events"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "deletion_jobs_one_open_per_owner_key" ON "deletion_jobs"("owner_id") WHERE (state <> 'COMPLETED');

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_id_avatar_asset_id_fkey" FOREIGN KEY ("id", "avatar_asset_id") REFERENCES "file_assets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_photo_asset_id_fkey" FOREIGN KEY ("owner_id", "photo_asset_id") REFERENCES "file_assets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_owner_id_pet_id_fkey" FOREIGN KEY ("owner_id", "pet_id") REFERENCES "pets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_owner_id_pet_id_record_id_kind_fkey" FOREIGN KEY ("owner_id", "pet_id", "record_id", "kind") REFERENCES "care_records"("owner_id", "pet_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_owner_id_pet_id_appointment_id_fkey" FOREIGN KEY ("owner_id", "pet_id", "appointment_id") REFERENCES "appointments"("owner_id", "pet_id", "record_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_id_record_id_record_kind_fkey" FOREIGN KEY ("owner_id", "record_id", "record_kind") REFERENCES "care_records"("owner_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_id_file_asset_id_fkey" FOREIGN KEY ("owner_id", "file_asset_id") REFERENCES "file_assets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_owner_id_pet_id_record_id_kind_fkey" FOREIGN KEY ("owner_id", "pet_id", "record_id", "kind") REFERENCES "care_records"("owner_id", "pet_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vaccine_due_items" ADD CONSTRAINT "vaccine_due_items_vaccination_id_fkey" FOREIGN KEY ("owner_id", "pet_id", "vaccination_id") REFERENCES "vaccinations"("owner_id", "pet_id", "record_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vaccine_due_items" ADD CONSTRAINT "vaccine_due_items_fulfilled_by_vaccination_id_fkey" FOREIGN KEY ("owner_id", "pet_id", "fulfilled_by_vaccination_id") REFERENCES "vaccinations"("owner_id", "pet_id", "record_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_owner_id_pet_id_record_id_kind_fkey" FOREIGN KEY ("owner_id", "pet_id", "record_id", "kind") REFERENCES "care_records"("owner_id", "pet_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_owner_id_inventory_item_id_fkey" FOREIGN KEY ("owner_id", "inventory_item_id") REFERENCES "inventory_items"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "prescription_times" ADD CONSTRAINT "prescription_times_owner_id_prescription_id_fkey" FOREIGN KEY ("owner_id", "prescription_id") REFERENCES "prescriptions"("owner_id", "record_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dose_occurrences" ADD CONSTRAINT "dose_occurrences_owner_id_prescription_id_fkey" FOREIGN KEY ("owner_id", "prescription_id") REFERENCES "prescriptions"("owner_id", "record_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_owner_id_dose_occurrence_id_fkey" FOREIGN KEY ("owner_id", "dose_occurrence_id") REFERENCES "dose_occurrences"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_actor_owner_id_fkey" FOREIGN KEY ("actor_owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_owner_id_pet_id_record_id_kind_fkey" FOREIGN KEY ("owner_id", "pet_id", "record_id", "kind") REFERENCES "care_records"("owner_id", "pet_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_outcome_actor_id_fkey" FOREIGN KEY ("outcome_actor_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_pets" ADD CONSTRAINT "inventory_pets_owner_id_item_id_fkey" FOREIGN KEY ("owner_id", "item_id") REFERENCES "inventory_items"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_pets" ADD CONSTRAINT "inventory_pets_owner_id_pet_id_fkey" FOREIGN KEY ("owner_id", "pet_id") REFERENCES "pets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_owner_id_item_id_fkey" FOREIGN KEY ("owner_id", "item_id") REFERENCES "inventory_items"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_owner_id_item_id_fkey" FOREIGN KEY ("owner_id", "item_id") REFERENCES "inventory_items"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_owner_id_pet_id_fkey" FOREIGN KEY ("owner_id", "pet_id") REFERENCES "pets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_owner_id_prescription_id_fkey" FOREIGN KEY ("owner_id", "prescription_id") REFERENCES "prescriptions"("owner_id", "record_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("owner_id", "item_id", "reverses_transaction_id") REFERENCES "stock_transactions"("owner_id", "item_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_transaction_id_fkey" FOREIGN KEY ("owner_id", "item_id", "transaction_id", "transaction_type") REFERENCES "stock_transactions"("owner_id", "item_id", "id", "type") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_owner_id_item_id_batch_id_fkey" FOREIGN KEY ("owner_id", "item_id", "batch_id") REFERENCES "stock_batches"("owner_id", "item_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_owner_id_item_id_fkey" FOREIGN KEY ("owner_id", "item_id") REFERENCES "inventory_items"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_owner_id_item_id_batch_id_fkey" FOREIGN KEY ("owner_id", "item_id", "batch_id") REFERENCES "stock_batches"("owner_id", "item_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_preferences" ADD CONSTRAINT "reminder_preferences_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "custom_reminders" ADD CONSTRAINT "custom_reminders_owner_id_pet_id_fkey" FOREIGN KEY ("owner_id", "pet_id") REFERENCES "pets"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_care_record_id_fkey" FOREIGN KEY ("owner_id", "care_record_id", "care_record_kind") REFERENCES "care_records"("owner_id", "id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_owner_id_custom_reminder_id_fkey" FOREIGN KEY ("owner_id", "custom_reminder_id") REFERENCES "custom_reminders"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_owner_id_inventory_alert_id_fkey" FOREIGN KEY ("owner_id", "inventory_alert_id") REFERENCES "inventory_alerts"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_owner_id_schedule_id_fkey" FOREIGN KEY ("owner_id", "schedule_id") REFERENCES "reminder_schedules"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_owner_id_dose_occurrence_id_fkey" FOREIGN KEY ("owner_id", "dose_occurrence_id") REFERENCES "dose_occurrences"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_owner_id_snoozed_from_id_fkey" FOREIGN KEY ("owner_id", "snoozed_from_id") REFERENCES "reminder_occurrences"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_owner_id_reminder_occurrence_id_fkey" FOREIGN KEY ("owner_id", "reminder_occurrence_id") REFERENCES "reminder_occurrences"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_owner_id_device_token_id_fkey" FOREIGN KEY ("owner_id", "device_token_id") REFERENCES "device_tokens"("owner_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "idempotency_requests" ADD CONSTRAINT "idempotency_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_owner_id_fkey" FOREIGN KEY ("actor_owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deletion_jobs" ADD CONSTRAINT "deletion_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- =============================================================================================
-- Hand-written: CHECK constraints
-- =============================================================================================
-- Text columns are unbounded TEXT; lengths live here so violations are named CHECK errors.
-- "Trimmed" limits reject blank input; the API trims before saving.

-- 1. Ownership and health records ------------------------------------------------------------
ALTER TABLE "owners"
  ADD CONSTRAINT "owners_auth_subject_check" CHECK (char_length(auth_subject) BETWEEN 1 AND 255),
  ADD CONSTRAINT "owners_display_name_check"
    CHECK (char_length(btrim(display_name)) >= 1 AND char_length(display_name) <= 100),
  ADD CONSTRAINT "owners_phone_check" CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 30),
  ADD CONSTRAINT "owners_time_zone_check" CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  ADD CONSTRAINT "owners_version_check" CHECK (version >= 1);

ALTER TABLE "file_assets"
  ADD CONSTRAINT "file_assets_object_key_check" CHECK (char_length(object_key) BETWEEN 1 AND 512),
  ADD CONSTRAINT "file_assets_original_name_check"
    CHECK (char_length(original_name) BETWEEN 1 AND 255),
  ADD CONSTRAINT "file_assets_mime_type_check"
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  ADD CONSTRAINT "file_assets_size_bytes_check" CHECK (size_bytes BETWEEN 1 AND 10485760),
  ADD CONSTRAINT "file_assets_profile_image_check"
    CHECK (purpose = 'ATTACHMENT' OR mime_type IN ('image/jpeg', 'image/png')),
  ADD CONSTRAINT "file_assets_version_check" CHECK (version >= 1);

ALTER TABLE "pets"
  ADD CONSTRAINT "pets_name_check" CHECK (char_length(btrim(name)) >= 1 AND char_length(name) <= 100),
  ADD CONSTRAINT "pets_species_other_check" CHECK (
    (species = 'OTHER' AND species_other IS NOT NULL
      AND char_length(btrim(species_other)) >= 1 AND char_length(species_other) <= 100)
    OR (species <> 'OTHER' AND species_other IS NULL)),
  ADD CONSTRAINT "pets_breed_check"
    CHECK (breed IS NULL OR (char_length(btrim(breed)) >= 1 AND char_length(breed) <= 100)),
  ADD CONSTRAINT "pets_microchip_check"
    CHECK (microchip IS NULL OR char_length(microchip) BETWEEN 1 AND 50),
  ADD CONSTRAINT "pets_current_weight_kg_check"
    CHECK (current_weight_kg IS NULL OR (current_weight_kg > 0 AND current_weight_kg <= 1000)),
  ADD CONSTRAINT "pets_weight_measured_on_check"
    CHECK (weight_measured_on IS NULL OR current_weight_kg IS NOT NULL),
  ADD CONSTRAINT "pets_birth_date_estimated_check"
    CHECK (NOT birth_date_estimated OR birth_date IS NOT NULL),
  ADD CONSTRAINT "pets_version_check" CHECK (version >= 1);

ALTER TABLE "care_records"
  ADD CONSTRAINT "care_records_void_check" CHECK (
    (status = 'ACTIVE' AND void_reason IS NULL AND voided_at IS NULL)
    OR (status = 'VOIDED' AND voided_at IS NOT NULL AND void_reason IS NOT NULL
      AND char_length(btrim(void_reason)) >= 1 AND char_length(void_reason) <= 500)),
  ADD CONSTRAINT "care_records_appointment_not_voided_check"
    CHECK (kind <> 'APPOINTMENT' OR status = 'ACTIVE'),
  ADD CONSTRAINT "care_records_version_check" CHECK (version >= 1);

-- Each subtype row carries its parent's kind as a constant; the composite FK to
-- care_records(owner_id, pet_id, id, kind) then rejects a subtype of the wrong kind.
ALTER TABLE "medical_events"
  ADD CONSTRAINT "medical_events_kind_check" CHECK (kind = 'MEDICAL'),
  ADD CONSTRAINT "medical_events_title_check"
    CHECK (char_length(btrim(title)) >= 1 AND char_length(title) <= 150),
  ADD CONSTRAINT "medical_events_notes_check" CHECK (notes IS NULL OR char_length(notes) <= 5000),
  ADD CONSTRAINT "medical_events_provider_name_check" CHECK (provider_name IS NULL
    OR (char_length(btrim(provider_name)) >= 1 AND char_length(provider_name) <= 150));

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_record_kind_check"
    CHECK (record_kind IN ('MEDICAL', 'VACCINE', 'PRESCRIPTION'));

-- 2. Vaccines, prescriptions and appointments --------------------------------------------------
ALTER TABLE "vaccinations"
  ADD CONSTRAINT "vaccinations_kind_check" CHECK (kind = 'VACCINE'),
  ADD CONSTRAINT "vaccinations_vaccine_name_check"
    CHECK (char_length(btrim(vaccine_name)) >= 1 AND char_length(vaccine_name) <= 150),
  ADD CONSTRAINT "vaccinations_provider_name_check" CHECK (provider_name IS NULL
    OR (char_length(btrim(provider_name)) >= 1 AND char_length(provider_name) <= 150)),
  ADD CONSTRAINT "vaccinations_batch_label_check"
    CHECK (batch_label IS NULL OR char_length(batch_label) BETWEEN 1 AND 100);

ALTER TABLE "vaccine_due_items"
  ADD CONSTRAINT "vaccine_due_items_fulfilled_by_other_check"
    CHECK (fulfilled_by_vaccination_id IS NULL OR fulfilled_by_vaccination_id <> vaccination_id),
  ADD CONSTRAINT "vaccine_due_items_schedule_version_check" CHECK (schedule_version >= 1),
  ADD CONSTRAINT "vaccine_due_items_version_check" CHECK (version >= 1);

ALTER TABLE "prescriptions"
  ADD CONSTRAINT "prescriptions_kind_check" CHECK (kind = 'PRESCRIPTION'),
  ADD CONSTRAINT "prescriptions_medication_name_check"
    CHECK (char_length(btrim(medication_name)) >= 1 AND char_length(medication_name) <= 150),
  ADD CONSTRAINT "prescriptions_dose_instructions_check"
    CHECK (char_length(btrim(dose_instructions)) >= 1 AND char_length(dose_instructions) <= 2000),
  ADD CONSTRAINT "prescriptions_prescriber_name_check" CHECK (prescriber_name IS NULL
    OR (char_length(btrim(prescriber_name)) >= 1 AND char_length(prescriber_name) <= 150)),
  ADD CONSTRAINT "prescriptions_date_range_check" CHECK (ends_on IS NULL OR starts_on <= ends_on),
  ADD CONSTRAINT "prescriptions_time_zone_check" CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  ADD CONSTRAINT "prescriptions_schedule_version_check" CHECK (schedule_version >= 1);

ALTER TABLE "dose_occurrences"
  ADD CONSTRAINT "dose_occurrences_schedule_version_check" CHECK (schedule_version >= 1);

ALTER TABLE "dose_logs"
  ADD CONSTRAINT "dose_logs_note_check" CHECK (note IS NULL OR char_length(note) <= 500),
  ADD CONSTRAINT "dose_logs_version_check" CHECK (version >= 1);

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_kind_check" CHECK (kind = 'APPOINTMENT'),
  ADD CONSTRAINT "appointments_title_check"
    CHECK (char_length(btrim(title)) >= 1 AND char_length(title) <= 150),
  ADD CONSTRAINT "appointments_provider_name_check"
    CHECK (char_length(btrim(provider_name)) >= 1 AND char_length(provider_name) <= 150),
  ADD CONSTRAINT "appointments_provider_contact_check"
    CHECK (provider_contact IS NULL OR char_length(provider_contact) BETWEEN 1 AND 200),
  ADD CONSTRAINT "appointments_location_check"
    CHECK (location IS NULL OR char_length(location) BETWEEN 1 AND 500),
  ADD CONSTRAINT "appointments_notes_check" CHECK (notes IS NULL OR char_length(notes) <= 2000),
  ADD CONSTRAINT "appointments_time_zone_check" CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  ADD CONSTRAINT "appointments_duration_check" CHECK (
    ends_at_utc >= starts_at_utc + interval '1 minute'
    AND ends_at_utc <= starts_at_utc + interval '480 minutes'),
  ADD CONSTRAINT "appointments_outcome_check" CHECK (
    (status IN ('COMPLETED', 'MISSED')
      AND outcome_recorded_at IS NOT NULL AND outcome_actor_id IS NOT NULL)
    OR (status IN ('PLANNED', 'CANCELED')
      AND outcome_recorded_at IS NULL AND outcome_actor_id IS NULL)),
  ADD CONSTRAINT "appointments_cancel_reason_check" CHECK (cancel_reason IS NULL
    OR (status = 'CANCELED'
      AND char_length(btrim(cancel_reason)) >= 1 AND char_length(cancel_reason) <= 500)),
  ADD CONSTRAINT "appointments_schedule_version_check" CHECK (schedule_version >= 1);

-- 3. Household inventory -----------------------------------------------------------------------
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_name_check"
    CHECK (char_length(btrim(name)) >= 1 AND char_length(name) <= 150),
  ADD CONSTRAINT "inventory_items_expiry_lead_days_check" CHECK (expiry_lead_days IN (7, 30)),
  ADD CONSTRAINT "inventory_items_low_stock_threshold_check" CHECK (low_stock_threshold IS NULL
    OR (low_stock_threshold >= 0
      AND (unit NOT IN ('PIECE', 'TABLET', 'CAPSULE', 'SACHET')
        OR low_stock_threshold = trunc(low_stock_threshold)))),
  ADD CONSTRAINT "inventory_items_version_check" CHECK (version >= 1);

ALTER TABLE "stock_batches"
  ADD CONSTRAINT "stock_batches_remaining_quantity_check" CHECK (remaining_quantity >= 0),
  ADD CONSTRAINT "stock_batches_batch_label_check"
    CHECK (batch_label IS NULL OR char_length(batch_label) BETWEEN 1 AND 100);

ALTER TABLE "stock_transactions"
  ADD CONSTRAINT "stock_transactions_request_key_check"
    CHECK (char_length(request_key) BETWEEN 1 AND 100),
  ADD CONSTRAINT "stock_transactions_reason_check" CHECK (
    (type NOT IN ('DISPOSE', 'ADJUST') OR reason IS NOT NULL)
    AND (reason IS NULL OR (char_length(btrim(reason)) >= 1 AND char_length(reason) <= 500))),
  ADD CONSTRAINT "stock_transactions_reversal_check" CHECK (
    (type = 'REVERSE' AND reverses_transaction_id IS NOT NULL AND reverses_transaction_id <> id)
    OR (type <> 'REVERSE' AND reverses_transaction_id IS NULL));

-- Whole-unit quantities for discrete units are validated by the API (the unit lives on the item).
ALTER TABLE "stock_entries"
  ADD CONSTRAINT "stock_entries_signed_quantity_check" CHECK (CASE transaction_type
    WHEN 'OPENING' THEN signed_quantity >= 0
    WHEN 'RESTOCK' THEN signed_quantity > 0
    WHEN 'USE' THEN signed_quantity < 0
    WHEN 'DISPOSE' THEN signed_quantity < 0
    ELSE signed_quantity <> 0 -- ADJUST, REVERSE
  END);

ALTER TABLE "inventory_alerts"
  ADD CONSTRAINT "inventory_alerts_batch_check" CHECK ((type = 'LOW_STOCK') = (batch_id IS NULL)),
  ADD CONSTRAINT "inventory_alerts_episode_number_check" CHECK (episode_number >= 1);

-- 4. Reminders and delivery --------------------------------------------------------------------
ALTER TABLE "reminder_preferences"
  ADD CONSTRAINT "reminder_preferences_appointment_lead_minutes_check"
    CHECK (appointment_lead_minutes IN (60, 1440)),
  ADD CONSTRAINT "reminder_preferences_vaccine_lead_days_check" CHECK (vaccine_lead_days IN (1, 7)),
  ADD CONSTRAINT "reminder_preferences_version_check" CHECK (version >= 1);

ALTER TABLE "device_tokens"
  ADD CONSTRAINT "device_tokens_token_check" CHECK (char_length(token) BETWEEN 1 AND 4096);

ALTER TABLE "custom_reminders"
  ADD CONSTRAINT "custom_reminders_title_check"
    CHECK (char_length(btrim(title)) >= 1 AND char_length(title) <= 150),
  ADD CONSTRAINT "custom_reminders_time_zone_check" CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  ADD CONSTRAINT "custom_reminders_ends_on_check"
    CHECK (ends_on IS NULL OR (recurrence = 'DAILY' AND ends_on >= starts_at_local::date)),
  ADD CONSTRAINT "custom_reminders_version_check" CHECK (version >= 1);

-- Exactly one typed source. Composite FKs skip their check when any column is NULL (MATCH
-- SIMPLE), so care_record_kind must be present exactly when care_record_id is.
ALTER TABLE "reminder_schedules"
  ADD CONSTRAINT "reminder_schedules_one_source_check"
    CHECK (num_nonnulls(care_record_id, custom_reminder_id, inventory_alert_id) = 1),
  ADD CONSTRAINT "reminder_schedules_care_record_kind_check" CHECK (
    (care_record_id IS NULL AND care_record_kind IS NULL)
    OR (care_record_id IS NOT NULL
      AND care_record_kind IN ('VACCINE', 'PRESCRIPTION', 'APPOINTMENT'))),
  ADD CONSTRAINT "reminder_schedules_schedule_version_check" CHECK (schedule_version >= 1),
  ADD CONSTRAINT "reminder_schedules_version_check" CHECK (version >= 1);

ALTER TABLE "reminder_occurrences"
  ADD CONSTRAINT "reminder_occurrences_occurrence_key_check"
    CHECK (char_length(occurrence_key) BETWEEN 1 AND 200),
  ADD CONSTRAINT "reminder_occurrences_available_check"
    CHECK (state <> 'AVAILABLE' OR available_at IS NOT NULL),
  ADD CONSTRAINT "reminder_occurrences_snooze_check"
    CHECK (snoozed_from_id IS NULL OR snoozed_from_id <> id);

-- One first attempt plus retries after 1, 5 and 15 minutes.
ALTER TABLE "push_deliveries"
  ADD CONSTRAINT "push_deliveries_attempt_count_check" CHECK (attempt_count BETWEEN 0 AND 4);

-- 5. Reliability and deletion support ----------------------------------------------------------
ALTER TABLE "idempotency_requests"
  ADD CONSTRAINT "idempotency_requests_request_key_check"
    CHECK (char_length(request_key) BETWEEN 1 AND 100),
  ADD CONSTRAINT "idempotency_requests_operation_check"
    CHECK (char_length(operation) BETWEEN 1 AND 100);

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_attempt_count_check" CHECK (attempt_count >= 0);

ALTER TABLE "deletion_jobs"
  ADD CONSTRAINT "deletion_jobs_attempt_count_check" CHECK (attempt_count >= 0);

-- =============================================================================================
-- Hand-written: triggers
-- =============================================================================================

-- Every care record has its matching subtype row by commit (the parent and subtype are written
-- in one transaction, so the check is deferred).
CREATE FUNCTION care_records_require_subtype() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  has_subtype boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM care_records WHERE id = NEW.id) THEN
    RETURN NULL; -- removed again in the same transaction
  END IF;
  has_subtype := CASE NEW.kind
    WHEN 'MEDICAL' THEN EXISTS (SELECT 1 FROM medical_events WHERE record_id = NEW.id)
    WHEN 'VACCINE' THEN EXISTS (SELECT 1 FROM vaccinations WHERE record_id = NEW.id)
    WHEN 'PRESCRIPTION' THEN EXISTS (SELECT 1 FROM prescriptions WHERE record_id = NEW.id)
    WHEN 'APPOINTMENT' THEN EXISTS (SELECT 1 FROM appointments WHERE record_id = NEW.id)
  END;
  IF NOT has_subtype THEN
    RAISE EXCEPTION 'care record % has no % subtype row', NEW.id, NEW.kind;
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "care_records_require_subtype"
  AFTER INSERT ON "care_records"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION care_records_require_subtype();

-- An item's unit never changes: every item has an OPENING transaction from creation (IN-01).
CREATE FUNCTION inventory_items_unit_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unit IS DISTINCT FROM OLD.unit THEN
    RAISE EXCEPTION 'inventory item unit is fixed and cannot change; create a new item instead';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "inventory_items_unit_immutable"
  BEFORE UPDATE OF unit ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION inventory_items_unit_immutable();

-- The stock ledger is append-only; corrections are new ADJUST or REVERSE transactions.
-- (Rows are only removed by the FN-02 account deletion workflow.)
CREATE FUNCTION stock_ledger_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock ledger is immutable: % rows cannot be updated', TG_TABLE_NAME;
END
$$;

CREATE TRIGGER "stock_transactions_immutable"
  BEFORE UPDATE ON "stock_transactions"
  FOR EACH ROW EXECUTE FUNCTION stock_ledger_immutable();

CREATE TRIGGER "stock_entries_immutable"
  BEFORE UPDATE ON "stock_entries"
  FOR EACH ROW EXECUTE FUNCTION stock_ledger_immutable();

-- A batch's remaining_quantity is a cache of its ledger entries and must equal their sum when
-- the transaction commits.
CREATE FUNCTION stock_batch_balance_matches_ledger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_batch uuid;
  balance numeric;
  ledger_total numeric;
BEGIN
  IF TG_TABLE_NAME = 'stock_entries' THEN
    target_batch := NEW.batch_id;
  ELSE
    target_batch := NEW.id;
  END IF;

  SELECT b.remaining_quantity, COALESCE(sum(e.signed_quantity), 0)
    INTO balance, ledger_total
    FROM stock_batches b
    LEFT JOIN stock_entries e ON e.batch_id = b.id
   WHERE b.id = target_batch
   GROUP BY b.id;

  IF FOUND AND balance <> ledger_total THEN
    RAISE EXCEPTION 'stock batch % balance % does not match its ledger total %',
      target_batch, balance, ledger_total;
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "stock_batches_balance_matches_ledger"
  AFTER INSERT OR UPDATE OF remaining_quantity ON "stock_batches"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION stock_batch_balance_matches_ledger();

CREATE CONSTRAINT TRIGGER "stock_entries_balance_matches_ledger"
  AFTER INSERT ON "stock_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION stock_batch_balance_matches_ledger();

-- Audit events are append-only. The only permitted change is clearing the actor when the
-- account is erased (the ON DELETE SET NULL of audit_events_actor_owner_id_fkey).
CREATE FUNCTION audit_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.actor_owner_id IS NOT NULL AND NEW.actor_owner_id IS NULL
     AND (NEW.id, NEW.action, NEW.object_type, NEW.object_id, NEW.occurred_at, NEW.change_metadata)
         IS NOT DISTINCT FROM
         (OLD.id, OLD.action, OLD.object_type, OLD.object_id, OLD.occurred_at, OLD.change_metadata)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit events are immutable';
END
$$;

CREATE TRIGGER "audit_events_append_only"
  BEFORE UPDATE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
