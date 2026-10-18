CREATE INDEX "transactions_apt_idx" ON "transactions" USING btree ("apt_seq");--> statement-breakpoint
CREATE INDEX "transactions_sgg_date_idx" ON "transactions" USING btree ("sgg_code","deal_date");