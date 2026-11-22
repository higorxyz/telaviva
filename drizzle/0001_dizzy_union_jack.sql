CREATE TABLE "applied_commands" (
	"user_id" text NOT NULL,
	"command_id" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	CONSTRAINT "applied_commands_pkey" PRIMARY KEY("user_id","command_id")
);
--> statement-breakpoint
CREATE TABLE "library_removals" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"media_type" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season_number" integer,
	"episode_number" integer,
	"removed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "library_removals_key_unique" UNIQUE NULLS NOT DISTINCT("user_id","kind","media_type","tmdb_id","season_number","episode_number"),
	CONSTRAINT "library_removals_kind_check" CHECK ("library_removals"."kind" in ('item', 'rating', 'mark'))
);
--> statement-breakpoint
ALTER TABLE "applied_commands" ADD CONSTRAINT "applied_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_removals" ADD CONSTRAINT "library_removals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;