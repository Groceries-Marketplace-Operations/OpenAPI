-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'viewer');

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picture" TEXT,
    "roles" "Role"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "didi_config" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "app_secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "didi_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "didi_order_event" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "app_shop_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirm_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "didi_order_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_email_key" ON "account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_slug_key" ON "project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "didi_config_project_id_key" ON "didi_config"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "didi_order_event_project_id_app_shop_id_date_order_index_key" ON "didi_order_event"("project_id", "app_shop_id", "date", "order_index");

-- AddForeignKey
ALTER TABLE "didi_config" ADD CONSTRAINT "didi_config_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "didi_order_event" ADD CONSTRAINT "didi_order_event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
