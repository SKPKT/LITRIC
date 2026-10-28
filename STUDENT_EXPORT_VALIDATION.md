# Pendaftaran murid dan laporan Excel — 28 Oktober 2026

Worker: `litric-pilot` — https://litric-pilot.g-18197853.workers.dev/

Deployment yang disahkan: `574edb50-f1b7-426d-b72e-e3c15a967c39`.

## Fungsi

- Pengurusan Murid mempunyai butang ungu **+ Tambah Murid**, borang simpan/batal, pengesahan pelayan dan mesej **Maklumat murid berjaya disimpan.** Profil baharu dipaparkan terus melalui carian nama selepas simpan.
- Nama, kelas, tahun dan status boleh diedit. Status Aktif, Berpindah dan Tamat Sekolah disokong; dua status terakhir mengarkibkan profil secara automatik. Pulih arkib mengaktifkan semula profil tanpa memadam sejarah.
- ID sumber AINS yang disahkan disimpan sebagai alias unik sekolah. Import menggunakan pengecam tersebut untuk memautkan rekod kepada profil kekal. Nama sahaja tidak digabung automatik. Identiti tidak lengkap/meragukan memerlukan pilihan profil, bukti dan pengesahan pentadbir dalam pratonton import.
- Profil tanpa AINS kekal dalam kedua-dua direktori dan jadual bintang: Tiada rekod AINS / Belum dapat disahkan. Ia tidak dianggap 0 bintang atau sifar bacaan seumur persekolahan.
- Kedua-dua modul murid dan bintang menyediakan **Eksport Excel** dengan penapis nama/kelas, status, tahun akademik, kelas dan tahap bintang.

## Buku kerja

ExcelJS menghasilkan `.xlsx` sebenar dengan tiga helaian: **Ringkasan Pencapaian**, **Sejarah Bacaan Tahunan**, **Statistik Sekolah**. Helaian pertama mengandungi kesemua sembilan medan direktori yang diminta, ditambah markah PAJSK dan status pengesahan. Laporan mempunyai tajuk sekolah ABA6052, tarikh Malaysia, header ungu, baris berselang, auto-filter, header beku, lebar lajur dan format angka.

Tahun akademik memilih murid berdasarkan profil, sejarah kelas atau tahun AINS yang tersedia; jumlah tahun laporan menggunakan tahun dipilih, atau tahun semasa jika Semua tahun dipilih. Sejarah tahunan bagi murid terpilih dan jumlah terkumpul sentiasa merangkumi semua tahun. Penapis tahun tidak memotong pencapaian terdahulu.

Pengiraan menggunakan engine domain sedia ada. Ringkasan bertindih tidak ditambah; bacaan belum disahkan/kurang lengkap tidak memberikan bintang rasmi. Nilai disahkan separa kekal berasingan melalui status pengesahan. Markah PAJSK hanya dikeluarkan jika data dan versi peraturan disahkan; konfigurasi sekolah yang belum diperakui dilabelkan dengan jelas. Murid tanpa bukti tidak dimasukkan ke statistik 0 bintang.

## Keselamatan dan D1

API laporan memerlukan sesi pentadbir atau guru yang diberi skop kelas. Pelajar/pelawat tidak boleh mengeksport; guru hanya menerima murid yang boleh diaksesnya. Fail dihantar terus dengan `Cache-Control: no-store`, tidak disimpan dalam aset awam/R2 atau GitHub. Teks formula berbahaya dinyahaktifkan dan setiap muat turun dilogkan dalam audit D1.

**Tiada migrasi skema diperlukan.** Worker dan D1 sekolah yang sama digunakan. Sandaran SQL dibuat dalam direktori tempatan ber-ACL peribadi di luar repository, dipulihkan ke SQLite terasing dan dibandingkan dengan D1. Semakan selepas deploy membandingkan setiap rekod asal dalam 10 jadual, termasuk students, aliases, sejarah kelas, batches, summaries, events, rules dan accounts: semuanya kekal sama. Statistik engine sebelum/selepas juga sepadan. Sandaran dan rekod sebenar tidak disertakan dalam sumber awam.

## Keputusan ujian

| Senario | Keputusan |
|---|---|
| Tambah manual, simpan D1, direktori segera | Lulus melalui API, D1 dan borang browser live |
| Edit nama/kelas/tahun/status | Lulus integrasi |
| ID atau profil pendua | Ditolak 409; individu berlainan memerlukan pengesahan/bukti |
| Berpindah/tamat sekolah, arkib/pulih | Lulus; sejarah kekal |
| Import AINS bagi murid manual | ID dalaman sama; tiada profil tambahan |
| Tanpa ID sumber | Import disekat sehingga identiti dipilih dan disahkan; pautan manual lulus |
| Excel daripada kedua-dua modul | Muat turun browser live berjaya |
| Bacaan semula tiga helaian | Lulus; nombor, penapis, jenis sel, styling dan format diperiksa |
| Tiada AINS / data belum lengkap | Tiada rekod / belum disahkan; tiada pencapaian rasmi rekaan |
| Kelas, tahun, status dan tahap bintang | Lulus unit/integrasi dan penapis browser live |
| Bacaan tiga tahun | 120 + 180 + 100 = 400; 2 bintang; baki 32 |
| Fail/peristiwa pendua dan overlap | Ujian sedia ada dan integrasi lulus; overlap menyekat kelayakan |
| Tanpa sesi / guru tanpa skop | Tanpa sesi 401; guru tanpa kelas menerima buku kerja tanpa murid |
| Paparan responsif | Desktop 1440px, tablet 768px, telefon 390px/320px; borang tiada limpahan mendatar |
| Label dan kontras | Tiada kawalan borang tanpa label; ujian kontras tema lulus |

Unit: **58 lulus, 0 gagal, 2 dataset peribadi dilangkau**. TypeScript dan production build lulus. **151 semakan Worker/Durable Object/D1** lulus. Imbasan sumber/bundle dan semakan privasi statik lulus. Excel yang dimuat turun melalui kedua-dua butang browser dibaca semula: tiga helaian, penapis tepat, data sintetik sahaja dan tiada formula.

Login live diuji dengan akaun QA sementara, termasuk kata laluan salah, perubahan pertama, tamat sesi, logout dan rate limit. Akaun/kata laluan GPM tidak diubah. Semua credential QA dibatalkan selepas ujian. Import sintetik dibatalkan secara boleh pulih dan murid sintetik diarkibkan dengan sejarah audit kekal. Ujian responsif menggunakan emulasi viewport, bukan peranti Android fizikal.

## Fail diubah

- `app/litric.tsx`, `app/litric.css`
- `app/modules/workspace-views.tsx`, `app/modules/independent-views.tsx`, `app/modules/import-centre.tsx`
- `app/modules/student-report-controls.tsx` (baharu)
- `app/api/[...path]/route.ts`, `lib/server.ts`
- `lib/student-identity.mjs`, `lib/student-report.mjs`, `lib/nilam-workbook.ts` (baharu)
- `tests/student-report.test.mjs` (baharu), `tests/standalone.integration.mjs`
- `scripts/test-live-pilot.mjs`, `README.md`, dokumen ini

Empat modul utama kekal. Backend Sites lama dan rekod asalnya tidak diubah. Perubahan diterbitkan pada feature branch untuk semakan PR; tiada force-push atau merge automatik.
