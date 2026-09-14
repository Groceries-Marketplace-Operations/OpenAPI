-- CreateTable
CREATE TABLE "inventory_request_log" (
    "id" TEXT NOT NULL,
    "load_type" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source_ip" TEXT,
    "user_agent" TEXT,
    "request_headers" JSONB NOT NULL,
    "request_body" JSONB,
    "request_raw_body" TEXT,
    "response_status" INTEGER,
    "response_headers" JSONB,
    "response_body" JSONB,
    "response_raw_body" TEXT,
    "success" BOOLEAN,
    "error_message" TEXT,
    "record_count" INTEGER,
    "store_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "inventory_request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_upstream_log" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "store_id" TEXT,
    "task_id" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "request_headers" JSONB,
    "request_body" JSONB,
    "response_status" INTEGER,
    "response_headers" JSONB,
    "response_body" JSONB,
    "response_raw_body" TEXT,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_upstream_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_request_log_created_at_idx" ON "inventory_request_log"("created_at");

-- CreateIndex
CREATE INDEX "inventory_request_log_load_type_created_at_idx" ON "inventory_request_log"("load_type", "created_at");

-- CreateIndex
CREATE INDEX "inventory_request_log_success_created_at_idx" ON "inventory_request_log"("success", "created_at");

-- CreateIndex
CREATE INDEX "inventory_request_log_store_ids_idx" ON "inventory_request_log" USING GIN ("store_ids");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_upstream_log_request_id_sequence_key" ON "inventory_upstream_log"("request_id", "sequence");

-- CreateIndex
CREATE INDEX "inventory_upstream_log_operation_created_at_idx" ON "inventory_upstream_log"("operation", "created_at");

-- CreateIndex
CREATE INDEX "inventory_upstream_log_store_id_created_at_idx" ON "inventory_upstream_log"("store_id", "created_at");

-- AddForeignKey
ALTER TABLE "inventory_upstream_log" ADD CONSTRAINT "inventory_upstream_log_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "inventory_request_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
