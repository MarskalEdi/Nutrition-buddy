// ========================================================================
// Database.js: Pengelolaan Google Sheets Berkecepatan Tinggi & CacheX
// Standar: gas-scale-turbo (Chunked Cache, Batch Read/Write) & gas-migrasi-database
// ========================================================================

function getSpreadsheet_() {
  let id = prop_('SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      console.warn('[DB] Gagal membuka SPREADSHEET_ID tersimpan, mencoba sheet aktif/buat baru.');
    }
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    setProp_('SPREADSHEET_ID', active.getId());
    return active;
  }

  // Jika dibuat standalone dan belum ada SPREADSHEET_ID, buat otomatis di Google Drive!
  console.log('[Setup] Membuat Google Spreadsheet baru otomatis di Google Drive Anda...');
  const newSS = SpreadsheetApp.create('Database NutriTrack & FitLife');
  setProp_('SPREADSHEET_ID', newSS.getId());
  console.log('[Setup] Spreadsheet baru berhasil dibuat!');
  console.log('[Setup] ID Spreadsheet: ' + newSS.getId());
  console.log('[Setup] Tautan Spreadsheet: ' + newSS.getUrl());
  return newSS;
}

// ------------------------------------------------------------------------
// CacheX: Solusi Limit 100 KB CacheService GAS (Skill: gas-scale-turbo)
// ------------------------------------------------------------------------
const CacheX = {
  SZ: 50000,
  c: function () { return CacheService.getScriptCache(); },
  get: function (key) {
    try {
      const c = this.c(), head = c.get(key);
      if (head == null) return null;
      if (head.indexOf('__chunks:') !== 0) return JSON.parse(head);
      const n = +head.slice(9), keys = [];
      for (let i = 0; i < n; i++) keys.push(key + '#' + i);
      const parts = c.getAll(keys);
      let s = '';
      for (let i = 0; i < n; i++) {
        if (parts[keys[i]] == null) return null;
        s += parts[keys[i]];
      }
      return JSON.parse(s);
    } catch (e) { return null; }
  },
  put: function (key, val, ttl) {
    try {
      const s = JSON.stringify(val), c = this.c();
      ttl = ttl || 1800; // Default 30 menit
      if (s.length <= this.SZ) { c.put(key, s, ttl); return true; }
      const n = Math.ceil(s.length / this.SZ), obj = {};
      obj[key] = '__chunks:' + n;
      for (let i = 0; i < n; i++) {
        obj[key + '#' + i] = s.slice(i * this.SZ, (i + 1) * this.SZ);
      }
      c.putAll(obj, ttl);
      return true;
    } catch (e) { return false; }
  },
  del: function (key) {
    try {
      const c = this.c(), head = c.get(key);
      if (head && head.indexOf('__chunks:') === 0) {
        const n = +head.slice(9), keys = [key];
        for (let i = 0; i < n; i++) keys.push(key + '#' + i);
        c.removeAll(keys);
      } else {
        c.remove(key);
      }
    } catch (e) {}
  }
};

// ------------------------------------------------------------------------
// Operasi Baca Berbasis Nama Header (Mapping Objek Aman)
// ------------------------------------------------------------------------
function readSheetBatch_(sheetName, useCache) {
  const cacheKey = 'DATA_' + sheetName;
  if (useCache) {
    const cached = CacheX.get(cacheKey);
    if (cached) return cached;
  }

  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  const rows = values.slice(1).filter(r => r.join('') !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });

  if (useCache) {
    CacheX.put(cacheKey, rows, 600); // 10 menit
  }
  return rows;
}

// ------------------------------------------------------------------------
// Operasi Tulis Kontigu Satu Blok (Bukan Loop appendRow)
// ------------------------------------------------------------------------
function bulkAppendRows_(sheetName, rowObjects) {
  if (!rowObjects || rowObjects.length === 0) return;

  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const matrix = rowObjects.map(obj => {
    return headers.map(h => obj[h] !== undefined ? obj[h] : '');
  });

  const nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, 1, matrix.length, headers.length).setValues(matrix);

  // Invalidate cache sheet terkait
  CacheX.del('DATA_' + sheetName);
}

// ------------------------------------------------------------------------
// Inisialisasi Otomatis Lingkungan Database (Idempoten)
// ------------------------------------------------------------------------
function setupAppEnvironment() {
  console.log('[Setup] Memulai inisialisasi lingkungan NutriTrack...');
  initSecuritySecrets_();

  const ss = getSpreadsheet_();

  // 1. Buat semua sheet dan header jika belum ada
  Object.keys(SHEET_HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      console.log(`[Setup] Sheet "${name}" dibuat.`);
    }
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEET_HEADERS[name]);
      sh.getRange(1, 1, 1, SHEET_HEADERS[name].length).setFontWeight('bold').setBackground('#F1F8E9');
      sh.setFrozenRows(1);
    }
  });

  // 2. Isi Katalog Workout Awal jika masih kosong
  const shWorkout = ss.getSheetByName('KatalogWorkout');
  if (shWorkout.getLastRow() <= 1) {
    const initialWorkouts = [
      { WorkoutID: 'WO-001', NamaGerakan: 'Morning Fat Burn Ignition', Kategori: 'Full Body', DurasiMenit: 12, EstKalori: 140, TingkatKesulitan: 'Beginner', Deskripsi: 'Jumping Jacks & Bodyweight Squats', Urutan: 1, IsActive: true },
      { WorkoutID: 'WO-002', NamaGerakan: 'Desk Break Abs & Posture', Kategori: 'Core & Abs', DurasiMenit: 10, EstKalori: 95, TingkatKesulitan: 'Easy', Deskripsi: 'Penguat otot perut dan perbaikan postur', Urutan: 2, IsActive: true },
      { WorkoutID: 'WO-003', NamaGerakan: 'HIIT Low Impact Bodyweight', Kategori: 'Full Body', DurasiMenit: 15, EstKalori: 180, TingkatKesulitan: 'Intermediate', Deskripsi: 'Interval tanpa lompatan ramah sendi', Urutan: 3, IsActive: true }
    ];
    bulkAppendRows_('KatalogWorkout', initialWorkouts);
    console.log('[Setup] Katalog workout awal diisi.');
  }

  // 3. Isi Pengguna Demo ("Brooks") jika belum ada
  const shUsers = ss.getSheetByName('Users');
  if (shUsers.getLastRow() <= 1) {
    bulkAppendRows_('Users', [{
      UserID: 'USR-0001',
      Nama: 'Brooks',
      NoWA: '081234567890',
      Usia: 28,
      Gender: 'Pria',
      TinggiCm: 175,
      BeratAwal: 75.6,
      BeratSekarang: 74.2,
      TargetBB: 68.0,
      JatahKalori: 1960,
      TargetAir: 8,
      Role: 'member',
      DibuatPada: new Date().toISOString()
    }]);
    console.log('[Setup] Akun demo Brooks diisi.');
  }

  // 4. Isi Riwayat Timbangan 7 Hari Terakhir jika kosong
  const shTimbang = ss.getSheetByName('RiwayatTimbang');
  if (shTimbang.getLastRow() <= 1) {
    const today = new Date();
    const rowsTimbang = [
      { TimbangID: 'TMB-01', UserID: 'USR-0001', Tanggal: '2026-11-04', BeratKg: 75.6, Catatan: 'Awal program diet', DibuatPada: new Date().toISOString() },
      { TimbangID: 'TMB-02', UserID: 'USR-0001', Tanggal: '2026-11-05', BeratKg: 75.4, Catatan: 'Defisit terjaga', DibuatPada: new Date().toISOString() },
      { TimbangID: 'TMB-03', UserID: 'USR-0001', Tanggal: '2026-11-06', BeratKg: 75.1, Catatan: 'Workout rutin', DibuatPada: new Date().toISOString() },
      { TimbangID: 'TMB-04', UserID: 'USR-0001', Tanggal: '2026-11-07', BeratKg: 74.8, Catatan: 'Pola makan stabil', DibuatPada: new Date().toISOString() },
      { TimbangID: 'TMB-05', UserID: 'USR-0001', Tanggal: '2026-11-08', BeratKg: 74.6, Catatan: 'Kondisi tubuh bugar', DibuatPada: new Date().toISOString() },
      { TimbangID: 'TMB-06', UserID: 'USR-0001', Tanggal: '2026-11-09', BeratKg: 74.4, Catatan: 'Target hampir tercapai', DibuatPada: new Date().toISOString() },
      { TimbangID: 'TMB-07', UserID: 'USR-0001', Tanggal: '2026-11-10', BeratKg: 74.2, Catatan: 'Turun 1.4 kg dalam 1 minggu!', DibuatPada: new Date().toISOString() }
    ];
    bulkAppendRows_('RiwayatTimbang', rowsTimbang);
    console.log('[Setup] Riwayat timbangan awal 7 hari diisi.');
  }

  // 5. Setup Pemicu Waktu Otomatis (Cron)
  setupWhatsAppTriggers_();

  console.log('[Setup] 🎉 Selesai! Spreadsheet siap digunakan: ' + ss.getUrl());
  return {
    success: true,
    message: 'Inisialisasi lingkungan NutriTrack & FitLife sukses!',
    spreadsheetUrl: ss.getUrl()
  };
}
