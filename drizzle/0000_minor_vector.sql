CREATE TABLE "area_types" (
	"apt_seq" text NOT NULL,
	"label" text NOT NULL,
	"min_area" numeric(9, 4) NOT NULL,
	"max_area" numeric(9, 4) NOT NULL,
	CONSTRAINT "area_types_apt_seq_label_pk" PRIMARY KEY("apt_seq","label")
);
--> statement-breakpoint
CREATE TABLE "complexes" (
	"apt_seq" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"build_year" smallint,
	"sgg_code" char(5) NOT NULL,
	"umd_name" text NOT NULL,
	"jibun" text
);
--> statement-breakpoint
CREATE TABLE "import_partitions" (
	"sgg_code" char(5) NOT NULL,
	"deal_ym" char(6) NOT NULL,
	"row_count" integer NOT NULL,
	"invalid_count" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_partitions_sgg_code_deal_ym_pk" PRIMARY KEY("sgg_code","deal_ym")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" char(10) PRIMARY KEY NOT NULL,
	"sgg_code" char(5) NOT NULL,
	"level" varchar(3) NOT NULL,
	"sido_name" text NOT NULL,
	"sgg_name" text NOT NULL,
	"umd_name" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sgg_code" char(5) NOT NULL,
	"umd_code" char(5) NOT NULL,
	"umd_name" text NOT NULL,
	"apt_seq" text NOT NULL,
	"apt_name" text NOT NULL,
	"jibun" text,
	"build_year" smallint,
	"deal_date" date NOT NULL,
	"price" integer NOT NULL,
	"area" numeric(9, 4) NOT NULL,
	"area_type_label" text,
	"floor" smallint,
	"cancelled" boolean DEFAULT false NOT NULL,
	"cancel_date" date,
	"deal_type" text,
	"registered_date" date,
	"apt_dong" text
);
