-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdb_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "overview" TEXT,
    "release_date" TEXT,
    "poster_path" TEXT,
    "backdrop_path" TEXT,
    "vote_average" REAL NOT NULL,
    "vote_count" INTEGER NOT NULL,
    "tagline" TEXT,
    "runtime" INTEGER,
    "original_language" TEXT,
    "year" INTEGER,
    "rating" REAL,
    "director" TEXT,
    "budget" INTEGER,
    "revenue" INTEGER,
    "last_synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "genres" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdb_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "movie_genres" (
    "movie_id" INTEGER NOT NULL,
    "genre_id" INTEGER NOT NULL,

    PRIMARY KEY ("movie_id", "genre_id"),
    CONSTRAINT "movie_genres_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movie_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movie_casts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movie_id" INTEGER NOT NULL,
    "tmdb_person_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "character" TEXT,
    "profile_path" TEXT,
    CONSTRAINT "movie_casts_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movie_galleries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movie_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "image_path" TEXT NOT NULL,
    CONSTRAINT "movie_galleries_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "similar_movies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movie_id" INTEGER NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "poster_path" TEXT,
    CONSTRAINT "similar_movies_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_companies" (
    "tmdb_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "logo_path" TEXT
);

-- CreateTable
CREATE TABLE "movie_production_companies" (
    "movie_id" INTEGER NOT NULL,
    "production_company_id" INTEGER NOT NULL,

    PRIMARY KEY ("movie_id", "production_company_id"),
    CONSTRAINT "movie_production_companies_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movie_production_companies_production_company_id_fkey" FOREIGN KEY ("production_company_id") REFERENCES "production_companies" ("tmdb_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_movies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_movies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_movies_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "movies_tmdb_id_key" ON "movies"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "genres_tmdb_id_key" ON "genres"("tmdb_id");

-- CreateIndex
CREATE INDEX "movie_casts_movie_id_idx" ON "movie_casts"("movie_id");

-- CreateIndex
CREATE UNIQUE INDEX "movie_casts_movie_id_tmdb_person_id_key" ON "movie_casts"("movie_id", "tmdb_person_id");

-- CreateIndex
CREATE INDEX "movie_galleries_movie_id_type_idx" ON "movie_galleries"("movie_id", "type");

-- CreateIndex
CREATE INDEX "similar_movies_movie_id_idx" ON "similar_movies"("movie_id");

-- CreateIndex
CREATE UNIQUE INDEX "similar_movies_movie_id_tmdb_id_key" ON "similar_movies"("movie_id", "tmdb_id");

-- CreateIndex
CREATE INDEX "user_movies_user_id_status_visibility_idx" ON "user_movies"("user_id", "status", "visibility");

-- CreateIndex
CREATE INDEX "user_movies_status_movie_id_idx" ON "user_movies"("status", "movie_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_movies_user_id_movie_id_key" ON "user_movies"("user_id", "movie_id");
