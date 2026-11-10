// ========================================================================
// GeminiAI.js: Asisten Diet & AI Vision Proxy (Google Gemini Free Tier)
// Dilengkapi: Smart Nutrition Engine Fallback (Kamus Makanan Indonesia)
// ========================================================================

// ------------------------------------------------------------------------
// 1. Chat AI Diet Virtual
// ------------------------------------------------------------------------
function panggilGeminiAI_(promptText, imageBase64, history, userProfile) {
  const apiKey = prop_('GEMINI_API_KEY');

  // Jika API Key belum diisi, gunakan Smart Advisor Fallback agar tidak error!
  if (!apiKey) {
    return fallbackSmartChat_(promptText, userProfile);
  }

  const u = userProfile || {};
  const systemInstruction = 
    "Anda adalah NutriTrack & FitLife AI Coach, pakar nutrisi klinis dan pelatih diet profesional.\n" +
    (u.weightKg ? `PROFIL PENGGUNA: BB ${u.weightKg}kg, TB ${u.heightCm}cm, BMI ${u.bmi} (${u.bmiCategory}), BMR ${u.bmr} kcal, TDEE ${u.tdee} kcal, Target BB ${u.targetWeightKg}kg, Target Kalori ${u.targetCalories} kcal (defisit -${u.deficitLevel || 500} kcal/hari). Terkonsumsi ${u.consumedCalories || 0} kcal.\n` : '') +
    "PEDOMAN MENJAWAB:\n" +
    "1. Jawablah langsung, relevan, dan 100% nyambung dengan pertanyaan spesifik pengguna.\n" +
    "2. Gunakan riwayat dialog (multi-turn) untuk memahami pertanyaan lanjutan.\n" +
    "3. Selalu gunakan Bahasa Indonesia yang ramah, santun, memotivasi, dan mudah dipahami.\n" +
    "4. Jika merekomendasikan makanan, selalu sertakan perkiraan kalori (kcal) dan makronutrisi (protein, lemak, karbohidrat).";

  // Gunakan riwayat percakapan jika ada
  let contents = [];
  if (Array.isArray(history) && history.length > 0) {
    contents = history;
  } else {
    const parts = [];
    if (promptText) parts.push({ text: promptText });
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    }
    contents = [{ role: 'user', parts: parts }];
  }

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 750
    }
  };

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  for (let i = 0; i < models.length; i++) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${models[i]}:generateContent?key=${apiKey}`;
    try {
      const response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const json = JSON.parse(response.getContentText());
      if (json.candidates && json.candidates.length > 0 && json.candidates[0].content) {
        return json.candidates[0].content.parts[0].text;
      }
      if (json.error) {
        console.warn(`[Gemini ${models[i]} Error]`, json.error.message);
      }
    } catch (err) {
      console.warn(`[Gemini ${models[i]} Fetch Error]`, err.message);
    }
  }

  return fallbackSmartChat_(promptText, userProfile);
}

// ------------------------------------------------------------------------
// 2. Hitung Kalori Makanan Otomatis via AI
// ------------------------------------------------------------------------
function hitungKaloriMakananAI_(namaMakanan) {
  const apiKey = prop_('GEMINI_API_KEY');

  if (apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = 
        `Analisis makanan ini: "${namaMakanan}". ` +
        `Kembalikan HANYA JSON murni tanpa markdown dengan format persis: ` +
        `{"nama_makanan": "${namaMakanan}", "kalori": 000, "protein": 0, "fat": 0, "carbs": 0, "porsi": "1 Porsi (200g)", "saran": "..."}`;

      const res = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
        }),
        muteHttpExceptions: true
      });

      const json = JSON.parse(res.getContentText());
      if (json.candidates && json.candidates[0].content) {
        let rawText = json.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);
        if (parsed.kalori) return parsed;
      }
    } catch (e) {
      console.warn('[Gemini Food Calc] Fallback to dictionary:', e.message);
    }
  }

  // Fallback ke kamus gizi cerdas
  return kalkulatorGiziKamus_(namaMakanan);
}

// ------------------------------------------------------------------------
// 3. Kamus Nutrisi & Kalori Cerdas (Offline / Built-in Fallback)
// ------------------------------------------------------------------------
function kalkulatorGiziKamus_(query) {
  const q = String(query || '').toLowerCase().trim();

  // Database 40+ Makanan Populer Indonesia & Harian
  const DB = [
    { k: ['nasi putih'], nama: 'Nasi Putih', kalori: 204, p: 4.2, f: 0.4, c: 45, porsi: '1 Porsi (150g)', saran: 'Sumber karbohidrat utama. Batasi 1 centong jika sedang program defisit ketat.' },
    { k: ['nasi merah'], nama: 'Nasi Merah', kalori: 165, p: 3.8, f: 1.2, c: 35, porsi: '1 Porsi (150g)', saran: 'Sangat baik untuk diet, tinggi serat dan indeks glikemik rendah.' },
    { k: ['nasi goreng'], nama: 'Nasi Goreng Telur', kalori: 450, p: 14, f: 18, c: 58, porsi: '1 Piring (250g)', saran: 'Cukup tinggi lemak dari minyak goreng. Kurangi porsi nasi dan tambahkan mentimun/sayur.' },
    { k: ['nasi uduk'], nama: 'Nasi Uduk', kalori: 380, p: 7, f: 16, c: 52, porsi: '1 Porsi (200g)', saran: 'Mengandung santan. Hindari gorengan pendamping berlebih untuk menjaga kalori.' },
    { k: ['ayam geprek'], nama: 'Ayam Geprek Sambal Bawang', kalori: 480, p: 32, f: 28, c: 24, porsi: '1 Potong Besar', saran: 'Tinggi protein namun tepung renyahnya menyerap banyak minyak. Seimbangkan dengan air putih.' },
    { k: ['ayam bakar', 'dada ayam bakar'], nama: 'Dada Ayam Bakar', kalori: 240, p: 35, f: 6, c: 8, porsi: '1 Potong (150g)', saran: 'Pilihan protein juara untuk penurunan berat badan dan pembentukan massa otot.' },
    { k: ['ayam goreng'], nama: 'Ayam Goreng', kalori: 320, p: 26, f: 20, c: 8, porsi: '1 Potong', saran: 'Kaya protein, buang kulitnya jika ingin memangkas hingga 100 kalori lemak jenuh.' },
    { k: ['sate ayam'], nama: 'Sate Ayam Bumbu Kacang', kalori: 380, p: 32, f: 16, c: 18, porsi: '10 Tusuk', saran: 'Minta bumbu kacang dipisah agar asupan kalori lebih mudah dikontrol.' },
    { k: ['soto ayam'], nama: 'Soto Ayam Bening', kalori: 280, p: 24, f: 8, c: 26, porsi: '1 Mangkuk', saran: 'Kuah bening sangat ramah diet dan mengenyangkan. Hindari koya berlebihan.' },
    { k: ['rendang'], nama: 'Rendang Daging Sapi', kalori: 350, p: 28, f: 22, c: 8, porsi: '1 Potong (100g)', saran: 'Padat nutrisi dan zat besi. Batasi kuah santannya saat defisit kalori.' },
    { k: ['telur rebus'], nama: 'Telur Ayam Rebus', kalori: 78, p: 6.5, f: 5.3, c: 0.6, porsi: '1 Butir (50g)', saran: 'Superfood ramah kantong. Pilihan camilan atau sarapan penahan lapar terbaik.' },
    { k: ['telur ceplok', 'telur mata sapi'], nama: 'Telur Ceplok Goreng', kalori: 115, p: 6.5, f: 9.2, c: 0.8, porsi: '1 Butir', saran: 'Gunakan sedikit minyak atau teflon anti-lengket untuk menghemat kalori.' },
    { k: ['telur dadar'], nama: 'Telur Dadar', kalori: 140, p: 7.2, f: 11, c: 1.5, porsi: '1 Butir', saran: 'Tambahkan daun bawang dan irisan cabai agar lebih mengenyangkan tanpa nambah kalori.' },
    { k: ['gado gado', 'gado-gado'], nama: 'Gado-Gado', kalori: 340, p: 14, f: 15, c: 42, porsi: '1 Piring', saran: 'Kaya sayuran dan serat pangan. Kurangi porsi kerupuk dan lontong.' },
    { k: ['pecel'], nama: 'Pecel Sayur', kalori: 260, p: 10, f: 12, c: 32, porsi: '1 Porsi', saran: 'Kombinasi sayuran rebus segar. Pilihan menu makan siang sehat yang mudah ditemukan.' },
    { k: ['tempe goreng'], nama: 'Tempe Goreng Tepung', kalori: 140, p: 6, f: 8, c: 10, porsi: '1 Potong', saran: 'Tempe kukus atau bacem lebih rendah kalori dibanding goreng tepung.' },
    { k: ['tahu goreng'], nama: 'Tahu Goreng', kalori: 90, p: 5, f: 6, c: 4, porsi: '1 Potong', saran: 'Sumber protein nabati rendah kalori yang mudah dipadukan dengan berbagai menu.' },
    { k: ['bakso'], nama: 'Mie Bakso Sapi Kuah', kalori: 420, p: 22, f: 16, c: 48, porsi: '1 Mangkuk', saran: 'Pilih kuah bening dan ganti mie kuning dengan bihun atau perbanyak sayur sawi.' },
    { k: ['pisang'], nama: 'Pisang Cavendish/Ambon', kalori: 105, p: 1.3, f: 0.3, c: 27, porsi: '1 Buah Sedang', saran: 'Sumber kalium dan karbohidrat cepat serap sebelum olahraga.' },
    { k: ['semangka'], nama: 'Semangka Potong', kalori: 45, p: 0.9, f: 0.2, c: 11, porsi: '1 Cup (150g)', saran: 'Mengandung 92% air. Camilan hidrasi manis yang sangat aman bagi diet defisit kalori.' },
    { k: ['alpukat'], nama: 'Alpukat Segar', kalori: 240, p: 3, f: 22, c: 12, porsi: '1 Buah (150g)', saran: 'Kaya lemak tak jenuh tunggal yang baik untuk kesehatan jantung dan rasa kenyang lama.' },
    { k: ['apel'], nama: 'Apel Fuji Segar', kalori: 95, p: 0.5, f: 0.3, c: 25, porsi: '1 Buah (180g)', saran: 'Tinggi serat pektin, membantu menstabilkan nafsu makan di sela jam kerja.' }
  ];

  // Cari yang cocok
  for (let item of DB) {
    if (item.k.some(key => q.includes(key))) {
      return {
        nama_makanan: item.nama,
        kalori: item.kalori,
        protein: item.p,
        fat: item.f,
        carbs: item.c,
        porsi: item.porsi,
        saran: item.saran
      };
    }
  }

  // Jika nama tidak ada di database, gunakan algoritma estimasi cerdas
  let estKcal = 300, estP = 15, estF = 10, estC = 35;
  if (q.includes('goreng') || q.includes('santan') || q.includes('crispy')) {
    estKcal += 150; estF += 12;
  }
  if (q.includes('rebus') || q.includes('kukus') || q.includes('bakar')) {
    estKcal -= 50; estF -= 5;
  }
  if (q.includes('daging') || q.includes('ayam') || q.includes('ikan') || q.includes('telur')) {
    estP += 15;
  }
  if (q.includes('sayur') || q.includes('buah') || q.includes('salad')) {
    estKcal -= 100; estC += 10;
  }

  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    nama_makanan: capitalize(query || 'Menu Sehat'),
    kalori: Math.max(80, estKcal),
    protein: Math.max(3, estP),
    fat: Math.max(2, estF),
    carbs: Math.max(5, estC),
    porsi: '1 Porsi Standar (~200g)',
    saran: 'Estimasi berbasis profil bahan makanan. Tetap utamakan sayuran dan cukupi kebutuhan cairan harian.'
  };
}

function fallbackSmartChat_(prompt, userProfile) {
  const q = String(prompt || '').toLowerCase().trim();
  const u = userProfile || {};

  if (/\b(halo|hai|pagi|siang|sore|malam|assalam|hi|hello)\b/.test(q)) {
    return "Halo Brooks! ☀️ Senang bisa mendampingi program sehat Anda hari ini. Ada menu makanan yang ingin Anda tanyakan atau butuh saran pola makan ramah defisit kalori?";
  }

  if (q.includes('warung') || (q.includes('makan') && (q.includes('luar') || q.includes('saran')))) {
    return "Rekomendasi warung ramah defisit kalori:\n" +
           "1. Sate ayam 10 tusuk tanpa lontong & bumbu kacang dipisah (~380 kcal, 36g protein).\n" +
           "2. Soto ayam bening kuah rempah nasi 1/2 (~320 kcal, 28g protein).\n" +
           "3. Gado-gado tanpa kerupuk porsi sedang (~340 kcal, 14g protein).\n" +
           "Tips: Pilih es teh tawar atau air putih hangat!";
  }

  if (q.includes('camilan') || q.includes('snack') || q.includes('buah') || q.includes('semangka') || q.includes('ngemil')) {
    return "Pilihan camilan sehat rendah kalori:\n" +
           "• 1 cup semangka potong (150g) ~45 kcal.\n" +
           "• 1 butir telur rebus ~78 kcal (6.5g protein).\n" +
           "• 1 buah apel segar ~95 kcal (kaya serat pektin).\n" +
           "• Greek yogurt plain 100g ~60 kcal (10g protein).";
  }

  if (q.includes('telur')) {
    return "Telur adalah sumber protein super! 1 butir telur rebus utuh mengandung ~78 kcal dan 6.5g protein. 2 butir telur rebus memberi ~156 kcal dan 13g protein murni, sangat ideal untuk sarapan atau camilan defisit kalori.";
  }

  if (q.includes('nasi') || q.includes('karbo')) {
    return "Anda tetap boleh makan nasi saat diet! 1 centong nasi putih (150g) bernilai ~204 kcal. Untuk kenyang lebih lama, dahulukan makan lauk protein dan serat sayuran sebelum menghabiskan nasi.";
  }

  if (q.includes('bmi') || q.includes('tdee') || q.includes('target bb') || q.includes('berat badan')) {
    return `Profil metabolisme Anda: BMI ${u.bmi || 24.2} (${u.bmiCategory || 'Normal'}), TDEE ~${u.tdee || 2365} kcal/hari, Target kalori harian ~${u.targetCalories || 1865} kcal (defisit -${u.deficitLevel || 500} kcal/hari). Anda bisa mengubah target ini kapan saja lewat menu kalkulator BMI!`;
  }

  if (q.includes('lapar') || q.includes('susah turun') || q.includes('tips') || q.includes('cara') || q.includes('plateau')) {
    return "Tips menjaga defisit kalori agar berat badan turun konsisten:\n" +
           "1. Jaga defisit 300-500 kcal per hari secara konsisten (jangan memangkas terlalu ekstrem).\n" +
           "2. Cukupi protein minimal 1.5 - 1.8g per kg berat badan.\n" +
           "3. Minum 2 gelas air putih saat merasa lapar tiba-tiba.\n" +
           "4. Tidur cukup 7-8 jam per hari untuk menstabilkan hormon lapar ghrelin.";
  }

  return "Halo Brooks! Saya FitLife AI Coach. Untuk konsultasi bebas tanpa batas seputar menu dan diet, pastikan Google Gemini API Key Anda sudah dimasukkan di menu Pengaturan. Anda juga bisa menanyakan kalori makanan tertentu langsung di sini!";
}
