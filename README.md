# Movie Platform Lite API

REST API katalog film dengan autentikasi, koleksi pribadi, profil publik, dan rekomendasi. Backend memakai Node.js, Express, SQLite/Prisma, dan TMDB.

## Fitur

- Register/login dengan hash password Argon2id, JWT access token, dan refresh session dalam HttpOnly cookie.
- Pencarian dan detail film dari TMDB dengan cache SQLite tujuh hari serta fallback cache stale.
- Koleksi film dengan status `watched` atau `plan_to_watch` dan visibility `public` atau `private`.
- Profil dan daftar film publik dengan pemeriksaan akses private.
- Most Watched menghitung entri watched, termasuk private, tanpa mengungkap identitas pemilik.

## Prasyarat

- Node.js 22 atau lebih baru.
- npm.
- API key TMDB v3 untuk pencarian, detail, dan fallback Popular.

## Instalasi lokal

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` dan isi sekurangnya `JWT_ACCESS_SECRET` serta `TMDB_API_KEY`. Buat secret acak 32 byte dengan:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Jangan commit `.env` atau membagikan nilainya. `.env` dan file SQLite lokal sudah dikecualikan oleh `.gitignore`.

Generate Prisma Client dan terapkan migration yang tersedia:

```powershell
npx prisma generate
npx prisma migrate deploy
```

Database lokal default tersimpan pada `database/movie_platform.sqlite`. Ubah `DATABASE_PATH` bila perlu dan pastikan direktori tujuan dapat ditulis.

Jalankan API:

```powershell
npm start
```

Default URL lokal adalah `http://localhost:3000`. Health check tersedia di `GET /health`.

## Konfigurasi

`.env.example` mencantumkan semua konfigurasi. Variabel utama:

| Variabel | Fungsi | Default |
| --- | --- | --- |
| `NODE_ENV` | Mode aplikasi | `development` |
| `PORT` | Port HTTP | `3000` |
| `APP_URL` | Issuer JWT dan URL aplikasi | `http://localhost:3000` |
| `DATABASE_PATH` | File SQLite | `./database/movie_platform.sqlite` |
| `TMDB_API_KEY` | TMDB API key, hanya digunakan backend | kosong |
| `TMDB_LANGUAGE` | Bahasa metadata TMDB | `id-ID` |
| `TMDB_CACHE_TTL_DAYS` | Lama cache detail film | `7` |
| `JWT_ACCESS_SECRET` | Secret JWT, minimal 32 byte | kosong; wajib diisi |
| `JWT_ACCESS_TTL` | Umur access token | `15m` |
| `REFRESH_TOKEN_TTL_DEFAULT_DAYS` | Umur refresh session biasa | `1` |
| `REFRESH_TOKEN_TTL_REMEMBER_DAYS` | Umur dengan Remember Me | `30` |
| `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` | Pagination | `20` / `50` |
| `MOST_WATCHED_LIMIT` | Jumlah rekomendasi lokal maksimum | `20` |
| `MOST_WATCHED_MIN_RECORDS` | Ambang watched record sebelum fallback | `10` |
| `CORS_ORIGINS` | Daftar origin frontend, pisahkan dengan koma | `http://localhost:5173` |
| `COOKIE_SECURE` | Secure cookie; wajib `true` di production | `false` |
| `COOKIE_SAME_SITE` | SameSite cookie | `lax` |

`CORS_ORIGINS` menerima beberapa origin yang dipisahkan koma, misalnya `https://app.example.com,https://admin.example.com`. Untuk kompatibilitas, `CORS_ORIGIN` tunggal masih dibaca jika `CORS_ORIGINS` belum diatur. Di luar production, origin HTTP loopback lokal juga diizinkan agar Swagger Preview dengan port dinamis bisa mengirim request. Konfigurasi tambahan seperti timeout TMDB, WAL, rate limit, dan log level tersedia di `.env.example`. Aplikasi memvalidasi konfigurasi saat startup.

## API

Semua endpoint API memakai prefix `/api/v1`. Endpoint yang memerlukan login menerima `Authorization: Bearer <accessToken>`. Login mengirim refresh token hanya melalui cookie HttpOnly.

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `POST` | `/auth/register` | Membuat akun |
| `POST` | `/auth/login` | Login; `rememberMe` memperpanjang refresh session |
| `POST` | `/auth/refresh` | Rotasi refresh session |
| `POST` | `/auth/logout` | Mencabut refresh session |
| `GET` | `/auth/current-user` | Pengguna dari access token |
| `GET` | `/movies/search?query=...&page=1` | Cari film di TMDB |
| `GET` | `/movies/{tmdbId}` | Detail film dengan cache lokal |
| `GET` | `/library` | Koleksi pengguna; filter status dan pagination |
| `GET` | `/library/stats` | Statistik koleksi pribadi |
| `POST` | `/library` | Tambah film; default `plan_to_watch` dan `private` |
| `PATCH` | `/library/{tmdbId}` | Ubah status/visibility milik pengguna |
| `DELETE` | `/library/{tmdbId}` | Hapus entri milik pengguna |
| `GET` | `/profiles/{publicId}` | Profil tanpa email |
| `GET` | `/profiles/{publicId}/movies` | Koleksi profil; pemilik dapat melihat private, pengunjung hanya public |
| `GET` | `/recommendations/most-watched` | Peringkat lokal atau TMDB Popular fallback |

Endpoint profil memerlukan autentikasi. Pagination menerima `page` dan `limit`; default dan batas maksimum mengikuti konfigurasi. Filter koleksi menerima `status=watched` atau `status=plan_to_watch`.

Koleksi request siap-impor untuk Bruno tersedia di `bruno/Movie-Platform-Lite`; panduan pemakaian ada di [docs/bruno-collection.md](docs/bruno-collection.md). Koleksi menyediakan environment `local` dan request untuk semua operasi API.

Response sukses memakai envelope `{ "success": true, "message": "...", "data": ... }`; daftar berpaginasi menyertakan `meta`. Response error memakai `success: false` dan `error.code`. Detail parameter dan schema tersedia di [OpenAPI](docs/openapi.yaml).

## Database dan struktur

Prisma mengelola tabel `users`, `refresh_tokens`, `movies`, dan `user_movies`. Migration berada di `prisma/migrations`. Film terhubung melalui ID internal database; API mengidentifikasi film dengan `tmdbId`. Jangan hapus atau reset database lokal untuk menjalankan migration.

```text
src/
  config/                 konfigurasi environment
  core/                   Prisma, response, errors, middleware
  integrations/tmdb/      TMDB HTTP client
  controllers/            controller per domain
  middlewares/            middleware HTTP bersama
  repositories/           akses data per domain
  routes/                 route per domain
  services/               aturan bisnis per domain
  validators/             validasi request per domain
  modules/                composition/wiring per domain saja
prisma/
  schema.prisma           model User, RefreshToken, Movie, UserMovie
  migrations/             riwayat schema database
tests/
  helpers/                fixture SQLite sementara
  integration/            test HTTP + database
  unit/                   test service/client
docs/
  MASTER_BLUEPRINT_LITE.md
  openapi.yaml
```

Model tabel didefinisikan satu kali di `prisma/schema.prisma`; Prisma Client adalah akses model untuk kode JavaScript. Kami tidak membuat kelas/file model database duplikat di tiap modul. Folder `models/` hanya ditambahkan bila muncul konsep domain yang berbeda dari bentuk tabel.

## Test

Jalankan suite dengan:

```powershell
npm test
```

Integration tests membuat SQLite sementara dari migration proyek lalu menghapusnya. Cakupan saat ini mencakup endpoint health/auth, koleksi dan privasi profil, library CRUD/statistik, auth lifecycle, cache TMDB, serta Most Watched.

