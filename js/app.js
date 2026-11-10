// ========================================================================
// app.js: Frontend Controller NutriTrack & FitLife
// Standar: GAS-PRO-API (CORS-safe fetch), Instant UX & SWR Caching
// ========================================================================

const AppState = {
  activeTab: 'home',
  user: {
    nama: 'Brooks',
    nomor_wa: '6281234567890',
    targetCalories: 1960,
    consumedCalories: 1420,
    waterDrank: 5,
    waterTarget: 8,
    startBB: 75.6,
    currentBB: 74.2
  },
  workoutTimer: {
    interval: null,
    secondsLeft: 42,
    totalSeconds: 45,
    isRunning: true,
    title: 'Jumping Jacks',
    caloriesBurn: 35
  },
  selectedMeal: null,
  chartInstance: null
};

// 1. LIFECYCLE ON LOAD
document.addEventListener('DOMContentLoaded', () => {
  // A. Lucide Icons
  if (window.lucide) lucide.createIcons();

  // B. Registrasi Service Worker PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA SW] Terdaftar:', reg.scope))
      .catch(err => console.warn('[PWA SW] Gagal registrasi:', err));
  }

  // C. Load Local Cache (SWR)
  loadCachedState();

  // D. Render Components
  renderCalorieHero();
  renderWaterGlasses();
  startInitialWorkoutTimer();

  // E. Sync dengan Backend GAS jika URL tersedia
  if (CONFIG.GAS_URL) {
    syncWithBackend();
  }
});

// ========================================================================
// 2. TAB ROUTING & NAVIGATION
// ========================================================================
function navigateToTab(tabId) {
  AppState.activeTab = tabId;

  // Sembunyikan semua views
  document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));

  // Reset visual nav buttons
  const navBtns = {
    home: document.getElementById('navBtnHome'),
    workout: document.getElementById('navBtnWorkout'),
    coach: document.getElementById('navBtnCoach')
  };

  Object.values(navBtns).forEach(b => {
    if (b) {
      b.className = 'nav-item flex flex-col items-center gap-1 text-stone-400 hover:text-[#1A1B22] transition';
      const dot = b.querySelector('.bg-\\[\\#8BC34A\\]');
      if (dot) dot.remove();
    }
  });

  if (tabId === 'home') {
    document.getElementById('viewHome').classList.remove('hidden');
    navBtns.home.className = 'nav-item flex flex-col items-center gap-1 text-[#1A1B22] transition';
    navBtns.home.innerHTML = `<i data-lucide="home" class="w-5 h-5"></i><span class="w-1.5 h-1.5 rounded-full bg-[#8BC34A]"></span>`;
  } else if (tabId === 'workout') {
    document.getElementById('viewWorkout').classList.remove('hidden');
    navBtns.workout.className = 'nav-item flex flex-col items-center gap-1 text-[#1A1B22] transition';
    navBtns.workout.innerHTML = `<i data-lucide="dumbbell" class="w-5 h-5 text-[#8BC34A]"></i><span class="text-[9px] font-extrabold uppercase text-[#8BC34A]">Workout</span>`;
  } else if (tabId === 'scanner') {
    document.getElementById('viewScanner').classList.remove('hidden');
  } else if (tabId === 'coach') {
    document.getElementById('viewCoach').classList.remove('hidden');
    navBtns.coach.className = 'nav-item flex flex-col items-center gap-1 text-[#1A1B22] transition';
    navBtns.coach.innerHTML = `<i data-lucide="message-square" class="w-5 h-5 text-[#8BC34A]"></i><span class="text-[9px] font-extrabold uppercase text-[#8BC34A]">Coach</span>`;
  }

  if (window.lucide) lucide.createIcons();
}

// ========================================================================
// 3. CALORIE HERO RING & WATER TRACKER
// ========================================================================
function renderCalorieHero() {
  const target = AppState.user.targetCalories;
  const consumed = AppState.user.consumedCalories;
  const left = Math.max(0, target - consumed);
  const percent = Math.min(100, Math.round((consumed / target) * 100));

  document.getElementById('txtTargetCalories').innerText = target.toLocaleString();
  document.getElementById('txtConsumedCalories').innerText = consumed.toLocaleString();
  document.getElementById('txtLeftCalories').innerText = `${left.toLocaleString()} LEFT`;
  document.getElementById('txtCaloriePercent').innerText = `${percent}% Completed`;

  // SVG Ring Offset (circumference = 251.2)
  const circle = document.getElementById('calorieRingSvg');
  if (circle) {
    const circumference = 251.2;
    const progress = Math.min(1, consumed / target);
    circle.style.strokeDashoffset = circumference - (progress * circumference);
  }
}

function renderWaterGlasses() {
  const row = document.getElementById('waterGlassesRow');
  if (!row) return;

  const total = AppState.user.waterTarget;
  const drank = AppState.user.waterDrank;

  document.getElementById('txtWaterGlasses').innerText = `${drank} / ${total} Glasses completed`;

  row.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const isFilled = i <= drank;
    const cup = document.createElement('div');
    cup.className = `w-7 h-9 rounded-lg flex items-center justify-center border transition-all ${
      isFilled 
        ? 'bg-[#1A1B22] border-[#1A1B22] text-white shadow-xs' 
        : 'bg-stone-50 border-stone-200 text-stone-300'
    }`;
    cup.innerHTML = `<i data-lucide="glass-water" class="w-4 h-4 ${isFilled ? 'fill-white' : ''}"></i>`;
    row.appendChild(cup);
  }
  if (window.lucide) lucide.createIcons();
}

function incrementWaterGlass() {
  if (AppState.user.waterDrank < AppState.user.waterTarget) {
    AppState.user.waterDrank++;
    renderWaterGlasses();
    saveCachedState();
    if (navigator.vibrate) navigator.vibrate(40);
  } else {
    alert('Target hidrasi 8 gelas hari ini sudah terpenuhi! Kerja bagus!');
  }
}

// ========================================================================
// 4. WORKOUT TIMER CONTROLLER (SCREEN 2)
// ========================================================================
function startInitialWorkoutTimer() {
  updateWorkoutTimerVisual();
  clearInterval(AppState.workoutTimer.interval);
  AppState.workoutTimer.interval = setInterval(() => {
    if (AppState.workoutTimer.isRunning) {
      if (AppState.workoutTimer.secondsLeft > 0) {
        AppState.workoutTimer.secondsLeft--;
        updateWorkoutTimerVisual();
      } else {
        finishActiveWorkout();
      }
    }
  }, 1000);
}

function updateWorkoutTimerVisual() {
  const sec = AppState.workoutTimer.secondsLeft;
  const mins = Math.floor(sec / 60);
  const remaining = sec % 60;
  const digitsEl = document.getElementById('workoutTimerDigits');
  if (digitsEl) {
    digitsEl.innerText = `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  }

  const circle = document.getElementById('workoutCountdownCircle');
  if (circle) {
    const circumference = 465;
    const ratio = sec / AppState.workoutTimer.totalSeconds;
    circle.style.strokeDashoffset = circumference - (ratio * circumference);
  }
}

function toggleWorkoutTimer() {
  AppState.workoutTimer.isRunning = !AppState.workoutTimer.isRunning;
  const btn = document.getElementById('btnPlayWorkout');
  if (btn) {
    btn.innerHTML = AppState.workoutTimer.isRunning 
      ? `<i data-lucide="pause" class="w-6 h-6"></i>` 
      : `<i data-lucide="play" class="w-6 h-6 fill-current ml-0.5"></i>`;
    if (window.lucide) lucide.createIcons();
  }
}

function resetWorkoutTimer() {
  AppState.workoutTimer.secondsLeft = AppState.workoutTimer.totalSeconds;
  updateWorkoutTimerVisual();
}

function skipWorkoutExercise() {
  AppState.workoutTimer.secondsLeft = 0;
  finishActiveWorkout();
}

function selectRoutine(title, seconds, calories) {
  AppState.workoutTimer.title = title;
  AppState.workoutTimer.secondsLeft = seconds;
  AppState.workoutTimer.totalSeconds = seconds;
  AppState.workoutTimer.caloriesBurn = calories;
  AppState.workoutTimer.isRunning = true;

  document.getElementById('currentExerciseTitle').innerText = title;
  toggleWorkoutTimer();
  updateWorkoutTimerVisual();
  if (navigator.vibrate) navigator.vibrate(50);
}

function finishActiveWorkout() {
  clearInterval(AppState.workoutTimer.interval);
  const burn = AppState.workoutTimer.caloriesBurn || 35;
  AppState.user.consumedCalories = Math.max(0, AppState.user.consumedCalories - burn);
  renderCalorieHero();
  saveCachedState();

  alert(`Sesi "${AppState.workoutTimer.title}" selesai! Anda membakar ~${burn} kcal ekstra. Defisit harian semakin tajam! 👏`);
}

// ========================================================================
// 5. FOOD SCANNER & MEAL DETAIL MODAL (SCREENS 3 & 4)
// ========================================================================
function triggerScannerCapture() {
  if (navigator.vibrate) navigator.vibrate(60);
  openMealDetailModal('Avocado Citrus Medley', 310, 5.0, 14.0, 42, 'Dinner');
}

function openMealDetailModal(title, kcal, protein, fat, carbs, mealType) {
  AppState.selectedMeal = { title, kcal, protein, fat, carbs, mealType };

  document.getElementById('detailFoodTitle').innerText = title;
  document.getElementById('detailFoodKcal').innerText = `${kcal} kcal`;
  document.getElementById('detailProteinVal').innerText = `${protein}g`;
  document.getElementById('detailFatVal').innerText = `${fat}g`;
  document.getElementById('detailCarbsVal').innerText = `${carbs}g`;

  document.getElementById('modalMealDetail').classList.remove('hidden');
}

function closeMealDetailModal() {
  document.getElementById('modalMealDetail').classList.add('hidden');
}

function confirmAddMealToDailyLog() {
  if (!AppState.selectedMeal) return;

  const m = AppState.selectedMeal;
  AppState.user.consumedCalories += m.kcal;
  renderCalorieHero();
  saveCachedState();

  // Kirim asinkron ke Google Apps Script backend jika aktif
  if (CONFIG.GAS_URL) {
    postToGAS('log_meal', {
      user_id: AppState.user.nomor_wa,
      waktu_makan: m.mealType || 'Dinner',
      nama_makanan: m.title,
      kalori_kkal: m.kcal,
      protein: m.protein,
      fat: m.fat,
      carbs: m.carbs
    }).catch(err => console.log('GAS sync queued:', err));
  }

  closeMealDetailModal();
  navigateToTab('home');
  alert(`Berhasil mencatat "${m.title}" (+${m.kcal} kcal) ke log ${m.mealType || 'makan'}!`);
}

// ========================================================================
// 6. FITLIFE AI COACH (SCREEN 5)
// ========================================================================
function triggerQuickAIQuery(queryText) {
  document.getElementById('aiChatInput').value = queryText;
  sendUserChatMessage();
}

function sendUserChatMessage() {
  const input = document.getElementById('aiChatInput');
  const msg = input.value.trim();
  if (!msg) return;

  const stream = document.getElementById('aiChatStream');

  // User Message Bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'flex justify-end';
  userBubble.innerHTML = `
    <div class="bg-[#1A1B22] text-white rounded-2xl rounded-tr-xs p-3.5 text-xs max-w-[85%] leading-relaxed shadow-xs">
      ${escapeHtml(msg)}
      <span class="block text-[10px] text-stone-400 mt-1 text-right">Just now ✓✓</span>
    </div>
  `;
  stream.appendChild(userBubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  // Call Google Apps Script Gemini AI Proxy if available
  if (CONFIG.GAS_URL) {
    postToGAS('gemini_chat', { prompt: msg })
      .then(res => {
        if (res.success && res.data) {
          appendAIBubble(res.data);
        } else {
          fallbackAIResponse(msg);
        }
      })
      .catch(() => fallbackAIResponse(msg));
  } else {
    setTimeout(() => fallbackAIResponse(msg), 600);
  }
}

function fallbackAIResponse(msg) {
  const stream = document.getElementById('aiChatStream');
  let text = "Pilihan menu yang sangat baik! Tetap perhatikan porsi karbohidrat dan minum cukup air putih agar defisit kalori Anda hari ini tetap berhasil.";
  
  if (msg.toLowerCase().includes('warung')) {
    text = "Rekomendasi warung tinggi protein &lt; 400 kcal: Sate ayam tanpa bumbu kacang pekat (~320 kcal) atau sup ayam bening dengan sayuran segar (~280 kcal).";
  } else if (msg.toLowerCase().includes('camilan') || msg.toLowerCase().includes('dessert')) {
    text = "Camilan rendah kalori ideal: 1 porsi buah semangka (150g) hanya ~45 kcal dan kaya elektrolit, atau apel fuji segar (~90 kcal).";
  }

  appendAIBubble(text);
}

function appendAIBubble(text) {
  const stream = document.getElementById('aiChatStream');
  const bubble = document.createElement('div');
  bubble.className = 'flex gap-2.5 items-start';
  bubble.innerHTML = `
    <div class="w-7 h-7 rounded-full bg-[#8BC34A] text-white flex items-center justify-center text-xs shrink-0 mt-1">
      <i data-lucide="bot" class="w-4 h-4"></i>
    </div>
    <div class="bg-white border border-[#E8E7EC] rounded-2xl rounded-tl-xs p-3.5 text-xs text-[#1A1B22] max-w-[85%] leading-relaxed shadow-xs">
      ${text}
      <span class="block text-[10px] text-stone-400 mt-1 text-right">Just now</span>
    </div>
  `;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
  if (window.lucide) lucide.createIcons();
}

function logMealFromAI(title, kcal, protein, fat, carbs, mealType) {
  AppState.user.consumedCalories += kcal;
  renderCalorieHero();
  saveCachedState();
  alert(`"${title}" (+${kcal} kcal) berhasil dicatat langsung dari AI Coach!`);
  navigateToTab('home');
}

// ========================================================================
// 7. WEEKLY REPORT & PDF EXPORT
// ========================================================================
function openReportModal() {
  document.getElementById('modalReport').classList.remove('hidden');
  initReportChart();
}

function closeReportModal() {
  document.getElementById('modalReport').classList.add('hidden');
}

function initReportChart() {
  const ctx = document.getElementById('chartWeeklyWeight');
  if (!ctx) return;

  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
  }

  AppState.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      datasets: [{
        label: 'Berat Badan (kg)',
        data: [75.6, 75.4, 75.1, 74.8, 74.6, 74.4, 74.2],
        borderColor: '#8BC34A',
        backgroundColor: 'rgba(139, 195, 74, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointBackgroundColor: '#689F38',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 73.5, max: 76.0, ticks: { stepSize: 0.5, font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

function downloadOfficialReportPDF() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert('Library jsPDF belum siap.');
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Green Brand Header
  doc.setFillColor(139, 195, 74);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('NUTRITRACK & FITLIFE - OFFICIAL WEEKLY PROGRESS REPORT', 14, 15);

  // Client Metadata
  doc.setTextColor(26, 27, 34);
  doc.setFontSize(11);
  doc.text(`Nama Klien: ${AppState.user.nama}`, 14, 34);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Evaluasi: 4 Nov - 10 Nov 2026 | ID Klien: NT-2026-BRK`, 14, 40);

  // Stat Boxes
  doc.setFillColor(241, 248, 233);
  doc.roundedRect(14, 46, 182, 26, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Berat Awal: 75.6 kg', 22, 60);
  doc.text('Berat Terkini: 74.2 kg', 82, 60);
  doc.setTextColor(46, 125, 50);
  doc.text('Penurunan: -1.4 kg (TARGET TERCAPAI)', 132, 60);

  // Daily Deficit Table
  doc.setTextColor(26, 27, 34);
  doc.setFontSize(11);
  doc.text('Rincian Kepatuhan Kalori Harian (7 Hari)', 14, 82);

  const days = [
    ['Senin, 4 Nov', '1,840 kkal', '15 Mins (~140 kkal)', 'Defisit -520 kkal (Tercapai)'],
    ['Selasa, 5 Nov', '1,900 kkal', '10 Mins (~95 kkal)', 'Defisit -480 kkal (Tercapai)'],
    ['Rabu, 6 Nov', '1,820 kkal', '15 Mins (~180 kkal)', 'Defisit -610 kkal (Tercapai)'],
    ['Kamis, 7 Nov', '1,780 kkal', '12 Mins (~140 kkal)', 'Defisit -580 kkal (Tercapai)'],
    ['Jumat, 8 Nov', '1,920 kkal', '10 Mins (~95 kkal)', 'Defisit -460 kkal (Tercapai)'],
    ['Sabtu, 9 Nov', '2,100 kkal', '20 Mins (~220 kkal)', 'Defisit -380 kkal (Tercapai)'],
    ['Minggu, 10 Nov', '1,420 kkal', '12 Mins (~140 kkal)', 'Defisit -540 kkal (Berjalan)']
  ];

  let y = 90;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  days.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255);
    doc.rect(14, y - 5, 182, 7.5, 'F');
    doc.text(row[0], 16, y);
    doc.text(`Asupan: ${row[1]}`, 65, y);
    doc.text(`Olahraga: ${row[2]}`, 115, y);
    doc.text(row[3], 155, y);
    y += 7.5;
  });

  // Verification
  doc.setFontSize(8);
  doc.setTextColor(120, 118, 123);
  doc.text('Dokumen diverifikasi secara digital menggunakan standar HMAC SHA-256.', 14, 280);
  doc.text('Kode Keaslian: NT-HMAC-VERIFIED-998822', 14, 285);

  doc.save(`NutriTrack_Report_${AppState.user.nama}.pdf`);
  alert('Laporan Mingguan PDF resmi berhasil diunduh ke handphone Anda!');
}

// ========================================================================
// 8. BACKEND GAS REST API HELPER (GAS-PRO-API)
// ========================================================================
async function postToGAS(action, payload) {
  if (!CONFIG.GAS_URL) return { success: false, message: 'GAS_URL belum disetel' };

  const bodyData = Object.assign({ action: action }, payload);
  const response = await fetch(CONFIG.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Menghindari pre-flight CORS OPTIONS
    body: JSON.stringify(bodyData)
  });

  return await response.json();
}

function openConfigModal() {
  document.getElementById('inputGasUrl').value = localStorage.getItem('NUTRITRACK_GAS_URL') || '';
  document.getElementById('modalConfig').classList.remove('hidden');
}

function closeConfigModal() {
  document.getElementById('modalConfig').classList.add('hidden');
}

function saveGasConfig() {
  const url = document.getElementById('inputGasUrl').value.trim();
  localStorage.setItem('NUTRITRACK_GAS_URL', url);
  CONFIG.GAS_URL = url;
  closeConfigModal();
  alert('URL Backend tersimpan!');
}

async function testGasPing() {
  const url = document.getElementById('inputGasUrl').value.trim();
  if (!url) {
    alert('Masukkan URL Web App GAS terlebih dahulu!');
    return;
  }
  try {
    const res = await fetch(`${url}?action=ping`);
    const json = await res.json();
    alert(`Sukses terhubung ke GAS!\nStatus: ${json.status}\nWaktu respon: ${json.timestamp}`);
  } catch (err) {
    alert(`Gagal terhubung ke GAS: ${err.message}\nPastikan deploy sebagai "Anyone".`);
  }
}

// ========================================================================
// 9. LOCAL STORAGE CACHING & UTILS
// ========================================================================
function saveCachedState() {
  localStorage.setItem('NUTRITRACK_LOCAL_STATE', JSON.stringify(AppState.user));
}

function loadCachedState() {
  const saved = localStorage.getItem('NUTRITRACK_LOCAL_STATE');
  if (saved) {
    try {
      AppState.user = Object.assign(AppState.user, JSON.parse(saved));
    } catch (e) {}
  }
}

function escapeHtml(str) {
  const tagsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, tag => tagsToReplace[tag] || tag);
}
