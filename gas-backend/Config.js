// ========================================================================
// Config.js: Registry Skema Sheet & Konfigurasi Aplikasi
// Standar: gas-pro-api & gas-notifikasi-wa-crm
// ========================================================================

const APP_VERSION = '1.2.0-turbo';

// Registry Nama Sheet Utama
const SHEET_NAMES = {
  users: 'Users',
  logs_kalori: 'LogsKalori',
  katalog_workout: 'KatalogWorkout',
  logs_workout: 'LogsWorkout',
  riwayat_timbang: 'RiwayatTimbang',
  antrian_notif: 'AntrianNotif',
  config: 'AppConfig'
};

// Header Kolom Database Google Sheets
const SHEET_HEADERS = {
  Users: ['UserID', 'Nama', 'NoWA', 'Usia', 'Gender', 'TinggiCm', 'BeratAwal', 'BeratSekarang', 'TargetBB', 'JatahKalori', 'TargetAir', 'Role', 'DibuatPada'],
  LogsKalori: ['LogID', 'UserID', 'Tanggal', 'WaktuMakan', 'NamaMakanan', 'Porsi', 'KaloriKkal', 'ProteinG', 'FatG', 'CarbsG', 'CatatanAI', 'DibuatPada'],
  KatalogWorkout: ['WorkoutID', 'NamaGerakan', 'Kategori', 'DurasiMenit', 'EstKalori', 'TingkatKesulitan', 'Deskripsi', 'Urutan', 'IsActive'],
  LogsWorkout: ['LogWOID', 'UserID', 'Tanggal', 'NamaLatihan', 'DurasiAktual', 'KaloriTerbakar', 'DibuatPada'],
  RiwayatTimbang: ['TimbangID', 'UserID', 'Tanggal', 'BeratKg', 'Catatan', 'DibuatPada'],
  AntrianNotif: ['AntrianID', 'Kanal', 'Tujuan', 'NamaPenerima', 'Subjek', 'Pesan', 'Event', 'RefID', 'Status', 'Percobaan', 'Respon', 'DibuatPada', 'DikirimPada'],
  AppConfig: ['Kunci', 'Nilai', 'Deskripsi', 'DiperbaruiPada']
};

// Registry Kejadian Notifikasi WhatsApp (Fonnte)
const NOTIF_EVENTS = {
  REMINDER_PAGI: {
    label: 'Pengingat Timbang & Sarapan Sehat (07:00)',
    wa: true,
    pesan: "Selamat pagi {nama}! 🌅\n\nAwali harimu dengan segelas air putih dan jangan lupa timbang berat badanmu hari ini di aplikasi NutriTrack.\n\n🎯 Target kalori sehatmu hari ini: {jatahKalori} kkal\n💧 Target hidrasi: {targetAir} gelas\n\nYuk catat sarapan pagimu sekarang agar defisit kalori tetap terjaga! Semangat konsisten! 💪✨"
  },
  LAPORAN_MALAM: {
    label: 'Laporan Evaluasi Defisit Kalori Harian (20:30)',
    wa: true,
    pesan: "Halo {nama}! 🌙\n\nBerikut rekapitulasi kalori harimu ({tanggal}):\n• Total Asupan: {totalKalori} kkal\n• Target Maksimal: {jatahKalori} kkal\n• Status: {statusDefisit}\n\nTidur yang cukup malam ini (7-8 jam) sangat penting untuk pembakaran lemak optimal. Sampai jumpa besok pagi! 😴💤"
  }
};
