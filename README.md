# LITRIC V2 — aplikasi sekolah kendiri

**Literacy Intelligence for Tracking, Reporting, Insights & Competency**
Every Read Counts. Every Progress Matters.
SK Pendidikan Khas Taiping · ABA6052

V2 menjalankan React dan API pada **Cloudflare Worker yang sama**, dengan Cloudflare D1. Ia tidak memerlukan akaun ChatGPT, Sites atau tetingkap popup. Sumber disediakan dalam feature branch dan mesti melalui semakan pull request sebelum produksi.

**Status (22 Oktober 2026):** login dan empat modul rintis tersedia di [litric-pilot.g-18197853.workers.dev](https://litric-pilot.g-18197853.workers.dev). Backend menggunakan SQLite Durable Object persendirian untuk bajet CPU scrypt pada Workers Free; D1 kekal storan rekod dan pengesahan. Ujian live dengan akaun QA sementara dan XLSX sintetik lulus: salah password, tukar password pertama, sesi, rate limit, ABA6052, pendua, overlap, arkib/pulih serta 400 bacaan / 2 bintang / baki 32. **Setup kata laluan GPM dan penerimaan oleh pentadbir sekolah masih diperlukan.** Tiga migrasi diterapkan pada D1 baharu sahaja; tiada rekod produksi lama dipindahkan. GitHub App kini dipasang untuk SKPKT/LITRIC sahaja; masalah 403 dipulihkan dan feature branch berjaya dicipta. Konfigurasi hosting lama dikekalkan tanpa mengganggu produksi asal.

Empat modul utama sahaja:

1. Dashboard Analitik — laporan tahunan, jumlah terkumpul disahkan, taburan bintang, kelas dan pencapaian tertinggi.
2. Import Data AINS — CSV, XLSX dan ZIP, padanan kod ABA6052, pratonton, pemetaan lajur, kumpulan mengikut tahun, pengesahan skop, sejarah dan rollback.
3. Pengurusan Murid — identiti kekal, kelas/tahun, murid semasa/berpindah, arkib dan pulih tanpa memadam sejarah.
4. Pencapaian Bintang NILAM — rekod mengikut tahun, jumlah terkumpul, sasaran seterusnya dan versi peraturan sekolah yang boleh disunting.

## Pembangunan

Node 22.13+ dan npm diperlukan.

```sh
npm ci --include=dev --include=optional
npm test
npm run typecheck
npm run build:cloudflare
node scripts/check-pages.mjs --worker
npm run build:api
npm run test:api
npm run check:public
```

`build:cloudflare` menghasilkan `dist-worker/`; Wrangler memuatkan frontend dan API bersama. `build:api` ialah dry run, bukan deployment. `test:api` menggunakan runtime Worker/D1 terasing dengan data sintetik dalam memori dan tidak menyentuh produksi.

Untuk preview tempatan penuh:

```sh
npm run build:cloudflare
npx wrangler d1 migrations apply litric-school --local --config standalone/wrangler.jsonc
npm run bootstrap:admin -- --local
npm run dev:api
```

Buka URL Wrangler yang dicetak. Masukkan kata laluan sementara melalui prompt tersembunyi; ia tidak dibekalkan dalam sumber. Akaun GPM mesti menukar kata laluan sebelum mengakses rekod murid. Hash scrypt menggunakan salt rawak, N=32768, r=8, p=3. Backend berjalan dalam SQLite Durable Object dengan bajet CPU berasingan yang disokong Workers Free; tiada pelemahan hashing atau pertukaran pelan diperlukan. Untuk setup live, gunakan `npm run bootstrap:cloudflare` dengan `LITRIC_PRODUCTION_URL` ditetapkan: rahsia setup sementara dihantar melalui stdin kepada Cloudflare dan hashing berlaku pada pelayan.

## Produksi dan migrasi

Ikuti [DEPLOYMENT.md](DEPLOYMENT.md) untuk akaun sekolah, D1, token GitHub Actions, setup GPM, migrasi dan acceptance test. [VALIDATION.md](VALIDATION.md) membezakan bukti ujian tempatan daripada perkara yang masih menunggu. [SECURITY_REVIEW.md](SECURITY_REVIEW.md) menerangkan keselamatan dan had operasi.

Workflow utama ialah `.github/workflows/cloudflare.yml`. Ia menguji PR dan hanya deploy selepas merge ke `main`, environment `cloudflare-production` diluluskan, dan `LITRIC_CLOUDFLARE_READY=true`. Workflow Pages lama kekal sebagai build manual tanpa job deployment. GitHub Pages bukan sasaran utama V2.

## Ketepatan NILAM

Hanya bacaan diluluskan daripada skop bebas yang disahkan dikira. Snapshot kemudian mengganti snapshot terdahulu dengan garis asas sama; ringkasan bertindih tidak dijumlah. Tahun yang berbeza boleh digabung melalui identiti murid yang disahkan. Penapis tahunan tidak mengehadkan jumlah seumur persekolahan.

Contoh sintetik: 2023=120, 2024=180, 2025=100 → **400 bacaan, 2 bintang, 32 lagi ke 3 bintang**. Rekod belum disahkan tetap kelihatan dan tidak diberikan pengiktirafan rasmi. Ambang sekolah: 144/288/432/576/720; markah: 3/4/5/6/7. Ini konfigurasi sekolah yang masih memerlukan semakan rasmi.

Tiada rekod murid sebenar atau kata laluan bootstrap disertakan dalam repositori awam. R2 tidak diperlukan untuk empat modul ini: raw baris sekolah, rujukan fail dan fingerprint disimpan dalam D1. Jika sekolah mahu arkib binari asal, gunakan bucket R2 peribadi dan migrasi objek secara berasingan sebelum cutover.

GitHub App kini dipasang untuk SKPKT/LITRIC sahaja dan penciptaan feature branch berjaya selepas masalah 403 dibetulkan. Perubahan mesti melalui pull request dan semakan manusia; jangan terus deploy main sebelum penerimaan GPM dan persediaan CI sekolah.
