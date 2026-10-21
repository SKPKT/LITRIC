# LITRIC — keputusan pengesahan

21 Oktober 2026. Keluaran kod 1.1.0. Penjenamaan dan konfigurasi migrasi disediakan daripada aplikasi asal. **Sudah diterbitkan** selepas pemilik memberikan repo dan mengizinkan repo LITRIC menjadi Public. Frontend Pages dan backend peribadi berjaya diterbitkan; sambungan sesi pentadbir sebenar berjaya memuatkan dashboard.

## Keputusan sebenar

| Semakan | Keputusan |
|---|---|
| Checkout peribadi: `npm test` | **48 lulus**, 0 gagal. Termasuk kawalan lapan sumber sebenar, pengiraan, peranan, sambungan Pages dan had badan permintaan. |
| Sumber awam: `npm test` | **46 lulus**, 2 dilangkau dengan sebab jelas kerana sumber peribadi tidak disertakan; 0 gagal. |
| TypeScript | `tsc --noEmit` lulus pada checkout asal dan eksport awam. |
| Binaan backend | `npm run build` lulus; route `/`, `/api/:path+`, `/bridge`, `/verify/:token`. Tiada migrasi skema baharu. |
| GitHub Actions | Ujian, privasi, TypeScript, binaan, upload artifact, deployment dan semakan URL produksi lulus pada run `39557357386` (percubaan semula selepas Pages diaktifkan). |
| Binaan Pages | `npm run build:pages` lulus pada checkout asal dan eksport awam. Entry React yang sama, base tepat `/LITRIC/`, hash routing, 404 fallback, favicon/manifest LITRIC. |
| HTTP Pages tempatan | Index/laluan hash ketika refresh dan **13 permintaan aset** memberi 200; termasuk JavaScript, CSS, fon, ikon dan manifest. |
| API backend terbina | **61 respons API disahkan** pada Worker D1/R2 tempatan, termasuk penapis tahun/kelas, import semula, profil, sijil/laporan dan penolakan akses. |
| Privasi frontend | Tiada seed, nama/pengecam murid asal, header identiti pelayan, sumber backend, pangkalan data, CSV/XLSX sekolah atau source map dalam `dist-pages`. |
| Sumber awam | Seed kosong, tiada sejarah Git peribadi atau fail rahsia/data sekolah. Satu CSV fixture sintetik dibenarkan hanya dengan hash kandungan yang disemak. |
| CORS | Permintaan API langsung dengan Origin `https://skpkt.github.io` ditolak 403; tiada CORS permisif. Sambungan menggunakan panggilan same-origin dalam tetingkap backend. |
| Kebergantungan produksi | `npm audit --omit=dev`: **0 advisori diketahui** pada semakan ini; bukan jaminan tiada kelemahan. |
| PDF/Excel | PDF sijil A4 landskap dan laporan program dirender dengan Poppler serta diperiksa secara visual. Penjenamaan, nama penuh, tagline, QR dan imej bukti hadir. Excel dibaca semula: jumlah sepadan dan pencipta `LITRIC`. |

Ujian menggunakan storan tempatan sahaja. Tiada rekod produksi dipadam, dipindah atau diubah. Sandaran kod/tag pemulihan asal disimpan secara peribadi. Format sandaran, 26 jadual, ID sekolah/pengguna dan migrasi terdahulu dikekalkan. Pemulihan ke SQLite baharu dengan foreign key dan perbandingan 26 jadual telah disahkan pada keluaran asal; penjenamaan ini tidak mengubah format itu.

## Sempadan NILAM yang diuji

| Bacaan diluluskan | Bintang | Markah PAJSK konfigurasi |
|---|---|---|
| 143 | 0 — Belum Mencapai 1 Bintang | Tiada / NULL |
| 144, 287 | 1 | 3 |
| 288, 431 | 2 | 4 |
| 432, 575 | 3 | 5 |
| 576, 719 | 4 | 6 |
| 720, 900 | 5 | 7 |

Peraturan boleh dikonfigurasi dan belum diperakui terhadap syarat rasmi semasa. Tahun/tempoh dan kelayakan kelompok perlu disahkan sebelum bintang dikira. Tahun berlainan tidak digabung secara senyap. Snapshot kumulatif menggantikan asas terdahulu; pendua dan ID peristiwa berulang tidak menambah bacaan. Bacaan sekolah/SMARTLIB kekal berasingan daripada kelulusan rasmi AINS.

## Liputan perjalanan pengguna

| Perjalanan | Bukti / had |
|---|---|
| Log masuk pentadbir | Identiti simulasi dipercayai diuji pada Worker tempatan; Sesi pentadbir berizin yang sudah log masuk juga berjaya menyambung melalui Pages; aliran OAuth akaun baharu belum diuji. |
| Dashboard | API state/agregat, respons aplikasi dan binaan disahkan. Dashboard sebenar melalui Pages diperiksa secara visual; jumlah sumber AINS kekal 20 identiti / 362 bahan dilaporkan dan tempoh belum disahkan. |
| Import AINS dan pendua | CSV/XLSX sumber disemak; import API, kandungan berulang, snapshot, peristiwa bertindih/berulang serta rollback/pulih lulus. |
| Profil murid | State yang dihadkan kepada guru/murid serta padanan/gabungan identiti lulus. |
| Tahun / kelas | Unit tahun berasingan dan API penapis lulus; kelas tidak dibenarkan tidak memulangkan profil. |
| Bintang NILAM | Semua 10 sempadan yang diminta lulus; markah sebelum 144 kekal NULL. |
| Laporan dan sijil | Generasi/akses PDF, Excel dan QR lulus; sijil/laporan program diperiksa secara visual. |
| Backend berizin | 401 tanpa identiti; 403 bagi tindakan/peranan/kelas/origin tidak dibenarkan. Pelawat tanpa log masuk tidak boleh mendapatkan laporan, sandaran atau pengesahan sijil. |
| Sambungan frontend | Kod transport sebenar diuji: window/origin/channel palsu diabaikan, JSON/fail/byte PDF dihantar, penutupan gagal selamat, pop-up disekat boleh dicuba semula. Sambungan pelayar sebenar menggunakan sesi pentadbir sedia ada lulus; OAuth baharu dan polisi tetingkap pada mobile masih perlu disahkan. |
| Mobile/tablet | CSS responsif, fon lebih jelas, fokus, kontras dan reduced-motion disediakan. Visual, pop-up, kamera dan pembaca skrin pada peranti sebenar belum disahkan. |
| Refresh route | Hash route diuji melalui HTTP tempatan; path mempunyai fallback. Navigasi hash melalui Pages sebenar turut berjaya; refresh kekal pada entry statik dan memerlukan sambungan backend semula. |
| GitHub Pages awam | **Diterbitkan dan disahkan** di `https://skpkt.github.io/LITRIC/`; index, JS, CSS, favicon dan manifest memberi 200. Backend peribadi juga dilaporkan berjaya oleh Sites. |

Polisi URL menghalang preview tempatan pada binaan asal. Selepas penerbitan, halaman login dan dashboard Pages sebenar dapat diperiksa melalui pelayar; halaman SMARTLIB menunjukkan status belum disambungkan seperti sepatutnya. HTTP/API/unit tidak dianggap bukti pengesahan OAuth akaun baharu atau peranti mudah alih.

## Perkara tertangguh

1. Ujian pada peranti mobile/tablet sebenar, OAuth akaun baharu, sesi luput serta akaun guru/murid sebenar masih perlu dilengkapkan. Semua laman pada origin `skpkt.github.io` mesti dipercayai; lihat SECURITY_REVIEW.md.
2. SMARTLIB sebenar, URL/kelayakan katalog, tahun/tempoh sumber, kelas/enrolmen dan rujukan rasmi PAJSK masih memerlukan pengesahan sekolah.
3. Keperluan semakan pull request pada main perlu dikonfigurasi sebelum kerjasama berbilang pembangun. Persekitaran Pages yang dijana mengehadkan deployment kepada main.
4. Modul Excel dimuatkan secara dinamik dan masih besar; backend build memberi amaran chunk >500 kB. Ini bukan kegagalan build. Kapasiti, backup berjadual, pemantauan dan pengekalan data diterangkan dalam README/SECURITY_REVIEW.

URL produksi disahkan: https://skpkt.github.io/LITRIC/. Kejayaan deployment tidak dianggap sebagai audit aksesibiliti formal atau pengesahan rasmi NILAM/PAJSK.
