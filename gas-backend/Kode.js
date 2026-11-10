// ========================================================================
// Kode.js: REST API Router & Dispatcher Master NutriTrack & FitLife
// Standar: gas-pro-api (No iFrame, Pure JSON) & gas-scale-turbo (Latency Telemetry)
// ========================================================================

function doGet(e) {
  const t0 = Date.now();
  let res;

  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'ping';

    if (action === 'ping') {
      res = {
        success: true,
        status: 'online',
        app: 'NutriTrack & FitLife REST API',
        timestamp: new Date().toISOString()
      };
    } else if (action === 'get_workouts') {
      const workouts = readSheetBatch_('KatalogWorkout', true);
      res = { success: true, data: workouts };
    } else if (action === 'get_user') {
      const wa = normalisasiHP_(params.no_wa || '081234567890');
      const users = readSheetBatch_('Users', false);
      const user = users.find(u => normalisasiHP_(u.NoWA) === wa) || users[0];
      res = { success: true, data: user };
    } else if (action === 'get_report') {
      const wa = normalisasiHP_(params.no_wa || '081234567890');
      const timbang = readSheetBatch_('RiwayatTimbang', false);
      const logsKalori = readSheetBatch_('LogsKalori', false);
      res = {
        success: true,
        data: {
          timbangan: timbang.slice(-7),
          logs: logsKalori.slice(-14)
        }
      };
    } else if (action === 'get_api_status') {
      res = {
        success: true,
        hasFonnte: !!prop_('FONNTE_TOKEN'),
        fonnteMasked: maskSecret_(prop_('FONNTE_TOKEN')),
        hasGemini: !!prop_('GEMINI_API_KEY'),
        geminiMasked: maskSecret_(prop_('GEMINI_API_KEY')),
        spreadsheetUrl: getSpreadsheet_().getUrl()
      };
    } else {
      res = { success: false, message: 'Aksi GET tidak ditemukan' };
    }
  } catch (err) {
    res = { success: false, message: err.message };
  }

  res.ms = Date.now() - t0;
  res.v = APP_VERSION;
  return sendJsonResponse_(res);
}

function doPost(e) {
  const t0 = Date.now();
  let res;

  try {
    const bodyStr = (e && e.postData && e.postData.contents) || '{}';
    const body = JSON.parse(bodyStr);
    const action = body.action || '';

    if (action === 'log_meal') {
      const logRow = {
        LogID: 'LOG-' + Utilities.getUuid().slice(0, 8),
        UserID: body.user_id || 'USR-0001',
        Tanggal: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        WaktuMakan: body.waktu_makan || 'Dinner',
        NamaMakanan: body.nama_makanan || 'Makanan',
        Porsi: body.porsi || '1 Porsi',
        KaloriKkal: Number(body.kalori_kkal) || 0,
        ProteinG: Number(body.protein) || 0,
        FatG: Number(body.fat) || 0,
        CarbsG: Number(body.carbs) || 0,
        CatatanAI: body.catatan_ai || '',
        DibuatPada: new Date().toISOString()
      };
      bulkAppendRows_('LogsKalori', [logRow]);
      res = { success: true, message: 'Menu berhasil dicatat ke kalori harian', data: logRow };

    } else if (action === 'log_workout') {
      const woRow = {
        LogWOID: 'LWO-' + Utilities.getUuid().slice(0, 8),
        UserID: body.user_id || 'USR-0001',
        Tanggal: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        NamaLatihan: body.nama_latihan || 'Workout',
        DurasiAktual: Number(body.durasi) || 12,
        KaloriTerbakar: Number(body.kalori_terbakar) || 140,
        DibuatPada: new Date().toISOString()
      };
      bulkAppendRows_('LogsWorkout', [woRow]);
      res = { success: true, message: 'Sesi latihan berhasil dicatat', data: woRow };

    } else if (action === 'gemini_chat') {
      const aiReply = panggilGeminiAI_(body.prompt, body.imageBase64, body.history, body.user_profile);
      res = { success: true, data: aiReply };

    } else if (action === 'calculate_calorie') {
      const calcResult = hitungKaloriMakananAI_(body.query);
      res = { success: true, data: calcResult };

    } else if (action === 'send_wa_test') {
      const target = body.target || '081234567890';
      const pesan = body.message || `Halo ${body.nama || 'Brooks'}! 🌟 Ini adalah pesan uji coba dari aplikasi NutriTrack & FitLife. Sistem notifikasi WhatsApp Anda telah berhasil aktif!`;
      const waRes = kirimWaDirect_(target, pesan);
      res = { success: waRes.status === true, message: waRes.message, detail: waRes.detail };

    } else if (action === 'save_user_profile') {
      const timbangRow = {
        TimbangID: 'TMB-' + Utilities.getUuid().slice(0, 8),
        UserID: body.user_id || 'USR-0001',
        Tanggal: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        BeratKg: Number(body.berat_badan) || 74.2,
        Catatan: `Nama: ${body.nama || 'Brooks'}, BMI: ${body.bmi || 24.2}, TDEE: ${body.tdee || 2365}, Target BB: ${body.target_bb || 68}kg, Target Kalori: ${body.target_kalori || 1865}`,
        DibuatPada: new Date().toISOString()
      };
      bulkAppendRows_('RiwayatTimbang', [timbangRow]);
      res = { success: true, message: 'Profil dan data timbangan berhasil disimpan ke Google Sheets', data: timbangRow };

    } else if (action === 'save_api_keys') {
      if (body.fonnte_token) setProp_('FONNTE_TOKEN', body.fonnte_token.trim());
      if (body.gemini_api_key) setProp_('GEMINI_API_KEY', body.gemini_api_key.trim());
      res = {
        success: true,
        message: 'Kunci API berhasil disimpan di Script Properties!',
        hasFonnte: !!prop_('FONNTE_TOKEN'),
        fonnteMasked: maskSecret_(prop_('FONNTE_TOKEN')),
        hasGemini: !!prop_('GEMINI_API_KEY'),
        geminiMasked: maskSecret_(prop_('GEMINI_API_KEY'))
      };

    } else if (action === 'setup_environment') {
      res = setupAppEnvironment();

    } else if (action === 'test_wa') {
      antrikanNotif_('REMINDER_PAGI', body.target, body.nama || 'Tester', {
        jatahKalori: 1960,
        targetAir: 8
      }, 'TEST-01');
      prosesAntrianNotif();
      res = { success: true, message: 'Uji pesan WhatsApp telah diproses' };

    } else {
      res = { success: false, message: 'Aksi POST "' + action + '" tidak dikenal' };
    }
  } catch (err) {
    res = { success: false, message: err.message };
  }

  res.ms = Date.now() - t0;
  res.v = APP_VERSION;
  return sendJsonResponse_(res);
}

function sendJsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
