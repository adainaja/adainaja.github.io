AdaAja — Supabase Auth V1

FILE YANG HARUS DIUPLOAD KE ROOT GITHUB:
1. register.html
2. register.js
3. login.html
4. login.js
5. supabase-config.js
6. auth-session.js
7. auth-callback.html
8. auth-callback.js

CSS:
- register.css tetap memakai file lama.
- login.css tetap memakai file lama.

PENGATURAN SUPABASE WAJIB:
Authentication > URL Configuration

Site URL:
https://adainaja.github.io

Redirect URLs:
https://adainaja.github.io/**
http://127.0.0.1:5500/**
http://localhost:5500/**

Authentication > Sign In / Providers > Email:
- Enable Email provider: ON
- Confirm email: ON

ALUR PENGUJIAN:
1. Upload 8 file ke GitHub.
2. Hard refresh.
3. Buka register.html.
4. Daftar memakai email yang belum pernah dipakai.
5. Buka email dan klik tautan konfirmasi.
6. Browser masuk ke auth-callback.html.
7. Setelah berhasil, browser diarahkan ke home.html.
8. Coba logout nanti setelah halaman Profile dimigrasikan, atau hapus session melalui Supabase Dashboard saat pengujian.
9. Buka login.html dan login memakai email/password tadi.

CATATAN:
- OTP Apps Script tidak lagi dipakai pada Register/Login baru.
- Password tidak pernah lagi disimpan di localStorage.
- localStorage key "user" masih dibuat sementara agar halaman lama tetap mengenali user.
- complete-account.html belum dimigrasikan dalam paket ini.
- Google OAuth belum dimasukkan dalam V1 agar pengujian Email Auth lebih mudah.
