CREATE TABLE "episode_progress" (
	"user_id" text NOT NULL,
	"tv_id" integer NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episode_progress_user_tv_season_episode_unique" UNIQUE("user_id","tv_id","season_number","episode_number")
);
--> statement-breakpoint
CREATE TABLE "library_items" (
	"user_id" text NOT NULL,
	"media_type" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"status" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watched_at" timestamp with time zone,
	"title" text NOT NULL,
	"poster_path" text,
	"release_date" text,
	"genre_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	CONSTRAINT "library_items_user_media_tmdb_unique" UNIQUE("user_id","media_type","tmdb_id"),
	CONSTRAINT "library_items_media_type_check" CHECK ("library_items"."media_type" in ('movie', 'tv')),
	CONSTRAINT "library_items_status_check" CHECK ("library_items"."status" in ('want', 'watching', 'watched'))
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"user_id" text NOT NULL,
	"media_type" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"score" integer NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_media_tmdb_unique" UNIQUE("user_id","media_type","tmdb_id"),
	CONSTRAINT "ratings_media_type_check" CHECK ("ratings"."media_type" in ('movie', 'tv')),
	CONSTRAINT "ratings_score_check" CHECK ("ratings"."score" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_progress" ADD CONSTRAINT "episode_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_progress_user_id_idx" ON "episode_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_items_user_id_idx" ON "library_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ratings_user_id_idx" ON "ratings" USING btree ("user_id");