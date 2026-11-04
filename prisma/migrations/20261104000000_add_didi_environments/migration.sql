ALTER TABLE "didi_config" ADD COLUMN "test_app_id" TEXT,
ADD COLUMN "test_app_secret" TEXT;
ALTER TABLE "didi_order_event" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'production';
-- Historical events cannot reliably be classified as real or simulated.
DROP INDEX "didi_order_event_project_id_app_shop_id_date_order_index_key";
CREATE UNIQUE INDEX "didi_order_event_environment_key"
ON "didi_order_event"("project_id", "environment", "app_shop_id", "date", "order_index");
