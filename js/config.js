// ========================================================================
// config.js: Konfigurasi Publik Frontend PWA
// Standar: R11 gas-rahasia-script-properties (Zero Literal Secrets!)
// Kredensial rahasia (Fonnte Token, Gemini API Key, Sheet ID) hanya di Script Properties!
// ========================================================================

const CONFIG = {
  // Web App URL dari deployment Google Apps Script (Execute as: Me, Who has access: Anyone)
  GAS_URL: localStorage.getItem('NUTRITRACK_GAS_URL') || 'https://script.google.com/macros/s/AKfycbzGPKKWL44XxBw2Urkr4_0V1E70sfE_kfG1YMJh9w92PqarjCXLe7xW9Ad4kBeTQyar/exec',

  // Informasi Brand & Versi
  APP_NAME: 'NutriTrack & FitLife',
  APP_VERSION: '1.2.0',
  DEFAULT_USER: {
    nama: 'Brooks',
    nomor_wa: '6281234567890',
    targetCalories: 1960,
    consumedCalories: 1420,
    waterDrank: 5,
    waterTarget: 8
  }
};
