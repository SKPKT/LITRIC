# Deployment dan migrasi Cloudflare LITRIC V2

## Status dan sempadan

22 Oktober 2026: akaun sekolah disahkan melalui Wrangler. D1 baharu `litric-school` dicipta di APAC dan tiga migrasi skema diterapkan pada D1 baharu sahaja. Aplikasi lama dan datanya tidak diubah. Rintis tersedia di **https://litric-pilot.g-18197853.workers.dev** dengan login diaktifkan melalui backend SQLite Durable Object persendirian pada Workers Free. D1 menyimpan rekod/auth; Durable Object menyediakan bajet CPU hashing dan menyirikan permintaan sekolah. Auth, import XLSX sintetik dan empat modul diuji pada URL sebenar menggunakan akaun QA sementara. Setup GPM oleh pemilik masih diperlukan; ini belum penerimaan produksi atau migrasi rekod sebenar. Jangan merge dan aktifkan automasi produksi sebelum semakan kod dan acceptance test sekolah selesai.

Sumber asal awam ialah commit `d13ed71f66333148f69019fba84e21225f6856f8` dalam SKPKT/LITRIC. Backend lama yang dikenal pasti ialah managed Sites, dengan binding `DB` (D1) dan `BUCKET` (R2), project `appgprj_6ad81f2da70c81918c3f95bf37e8c9ce`. Binding ini bukan ID D1 dalam akaun sekolah. Tiada eksport pangkalan data produksi diterima atau diandaikan tersedia.

## 1. Autorisasi yang sekolah perlu sediakan

- Akaun Cloudflare yang dikawal sekolah dan akaun pengguna dengan kebenaran Workers/D1. Workers Free disokong: gunakan binding `SCHOOL_SERVICE` dan migrasi `new_sqlite_classes` seperti template. Jangan pindahkan hashing ke outer Worker yang mempunyai had CPU lebih rendah. Tiada pembelian pelan diperlukan untuk rintis ini.
- Kebenaran untuk mencipta **database D1 baharu dan terasing**, `litric-school`, serta Worker baharu, `litric-api` atau nama yang sekolah pilih. Jangan guna atau padam database lama.
- Bagi GitHub Actions: token Cloudflare terskop kepada akaun sekolah, dengan `Account / Workers Scripts / Edit` dan `Account / D1 / Edit`. Jangan beri akses semua akaun atau Global API Key. Jika custom domain digunakan, tambahkan hanya kebenaran route/DNS yang benar-benar diperlukan. Semak nama izin yang dipaparkan Cloudflare semasa membuat token.
- Authorized backup eksport JSON versi 1 daripada aplikasi lama, serta objek R2 yang dirujuk jika ada. Hantar melalui saluran fail selamat; jangan commit ke GitHub.
- Kata laluan bootstrap sementara yang dipilih sendiri oleh pentadbir, dimasukkan **hanya dalam prompt tersembunyi** pada mesin yang dipercayai. Jangan gunakan semula kata laluan yang telah dikongsi dalam chat. Jangan simpan dalam repository, GitHub secret, Actions input, shell argument atau log.

Wrangler telah diberi izin dan resource rintis baharu telah dicipta dalam akaun sekolah. Jangan cipta semula database rintis yang sudah wujud. Pengeluaran token CI dan pemberian GitHub App access mesti dilakukan oleh pemilik akaun sekolah; tiada pembelian pelan dilakukan.

## 2. Akaun, database dan konfigurasi

Pada mesin pentadbir, dalam feature branch yang disemak:

```sh
npm ci --include=dev --include=optional
npx wrangler login
npx wrangler whoami
npx wrangler d1 create litric-school
```

Sahkan akaun yang dicetak ialah akaun sekolah. Salin `database_id` daripada hasil sebenar. Template `standalone/wrangler.jsonc` mengandungi ID placeholder yang tidak boleh digunakan untuk produksi.

Set pemboleh ubah menggunakan shell anda, tanpa meletakkan token dalam fail sumber:

```sh
# POSIX shell; nilai ID ini bukan rahsia.
export CLOUDFLARE_ACCOUNT_ID='ACCOUNT-ID-SEKOLAH-SEBENAR'
export CLOUDFLARE_D1_ID='ID-UUID-SEBENAR-DARIPADA-CLOUDFLARE'
export LITRIC_WORKER_NAME='litric-api'
npm run configure:cloudflare
```

PowerShell menggunakan `$env:CLOUDFLARE_D1_ID = '...'` dan `$env:LITRIC_WORKER_NAME = 'litric-api'`. Script menolak placeholder dan menghasilkan `standalone/wrangler.generated.jsonc` yang diabaikan Git. Fail ini tidak mengandungi token.

## 3. Backup, validasi dan restore terasing

### Mendapatkan backup asal (belum dilaksanakan)

Pemilik/pentadbir sah perlu membuka aplikasi Sites lama, log masuk melalui mekanisme lamanya, dan menggunakan **Tetapan → Sandaran & pemulihan → Muat turun sandaran** jika menu tersebut tersedia. Endpoint asal `/api/backup` memerlukan pentadbir; ia mengeksport JSON versi 1 untuk sekolah berkenaan, bukan hash/sesi GPM V2. Penggunaan login lama untuk mengambil backup tidak menjadikan Sites backend V2. Jangan menghantar password, session header atau fail backup melalui repository awam.

Jika menu/eksport tidak tersedia atau akses gagal, pemilik perlu mendapatkan eksport daripada pentadbir hosting Sites: nyatakan project `appgprj_6ad81f2da70c81918c3f95bf37e8c9ce`, binding `DB` dan `BUCKET`, skop sekolah ABA6052, timestamp serta inventori jadual/objek. Binding ini bukan credential atau ID yang memberi akses Cloudflare sekolah. Jangan jalankan `wrangler d1 export` terhadap ID rekaan atau menganggap akaun sekolah boleh membaca managed resource Sites.

JSON database hanya mengandungi metadata/rujukan R2. Dapatkan **salinan binari objek R2** secara berasingan, bersama key, saiz dan checksum (termasuk sumber import dan fail bukti yang dirujuk). Tiada bucket R2 baharu dicipta untuk rintis kerana empat modul menggunakan D1 dan belum menerima fail asal untuk dipindahkan. Simpan kedua-dua sandaran dalam storan sekolah yang terkawal.

Sebelum restore sebenar, minta kebenaran migrasi khusus daripada pemilik selepas manifest/checksum dan perbandingan sintetik diperiksa. Ambil backup kosong atau snapshot D1 sasaran sebelum restore. Jangan guna fail SQL eksport penuh untuk menulis ganti skema/auth V2; jika hanya SQL dibekalkan, sediakan penukaran terasing dan semak pemetaan dahulu.

Jangan migrasi tanpa sandaran berizin yang sah. Simpan backup di luar repo, dengan kawalan akses dan salinan pemulihan. Rakam checksum, tarikh eksport, pemilik eksport dan lokasi asal.

```sh
node scripts/validate-backup.mjs /private/old-backup.json /private/source-manifest.json
node scripts/restore-backup.mjs /private/old-backup.json /private/reviewed-restore.sql
```

Validator menolak sekolah selain ABA6052, jadual wajib yang hilang, ID pendua dan rujukan sejarah rosak. Manifest mengandungi kiraan jadual, jumlah mentah mengikut tahun dan senarai key objek; jumlah mentah bukan pengiktirafan bintang. Script restore hanya menyediakan INSERT yang tidak menulis ganti rekod.

Semak SQL secara tertutup. Kemudian, **hanya pada D1 baharu**:

```sh
npx wrangler d1 migrations apply litric-school --remote --config standalone/wrangler.generated.jsonc
npx wrangler d1 execute litric-school --remote --config standalone/wrangler.generated.jsonc --file /private/reviewed-restore.sql
```

Jika tiada data lama untuk dipindahkan, jalankan migrations sahaja dan kekalkan status `migration pending` sehingga backup diterima. Jangan label database kosong sebagai data lama yang telah dipindahkan.

Sebelum cutover, bandingkan jumlah students/aliases/batches/summaries/events/audit/class history, aggregate tahun yang dipilih dan contoh identiti sekolah antara backup dan database baharu. Semak bahawa `PRAGMA foreign_key_check` tidak memulangkan baris. Bandingkan juga jumlah yang disahkan melalui API/login selepas bootstrap. Jika mana-mana kiraan berbeza, hentikan cutover dan kekalkan app lama. R2 lama tidak dipindahkan oleh restore JSON; salin objek secara berasingan dengan inventori/checksum dan kekalkan metadata asal.

## 4. Setup GPM satu kali

Deploy backend dahulu, kemudian jalankan dalam terminal interaktif yang dipercayai:

```powershell
$env:LITRIC_PRODUCTION_URL = 'https://litric-pilot.g-18197853.workers.dev'
npm run bootstrap:cloudflare
```

Skrip memeriksa akses Worker dan menyegarkan sesi OAuth yang masih boleh diperbaharui sebelum meminta password. Untuk semakan tanpa password/secret, jalankan `node scripts/bootstrap-cloudflare.mjs --check`. Jika sesi tidak tersedia, jalankan arahan `wrangler login --scopes account:read user:read workers:write workers_scripts:write d1:write` menggunakan pemasangan projek, lengkapkan Authorize sendiri dan ulang setup. Proses child bukan interaktif tidak boleh memulakan login baharu; ini tidak bermaksud password GPM salah atau memerlukan token dalam chat. Output ralat Wrangler tidak dicetak mentah kerana ia mungkin mengandungi nilai peribadi.

Prompt meminta kata laluan sementara dua kali tanpa echo, sekurang-kurangnya 10 aksara. CLI menjana kunci rawak 256-bit; hanya hash kunci dan masa tamat 10 minit dimasukkan sebagai secret `LITRIC_BOOTSTRAP_HASH` dan `LITRIC_BOOTSTRAP_EXPIRES_AT` melalui stdin Wrangler. Password dihantar melalui HTTPS ke endpoint setup sekolah, dihash scrypt pada pelayan dan hash bersalt disimpan dalam D1. Tiada password dihantar dalam argumen shell, log, fail sumber atau fail SQL. CLI memadam dua secret setup selepas selesai; jika pemadaman gagal, padam kedua-duanya melalui Cloudflare. Tamat masa dan kewujudan GPM tetap menghalang penggunaan semula. Kunci salah/tamat memberi 404, setup kedua memberi 409 tanpa menulis ganti akaun.

Untuk ujian tempatan sahaja, `npm run bootstrap:admin -- --local` masih tersedia. Jangan jalankan bootstrap dalam GitHub Actions.

Pada log masuk pertama, GPM mesti memilih kata laluan baharu sekurang-kurangnya 12 aksara. Semua sesi sementara dibatalkan selepas perubahan dan pentadbir log masuk semula. Tiada langkah bootstrap di GitHub Actions.

## 5. Deploy awal secara manual ke Worker baharu

### Rintis Workers Free dengan backend Durable Object

Jangan mengurangkan parameter scrypt. Gunakan nama Worker rintis dan konfigurasi:

```powershell
Remove-Item Env:LITRIC_PILOT_MODE -ErrorAction SilentlyContinue
$env:LITRIC_WORKER_NAME = 'litric-pilot'
npm run configure:cloudflare
```

Wrangler mencipta SQLite Durable Object melalui migration `litric-service-v1`; ia bukan D1 lama atau salinan data lama. Outer Worker menyediakan React/ASSETS dan menyampaikan API hanya kepada binding persendirian; objek itu mempunyai bajet CPU berasingan 30 saat dan D1 kekal storan utama. `/health` melaporkan `loginEnabled:true`. Endpoint data masih 401 tanpa sesi, dan sesi login pertama menerima 428 sehingga password ditukar.

Pilihan kecemasan `LITRIC_PILOT_MODE=true` masih boleh menjana konfigurasi yang menyekat auth 503 dan data 401 sebelum hashing. Ia bukan konfigurasi live semasa. Jangan gunakan gate CI untuk produksi sehingga penerimaan sekolah selesai.

### Izin OAuth dan GitHub

Autorisasi awal membolehkan D1, tetapi deployment mula-mula ditolak pada API Workers scripts/deployments. Selepas pemilik meluluskan Workers Scripts, sambungan semula berjaya dan rintis dimuat naik. Untuk sambungan mesin baharu, gunakan:

```sh
npx wrangler login --scopes account:read user:read workers:write workers_scripts:write d1:write
```

Pemilik akaun perlu menekan **Authorize** pada laman Cloudflare. Jika pautan tamat tempoh, jalankan semula arahan itu dan gunakan pautan baharu. Untuk GitHub, semakan UI menunjukkan hanya Cloudflare Workers and Pages dipasang; ChatGPT Codex Connector belum dipasang pada SKPKT/LITRIC. Pemberian identiti pengguna sahaja tidak memberi integration akses repository. Pasang app rasmi tersebut dengan **Only select repositories → SKPKT/LITRIC**, semak izin code/PR/workflows/Actions/issues, dan tekan **Install & Authorize** sendiri. Penolakan 403 tidak dipintas melalui credential lain. Jangan paste token dalam chat.

```sh
npm test
npm run typecheck
npm run build:cloudflare
node scripts/check-pages.mjs --worker
npm run build:api
npm run test:api
npm run check:public
npm run deploy:cloudflare
```

Salin **URL sebenar yang Wrangler pulangkan**; jangan reka workers.dev subdomain. Buka URL itu tanpa akaun ChatGPT, uji login GPM dan tukar password, serta jalankan acceptance test di bawah. Jangan mengarahkan pengguna sekolah ke V2 sehingga migrasi dan login diluluskan.

## 6. GitHub → Cloudflare automatik

Repository kekal `SKPKT/LITRIC`. Feature branch / pull request digunakan. Jangan beri workflow PR akses kepada token produksi.

Di GitHub Settings → Environments, buat `cloudflare-production`, hadkan kepada branch `main`, dan tetapkan required reviewer sekolah jika pelan GitHub menyokongnya. Tambah:

| Jenis | Nama | Nilai |
|---|---|---|
| Environment secret | `CLOUDFLARE_API_TOKEN` | Token Cloudflare terskop di atas |
| Environment secret | `CLOUDFLARE_ACCOUNT_ID` | Account ID sekolah |
| Repository variable | `CLOUDFLARE_D1_ID` | Database ID baharu yang disahkan |
| Repository variable | `LITRIC_WORKER_NAME` | Nama Worker sebenar, misalnya `litric-api` |
| Repository variable | `LITRIC_PRODUCTION_URL` | Origin HTTPS sebenar tanpa trailing slash |
| Repository variable | `LITRIC_CLOUDFLARE_READY` | `true` hanya selepas setup, migrasi/keputusan penangguhan dan acceptance test diluluskan |

`.github/workflows/cloudflare.yml` menguji PR; selepas merge ke main ia memasang dependency, menguji, typecheck, membina frontend, mengimbas artifact awam, membina Worker dan menguji API/D1. Job deploy menunggu gate di atas dan approval environment. Ia menjana config daripada ID sekolah, membina frontend, menerapkan migrations dan deploy Worker, kemudian memeriksa frontend, `/health` dan 401 untuk `/api/state` tanpa sesi.

Semakan automatik URL tidak menggantikan login manusia. Script tidak pernah menyimpan atau menggunakan password GPM di CI. Deployment pertama mesti diuji dengan GPM pada URL sebenar sebelum dilaporkan berfungsi. Workflow Pages lama ialah build manual sahaja dan tiada job deployment. Jangan guna GitHub Pages sebagai sasaran V2 Cloudflare.

## 7. Acceptance test pada URL sebenar

- Buka tanpa ChatGPT; tunjuk halaman login LITRIC.
- Password salah ditolak; username GPM dan password sementara membuka skrin tukar password sahaja.
- Tukar password, log masuk semula, lihat empat modul sahaja.
- `/api/state` tanpa bearer memberi 401; Sites identity headers tidak memberikan akses.
- Import CSV/XLSX/ZIP sintetik bercampur sekolah; hanya ABA6052 disimpan.
- Verify tahun dan skop; contoh 120+180+100 memberi 400/2 bintang/32 baki. Penapis tahun tidak memadam lifetime.
- Import pendua tidak ditambah; overlap menghalang pengiktirafan; rollback selamat.
- Tandakan berpindah, arkib, pulih; sejarah bacaan kekal.
- Logout membatalkan sesi; refresh memerlukan login semula; selepas 30 minit sesi ditolak server.
- Semak desktop dan Android, dark/high-contrast, keyboard focus dan reduced motion.
- Bandingkan data migrasi sebenar dengan manifest sebelum cutover.

Rakam URL, commit, tarikh, penguji dan hasil. Jika belum dilakukan, status tetap **belum disahkan produksi**.

Rujukan: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

## GitHub write access

The initial connection rejected branch creation with HTTP 403, `Resource not accessible by integration`. GitHub UI confirmed the Codex Connector was not installed. After the owner approved installation for SKPKT/LITRIC only, the installation completed and remote branch creation succeeded. Main was not changed. Publish through the now-authorized connector and open a draft pull request for human review. The source archive and patch remain available as recovery copies.

After granting the GitHub connection repository Contents write and Pull requests write access, publish the branch through the authorized connection. Alternatively, on a school-managed machine already authorized for GitHub:

```sh
git clone https://github.com/SKPKT/LITRIC.git
cd LITRIC
git switch -c feat/litric-v2-standalone
git am /path/to/LITRIC-V2.patch
git push -u origin feat/litric-v2-standalone
gh pr create --draft --base main --head feat/litric-v2-standalone --title "Build standalone Cloudflare LITRIC" --body "Standalone Worker frontend/API with private Durable Object, secure server-side GPM setup, verified lifetime NILAM and Purple UI. Synthetic live pilot passed. See VALIDATION.md and DEPLOYMENT.md. School GPM acceptance, backup migration and production CI remain pending."
```

Request a human review and keep the deployment gate disabled until the school has completed the Cloudflare and backup steps. Do not paste GitHub or Cloudflare tokens into chat or public files.
