# Semakan sumber ABA6052

Semakan kandungan sebenar pada 21 Oktober 2026. Fail asal di Downloads tidak diubah. Hanya rekod dengan kod ABA6052 dimasukkan dalam sumber pelayan. Skrip pengesahan dan ujian mengekalkan hash SHA-256 serta nombor baris asal.

| Fail | Baris sekolah | Identiti sumber unik | Diluluskan mentah | Ditolak | Pendua tepat | Baris semakan |
|---|---:|---:|---:|---:|---:|---:|
| users_PERAK Jan.csv | 21 | 20 | 10 | 0 | 1 | 0 |
| user_PERAK February.csv | 24 | 23 | 11 | 0 | 1 | 0 |
| User Perak March.csv | 21 | 20 | 23 | 0 | 1 | 0 |
| User Perak April.csv | 23 | 22 | 83 | 1 | 0 | 2 |
| User Perak Mei.csv | 25 | 24 | 77 | 0 | 0 | 2 |
| user_PERAK_jun.csv | 25 | 24 | 44 | 0 | 0 | 2 |
| user_PERAK July.csv | 25 | 24 | 74 | 3 | 0 | 2 |
| AINS_LMS.xlsx / Sheet1 | 21 | 20 | 362 | 0 | 0 | 2 |

CSV Januari–Julai mempunyai 28 pengecam unik dan jumlah mentah 322 bahan. Tiga baris pendua tepat mempunyai sifar bacaan; pengasingannya tidak mengubah 322. Workbook mempunyai 20 pengecam unik dan 362 bahan mentah. Kedua-dua set dikekalkan berasingan.

Setiap baris ialah ringkasan seorang murid dalam eksport, bukan satu buku. Lajur hanya menyatakan sekolah, identiti sumber, bilangan dan pecahan bahasa/kategori. Tiada tahun pelaporan, tarikh mula/akhir, tarikh aktiviti, tarikh snapshot atau kelas dalam jadual. Bulan CSV hanya petunjuk nama fail. Label AINS 2025 datang daripada arahan pengguna dan tidak membuktikan liputan setahun penuh.

April–Julai serta workbook mengandungi pengecam sama dengan baris berlainan. Ini mungkin pendua eksport atau pecahan data; kandungan sahaja tidak menjelaskan sebab. Kedua-dua baris diletakkan untuk semakan, dikekalkan dalam jumlah mentah sumber dan dikecualikan daripada bacaan layak sehingga keputusan pentadbir. Tiada identiti digabung berdasarkan persamaan nama.

Semua kelompok bermula dengan `year = NULL`, `granularity = unknown`, `verification = unverified`, `star_eligible = 0`. Jumlah 322 dan 362 ialah kawalan audit, bukan pemalar dashboard. Dashboard mengira semula daripada jadual, penapis, status baris dan kelompok aktif.

Semakan yang diperlukan: tahun CSV, tempoh sebenar workbook, agregat bulanan berbanding snapshot kumulatif, baris berulang berlainan, kelas/tahun akademik dan enrolmen semasa. Sehingga disahkan, tiada sijil bintang dikeluarkan daripada sumber ini dan tiada label tidak aktif diputuskan daripada ketiadaan rekod.
