# LITRIC

**Literacy Intelligence for Tracking, Reporting, Insights & Competency**
Every Read Counts. Every Progress Matters.
SK Pendidikan Khas Taiping · ABA6052 · Ekosistem SMARTLIB

Kategori: **Literacy Intelligence & Analytics Platform**.

## Keluaran LITRIC dan GitHub Pages

Penjenamaan, tipografi Manrope/Inter tempatan, ikon, metadata, sijil dan eksport telah dikemas kini daripada aplikasi asal. Binaan backend masih menggunakan Vinext/Cloudflare Worker. Binaan kedua menggunakan aplikasi React yang sama untuk frontend statik, dengan base tepat `/LITRIC/` dan navigasi hash.

```sh
npm ci --include=dev --include=optional
npm test
npm run typecheck
npm run build:pages
npm run preview:pages
```

Workflow `.github/workflows/deploy.yml` membina/memeriksa pull request dan menerbitkan perubahan `main` ke Pages setelah kawalan semakan repositori diluluskan. Hanya `dist-pages/` dimuat naik. Backend `/bridge` telah diterbitkan secara peribadi; frontend Pages menggunakan tetingkap log masuk backend tanpa menyalin token/sesi ke kod awam.

**Status: sudah diterbitkan.** [Buka LITRIC](https://skpkt.github.io/LITRIC/). Repositori `SKPKT/LITRIC` dijadikan Public dengan arahan jelas pemilik; hanya sumber yang telah dibersihkan dimuat naik. GitHub Actions lulus dan URL/aset produksi disahkan. Backend `/bridge` juga diterbitkan secara peribadi pada Site sedia ada. Sambungan menggunakan sesi pentadbir sebenar berjaya memuatkan dashboard melalui Pages; data murid kekal di backend berizin.

Pakej awam mempunyai `lib/seed-data.json` kosong dan tiada sejarah Git/data murid. `npm run check:public` mengesahkannya. Checkout asal peribadi mengandungi sumber sebenar; **jangan push checkout atau sejarah peribadi itu ke GitHub awam**. Jalankan `npm run export:public -- ../LITRIC-public-new` ke direktori baharu untuk menyediakan salinan bersih selepas suntingan.

Baca [DEPLOYMENT.md](DEPLOYMENT.md) untuk langkah GitHub/backend, pemulihan dan ujian sebelum penerbitan; [SECURITY_REVIEW.md](SECURITY_REVIEW.md) untuk penemuan dan had keselamatan; [VALIDATION.md](VALIDATION.md) untuk keputusan sebenar.

LITRIC ialah aplikasi analitik sekolah yang berasingan daripada sistem rasmi KPM/AINS. Antara muka utama menggunakan Bahasa Melayu. Markah awal ialah konfigurasi sekolah; pengesahan rujukan semasa mesti dilakukan oleh pentadbir.

## Mulakan

Site yang dibekalkan kekal peribadi. Log masuk dengan akaun pemilik melalui ChatGPT. Identiti pentadbir awal ditetapkan dalam rahsia pelayan `LITRIC_ADMIN_EMAIL`, dengan alias lama `LITRIX_ADMIN_EMAIL` dikekalkan. Dalam checkout/deployment peribadi asal, log masuk pertama pemilik memuatkan lapan fail yang dibekalkan; import ini idempoten dan memuatkan hanya ABA6052. Pakej sumber awam tidak membawa fail tersebut. Semak SOURCE_REVIEW.md sebelum mengesahkan tempoh.

Tiada repositori SMARTLIB, Apps Script, skema Google Sheets, logo atau kelayakan katalog dibekalkan. Projek ini tidak menimpa sebarang sistem SMARTLIB. Nama institusi dipelihara tanpa logo rekaan. SMARTLIB kekal belum disambungkan sehingga adapter sebenar dikonfigurasi.

## Seni bina

- React 19 dan Vinext / Vite pada Cloudflare Workers melalui Sites. Navigasi modul berasaskan hash. `app/litric.tsx` menyediakan rangka, dashboard, analitik dan antara muka murid ringkas.
- `app/modules/import-centre.tsx` mengendalikan CSV secara berkelompok dalam pelayar, XLSX dan ZIP dengan had saiz, pemetaan dan pratonton pelayan. Baris sekolah lain tidak dihantar ke pelayan.
- `lib/server.ts` menyediakan kebenaran, import, CRUD, padanan identiti, skop pelaporan dan audit. `app/api/[...path]/route.ts` memanggilnya pada setiap permintaan yang dilindungi.
- D1 menyimpan 26 jadual ternormal termasuk sekolah, murid, alias, sejarah kelas, kelompok, ringkasan/snapshot, ralat, bacaan sekolah, sasaran, versi peraturan, program, peserta, bukti, sijil dan audit. Indeks merangkumi sekolah, identiti, kelompok dan masa. Migrasi skema sahaja berada dalam `drizzle/`.
- R2 menyimpan sumber sekolah, bukti program dan salinan sandaran. Data peribadi tidak dimasukkan ke dalam bundle pelayar. Dalam checkout peribadi, `lib/seed-data.json` diimport hanya oleh modul pelayan yang dilindungi; eksport awam menggantikannya dengan `[]`.
- `lib/domain.mjs` ialah enjin pengiraan tulen yang dikongsi dashboard dan laporan. `lib/exports.ts` menjana Excel bertip dan PDF A4 dengan QR sijil.

Semua operasi menggunakan `school_id` daripada pengguna pelayan. Pentadbir mengurus sekolahnya. Guru hanya melihat murid dalam kelas ditugaskan dan program sendiri. Murid hanya melihat profilnya. Peranan paparan hanya menerima agregat tanpa identiti. Sites masih memerlukan pemilik memberikan akses Site; menetapkan peranan aplikasi tidak menukar khalayak Site atau menghantar e-mel.

## Skop dan ketepatan data

- Sumber sebenar: workbook mempunyai 20 pengecam / 362 bahan mentah; CSV mempunyai 28 pengecam / 322 bahan mentah. Angka ini ialah kawalan ujian dan tidak digunakan sebagai pemalar dashboard.
- Semua import awal mempunyai tahun NULL dan status **Tempoh belum disahkan**. Nama fail bukan bukti tahun atau agregat bukan kumulatif.
- Pengecam sumber yang sama dan nama konsisten memaut pada profil kekal. Persamaan nama sahaja tidak pernah menggabung. Nama bercanggah dipegang untuk semakan. Gabungan manual boleh dibatalkan tanpa menulis semula sumber.
- Pendua tepat dan import semula tidak menambah bacaan. Snapshot terkini menggantikan snapshot terdahulu bagi identiti, set data dan tahun yang sama. Pertindihan antara skop yang disahkan, termasuk set data berlainan, disekat daripada bintang.
- Bintang memerlukan tahun, tempoh, jenis agregat dan kelayakan yang disahkan. Tahun berlainan tidak digabung untuk bintang. Kurang daripada 144 bahan memaparkan **Belum layak** bagi PAJSK.
- Bacaan sekolah dan pinjaman SMARTLIB tidak menambah jumlah AINS. Pautan manual kepada ringkasan AINS menyimpan bukti guru tanpa membuat bacaan berganda.
- Carta CSV menyatakan bulan sebagai petunjuk nama fail. Bulan tiada rekod tidak diisi sifar. Amaran penglibatan membezakan data tidak tersedia daripada tiada bacaan dalam tempoh lengkap.
- Laporan program mengehadkan pencapaian kepada senarai murid peserta. Tiada bacaan individu diatribusi secara automatik kepada program. Foto JPG/PNG disertakan dalam PDF; format sokongan lain disenaraikan sebagai bukti terlindung. Sehingga 8 bukti imej, dengan bajet keseluruhan 12 MB, disertakan untuk mengawal memori Worker. Bukti lain kekal boleh dicapai dalam aplikasi.

## Penggunaan tempatan

Prasyarat: Node >=22.13, npm dan Git. Gunakan direktori projek ini.

```sh
npm ci --include=dev --include=optional
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_spotty_the_initiative.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_nebulous_kinsey_walden.sql
npm run dev
```

`npm run dev` melayani loopback. Buka URL yang dicetak, kemudian Log masuk dengan ChatGPT untuk identiti simulasi `seedy@sites.test`. Simulasi ini ialah ciri pembangunan starter dan tidak disertakan dalam binaan produksi. Pangkalan data tempatan dan produksi adalah berasingan. Jangan anggap data ujian tempatan diterbitkan ke D1 produksi.

```sh
npm test
npm run typecheck
npm run build
```

Ujian integrasi memerlukan Worker terbina pada pangkalan data tempatan:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8787 --inspector-port 0
node tests/http.integration.mjs
```

Skrip menolak hos bukan loopback. Header identiti dalam ujian mensimulasikan header dipercayai daripada Sites dispatch. Jangan dedahkan Worker ini terus kepada Internet tanpa lapisan identiti yang mengesahkan dan menapis header. Fixture ujian menggunakan domain `example.invalid`.

## Penerbitan & konfigurasi

Penerbitan Sites menggunakan `.openai/hosting.json` yang mengekalkan ID projek, binding `DB` dan `BUCKET`. Sites menyediakan storan dan menggunakan migrasi sebelum Worker. Kekalkan integrasi build `sites()` dan gunakan helper Sites untuk commit/push, pembungkusan dan penerbitan versi tersimpan. Tiada kata laluan atau token Git disimpan dalam repositori.

Rahsia runtime:

| Nama | Tujuan |
|---|---|
| `LITRIC_ADMIN_EMAIL` | Akaun pemilik untuk butstrap pentadbir pertama |
| `SMARTLIB_API_KEY` | Pilihan, token katalog di pelayan sahaja |

Tetapkan URL katalog HTTPS dalam Tetapan Sistem. Adapter melakukan `GET <URL>?q=<carian>&school=ABA6052`, menghantar `Authorization: Bearer <SMARTLIB_API_KEY>` jika tersedia, menolak redirect dan mengehadkan respons. Kontrak respons:

```json
{"books":[{"id":"ID-KATALOG","title":"Tajuk sebenar","author":"Pengarang","isbn":"ISBN","category":"fiction","language":"bm","cover":"https://...","availability":"Tersedia"}]}
```

Sediakan adapter berasingan bagi Apps Script/Sheets sedia ada dan kuatkuasakan kebenaran di situ. Tiada peminjaman ditukar menjadi bacaan, dan tiada sambungan berjaya direka. Pengimbas kamera menggunakan BarcodeDetector apabila disokong; input ISBN/QR manual tersedia pada semua pelayar. Kebenaran kamera diminta hanya selepas pengguna memilih Imbas.

## Sandaran dan pemulihan

Pentadbir boleh memuat turun JSON sandaran melalui Tetapan Sistem. Fail salinan disimpan di R2. Sandaran mengandungi data peribadi: simpan dalam storan sekolah yang dibenarkan. Ia tidak memasukkan byte semua objek R2. Simpan/copy awalan sekolah R2 (imports, evidence dan backups) melalui pentadbiran storan sebelum pemulihan atau perpindahan.

```sh
node scripts/restore-backup.mjs LITRIC-sandaran.json reviewed-restore.sql
```

Helper mengesahkan versi, jadual/lajur dan skop sekolah serta menghasilkan INSERT untuk **pangkalan data baharu yang sudah dimigrasi**. Semak SQL dan pulihkan objek R2 bersama kunci asal sebelum menukar binding. Ia tidak memadam atau menimpa data sedia ada. Uji proses ini pada pangkalan data berasingan. Polisi pengekalan dan jadual sandaran organisasi perlu dikonfigurasi oleh operator; aplikasi tidak mendakwa sandaran berjadual telah diaktifkan.

## Had operasi yang diketahui

Ini ialah keluaran berfungsi untuk rintis sekolah, dengan had 5,000 baris sekolah setiap kelompok import, 15 fail, CSV 70 MB, XLSX 15 MB, ZIP 70 MB dan bukti 8 MB. Direktori murid berhalaman dalam klien. Analitik merangkumi data sekolah yang dibaca pada permintaan; sebelum penggunaan berbilang sekolah berskala besar, tambahkan pagination pertanyaan, cache berasaskan versi dan ringkasan prahitung serta ujian beban mengikut saiz sebenar.

Import menyokong ringkasan AINS serta peristiwa individu. Mod peristiwa memerlukan `event_id`, `reading_date` (YYYY-MM-DD), `title`, `approval_status` (approved/rejected/pending), pengecam murid dan kod sekolah. Hanya status approved dikira sebagai diluluskan. Daftar ID peristiwa unik menghalang pengiraan berulang merentas fail, termasuk import serentak. Pembatalan melepaskan daftar aktif sambil mengekalkan rekod asal; pemulihan ditolak jika ID telah digunakan oleh kelompok aktif lain. Penukaran ringkasan kepada peristiwa individu ditolak. Fail aktiviti berbilang tahun perlu dipecahkan sebelum kelayakan bintang disahkan.

Integrasi SMARTLIB langsung, rujukan PAJSK semasa, tahun/tempoh sumber serta kelas/enrolmen sebenar memerlukan data sekolah yang belum dibekalkan. Sijil selain bintang memerlukan asas pengiktirafan guru; aplikasi tidak mereka ukuran konsistensi atau sebab peningkatan. Lihat VALIDATION.md untuk bukti semakan sebenar dan had ujian UI.

Rujukan teknikal: [ExcelJS](https://github.com/exceljs/exceljs), [fflate](https://github.com/101arrowz/fflate), serta README starter Sites dalam pakej pemasangan.
