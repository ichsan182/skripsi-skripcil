import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Sidebar } from '../../../../shared/components/sidebar/sidebar';
import {
  FinancialData,
  JournalService,
  UserJournal,
} from '../../../../core/services/journal.service';
import { RollingBudgetService } from '../../../../core/utils/rolling-budget.service';

interface EducationArticle {
  title: string;
  image: string;
  intro: string;
  contentHtml: string;
}

@Component({
  selector: 'app-education-content',
  standalone: true,
  imports: [CommonModule, RouterLink, Sidebar],
  templateUrl: './education-content.html',
  styleUrl: './education-content.css',
})
export class EducationContent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  // Content is developer-authored static strings — safe to bypass sanitization
  private readonly sanitizer = inject(DomSanitizer);
  private readonly journalService = inject(JournalService);
  private readonly rollingBudgetService = inject(RollingBudgetService);

  rollingBudgetToday = 0;
  rollingBudgetRemaining = 0;
  rollingDaysRemaining = 0;
  rollingTotalBudget = 0;
  rollingUsedBudget = 0;

  article: EducationArticle | null = null;
  safeContent: SafeHtml | null = null;

  private journal: UserJournal = {
    nextChatMessageId: 1,
    chatByDate: {},
    expensesByDate: {},
    incomesByDate: {},
  };
  private currentFinancialData: FinancialData | null = null;

  private readonly contentMap: Record<string, EducationArticle> = {
    'mindset-keuangan': {
      title: 'Mindset Keuangan & Literasi Finansial',
      image: 'assets/education-assets/investing.png',
      intro:
        'Mindset keuangan adalah cara seseorang memandang uang: bagaimana mereka mengelola, mengambil keputusan, dan merencanakan masa depan. Literasi finansial adalah kemampuan memahami konsep keuangan seperti menabung, berinvestasi, mengelola utang, dan melindungi aset.',
      contentHtml: `
        <section class="content-section">
          <h2>1. Pentingnya Mindset Keuangan yang Benar</h2>
          <ul class="styled-list">
            <li><strong>Uang sebagai alat, bukan tujuan</strong> – fokus pada fungsi uang untuk mencapai kesejahteraan.</li>
            <li><strong>Kendalikan pengeluaran</strong> – jangan biarkan gaya hidup naik lebih cepat dari pendapatan.</li>
            <li><strong>Pikir jangka panjang</strong> – keputusan hari ini menentukan posisi finansial masa depan.</li>
            <li><strong>Belajar dari kesalahan</strong> – mengelola uang adalah kemampuan yang berkembang dari pengalaman.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>2. Pilar Utama Literasi Finansial</h2>
          <ul class="styled-list pillar-list">
            <li>
              <strong>Mengelola Pengeluaran</strong>
              <p>Gunakan prinsip 50/30/20 atau sistem budgeting lain agar arus uang jelas.</p>
            </li>
            <li>
              <strong>Menabung &amp; Dana Darurat</strong>
              <p>Targetkan minimal 3–6 bulan biaya hidup sebagai perlindungan risiko.</p>
            </li>
            <li>
              <strong>Investasi</strong>
              <p>Pahami instrumen seperti reksa dana, saham, obligasi, atau emas sebelum membeli.</p>
            </li>
            <li>
              <strong>Manajemen Utang</strong>
              <p>Gunakan utang secara sehat: <em>productive debt</em> lebih baik daripada utang konsumtif.</p>
            </li>
            <li>
              <strong>Perlindungan Aset</strong>
              <p>Asuransi kesehatan, jiwa, atau perlindungan aset mengurangi risiko keuangan besar.</p>
            </li>
          </ul>
        </section>

        <section class="content-section">
          <h2>3. Kebiasaan Keuangan yang Perlu Dibangun</h2>
          <ul class="styled-list">
            <li>Mencatat pemasukan dan pengeluaran.</li>
            <li>Konsisten menabung tiap bulan.</li>
            <li>Membatasi keinginan impulsif.</li>
            <li>Meningkatkan penghasilan (skill, side income, karier).</li>
            <li>Membaca atau belajar minimal 15 menit per hari tentang keuangan.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>4. Kesalahan Umum Generasi Muda</h2>
          <ul class="styled-list warning-list">
            <li>Mengutamakan lifestyle daripada stabilitas.</li>
            <li>Tidak mempersiapkan dana darurat.</li>
            <li>Investasi ikut-ikutan tanpa memahami risiko.</li>
            <li>Terlalu banyak cicilan konsumtif.</li>
            <li>Tidak punya tujuan keuangan yang jelas.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>5. Langkah Praktis Memulai</h2>
          <ol class="styled-list">
            <li>Buat catatan finansial 30 hari.</li>
            <li>Tentukan tujuan keuangan jangka pendek &amp; panjang.</li>
            <li>Buat anggaran bulanan sederhana.</li>
            <li>Bangun dana darurat bertahap.</li>
            <li>Pilih satu instrumen investasi yang mudah dipahami dan mulai kecil dulu.</li>
          </ol>
        </section>

        <section class="content-section sources-section">
          <h2>Sumber &amp; Media Terpercaya untuk Belajar</h2>
          <div class="sources-grid">
            <a href="https://www.ojk.go.id" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">OJK</span>
              <span class="source-label">Otoritas Jasa Keuangan</span>
            </a>
            <a href="https://www.bi.go.id" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Bank Indonesia</span>
              <span class="source-label">Edukasi Keuangan</span>
            </a>
            <a href="https://www.kemenkeu.go.id" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Kemenkeu RI</span>
              <span class="source-label">Kementerian Keuangan</span>
            </a>
            <a href="https://www.investopedia.com" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Investopedia</span>
              <span class="source-label">Referensi Investasi Global</span>
            </a>
            <a href="https://www.bareksa.com" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Bareksa</span>
              <span class="source-label">Edukasi Investasi</span>
            </a>
            <a href="https://idnfinancials.com" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">IDN Financials</span>
              <span class="source-label">Informasi Pasar</span>
            </a>
          </div>
        </section>
      `,
    },

    'Manajemen Uang (Cashflow 101)': {
      title: 'Manajemen Uang (Cashflow 101)',
      image: 'assets/education-assets/investing.png',
      intro:
        'Manajemen uang atau cashflow management adalah fondasi utama dalam membangun kehidupan finansial yang sehat. Cashflow bukan sekadar tentang berapa banyak uang yang kita hasilkan, tetapi bagaimana kita memastikan bahwa uang tersebut mengalir dengan benar untuk memenuhi kebutuhan, mewujudkan tujuan, dan memberikan rasa aman.',
      contentHtml: `
        <section class="content-section">
          <h2>1. Apa Itu Cashflow?</h2>
          <p>Cashflow menggambarkan arus pergerakan uang dalam kehidupan kita. Setiap bulan kita menerima <strong>pemasukan</strong> seperti gaji atau hasil usaha, dan kita juga mengeluarkan <strong>pengeluaran</strong> untuk kebutuhan, gaya hidup, cicilan, serta hal lainnya. Ketika pemasukan lebih besar dari pengeluaran, cashflow kita positif; sebaliknya jika pengeluaran lebih besar, maka kita berada dalam posisi cashflow negatif.</p>
          <ul class="styled-list pillar-list">
            <li>
              <strong>Pemasukan (Cash In)</strong>
              <p>Gaji, bonus, usaha, dan pendapatan lainnya.</p>
            </li>
            <li>
              <strong>Pengeluaran (Cash Out)</strong>
              <p>Biaya kebutuhan, cicilan, dan lifestyle.</p>
            </li>
            <li>
              <strong>Sisa Saldo (Balance)</strong>
              <p>Uang yang tersisa setelah dikurangi pengeluaran.</p>
            </li>
          </ul>
        </section>

        <section class="content-section">
          <h2>2. Prinsip Dasar Manajemen Uang</h2>
          <p>Sebelum masuk ke teknik perhitungan, penting untuk memahami prinsip dasar. Prinsip pertama adalah <strong>hidup di bawah kemampuan</strong>, yaitu memastikan pengeluaran tidak melampaui pemasukan. Kemudian, biasakan untuk <strong>menyisihkan uang di awal</strong> sebelum membelanjakan apa pun. Banyak orang gagal bukan karena kurang uang, tetapi karena tidak mengatur arus uangnya dengan benar.</p>
          <ul class="styled-list">
            <li><strong>Belanja di bawah kemampuan</strong> – fokus pada kebutuhan, bukan keinginan.</li>
            <li><strong>Tabung di awal, bukan di akhir</strong> – agar lebih konsisten.</li>
            <li><strong>Catat arus uang</strong> – keputusan yang baik lahir dari data.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>3. Format Cashflow 101 (Pola 50/30/20)</h2>
          <p>Salah satu metode paling populer dalam mengatur cashflow adalah pembagian 50/30/20. Metode ini membantu menata uang secara sederhana tanpa harus menghitung terlalu rumit. Dengan cara ini, setiap pemasukan langsung diarahkan ke tiga kategori utama.</p>
          <ul class="styled-list pillar-list">
            <li>
              <strong>50% untuk Kebutuhan</strong>
              <p>Seperti makanan, sewa, transportasi, dan tagihan.</p>
            </li>
            <li>
              <strong>30% untuk Keinginan</strong>
              <p>Hiburan, belanja non-esensial, dan lifestyle.</p>
            </li>
            <li>
              <strong>20% untuk Tabungan &amp; Investasi</strong>
              <p>Dana darurat, asuransi, dan tujuan jangka panjang.</p>
            </li>
          </ul>
        </section>

        <section class="content-section">
          <h2>4. Kesalahan Umum dalam Mengelola Cashflow</h2>
          <p>Banyak orang mengalami masalah keuangan bukan karena pendapatan rendah, tetapi karena kesalahan kecil yang dilakukan terus-menerus. Akumulasi dari kesalahan kecil ini bisa membuat cashflow menjadi negatif.</p>
          <ul class="styled-list warning-list">
            <li>Tidak mencatat pengeluaran harian.</li>
            <li>Terlalu banyak cicilan konsumtif.</li>
            <li>Tidak punya dana darurat.</li>
            <li>Belanja impulsif saat gajian.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>5. Langkah Praktis untuk Meningkatkan Cashflow</h2>
          <p>Mengubah cashflow tidak harus sulit. Justru perubahan kecil namun konsisten bisa membantu mengubah kondisi keuangan dalam beberapa bulan. Mulailah dari menganalisis pola pengeluaran selama 30 hari terakhir.</p>
          <ol class="styled-list">
            <li>Lakukan analisis 30 hari arus uang.</li>
            <li>Kurangi pengeluaran non-esensial bertahap.</li>
            <li>Set otomatis tabungan setelah gajian.</li>
            <li>Batasi cicilan maksimal 30% dari pemasukan.</li>
            <li>Bangun dana darurat secara bertahap.</li>
          </ol>
        </section>

        <section class="content-section">
          <h2>6. Tools untuk Mengelola Cashflow</h2>
          <p>Banyak alat yang dapat membantu mengelola keuangan. Yang terpenting adalah konsisten dan memperbarui catatan secara rutin.</p>
          <ul class="styled-list">
            <li>Google Sheets / Excel – untuk pencatatan manual.</li>
            <li>Aplikasi seperti Money Lover atau Spendee.</li>
            <li>Bank digital dengan fitur budgeting otomatis.</li>
          </ul>
        </section>

        <section class="content-section sources-section">
          <h2>Sumber &amp; Media Terpercaya untuk Belajar</h2>
          <div class="sources-grid">
            <a href="https://www.ojk.go.id" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">OJK</span>
              <span class="source-label">Otoritas Jasa Keuangan</span>
            </a>
            <a href="https://www.bi.go.id" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Bank Indonesia</span>
              <span class="source-label">Literasi Keuangan</span>
            </a>
            <a href="https://www.kemenkeu.go.id/publikasi" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Kemenkeu RI</span>
              <span class="source-label">Kementerian Keuangan</span>
            </a>
            <a href="https://www.investopedia.com/terms/c/cash-flow.asp" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">Investopedia</span>
              <span class="source-label">Cash Flow</span>
            </a>
            <a href="https://sikapiuangmu.ojk.go.id" target="_blank" rel="noopener noreferrer" class="source-card">
              <span class="source-name">SikapiUangmu</span>
              <span class="source-label">Materi Edukasi Keuangan OJK</span>
            </a>
          </div>
        </section>
      `,
    },

    tabungan: {
      title: 'Tabungan',
      image: 'assets/education-assets/investing.png',
      intro:
        'Menabung adalah pondasi utama keuangan yang sehat. Tanpa kebiasaan menabung, sulit untuk membangun kekayaan atau menghadapi situasi darurat.',
      contentHtml: `
        <section class="content-section">
          <h2>Mengapa Menabung Itu Penting?</h2>
          <p>Tabungan berfungsi sebagai jaring pengaman finansial. Dana darurat yang ideal adalah 3–6 kali pengeluaran bulanan, yang hanya bisa dicapai dengan menabung secara konsisten.</p>
        </section>
        <section class="content-section">
          <h2>Strategi Menabung Efektif</h2>
          <p>Gunakan metode "bayar diri sendiri lebih dulu" — sisihkan sebagian penghasilan untuk tabungan sebelum pengeluaran lain. Otomasi transfer ke rekening tabungan untuk memudahkan disiplin.</p>
        </section>
        <section class="content-section">
          <h2>Jenis-Jenis Tabungan</h2>
          <p>Ada berbagai instrumen tabungan seperti tabungan konvensional, deposito, dan rekening berjangka. Pilih yang sesuai dengan tujuan dan kebutuhan Anda.</p>
        </section>
        <section class="content-section coming-soon-section">
          <p class="coming-soon-text">Konten lebih lengkap sedang dalam penyusunan. Pantau terus!</p>
        </section>
      `,
    },

    'perencanaan-keuangan': {
      title: 'Perencanaan Keuangan',
      image: 'assets/education-assets/investing.png',
      intro:
        'Perencanaan keuangan adalah proses menetapkan tujuan finansial dan membuat rencana untuk mencapainya. Ini meliputi pengelolaan pendapatan, pengeluaran, tabungan, dan investasi.',
      contentHtml: `
        <section class="content-section">
          <h2>Langkah Awal Perencanaan Keuangan</h2>
          <p>Mulailah dengan mencatat seluruh pemasukan dan pengeluaran Anda. Dari sana, identifikasi kebocoran keuangan dan tentukan prioritas finansial jangka pendek dan panjang.</p>
        </section>
        <section class="content-section">
          <h2>Membuat Anggaran Bulanan</h2>
          <p>Gunakan aturan 50/30/20: 50% untuk kebutuhan, 30% untuk keinginan, dan 20% untuk tabungan serta investasi. Sesuaikan proporsinya dengan kondisi keuangan Anda.</p>
        </section>
        <section class="content-section">
          <h2>Mengelola Tujuan Keuangan</h2>
          <p>Tetapkan tujuan spesifik, terukur, dan memiliki tenggat waktu. Misalnya: menabung Rp 10 juta dalam 12 bulan untuk dana darurat.</p>
        </section>
        <section class="content-section coming-soon-section">
          <p class="coming-soon-text">Konten lebih lengkap sedang dalam penyusunan. Pantau terus!</p>
        </section>
      `,
    },

    investasi: {
      title: 'Investasi',
      image: 'assets/education-assets/investing.png',
      intro:
        'Investasi adalah cara menyimpan uang yang bertujuan menghasilkan keuntungan di masa depan. Dengan berinvestasi, uang Anda bekerja untuk Anda.',
      contentHtml: `
        <section class="content-section">
          <h2>Kenapa Harus Investasi?</h2>
          <p>Inflasi membuat nilai uang menurun setiap tahun. Investasi adalah cara untuk mempertahankan dan meningkatkan daya beli uang Anda seiring berjalannya waktu.</p>
        </section>
        <section class="content-section">
          <h2>Jenis Instrumen Investasi</h2>
          <p>Terdapat berbagai pilihan investasi seperti saham, reksa dana, obligasi, properti, dan emas. Setiap instrumen memiliki profil risiko dan potensi imbal hasil yang berbeda.</p>
        </section>
        <section class="content-section">
          <h2>Prinsip Diversifikasi</h2>
          <p>Jangan menaruh semua telur dalam satu keranjang. Diversifikasi portofolio investasi Anda untuk mengurangi risiko dan mengoptimalkan potensi keuntungan jangka panjang.</p>
        </section>
        <section class="content-section coming-soon-section">
          <p class="coming-soon-text">Konten lebih lengkap sedang dalam penyusunan. Pantau terus!</p>
        </section>
      `,
    },

    'manajemen-utang': {
      title: 'Manajemen Utang & Kredit',
      image: 'assets/education-assets/investing.png',
      intro:
        'Utang bukan selalu musuh keuangan. Jika dikelola dengan benar, utang dapat menjadi alat untuk mempercepat pencapaian tujuan finansial Anda.',
      contentHtml: `
        <section class="content-section">
          <h2>Utang Baik vs Utang Buruk</h2>
          <p>Utang baik adalah utang yang digunakan untuk aset produktif, seperti KPR atau pinjaman usaha. Utang buruk adalah utang konsumtif yang digunakan untuk kebutuhan tidak mendesak dengan bunga tinggi.</p>
        </section>
        <section class="content-section">
          <h2>Strategi Melunasi Utang</h2>
          <p>Metode "avalanche" memprioritaskan pelunasan utang berbunga tertinggi untuk menghemat total bunga. Metode "snowball" memprioritaskan utang terkecil untuk mendapat motivasi dari pencapaian cepat.</p>
        </section>
        <section class="content-section">
          <h2>Mengelola Skor Kredit</h2>
          <p>Skor kredit yang baik membuka akses ke pinjaman dengan bunga lebih rendah. Jaga skor kredit dengan membayar tagihan tepat waktu dan menjaga rasio utang tetap rendah.</p>
        </section>
        <section class="content-section coming-soon-section">
          <p class="coming-soon-text">Konten lebih lengkap sedang dalam penyusunan. Pantau terus!</p>
        </section>
      `,
    },

    'perlindungan-aset': {
      title: 'Perlindungan Aset & Asuransi',
      image: 'assets/education-assets/investing.png',
      intro:
        'Melindungi aset adalah bagian penting dari perencanaan keuangan yang sering diabaikan. Asuransi memberikan perlindungan finansial dari risiko tak terduga.',
      contentHtml: `
        <section class="content-section">
          <h2>Mengapa Asuransi Itu Penting?</h2>
          <p>Satu kejadian tak terduga seperti kecelakaan atau penyakit serius dapat menghapus tabungan bertahun-tahun. Asuransi melindungi aset dan gaya hidup Anda dari risiko semacam ini.</p>
        </section>
        <section class="content-section">
          <h2>Jenis-Jenis Asuransi</h2>
          <p>Asuransi jiwa, asuransi kesehatan, asuransi kendaraan, dan asuransi properti adalah jenis-jenis utama yang perlu dipertimbangkan. Prioritaskan sesuai tahapan kehidupan Anda.</p>
        </section>
        <section class="content-section">
          <h2>Diversifikasi Aset untuk Perlindungan</h2>
          <p>Selain asuransi, pastikan aset Anda terdiversifikasi dalam berbagai kelas aset. Hal ini meminimalkan dampak kerugian dari satu jenis aset terhadap keseluruhan kekayaan Anda.</p>
        </section>
        <section class="content-section coming-soon-section">
          <p class="coming-soon-text">Konten lebih lengkap sedang dalam penyusunan. Pantau terus!</p>
        </section>
      `,
    },
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const found = this.contentMap[id] ?? null;
    this.article = found;
    if (found) {
      this.safeContent = this.sanitizer.bypassSecurityTrustHtml(
        found.contentHtml,
      );
    }
    void this.loadRollingBudgetState();
  }

  private async loadRollingBudgetState(): Promise<void> {
    try {
      this.journal = await this.journalService.loadCurrentUserJournal();
      const summary = await this.journalService.getCurrentCycleSummary();
      this.currentFinancialData = summary.financialData;
      const state = this.rollingBudgetService.computeRollingBudgetState(
        this.currentFinancialData,
        this.journal,
      );
      this.rollingTotalBudget = state.rollingTotalBudget;
      this.rollingUsedBudget = state.rollingUsedBudget;
      this.rollingBudgetRemaining = state.rollingBudgetRemaining;
      this.rollingDaysRemaining = state.rollingDaysRemaining;
      this.rollingBudgetToday = state.rollingBudgetToday;
    } catch {
      this.rollingBudgetToday = 0;
      this.rollingBudgetRemaining = 0;
      this.rollingDaysRemaining = 0;
      this.rollingTotalBudget = 0;
      this.rollingUsedBudget = 0;
    }
  }
}
