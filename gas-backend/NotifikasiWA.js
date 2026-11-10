// ========================================================================
// NotifikasiWA.js: Integrasi WhatsApp Gateway Fonnte & Antrean Non-Blocking
// Standar: 10 Prinsip gas-notifikasi-wa-crm (Zero Latency Blocking UI)
// ========================================================================

// ------------------------------------------------------------------------
// 1. Normalisasi Nomor Telepon 3-Titik (Prinsip 4)
// ------------------------------------------------------------------------
function normalisasiHP_(no) {
  if (!no) return '';
  let s = String(no).replace(/[^0-9]/g, '');
  if (s.startsWith('62')) s = '0' + s.slice(2);
  if (!s.startsWith('0') && s.length >= 9) s = '0' + s;
  return s;
}

function keFormatFonnte_(no) {
  let s = normalisasiHP_(no);
  if (s.startsWith('0')) s = '62' + s.slice(1);
  return s;
}

// ------------------------------------------------------------------------
// 2. Antrean Non-Blocking: Cukup Tulis ke Sheet AntrianNotif (0ms Delay)
// ------------------------------------------------------------------------
function antrikanNotif_(eventKey, noWA, nama, vars, refId) {
  const ev = NOTIF_EVENTS[eventKey];
  if (!ev || !ev.wa) return;

  // Substitusi Variabel Pesan
  let pesan = ev.pesan.replace('{nama}', nama || 'Member');
  if (vars) {
    Object.keys(vars).forEach(k => {
      pesan = pesan.replace(new RegExp(`{${k}}`, 'g'), vars[k]);
    });
  }

  const antrianRow = {
    AntrianID: 'ANT-' + Utilities.getUuid().slice(0, 8),
    Kanal: 'WA',
    Tujuan: normalisasiHP_(noWA),
    NamaPenerima: nama || 'Member',
    Subjek: ev.label,
    Pesan: pesan,
    Event: eventKey,
    RefID: refId || '',
    Status: 'Antri',
    Percobaan: 0,
    Respon: '',
    DibuatPada: new Date().toISOString(),
    DikirimPada: ''
  };

  bulkAppendRows_('AntrianNotif', [antrianRow]);
  console.log(`[Antrean WA] Pesan untuk ${nama} (${noWA}) berhasil dimasukkan antrean.`);
}

// ------------------------------------------------------------------------
// 3. Worker Pengirim Antrean: Diproses Latar Belakang (Non-Blocking)
// ------------------------------------------------------------------------
function prosesAntrianNotif() {
  const token = prop_('FONNTE_TOKEN');
  if (!token) {
    console.warn('[Fonnte] FONNTE_TOKEN belum diatur di Script Properties.');
    return;
  }

  const antrian = readSheetBatch_('AntrianNotif', false);
  const pending = antrian.filter(r => r.Status === 'Antri').slice(0, 20); // Batch 20 pesan

  if (pending.length === 0) return;

  console.log(`[Fonnte Worker] Memproses ${pending.length} pesan dalam antrean...`);

  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName('AntrianNotif');
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const colStatus = headers.indexOf('Status') + 1;
  const colRespon = headers.indexOf('Respon') + 1;
  const colDikirim = headers.indexOf('DikirimPada') + 1;

  pending.forEach((item, idx) => {
    if (idx > 0) Utilities.sleep(1500); // Jeda anti-banned

    const target62 = keFormatFonnte_(item.Tujuan);
    const res = kirimFonnteDirect_(token, target62, item.Pesan);

    // Update status baris di spreadsheet
    for (let r = 1; r < values.length; r++) {
      if (values[r][headers.indexOf('AntrianID')] === item.AntrianID) {
        const rowNum = r + 1;
        sh.getRange(rowNum, colStatus).setValue(res.status ? 'Terkirim' : 'Gagal');
        sh.getRange(rowNum, colRespon).setValue(JSON.stringify(res).slice(0, 200));
        sh.getRange(rowNum, colDikirim).setValue(new Date().toISOString());
        break;
      }
    }
  });
}

function kirimFonnteDirect_(token, target62, pesan) {
  if (!token) {
    return { status: false, reason: 'FONNTE_TOKEN belum diatur di Script Properties.' };
  }

  const payload = {
    target: target62,
    message: pesan,
    countryCode: '62'
  };

  try {
    const res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { Authorization: token },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText());
  } catch (err) {
    return { status: false, reason: err.message };
  }
}

function kirimWaDirect_(target, pesan) {
  const token = prop_('FONNTE_TOKEN');
  if (!token) {
    return {
      status: false,
      message: 'FONNTE_TOKEN belum diatur. Silakan masukkan Token Fonnte di menu Pengaturan (ikon gerigi) aplikasi Anda.'
    };
  }

  const target62 = keFormatFonnte_(target);
  const res = kirimFonnteDirect_(token, target62, pesan);

  if (res.status === true) {
    return { status: true, message: `Pesan WhatsApp berhasil dikirim ke ${target62}!`, detail: res };
  } else {
    return { status: false, message: `Fonnte: ${res.reason || res.message || JSON.stringify(res)}`, detail: res };
  }
}

// ------------------------------------------------------------------------
// 4. Pemicu Waktu Harian (Cron Triggers 07:00 & 20:30 WIB)
// ------------------------------------------------------------------------
function cronReminderPagi() {
  console.log('[Cron] Menjalankan pengingat pagi 07:00 WIB...');
  const users = readSheetBatch_('Users', false);

  users.forEach(u => {
    antrikanNotif_('REMINDER_PAGI', u.NoWA, u.Nama, {
      jatahKalori: u.JatahKalori || 1960,
      targetAir: u.TargetAir || 8
    }, u.UserID);
  });

  // Segera picu pengiriman antrean
  prosesAntrianNotif();
}

function cronLaporanMalam() {
  console.log('[Cron] Menjalankan laporan rekap malam 20:30 WIB...');
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const users = readSheetBatch_('Users', false);
  const logs = readSheetBatch_('LogsKalori', false).filter(l => String(l.Tanggal).startsWith(todayStr));

  users.forEach(u => {
    const userLogs = logs.filter(l => l.UserID === u.UserID);
    const totalKalori = userLogs.reduce((acc, cur) => acc + (Number(cur.KaloriKkal) || 0), 0);
    const target = Number(u.JatahKalori) || 1960;
    const defisit = target - totalKalori;

    let statusText = '';
    if (defisit >= 0) {
      statusText = `🎉 BERHASIL DEFISIT ${defisit} kkal! Pertahankan konsistensi ini!`;
    } else {
      statusText = `⚠️ Surplus ${Math.abs(defisit)} kkal. Seimbangkan dengan olahraga ringan besok pagi!`;
    }

    antrikanNotif_('LAPORAN_MALAM', u.NoWA, u.Nama, {
      tanggal: todayStr,
      totalKalori: totalKalori,
      jatahKalori: target,
      statusDefisit: statusText
    }, u.UserID);
  });

  prosesAntrianNotif();
}

// ------------------------------------------------------------------------
// 5. Inisialisasi Pemicu Waktu Otomatis
// ------------------------------------------------------------------------
function setupWhatsAppTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === 'cronReminderPagi' || fn === 'cronLaporanMalam' || fn === 'prosesAntrianNotif') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Pagi 07:00
  ScriptApp.newTrigger('cronReminderPagi')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone('Asia/Jakarta')
    .create();

  // Malam 20:30
  ScriptApp.newTrigger('cronLaporanMalam')
    .timeBased()
    .atHour(20)
    .everyDays(1)
    .inTimezone('Asia/Jakarta')
    .create();

  // Worker Antrean Setiap 5 Menit
  ScriptApp.newTrigger('prosesAntrianNotif')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('[Setup] Pemicu waktu pengingat WhatsApp & worker antrean aktif!');
}
