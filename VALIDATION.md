# Keputusan validasi LITRIC V2

Tarikh: 22 Oktober 2026 (Asia/Kuala_Lumpur). Sasaran ialah React + API Cloudflare Workers, SQLite Durable Object persendirian dan D1 pada akaun sekolah. Tiada perubahan kepada backend Sites lama atau pemindahan rekod murid sebenar.

## Semakan automatik

| Semakan | Hasil |
|---|---|
| Unit/domain/parser/theme/config/setup | 55 lulus, 0 gagal; 2 dataset peribadi sengaja skip kerana tidak dibundel dalam sumber awam. |
| TypeScript | Lulus. |
| Production frontend + imbasan bundle | Lulus; tiada Sites login/API/bridge atau password hash dalam output statik. |
| Wrangler dry run | Lulus dengan binding ASSETS, DB dan SCHOOL_SERVICE. |
| Worker/Durable Object/D1 integration | 113 semakan lulus pada runtime terasing, termasuk bootstrap pelayan, preflight tanpa password bagi pasangan manual, first-login gate, protected source download dan backup/restore. |
| Imbasan sumber awam | Lulus; seed kosong, fixture sintetik, tiada credential atau input murid peribadi. |
| D1 baharu sekolah | 0000/0001/0002 diterapkan; tiada restore data produksi. |

Liputan pengiraan meliputi semua sempadan bintang 143/144/287/288/431/432/575/576/719/720, identiti kekal, tahun bebas, snapshot pengganti, event pendua, overlap antara dataset, tempoh tidak diketahui, rollback dan rekod belum disahkan. Restore backup sintetik diuji ke database terasing: kiraan jadual, foreign keys dan 400 bacaan kekal sama.

Setup manual: tiket rawak, padanan hash, skop origin, tempoh 14 minit, penolakan expiry tamat/terlalu jauh/dalam saat diuji. Round trip Windows DPAPI CurrentUser diperiksa pada mesin ini; fail ciphertext tidak mengandungi kunci mentah. Tiada password diperlukan bagi semakan ini. Setup GPM sebenar masih menunggu input peribadi pemilik.

## Ujian pada URL Cloudflare sebenar

URL: **https://litric-pilot.g-18197853.workers.dev**. Login kini diaktifkan; mod lama yang menyekat login bukan lagi status live semasa. Backend scrypt berjalan dalam SQLite Durable Object pada Workers Free. Tiada pembelian atau pertukaran pelan.

Versi deployment akhir semasa semakan: `d19ae000-deab-42ff-b02c-82fa68bb2c8f`. Selepas deploy ini, semakan berasingan mengesahkan login 200, sumber import tanpa sesi 401, muat turun sumber dengan sesi 200 (satu baris sekolah), logout 200 dan token dibatalkan 401. Halaman frontend, health dan penolakan API tanpa sesi turut diperiksa semula. Setup secret kemudian boleh menghasilkan versi Cloudflare baharu tanpa perubahan kod.

Script operator `scripts/test-live-pilot.mjs` dijalankan dengan kebenaran data sintetik, bukannya dalam CI. Ia menjana akaun QA sementara dan password rawak tanpa mencetaknya, menggunakan D1 sekolah baharu sahaja. 44 semakan HTTP dan assertion kandungan berikut lulus:

- Tanpa sesi 401, password salah 401, login sementara 200 dan akses data sementara 428.
- Tukar password pertama berjaya, sesi lama 401 dan login baharu berjaya.
- XLSX sebenar dijana dalam memori dan diparse melalui parser produksi. Setiap fail mengandungi ABA6052, ABA60520 serta sekolah lain; hanya ABA6052 diterima. Semakan preview server turut menolak dua baris luar.
- Tiga tahun bebas yang disahkan: 120 + 180 + 100 = **400 bacaan, 2 bintang, 32 lagi ke 432**.
- Fail pendua tidak ditambah. Ringkasan bertindih menghalang kelayakan; rollback memulihkan 400.
- Status berpindah, arkib dan pulih mengekalkan identiti dan sejarah bacaan.
- Logout membatalkan sesi, expiry server memberi 401 dan percubaan login ke-11 memberi 429.

Keputusan HTTP selamat dieksport tanpa credential. Selepas browser QA, credential QA dibatalkan, import sintetik dibatalkan secara boleh pulih dan murid sintetik diarkibkan; sejarah ujian kekal bagi audit tanpa menyumbang kepada jumlah bacaan operasi. Ini bukan data sekolah sebenar. Jangan gunakan akaun QA untuk operasi sekolah.

Browser live turut mengesahkan dashboard, direktori, import/sejarah dan Bintang NILAM melalui sesi QA tanpa ChatGPT. Sidebar mempunyai empat modul sahaja. Jadual bintang menunjukkan 2023/2024/2025, lifetime 400, 2 bintang dan baki 32. Screenshot yang dibekalkan ialah data sintetik pada URL live.

## Paparan dan aksesibiliti

Production UI telah diperiksa pada runtime Worker + ASSETS + D1 tempatan. Desktop 1440x1000, viewport 390px dan 320px tiada overflow dokumen; KPI masing-masing tiga/dua/satu kolum. Dark dan high contrast diperiksa secara visual. Ini emulasi browser, bukan ujian Android fizikal.

Ujian token memastikan kontras teks 4.5:1 untuk light/dark/high-contrast dan endpoint gradient KPI. Amber menggunakan teks gelap. Reduced-motion mematikan animasi/transisi. Semakan DOM terarah mendapati satu h1 dan tiada input/select/textarea tanpa label pada import. Ini bukan audit screen reader penuh atau pensijilan aksesibiliti.

## Belum selesai

- Pemilik perlu menjalankan bootstrap GPM tersembunyi, menukar password pertama dan menerima login sebenar GPM. Kejayaan QA tidak menggantikan penerimaan pemilik.
- GitHub App kini dipasang untuk SKPKT/LITRIC sahaja. Masalah 403 dipulihkan dan penciptaan feature branch berjaya. Pull request masih memerlukan semakan manusia; tiada merge ke main dilakukan.
- GitHub Actions memerlukan token Cloudflare terskop dan environment/variables sekolah; automasi produksi belum diaktifkan.
- Backup D1/R2 asal, migrasi rekod sebenar, parity produksi, Android fizikal, ujian beban dan cutover belum dilakukan.

Rintis berlogin dan empat modul dengan data sintetik telah diuji. Sistem belum diterima untuk operasi data sebenar. Ikuti DEPLOYMENT.md untuk setup GPM, semakan manusia dan proses backup/restore berizin.
