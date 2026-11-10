// ========================================================================
// Migrasi.js: Pola Migrasi & Sinkronisasi Database Spreadsheet Aman
// Standar: 8 Prinsip gas-migrasi-database (Dry-Run, Upsert Idempoten)
// ========================================================================

function openSourceSpreadsheet_(idOrUrl) {
  if (!idOrUrl) {
    throw new Error('Fungsi migrasi memerlukan ID Spreadsheet sumber. Jika ingin setup database aplikasi baru, silakan pilih dan jalankan fungsi "setupAppEnvironment".');
  }

  const m = String(idOrUrl).match(/\/d\/([A-Za-z0-9_-]{20,})/);
  const id = m ? m[1] : String(idOrUrl).trim();
  const currentSS = getSpreadsheet_();
  const currentId = currentSS ? currentSS.getId() : '';

  if (id === currentId) {
    throw new Error('Spreadsheet yang dimasukkan adalah spreadsheet aplikasi ini. Masukkan ID spreadsheet sumber LAMA.');
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Spreadsheet lama tidak dapat dibuka. Pastikan ID benar dan berada di akun Google yang sama.');
  }
}

function bacaSheetSumber_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return null;
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.join('') !== '').map(r => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = r[i]; });
    return o;
  });
}

/**
 * Eksekusi Migrasi / Sinkronisasi Idempoten
 * @param {string} sourceId - ID spreadsheet lama
 * @param {boolean} dryRun - Jika true, hanya menghitung tanpa menulis data
 */
function jalankanMigrasiNutriTrack(sourceId, dryRun) {
  const srcSS = openSourceSpreadsheet_(sourceId);
  const hasil = { dryRun: !!dryRun, inserted: 0, updated: 0, skipped: 0 };

  // Migrasi Pengguna (Users)
  const usersLama = bacaSheetSumber_(srcSS, 'Users') || bacaSheetSumber_(srcSS, 'Pengguna') || [];
  if (usersLama.length > 0) {
    const usersBaru = readSheetBatch_('Users', false);
    const existingMap = {};
    usersBaru.forEach(u => { existingMap[normalisasiHP_(u.NoWA)] = true; });

    const rowsToInsert = [];
    usersLama.forEach(u => {
      const wa = normalisasiHP_(u.NoWA || u.NomorWA || u.Telepon);
      if (!wa || existingMap[wa]) {
        hasil.skipped++;
        return;
      }
      rowsToInsert.push({
        UserID: 'USR-' + Utilities.getUuid().slice(0, 6),
        Nama: u.Nama || u.NamaLengkap || 'Member',
        NoWA: wa,
        Usia: u.Usia || 25,
        Gender: u.Gender || 'Pria',
        TinggiCm: u.TinggiCm || 170,
        BeratAwal: u.BeratAwal || 70,
        BeratSekarang: u.BeratSekarang || 70,
        TargetBB: u.TargetBB || 65,
        JatahKalori: u.JatahKalori || 1960,
        TargetAir: u.TargetAir || 8,
        Role: 'member',
        DibuatPada: new Date().toISOString()
      });
      existingMap[wa] = true;
      hasil.inserted++;
    });

    if (!dryRun && rowsToInsert.length > 0) {
      bulkAppendRows_('Users', rowsToInsert);
    }
  }

  return hasil;
}
