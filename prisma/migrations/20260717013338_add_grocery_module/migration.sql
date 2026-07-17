-- CreateTable
CREATE TABLE "didi_grocery_config" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sftp_host" TEXT NOT NULL,
    "sftp_port" INTEGER NOT NULL DEFAULT 36000,
    "sftp_user" TEXT NOT NULL,
    "sftp_password" TEXT NOT NULL,
    "sftp_remote_dir" TEXT NOT NULL DEFAULT '/upload',
    "max_per_category" INTEGER NOT NULL DEFAULT 3000,
    "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule_hour" INTEGER NOT NULL DEFAULT 9,
    "schedule_minute" INTEGER NOT NULL DEFAULT 0,
    "schedule_timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "didi_grocery_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "didi_grocery_upload" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'menu',
    "status" TEXT NOT NULL DEFAULT 'running',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "didi_grocery_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "didi_grocery_upload_store" (
    "id" TEXT NOT NULL,
    "upload_id" TEXT NOT NULL,
    "app_shop_id" TEXT NOT NULL,
    "task_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "didi_grocery_upload_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "didi_grocery_config_project_id_key" ON "didi_grocery_config"("project_id");

-- AddForeignKey
ALTER TABLE "didi_grocery_config" ADD CONSTRAINT "didi_grocery_config_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "didi_grocery_upload" ADD CONSTRAINT "didi_grocery_upload_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "didi_grocery_upload_store" ADD CONSTRAINT "didi_grocery_upload_store_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "didi_grocery_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
