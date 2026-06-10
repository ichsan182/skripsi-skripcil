# Level Logic Guide (Level 1-7)

Dokumen ini menjelaskan logika evaluasi level finansial berdasarkan implementasi saat ini di:

- src/app/core/utils/level.ts

## Ringkasan Cara Sistem Menentukan Level

Sistem membaca sinyal finansial dari `financialData`, lalu mengevaluasi berurutan dari Level 1 sampai Level 7.
Evaluasi bersifat `first-match`:

- Kondisi level yang terpenuhi lebih dulu akan langsung di-return.
- Artinya, walaupun user punya indikator level atas, kalau masih gagal syarat level bawah, user akan tertahan di level bawah.

## Definisi Sinyal Utama

- Pendapatan bulanan: `pendapatan`
- Pengeluaran bulanan acuan: `currentPengeluaranLimit` (fallback ke `pengeluaranWajib`)
- Dana darurat: `danaDarurat`
- Tabungan: `estimasiTabungan`
- Hutang konsumtif: `hutangWajib`
- Rasio investasi bulan berjalan (% income): `investmentAllocationRate`
- Streak investasi bulanan: `consecutiveInvestmentMonths`
- Jeda investasi bulanan: `pausedInvestmentMonths`

Catatan periodisasi investasi:

- Tracking investasi memakai `investmentTracking.cycleAmounts` per cycle bulanan.
- Banyak input investasi di hari yang sama tetap dihitung pada cycle bulan yang sama, bukan menambah jumlah bulan streak.

## Cara Naik Tiap Level

## Level 1 - Pondasi Pertama

### Kondisi level ini

- Tabungan (saldo awal) < Rp10.000.000.


- Naikkan `estimasiTabungan` sampai minimal Rp10.000.000.
- Setelah itu, syarat berikutnya akan diperiksa (hutang konsumtif).

### Cara naik ke Level 2

- Naikkan `estimasiTabungan` sampai minimal Rp10.000.000.
- Setelah itu, syarat berikutnya akan diperiksa (hutang konsumtif).

### Risiko turun ke Level 1 dari Level 2

- Jika tabungan turun di bawah Rp5.000.000 saat masih ada hutang konsumtif, sistem fallback ke Level 1.

### Checklist praktis

- Alokasikan pendapatan rutin ke tabungan.
- Hindari membuka hutang konsumtif baru selagi membangun tabungan.

## Level 2 - Bersihkan Beban

### Kondisi level ini

- Ada hutang konsumtif (`hutangWajib > 0`) dan dana darurat masih aman minimal Rp500.000.

### Cara naik ke Level 3

- Lunasi `hutangWajib` sampai 0.
- Ada hutang konsumtif (`hutangWajib > 0`) dan tabungan masih >= Rp5.000.000.

### Progress bar Level 2

Progress dihitung dari: `(totalPrincipalKonsumtif - totalSisaKonsumtif) / totalPrincipalKonsumtif`.
Contoh: hutang konsumtif awal Rp200.000, sudah dibayar Rp100.000 → progress 50%.

### Risiko turun ke Level 1

- Jika tabungan (`estimasiTabungan`) turun di bawah Rp5.000.000 saat masih ada hutang konsumtif, sistem fallback ke Level 1.

### Cara naik ke Level 3

- Lunasi seluruh hutang konsumtif hingga 0.
- Jaga tabungan tetap >= Rp5.000.000 selama proses pelunasan.

### Checklist praktis

- Prioritaskan pelunasan hutang berbunga tinggi dulu.
- Tetap sisakan buffer dana darurat.

## Level 3 - Bangun Benteng Darurat

### Kondisi level ini

- Dana darurat belum mencapai 3x pendapatan bulanan.

### Cara naik ke Level 4

- Penuhi `danaDarurat >= 3 x pendapatan bulanan`.
- Pendapatan dipakai sebagai acuan karena lebih stabil dibanding pengeluaran yang dinamis.
- Pastikan kondisi aset liquid stabil dan tidak memicu fallback ke Level 2.

### Checklist praktis

- Hitung target: `3 x pendapatan bulanan (pendapatan)`.
- Naikkan dana darurat bertahap sampai target tercapai.

## Level 4 - Mulai Bekerja untuk Masa Depan

### Kondisi level ini

User masuk fase ini jika syarat transisi belum lengkap:

- Rasio investasi belum >= 15%, atau
- Streak investasi belum 3 bulan berturut-turut, atau
- Dana darurat belum > 2 bulan pengeluaran.

### Syarat lolos fase Level 4

Semua harus terpenuhi sekaligus:

- `investmentAllocationRate >= 15`
- `consecutiveInvestmentMonths >= 3`
- `danaDarurat >= 2 x pengeluaran bulanan`

### Kenapa progress sering 33%

Jika rasio investasi sudah >= 15% namun streak baru 1 bulan:

- Progress dihitung dari `consecutiveInvestmentMonths / 3`.
- 1 bulan = 33%, 2 bulan = 66%, 3 bulan = 100%.

### Cara naik ke Level 5

- Jaga investasi >= 15% selama 3 cycle bulanan berturut-turut.
- Pastikan dana darurat tetap minimal 2 bulan pengeluaran.
- Hindari jeda investasi > 2 bulan karena bisa memicu fallback.

## Level 5 - Tujuan Besar

### Kondisi level ini (sesuai kode saat ini)

Setelah lolos fase Level 4 dan tidak terkena fallback, evaluasi masuk blok Level 5.

### Syarat lanjut dari Level 5 ke Level 6

- `bigGoalDefined = true`
- `bigGoalProgressPercent >= 20`
- `investmentAllocationRate >= 15`

### Catatan penting implementasi saat ini

Di builder sinyal saat ini:

- `bigGoalDefined` masih default `false`
- `bigGoalProgressPercent` masih default `0`

Akibatnya, user akan tetap berada di fase Level 5 (in-progress) sampai field tujuan besar benar-benar diintegrasikan ke data user.

### Cara naik ke Level 6

- Integrasikan data tujuan besar ke `financialData` agar sinyal goal tidak hardcoded.
- Definisikan tujuan besar dan capai progress minimal 20%.
- Pertahankan rasio investasi >= 15%.

## Level 6 - Bebaskan Diri dari Kewajiban Terbesar

### Kondisi level ini

Setelah lolos Level 5 readiness, sistem mengecek:

- Jika punya KPR: `mortgageRemaining <= 0`
- Jika tidak punya KPR: `passiveIncomeRatioToIncome >= 30` dan konsisten >= 3 bulan.

### Cara naik ke Level 7

- Jalur KPR: lunasi KPR.
- Jalur tanpa KPR: bangun passive income >= 30% pendapatan, konsisten minimal 3 bulan.

### Checklist praktis

- Pilih jalur yang relevan (KPR vs passive income).
- Ukur konsistensi, bukan hanya 1 bulan bagus.

## Level 7 - Kebebasan dan Dampak

### Kondisi stabil Level 7

- `passiveIncomeRatioToNeeds >= 50`
- `hasRoutineDonation = true`
- `netWorthDrawdownPercent < 40`

### Risiko turun dari Level 7

- Jika drawdown net worth > 40 atau passive income to needs < 20, sistem dapat fallback ke Level 6 warning.

### Cara mempertahankan Level 7

- Stabilkan passive income terhadap kebutuhan.
- Pertahankan kebiasaan donasi rutin.
- Jaga manajemen risiko agar drawdown tidak berlebihan.

## Tabel Cepat Kenaikan Level

| Dari | Ke  | Inti Syarat                                                                      |
| ---- | --- | -------------------------------------------------------------------------------- |
| 1    | 2   | Tabungan (estimasiTabungan) >= Rp10.000.000                                      |
| 2    | 3   | Hutang konsumtif lunas (0)                                                       |
| 3    | 4   | Dana darurat >= 3x pendapatan bulanan                                            |
| 4    | 5   | Investasi >= 15%, streak 3 bulan, dana darurat >= 2x pengeluaran                 |
| 5    | 6   | Goal besar terdefinisi, progress >= 20%, investasi >= 15%                        |
| 6    | 7   | KPR lunas atau passive income >= 30% (konsisten), lalu penuhi stabilitas Level 7 |

## Rekomendasi Teknis Lanjutan

Agar alur level lebih realistis dan tidak membingungkan user:

- Simpan data tujuan besar ke `financialData` dan map ke `bigGoalDefined` serta `bigGoalProgressPercent`.
- Tambahkan UI penjelasan periodisasi cycle agar user paham kenapa 3 kali input di 1 hari tidak sama dengan 3 bulan streak.
- Tampilkan komponen progress breakdown terpisah: rasio investasi, streak bulan, dan dana darurat.
