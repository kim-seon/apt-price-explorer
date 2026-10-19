CREATE TABLE "sgg_monthly_counts" (
	"sgg_code" char(5) NOT NULL,
	"deal_ym" char(7) NOT NULL,
	"trade_count" integer NOT NULL,
	CONSTRAINT "sgg_monthly_counts_sgg_code_deal_ym_pk" PRIMARY KEY("sgg_code","deal_ym")
);
