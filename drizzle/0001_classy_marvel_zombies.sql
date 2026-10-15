ALTER TABLE "complexes" ADD COLUMN "trade_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "complexes" ADD COLUMN "last_deal_date" date;