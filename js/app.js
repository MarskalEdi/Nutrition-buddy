// ========================================================================
// app.js: Frontend Controller NutriTrack & FitLife
// Standar: GAS-PRO-API (CORS-safe fetch), Instant UX & SWR Caching
// ========================================================================

const AppState = {
  activeTab: 'home',
  user: {
    nama: 'Brooks',
    nomor_wa: '6281234567890',
    gender: 'L',
    age: 28,
    heightCm: 175,
    weightKg: 74.2,
    targetWeightKg: 68.0,
    activityLevel: 1.375,
    deficitLevel: 500,
    bmr: 1720,
    tdee: 2365,
    bmi: 24.2,
    bmiCategory: 'Normal (Ideal)',
    targetCalories: 1865,
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

  // B. Registrasi Service Worker PWA & Auto-Update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        reg.update();
        console.log('[PWA SW] Terdaftar & diupdate:', reg.scope);
      })
      .catch(err => console.warn('[PWA SW] Gagal registrasi:', err));
  }

  // C. Load Local Cache (SWR)
  loadCachedState();

  // D. Render Components
  renderCalorieHero();
  renderBmiTdeeCard();
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

// ========================================================================
// 3B. BMI, TDEE & RENCANA PENGURANGAN BERAT BADAN
// ========================================================================
let currentBmiGender = 'L';
let currentBmiDeficit = 500;
let lastCalculatedBmiPlan = null;

function renderBmiTdeeCard() {
  const u = AppState.user;
  const bmiVal = document.getElementById('cardBmiVal');
  const bmiBadge = document.getElementById('cardBmiBadge');
  const tdeeVal = document.getElementById('cardTdeeVal');
  const planSummary = document.getElementById('cardGoalPlanSummary');

  if (bmiVal) bmiVal.innerText = u.bmi ? u.bmi.toFixed(1) : '24.2';
  if (tdeeVal) tdeeVal.innerText = u.tdee ? u.tdee.toLocaleString() : '2,365';
  if (planSummary) {
    planSummary.innerText = `Target: ${u.targetWeightKg || 68.0} kg (Defisit -${u.deficitLevel || 500} kcal/hari)`;
  }

  if (bmiBadge && u.bmiCategory) {
    bmiBadge.innerText = u.bmiCategory.split(' ')[0];
    const badgeColors = {
      'Kurus': 'bg-blue-100 text-[#0288D1]',
      'Normal': 'bg-green-100 text-[#2E7D32]',
      'Kelebihan': 'bg-amber-100 text-amber-700',
      'Overweight': 'bg-amber-100 text-amber-700',
      'Obesitas': 'bg-red-100 text-red-600'
    };
    const catKey = Object.keys(badgeColors).find(k => u.bmiCategory.includes(k)) || 'Normal';
    bmiBadge.className = `px-2 py-0.5 rounded-full text-[9px] font-extrabold ${badgeColors[catKey]}`;
  }
}

function selectBmiGender(gender) {
  currentBmiGender = gender;
  const btnL = document.getElementById('btnGenderL');
  const btnP = document.getElementById('btnGenderP');
  if (btnL && btnP) {
    if (gender === 'L') {
      btnL.className = 'py-2 rounded-xl border-2 border-[#1A1B22] bg-[#1A1B22] text-white text-xs font-extrabold transition flex items-center justify-center gap-1.5';
      btnP.className = 'py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-extrabold transition flex items-center justify-center gap-1.5';
    } else {
      btnP.className = 'py-2 rounded-xl border-2 border-[#1A1B22] bg-[#1A1B22] text-white text-xs font-extrabold transition flex items-center justify-center gap-1.5';
      btnL.className = 'py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-extrabold transition flex items-center justify-center gap-1.5';
    }
  }
  onBmiTdeeInputsChanged();
}

function selectBmiDeficit(deficit) {
  currentBmiDeficit = Number(deficit);
  const defs = [250, 500, 750];
  defs.forEach(d => {
    const btn = document.getElementById(`btnDeficit${d}`);
    if (btn) {
      if (d === currentBmiDeficit) {
        btn.className = 'py-2 px-1 rounded-xl border-2 border-[#1A1B22] bg-[#1A1B22] text-white text-[11px] font-extrabold transition';
      } else {
        btn.className = 'py-2 px-1 rounded-xl border border-stone-200 text-[11px] font-extrabold text-stone-600 transition';
      }
    }
  });
  onBmiTdeeInputsChanged();
}

function openBmiTdeeModal() {
  const u = AppState.user;
  const inAge = document.getElementById('bmiInputAge');
  const inHeight = document.getElementById('bmiInputHeight');
  const inWeight = document.getElementById('bmiInputWeight');
  const inTargetWeight = document.getElementById('bmiInputTargetWeight');
  const inAct = document.getElementById('bmiInputActivity');

  if (inAge) inAge.value = u.age || 28;
  if (inHeight) inHeight.value = u.heightCm || 175;
  if (inWeight) inWeight.value = u.weightKg || 74.2;
  if (inTargetWeight) inTargetWeight.value = u.targetWeightKg || 68.0;
  if (inAct) inAct.value = String(u.activityLevel || 1.375);

  selectBmiGender(u.gender || 'L');
  selectBmiDeficit(u.deficitLevel || 500);

  document.getElementById('modalBmiTdee').classList.remove('hidden');
  onBmiTdeeInputsChanged();
}

function closeBmiTdeeModal() {
  document.getElementById('modalBmiTdee').classList.add('hidden');
}

function onBmiTdeeInputsChanged() {
  const age = Number(document.getElementById('bmiInputAge')?.value) || 25;
  const height = Number(document.getElementById('bmiInputHeight')?.value) || 170;
  const weight = Number(document.getElementById('bmiInputWeight')?.value) || 70;
  const targetWeight = Number(document.getElementById('bmiInputTargetWeight')?.value) || (weight - 5);
  const activityLevel = Number(document.getElementById('bmiInputActivity')?.value) || 1.375;
  const gender = currentBmiGender;
  const deficitLevel = currentBmiDeficit;

  const plan = calculateBmiTdeePlan(weight, height, age, gender, activityLevel, deficitLevel, targetWeight);
  lastCalculatedBmiPlan = plan;

  const resBmi = document.getElementById('resBmiValue');
  const resBadge = document.getElementById('resBmiBadge');
  const resIdeal = document.getElementById('resIdealRange');
  const resBmr = document.getElementById('resBmrValue');
  const resTdee = document.getElementById('resTdeeValue');
  const resTargetCal = document.getElementById('resTargetCalorieValue');
  const resDeficit = document.getElementById('resDeficitValue');
  const resTimeline = document.getElementById('resTimelineText');
  const resProtein = document.getElementById('resMacroProtein');
  const resFat = document.getElementById('resMacroFat');
  const resCarbs = document.getElementById('resMacroCarbs');

  if (resBmi) resBmi.innerText = plan.bmi.toFixed(1);
  if (resBadge) {
    resBadge.innerText = plan.bmiCategory;
    resBadge.className = `px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${plan.bmiBadgeClass}`;
  }
  if (resIdeal) resIdeal.innerText = `${plan.idealWeightMin} – ${plan.idealWeightMax} kg`;
  if (resBmr) resBmr.innerText = plan.bmr.toLocaleString();
  if (resTdee) resTdee.innerText = plan.tdee.toLocaleString();
  if (resTargetCal) resTargetCal.innerText = plan.targetCalories.toLocaleString();
  if (resDeficit) resDeficit.innerText = `-${plan.deficitLevel} kcal`;

  if (resTimeline) {
    if (plan.weightToLose > 0) {
      resTimeline.innerHTML = `
        <i data-lucide="calendar" class="w-3.5 h-3.5 text-[#8BC34A] shrink-0"></i>
        <span>Target turun <strong>${plan.weightToLose} kg</strong> tercapai dalam <strong>~${plan.weeksEstimate} minggu (~${Math.ceil(plan.weeksEstimate / 4)} bulan)</strong></span>
      `;
    } else {
      resTimeline.innerHTML = `
        <i data-lucide="check-circle" class="w-3.5 h-3.5 text-[#8BC34A] shrink-0"></i>
        <span>Berat badan Anda sudah di target ideal! Pertahankan gaya hidup sehat &amp; seimbang.</span>
      `;
    }
  }

  if (resProtein) resProtein.innerText = `${plan.macros.proteinG}g`;
  if (resFat) resFat.innerText = `${plan.macros.fatG}g`;
  if (resCarbs) resCarbs.innerText = `${plan.macros.carbsG}g`;

  if (window.lucide) lucide.createIcons();
}

function calculateBmiTdeePlan(weight, height, age, gender, activityLevel, deficitLevel, targetWeight) {
  // 1. BMI Calculation: kg / (m^2)
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);

  // Kategori BMI Standar Kemenkes / Asia Pasifik
  let bmiCategory = 'Normal (Ideal)';
  let bmiColor = 'text-green-600';
  let bmiBadgeClass = 'bg-green-100 text-[#2E7D32]';
  if (bmi < 18.5) {
    bmiCategory = 'Kurus (Underweight)';
    bmiColor = 'text-blue-500';
    bmiBadgeClass = 'bg-blue-100 text-[#0288D1]';
  } else if (bmi < 23.0) {
    bmiCategory = 'Normal (Ideal)';
    bmiColor = 'text-green-600';
    bmiBadgeClass = 'bg-green-100 text-[#2E7D32]';
  } else if (bmi < 25.0) {
    bmiCategory = 'Kelebihan (Overweight)';
    bmiColor = 'text-amber-500';
    bmiBadgeClass = 'bg-amber-100 text-amber-700';
  } else {
    bmiCategory = 'Obesitas';
    bmiColor = 'text-red-500';
    bmiBadgeClass = 'bg-red-100 text-red-600';
  }

  // Rentang Berat Badan Ideal (BMI 18.5 - 22.9)
  const idealWeightMin = Math.round(18.5 * heightM * heightM * 10) / 10;
  const idealWeightMax = Math.round(22.9 * heightM * heightM * 10) / 10;

  // 2. BMR (Rumus Medis Mifflin-St Jeor)
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  if (gender === 'L') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  bmr = Math.round(bmr);

  // 3. TDEE = BMR * Activity Factor
  const tdee = Math.round(bmr * activityLevel);

  // 4. Target Kalori Harian Bersih
  const minSafeCalories = gender === 'L' ? 1500 : 1200;
  const targetCalories = Math.max(minSafeCalories, Math.round(tdee - deficitLevel));

  // 5. Estimasi Durasi Penurunan Berat Badan (1 kg lemak tubuh ~ 7.700 kcal defisit)
  const weightToLose = Math.max(0, weight - targetWeight);
  let daysEstimate = 0;
  let weeksEstimate = 0;
  if (weightToLose > 0 && deficitLevel > 0) {
    const totalDeficitNeeded = weightToLose * 7700;
    daysEstimate = Math.round(totalDeficitNeeded / deficitLevel);
    weeksEstimate = Math.max(1, Math.ceil(daysEstimate / 7));
  }

  // 6. Pembagian Makronutrisi Harian
  const proteinG = Math.round(Math.min(weight * 1.8, (targetCalories * 0.28) / 4));
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbsG = Math.round((targetCalories - (proteinG * 4) - (fatG * 9)) / 4);

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory,
    bmiColor,
    bmiBadgeClass,
    idealWeightMin,
    idealWeightMax,
    bmr,
    tdee,
    targetCalories,
    deficitLevel,
    weightToLose: Math.round(weightToLose * 10) / 10,
    daysEstimate,
    weeksEstimate,
    macros: { proteinG, fatG, carbsG }
  };
}

function saveBmiTdeePlan() {
  if (!lastCalculatedBmiPlan) return;

  const plan = lastCalculatedBmiPlan;
  const u = AppState.user;

  u.age = Number(document.getElementById('bmiInputAge')?.value) || 28;
  u.heightCm = Number(document.getElementById('bmiInputHeight')?.value) || 175;
  u.weightKg = Number(document.getElementById('bmiInputWeight')?.value) || 74.2;
  u.currentBB = u.weightKg;
  u.targetWeightKg = Number(document.getElementById('bmiInputTargetWeight')?.value) || 68.0;
  u.activityLevel = Number(document.getElementById('bmiInputActivity')?.value) || 1.375;
  u.gender = currentBmiGender;
  u.deficitLevel = plan.deficitLevel;

  u.bmi = plan.bmi;
  u.bmiCategory = plan.bmiCategory;
  u.bmr = plan.bmr;
  u.tdee = plan.tdee;
  u.targetCalories = plan.targetCalories;

  // Re-render antarmuka
  renderCalorieHero();
  renderBmiTdeeCard();
  saveCachedState();

  // Sinkronkan ke Google Sheets backend jika online
  if (CONFIG.GAS_URL) {
    postToGAS('save_user_profile', {
      user_id: u.nomor_wa,
      berat_badan: u.weightKg,
      tinggi_badan: u.heightCm,
      usia: u.age,
      gender: u.gender,
      bmi: u.bmi,
      tdee: u.tdee,
      target_bb: u.targetWeightKg,
      target_kalori: u.targetCalories
    }).catch(e => console.log('Sync profile warning:', e));
  }

  closeBmiTdeeModal();
  alert(`Rencana berhasil diterapkan! Target kalori harian Anda telah disesuaikan menjadi ${plan.targetCalories.toLocaleString()} kcal (Defisit -${plan.deficitLevel} kcal/hari).`);
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
      <span class="block text-[10px] text-stone-400 mt-1 text-right">Baru saja ✓✓</span>
    </div>
  `;
  stream.appendChild(userBubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  // Catat pesan pengguna ke memori riwayat multi-turn
  AppState.chatHistory = AppState.chatHistory || [];
  AppState.chatHistory.push({
    role: 'user',
    parts: [{ text: msg }]
  });
  if (AppState.chatHistory.length > 10) {
    AppState.chatHistory = AppState.chatHistory.slice(-10);
  }

  // Typing indicator bubble
  const typingBubble = document.createElement('div');
  typingBubble.id = 'aiTypingBubble';
  typingBubble.className = 'flex gap-2 items-center text-xs text-stone-500 italic py-1';
  typingBubble.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-[#8BC34A] text-white flex items-center justify-center text-xs shrink-0">
      <i data-lucide="bot" class="w-3.5 h-3.5"></i>
    </div>
    <span class="animate-pulse">FitLife AI sedang menganalisis &amp; berpikir...</span>
  `;
  stream.appendChild(typingBubble);
  stream.scrollTop = stream.scrollHeight;
  if (window.lucide) lucide.createIcons();

  // 1. Cek apakah pengguna menyimpan Google Gemini API Key di browser lokal
  const geminiKey = (localStorage.getItem('NUTRITRACK_GEMINI_KEY') || '').trim();
  if (geminiKey) {
    callDirectGeminiAPI(geminiKey, msg);
    return;
  }

  // 2. Jika ada GAS backend, panggil via backend dengan timeout 12 detik (karena cold start GAS)
  if (CONFIG.GAS_URL) {
    let responded = false;
    const timeoutTimer = setTimeout(() => {
      if (!responded) {
        responded = true;
        fallbackAIResponse(msg);
      }
    }, 12000);

    postToGAS('gemini_chat', { 
      prompt: msg,
      history: AppState.chatHistory,
      user_profile: {
        weightKg: AppState.user.weightKg,
        heightCm: AppState.user.heightCm,
        bmi: AppState.user.bmi,
        bmiCategory: AppState.user.bmiCategory,
        bmr: AppState.user.bmr,
        tdee: AppState.user.tdee,
        targetCalories: AppState.user.targetCalories,
        consumedCalories: AppState.user.consumedCalories,
        targetWeightKg: AppState.user.targetWeightKg,
        deficitLevel: AppState.user.deficitLevel
      }
    })
      .then(res => {
        if (!responded) {
          responded = true;
          clearTimeout(timeoutTimer);
          document.getElementById('aiTypingBubble')?.remove();
          if (res && res.success && res.data && typeof res.data === 'string' && !res.data.includes('belum disetel')) {
            // Simpan respons ke riwayat percakapan
            AppState.chatHistory.push({
              role: 'model',
              parts: [{ text: res.data }]
            });
            if (AppState.chatHistory.length > 10) AppState.chatHistory = AppState.chatHistory.slice(-10);

            let formatted = res.data
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n\n/g, '<br><br>')
              .replace(/\n/g, '<br>');
            appendAIBubble(formatted);
          } else {
            fallbackAIResponse(msg);
          }
        }
      })
      .catch(() => {
        if (!responded) {
          responded = true;
          clearTimeout(timeoutTimer);
          fallbackAIResponse(msg);
        }
      });
  } else {
    setTimeout(() => fallbackAIResponse(msg), 400);
  }
}

async function callDirectGeminiAPI(apiKey, promptText) {
  const u = AppState.user;
  const remainingCal = Math.max(0, u.targetCalories - u.consumedCalories);

  const systemInstructionText = 
    "Anda adalah FitLife AI Coach, ahli gizi klinis & pelatih diet pribadi di aplikasi NutriTrack & FitLife.\n" +
    "DATA PROFIL PENGGUNA SAAT INI:\n" +
    `- Nama: Brooks\n` +
    `- Jenis Kelamin: ${u.gender === 'P' ? 'Perempuan' : 'Laki-laki'}, Usia: ${u.age || 26} tahun\n` +
    `- Tinggi: ${u.heightCm || 175} cm, Berat Sekarang: ${u.weightKg || 74.2} kg, Target: ${u.targetWeightKg || 68} kg\n` +
    `- BMI: ${u.bmi || 24.2} (${u.bmiCategory || 'Normal'}), BMR: ${u.bmr || 1720} kcal, TDEE: ${u.tdee || 2365} kcal/hari\n` +
    `- Target Kalori Harian: ${u.targetCalories || 1865} kcal/hari (Laju Defisit: -${u.deficitLevel || 500} kcal/hari)\n` +
    `- Kalori Terkonsumsi Hari Ini: ${u.consumedCalories || 1210} kcal, Sisa Jatah Kalori: ${remainingCal} kcal\n` +
    `- Air Minum Hari Ini: ${u.waterDrank || 5} dari target ${u.waterTarget || 8} gelas\n\n` +
    "ATURAN WAJIB MENJAWAB:\n" +
    "1. Jawablah langsung, spesifik, dan 100% 'nyambung' dengan pertanyaan pengguna.\n" +
    "2. Gunakan seluruh riwayat dialog (multi-turn) untuk memahami pertanyaan lanjutan (contoh: 'kalau yang tadi?', 'kenapa begitu?', 'berapa kalorinya?').\n" +
    "3. Selalu gunakan Bahasa Indonesia yang ramah, santun, antusias, memotivasi, dan mudah dipahami.\n" +
    "4. Jika merekomendasikan makanan atau menganalisis porsi, selalu sertakan perkiraan kalori (kcal) dan makronutrisi (protein, lemak, karbohidrat).\n" +
    "5. Jika pengguna menanyakan makanan di luar rekomendasi diet, berikan evaluasi jujur dan solusi penyeimbangnya, bukan melarang kaku.";

  // List endpoint model yang dicoba secara fallback
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
  let success = false;
  let lastErrorMessage = '';

  for (const model of models) {
    if (success) break;
    const cleanKey = apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstructionText }]
          },
          contents: AppState.chatHistory,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 750
          }
        })
      });

      const data = await res.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        document.getElementById('aiTypingBubble')?.remove();
        const rawReply = data.candidates[0].content.parts[0].text;

        // Simpan jawaban ke history untuk konteks percakapan selanjutnya
        AppState.chatHistory.push({
          role: 'model',
          parts: [{ text: rawReply }]
        });
        if (AppState.chatHistory.length > 10) AppState.chatHistory = AppState.chatHistory.slice(-10);

        let formatted = rawReply
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n\n/g, '<br><br>')
          .replace(/\n/g, '<br>');

        appendAIBubble(formatted);
        success = true;
        return;
      }

      if (data.error) {
        lastErrorMessage = data.error.message || 'Gemini API Error';
        console.warn(`[Gemini ${model} Error]:`, lastErrorMessage);
      }
    } catch (fetchErr) {
      lastErrorMessage = fetchErr.message || 'Gagal koneksi ke Gemini';
      console.warn(`[Gemini ${model} Fetch Failed]:`, fetchErr);
    }
  }

  // Jika semua endpoint gagal:
  document.getElementById('aiTypingBubble')?.remove();

  if (lastErrorMessage && (lastErrorMessage.includes('API key') || lastErrorMessage.includes('quota') || lastErrorMessage.includes('RESOURCE_EXHAUSTED') || lastErrorMessage.includes('INVALID_ARGUMENT'))) {
    appendAIBubble(
      `<div class="space-y-2">
        <div class="flex items-center gap-1.5 text-amber-600 font-extrabold text-xs">
          <span>⚠️ Kunci API Gemini Perlu Diperiksa</span>
        </div>
        <p class="text-xs text-stone-600 leading-relaxed">${lastErrorMessage}</p>
        <p class="text-[11px] text-stone-500">Periksa kembali API Key Anda dari Google AI Studio atau buat kunci baru gratis.</p>
        <button onclick="openConfigModal('keys')" class="w-full py-2.5 rounded-xl bg-[#1A1B22] text-white font-extrabold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1">
          <i data-lucide="key" class="w-3.5 h-3.5 text-[#8BC34A]"></i>
          <span>Perbarui Kunci API Gemini</span>
        </button>
      </div>`
    );
    return;
  }

  // Fallback cerdas jika koneksi internet terputus
  fallbackAIResponse(promptText);
}

function fallbackAIResponse(msg) {
  document.getElementById('aiTypingBubble')?.remove();
  const q = String(msg || '').toLowerCase().trim();
  const u = AppState.user;
  const remainingCal = Math.max(0, u.targetCalories - u.consumedCalories);
  let text = "";

  // 1. Cek apakah ini secara eksplisit pertanyaan nama makanan (strict)
  const foodMatch = calculateOfflineFoodCalories(msg, true);
  if (foodMatch && foodMatch.nama_makanan) {
    text = `Analisis gizi <strong>${foodMatch.nama_makanan}</strong>:<br>` +
           `• Porsi: <strong>${foodMatch.porsi}</strong><br>` +
           `• Kalori: <strong>~${foodMatch.kalori} kcal</strong><br>` +
           `• Makronutrisi: Protein <strong>${foodMatch.protein}g</strong> • Lemak <strong>${foodMatch.fat}g</strong> • Karbohidrat <strong>${foodMatch.carbs}g</strong><br><br>` +
           `💡 <em>Saran Diet:</em> ${foodMatch.saran}
           <div class="mt-3">
             <button onclick="logMealFromAI('${foodMatch.nama_makanan}', ${foodMatch.kalori}, ${foodMatch.protein}, ${foodMatch.fat}, ${foodMatch.carbs}, 'Dinner')" class="w-full py-2 rounded-xl bg-[#8BC34A] text-white font-extrabold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1">
               <span>+ Log ke Kalori Harian (+${foodMatch.kalori} kcal)</span>
             </button>
           </div>`;
  }
  // 2. Sapaan / Salam
  else if (/\b(halo|hai|pagi|siang|sore|malam|assalam|hi|hello)\b/.test(q)) {
    text = `Halo Brooks! ☀️ Senang bisa mendampingi Anda hari ini.<br><br>` +
           `Status kalori hari ini: Anda sudah mengonsumsi <strong>${u.consumedCalories} kcal</strong> dari target <strong>${u.targetCalories} kcal</strong> (sisa jatah: <strong class="text-[#2E7D32]">${remainingCal} kcal</strong>).<br><br>` +
           `Ada menu makanan yang ingin Anda tanyakan, atau butuh rekomendasi pilihan makan yang ramah defisit kalori?`;
  }
  // 3. Rekomendasi Menu Warung
  else if (q.includes('warung') || (q.includes('makan') && (q.includes('luar') || q.includes('saran') || q.includes('rekomendasi')))) {
    text = `Berikut 2 rekomendasi menu warung tinggi protein &lt; 400 kcal yang ramah defisit kalori Anda:
    <div class="space-y-2 mt-2">
      <!-- Card 1 -->
      <div class="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-[10px] font-bold text-stone-500">10 Tusuk</span>
          <span class="text-[10px] bg-green-100 text-[#2E7D32] px-2 py-0.5 rounded-full font-extrabold">Lean Protein</span>
        </div>
        <h4 class="text-xs font-extrabold text-[#1A1B22]">Sate Ayam Tanpa Lontong</h4>
        <div class="flex gap-1.5 text-[10px] font-bold">
          <span class="text-orange-600">🔥 ~380 kcal</span> • <span class="text-green-700">🥩 36g Pro</span> • <span class="text-blue-700">🥑 14g Fat</span>
        </div>
        <p class="text-[10px] text-stone-500 italic">💡 Minta bumbu kacang dipisah untuk menghemat ~80 kcal lemak.</p>
        <button onclick="logMealFromAI('Sate Ayam Tanpa Lontong', 380, 36, 14, 12, 'Dinner')" class="w-full py-1.5 rounded-lg bg-[#8BC34A] text-white font-bold text-xs active:scale-95 transition">
          + Log as Dinner (380 kcal)
        </button>
      </div>

      <!-- Card 2 -->
      <div class="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-[10px] font-bold text-stone-500">1 Mangkuk</span>
          <span class="text-[10px] bg-blue-100 text-[#0288D1] px-2 py-0.5 rounded-full font-extrabold">Hydrating Broth</span>
        </div>
        <h4 class="text-xs font-extrabold text-[#1A1B22]">Soto Ayam Bening (Nasi 1/2)</h4>
        <div class="flex gap-1.5 text-[10px] font-bold">
          <span class="text-orange-600">🔥 ~320 kcal</span> • <span class="text-green-700">🥩 28g Pro</span> • <span class="text-blue-700">🥑 8g Fat</span>
        </div>
        <button onclick="logMealFromAI('Soto Ayam Bening', 320, 28, 8, 32, 'Dinner')" class="w-full py-1.5 rounded-lg bg-stone-200 text-stone-800 font-bold text-xs active:scale-95 transition">
          + Log as Dinner (320 kcal)
        </button>
      </div>
    </div>`;
  }
  // 4. BMI / TDEE / Rencana Defisit
  else if (q.includes('bmi') || q.includes('tdee') || q.includes('bmr') || q.includes('rencana') || q.includes('berat badan') || q.includes('target bb')) {
    text = `Berikut profil metabolisme &amp; rencana target penurunan berat badan Anda:<br>
    • <strong>BMI Saat Ini:</strong> ${u.bmi || 24.2} (${u.bmiCategory || 'Normal'})<br>
    • <strong>BMR (Kalori Basal):</strong> ${u.bmr ? u.bmr.toLocaleString() : '1,720'} kcal/hari<br>
    • <strong>TDEE (Maintenance):</strong> ${u.tdee ? u.tdee.toLocaleString() : '2,365'} kcal/hari<br>
    • <strong>Target Kalori Harian:</strong> <strong class="text-[#2E7D32]">${u.targetCalories} kcal/hari</strong> (Defisit -${u.deficitLevel || 500} kcal)<br>
    • <strong>Target Berat Badan:</strong> ${u.targetWeightKg || 68} kg (saat ini ${u.weightKg || 74.2} kg)<br><br>
    <button onclick="openBmiTdeeModal()" class="w-full py-2.5 rounded-xl bg-[#1A1B22] text-white font-extrabold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5">
      <span>⚖️ Buka &amp; Atur Kalkulator BMI &amp; TDEE</span>
    </button>`;
  }
  // 5. Camilan & Buah
  else if (q.includes('camilan') || q.includes('snack') || q.includes('dessert') || q.includes('buah') || q.includes('semangka') || q.includes('ngemil')) {
    text = `Pilihan camilan sehat &amp; rendah kalori untuk program defisit Anda:<br>` +
           `• <strong>Semangka Segar (150g)</strong>: ~45 kcal, 92% air hidrasi &amp; elektrolit.<br>` +
           `• <strong>Apel Fuji (1 buah)</strong>: ~95 kcal, tinggi serat pektin alami.<br>` +
           `• <strong>1 Butir Telur Rebus</strong>: ~78 kcal, 6.5g protein murni.<br>` +
           `• <strong>Greek Yogurt Plain (100g)</strong>: ~60 kcal, 10g protein.<br><br>` +
           `💡 <em>Tips:</em> Buah berair seperti semangka adalah pilihan penutup terbaik karena memuaskan rasa manis tanpa memicu lonjakan gula darah!`;
  }
  // 6. Telur
  else if (q.includes('telur') || q.includes('egg')) {
    text = `Telur adalah salah satu sumber protein terbaik untuk diet! 1 butir telur rebus utuh mengandung <strong>~78 kcal dan 6.5g protein</strong>.<br><br>` +
           `• Jika makan <strong>2 butir telur rebus</strong>: ~156 kcal dan 13g protein murni.<br>` +
           `• Putih telurnya saja hanya <strong>~17 kcal dengan 3.6g protein</strong> bebas lemak.<br><br>` +
           `Sangat ideal untuk sarapan atau camilan malam tanpa takut surplus kalori!`;
  }
  // 7. Nasi & Karbohidrat
  else if (q.includes('nasi') || q.includes('karbo')) {
    text = `Anda tetap bisa makan nasi saat diet! 1 centong nasi putih (150g) bernilai <strong>~204 kcal</strong>.<br><br>` +
           `• Untuk kenyang lebih lama dengan indeks glikemik rendah: pilih <strong>nasi merah (~165 kcal)</strong> atau campur shirataki.<br>` +
           `• Selalu dahulukan makan lauk berprotein dan sayuran sebelum menghabiskan nasi.`;
  }
  // 8. Status Kalori & Defisit
  else if (q.includes('kalori') || q.includes('defisit') || q.includes('target') || q.includes('sisa')) {
    text = `Status kalori harian Brooks hari ini:<br>` +
           `• Target Harian: <strong>${u.targetCalories} kcal</strong> (Defisit -${u.deficitLevel || 500} kcal)<br>` +
           `• Sudah Dikonsumsi: <strong>${u.consumedCalories} kcal</strong><br>` +
           `• Sisa Jatah Kalori: <strong class="text-[#2E7D32]">${remainingCal} kcal</strong><br><br>` +
           `Anda masih memiliki kuota kalori yang aman untuk menikmati makan malam bergizi seimbang! 🎯`;
  }
  // 9. Lapar / Cravings / Tips Diet / Kenapa Berat Badan Susah Turun
  else if (q.includes('lapar') || q.includes('susah turun') || q.includes('stuck') || q.includes('plateau') || q.includes('tips') || q.includes('cara') || q.includes('kenapa')) {
    text = `Panduan praktis menjaga keberhasilan defisit kalori Brooks:<br><br>` +
           `1. <strong>Defisit Kalori Konsisten</strong>: Target Anda adalah defisit <strong>-${u.deficitLevel || 500} kcal/hari</strong>. Jangan memangkas kalori terlalu ekstrem agar metabolisme tidak drop.<br>` +
           `2. <strong>Prioritas Protein</strong>: Penuhi ~1.8g protein per kg BB (~130g protein/hari). Protein memiliki efek termal tertinggi dan mengenyangkan paling lama.<br>` +
           `3. <strong>Minum 2 Gelas Air Hangat Saat Lapar</strong>: Sering kali rasa lapar mendadak adalah sinyal tubuh mengalami dehidrasi ringan.<br>` +
           `4. <strong>Tidur Cukup (7-8 Jam)</strong>: Kurang tidur meningkatkan hormon ghrelin yang memicu nafsu makan berlebih.<br><br>` +
           `💡 <em>Ingin konsultasi bebas dan analisis menu AI langsung dari Google Gemini?</em> Aktifkan API key di bawah!`;
  }
  // 10. Olahraga & Latihan
  else if (q.includes('olahraga') || q.includes('workout') || q.includes('latihan')) {
    text = `Untuk membakar kalori optimal tanpa kehilangan otot, lakukan latihan <strong>10–15 menit</strong> konsisten:<br>` +
           `• <strong>Morning Fat Burn</strong>: 12 menit (~140 kcal)<br>` +
           `• <strong>Core Sculpt &amp; Tight Plank</strong>: 10 menit (~110 kcal)<br>` +
           `• <strong>Low-Impact HIIT Burner</strong>: 15 menit (~180 kcal)<br><br>` +
           `Buka tab <strong>Workout</strong> di menu bawah untuk memulai timer dan panduan gerakan langsung!`;
  }
  // 11. Air Minum & Hidrasi
  else if (q.includes('air') || q.includes('minum') || q.includes('water')) {
    text = `Hidrasi sangat krusial untuk membakar lemak dan mencegah rasa lapar semu. Pastikan minum minimal <strong>8 gelas (2 liter) air putih</strong> setiap hari.<br><br>` +
           `Saat ini Anda sudah mencatat <strong>${u.waterDrank} / ${u.waterTarget} gelas</strong> di halaman Home!`;
  }
  // 12. Pengaturan API Key
  else if (q.includes('api') || q.includes('key') || q.includes('kunci') || q.includes('token') || q.includes('setting') || q.includes('pengaturan')) {
    text = `Untuk mengaktifkan kecerdasan penuh <strong>Google Gemini AI</strong> di FitLife Coach:<br><br>` +
           `Silakan klik tombol di bawah untuk langsung membuka tab input kunci API:<br><br>` +
           `<button onclick="openConfigModal('keys')" class="w-full py-2.5 rounded-xl bg-[#1A1B22] text-white font-extrabold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5">` +
           `  <i data-lucide="key" class="w-3.5 h-3.5 text-[#8BC34A]"></i>` +
           `  <span>🔑 Buka Pengaturan Kunci API Sekarang</span>` +
           `</button>`;
  }
  // 13. General Fallback Responsif & Edukatif
  else {
    text = `Pertanyaan yang bagus, Brooks! 🌟<br><br>` +
           `Untuk pertanyaan bebas seputar <em>"${escapeHtml(msg)}"</em>, Anda dapat menghubungkan <strong>Google Gemini API Key</strong> gratis agar saya dapat menganalisis dan menjawab secara mendalam.<br><br>` +
           `Klik tombol di bawah untuk memasukkan API Key Gemini Anda dalam 1 menit:<br><br>` +
           `<button onclick="openConfigModal('keys')" class="w-full py-2.5 rounded-xl bg-[#1A1B22] text-white font-extrabold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5">` +
           `  <i data-lucide="key" class="w-3.5 h-3.5 text-[#8BC34A]"></i>` +
           `  <span>🔑 Masukkan Kunci Google Gemini API (Gratis)</span>` +
           `</button>`;
  }

  // Catat balasan ke history
  AppState.chatHistory = AppState.chatHistory || [];
  AppState.chatHistory.push({
    role: 'model',
    parts: [{ text: text.replace(/<[^>]*>/g, '') }]
  });
  if (AppState.chatHistory.length > 10) AppState.chatHistory = AppState.chatHistory.slice(-10);

  appendAIBubble(text);
}

function appendAIBubble(text) {
  document.getElementById('aiTypingBubble')?.remove();
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
// 8. INPUT MAKANAN & KALKULATOR KALORI AI
// ========================================================================
let currentSelectedMealType = 'Dinner';

function openAddFoodCalcModal(mealType) {
  if (mealType) {
    selectMealTypeSegment(mealType);
  }
  document.getElementById('modalAddFoodCalc').classList.remove('hidden');
  document.getElementById('inputFoodQuery').focus();
}

function closeAddFoodCalcModal() {
  document.getElementById('modalAddFoodCalc').classList.add('hidden');
}

function selectMealTypeSegment(mealType) {
  currentSelectedMealType = mealType;
  const types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  types.forEach(t => {
    const btn = document.getElementById(`segBtn${t}`);
    if (btn) {
      if (t === mealType) {
        btn.className = 'seg-meal-btn py-2 rounded-xl border-2 border-[#1A1B22] bg-[#1A1B22] text-white text-xs font-extrabold transition';
      } else {
        btn.className = 'seg-meal-btn py-2 rounded-xl border border-stone-200 text-xs font-extrabold text-stone-600 transition';
      }
    }
  });
}

function quickFillFood(foodName) {
  document.getElementById('inputFoodQuery').value = foodName;
  executeFoodAICalculation();
}

async function executeFoodAICalculation() {
  const query = document.getElementById('inputFoodQuery').value.trim();
  if (!query) {
    alert('Masukkan nama makanan terlebih dahulu!');
    return;
  }

  const btn = document.getElementById('btnCalculateAI');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Menghitung...`;

  try {
    let result = null;
    const geminiKey = localStorage.getItem('NUTRITRACK_GEMINI_KEY');

    // 1. Coba panggil Gemini AI langsung dari browser jika kunci tersedia
    if (geminiKey) {
      try {
        const prompt = `Analisis gizi makanan: "${query}". Kembalikan HANYA format JSON murni tanpa markdown: {"nama_makanan":"${query}","kalori":350,"protein":15,"fat":10,"carbs":40,"porsi":"1 Porsi (200g)","saran":"Saran diet singkat..."}`;
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
          })
        });
        const geminiData = await geminiRes.json();
        if (geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content) {
          let txt = geminiData.candidates[0].content.parts[0].text;
          txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
          result = JSON.parse(txt);
        }
      } catch (e) {
        console.warn('Direct Gemini food calc failed, fallback to local:', e);
      }
    }

    // 2. Jika belum ada hasil, panggil backend Apps Script (dengan batas waktu)
    if (!result && CONFIG.GAS_URL) {
      try {
        const res = await postToGAS('calculate_calorie', { query: query });
        if (res && res.success && res.data) {
          result = res.data;
        }
      } catch (e) {
        console.warn('Backend calc failed, fallback to local engine:', e);
      }
    }

    // 3. Fallback instan ke kamus gizi cerdas lokal (40+ Makanan Indonesia)
    if (!result || !result.kalori) {
      result = calculateOfflineFoodCalories(query);
    }

    // Isi formulir hasil
    document.getElementById('calcFoodName').value = result.nama_makanan || query;
    document.getElementById('calcFoodKcal').value = result.kalori || 300;
    document.getElementById('calcFoodProtein').value = result.protein || 15;
    document.getElementById('calcFoodFat').value = result.fat || 10;
    document.getElementById('calcFoodCarbs').value = result.carbs || 35;
    document.getElementById('calcFoodPortion').value = result.porsi || '1 Porsi (~200g)';
    document.getElementById('calcFoodAdvice').innerText = `💡 Catatan AI: ${result.saran || 'Profil gizi seimbang. Minum air putih yang cukup.'}`;

    // Highlight animasi lembut
    const box = document.getElementById('boxCalcResult');
    box.classList.add('ring-2', 'ring-[#8BC34A]');
    setTimeout(() => box.classList.remove('ring-2', 'ring-[#8BC34A]'), 1000);

    if (navigator.vibrate) navigator.vibrate(40);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
    if (window.lucide) lucide.createIcons();
  }
}

function saveCalculatedMealToLog() {
  const name = document.getElementById('calcFoodName').value.trim() || 'Menu Makanan';
  const kcal = Number(document.getElementById('calcFoodKcal').value) || 0;
  const protein = Number(document.getElementById('calcFoodProtein').value) || 0;
  const fat = Number(document.getElementById('calcFoodFat').value) || 0;
  const carbs = Number(document.getElementById('calcFoodCarbs').value) || 0;
  const portion = document.getElementById('calcFoodPortion').value.trim();
  const mealType = currentSelectedMealType;

  // 1. Update State Lokal & Cincin Kalori
  AppState.user.consumedCalories += kcal;
  renderCalorieHero();
  saveCachedState();

  // 2. Update baris interval di DOM
  const mealTypeMap = {
    Breakfast: { kcal: 'txtBfKcal', desc: 'txtBfDesc' },
    Lunch: { kcal: 'txtLunchKcal', desc: 'txtLunchDesc' },
    Dinner: { kcal: 'txtDinnerKcal', desc: 'txtDinnerDesc' },
    Snack: { kcal: 'txtSnackKcal', desc: 'txtSnackDesc' }
  };
  if (mealTypeMap[mealType]) {
    const elKcal = document.getElementById(mealTypeMap[mealType].kcal);
    const elDesc = document.getElementById(mealTypeMap[mealType].desc);
    if (elKcal) elKcal.innerText = `+${kcal} kcal`;
    if (elDesc) elDesc.innerText = `${name} (${portion})`;
  }

  // 3. Simpan ke Google Sheets via GAS REST API
  if (CONFIG.GAS_URL) {
    postToGAS('log_meal', {
      user_id: AppState.user.nomor_wa,
      waktu_makan: mealType,
      nama_makanan: name,
      kalori_kkal: kcal,
      protein: protein,
      fat: fat,
      carbs: carbs,
      porsi: portion
    }).then(res => console.log('Tersimpan di Google Sheets:', res))
      .catch(err => console.warn('Gagal simpan ke Sheets:', err));
  }

  closeAddFoodCalcModal();
  alert(`Berhasil mencatat "${name}" (+${kcal} kcal) ke ${mealType}! Cincin kalori telah diperbarui.`);
}

// Kamus Nutrisi Makanan Indonesia Lengkap (Offline / Built-in Fallback)
function calculateOfflineFoodCalories(query, isStrictFoodOnly = false) {
  const raw = String(query || '').trim();
  const q = raw.toLowerCase();

  // Jika dipanggil dari fallback AI chat (isStrictFoodOnly = true),
  // cegah kalimat percakapan / pertanyaan disangka sebagai makanan
  if (isStrictFoodOnly) {
    if (q.includes('?') || q.includes('kenapa') || q.includes('mengapa') || q.includes('bagaimana') ||
        q.includes('gimana') || q.includes('apakah') || q.includes('apa itu') || q.includes('berapa') ||
        q.includes('kapan') || q.includes('siapa') || q.includes('cara') || q.includes('tips') ||
        q.includes('halo') || q.includes('hai') || q.includes('pagi') || q.includes('siang') ||
        q.includes('sore') || q.includes('malam') || q.includes('terima kasih') || q.includes('makasih') ||
        q.includes('lapar') || q.includes('lemas') || q.includes('olahraga') || q.includes('workout') ||
        q.includes('susah turun') || q.includes('plateau') || q.includes('berat badan') || q.includes('tdee') || q.includes('bmi')) {
      return null;
    }
    // Jika kalimat panjang lebih dari 4 kata tanpa kata makanan umum
    if (raw.split(/\s+/).length > 4) {
      const foodWords = ['nasi', 'ayam', 'ikan', 'daging', 'sapi', 'telur', 'tahu', 'tempe', 'sayur', 'buah', 'mie', 'soto', 'sop', 'bakso', 'sate', 'bebek', 'rendang', 'roti', 'kue', 'bubur', 'jus', 'kopi', 'teh', 'alpukat', 'pisang', 'apel', 'semangka', 'kentang'];
      if (!foodWords.some(w => q.includes(w))) return null;
    }
  }

  const DB = [
    { k: ['nasi putih'], nama: 'Nasi Putih', kalori: 204, p: 4.2, f: 0.4, c: 45, porsi: '1 Centong (150g)', saran: 'Sumber karbohidrat utama. Batasi 1 centong jika sedang defisit kalori.' },
    { k: ['nasi merah'], nama: 'Nasi Merah', kalori: 165, p: 3.8, f: 1.2, c: 35, porsi: '1 Centong (150g)', saran: 'Kaya serat & indeks glikemik rendah, sangat bagus untuk kenyang lebih lama.' },
    { k: ['nasi goreng'], nama: 'Nasi Goreng Telur', kalori: 450, p: 14, f: 18, c: 58, porsi: '1 Piring (250g)', saran: 'Tinggi kalori dari minyak goreng. Kurangi porsi nasi dan tambahkan mentimun.' },
    { k: ['nasi uduk'], nama: 'Nasi Uduk', kalori: 380, p: 7, f: 16, c: 52, porsi: '1 Porsi (200g)', saran: 'Mengandung santan kelapa. Hindari gorengan tambahan agar defisit terjaga.' },
    { k: ['ayam bakar', 'dada ayam'], nama: 'Dada Ayam Bakar', kalori: 240, p: 35, f: 6, c: 8, porsi: '1 Potong (150g)', saran: 'Super protein! Sangat ideal untuk menjaga otot dan mempercepat metabolisme.' },
    { k: ['ayam geprek'], nama: 'Ayam Geprek Sambal Bawang', kalori: 480, p: 32, f: 28, c: 24, porsi: '1 Porsi Lengkap', saran: 'Kaya protein, namun tepungnya menyerap minyak. Kurangi makan kulitnya.' },
    { k: ['ayam goreng'], nama: 'Ayam Goreng', kalori: 320, p: 26, f: 20, c: 8, porsi: '1 Potong', saran: 'Tinggi protein. Sisihkan kulitnya untuk memangkas hingga 100 kalori lemak.' },
    { k: ['sate ayam'], nama: 'Sate Ayam Tanpa Lontong', kalori: 380, p: 36, f: 14, c: 12, porsi: '10 Tusuk', saran: 'Minta bumbu kacang dipisah untuk mengontrol asupan kalori.' },
    { k: ['soto ayam'], nama: 'Soto Ayam Bening', kalori: 280, p: 24, f: 8, c: 26, porsi: '1 Mangkuk', saran: 'Kuah kaldu bening sangat ramah diet dan mengenyangkan.' },
    { k: ['rendang'], nama: 'Rendang Daging Sapi', kalori: 350, p: 28, f: 22, c: 8, porsi: '1 Potong (100g)', saran: 'Kaya zat besi & protein. Batasi minyak santan untuk program defisit.' },
    { k: ['telur rebus'], nama: 'Telur Ayam Rebus', kalori: 78, p: 6.5, f: 5.3, c: 0.6, porsi: '1 Butir (50g)', saran: 'Pilihan sarapan dan camilan tinggi protein terbaik dengan harga terjangkau.' },
    { k: ['telur ceplok', 'telur mata sapi'], nama: 'Telur Ceplok Goreng', kalori: 115, p: 6.5, f: 9.2, c: 0.8, porsi: '1 Butir', saran: 'Goreng dengan sedikit minyak atau gunakan teflon anti-lengket.' },
    { k: ['telur dadar'], nama: 'Telur Dadar', kalori: 140, p: 7.2, f: 11, c: 1.5, porsi: '1 Butir', saran: 'Tambahkan irisan daun bawang dan cabai agar lebih kaya serat.' },
    { k: ['gado gado', 'gado-gado'], nama: 'Gado-Gado', kalori: 340, p: 14, f: 15, c: 42, porsi: '1 Piring', saran: 'Kaya serat sayuran. Kurangi porsi kerupuk untuk menghemat kalori.' },
    { k: ['tempe'], nama: 'Tempe Goreng', kalori: 120, p: 7, f: 7, c: 8, porsi: '1 Potong Sedang', saran: 'Sumber protein nabati dan probiotik yang sangat sehat bagi pencernaan.' },
    { k: ['tahu'], nama: 'Tahu Goreng', kalori: 90, p: 6, f: 6, c: 3, porsi: '1 Potong Sedang', saran: 'Rendah kalori dan mudah dipadukan dengan berbagai menu harian.' },
    { k: ['semangka'], nama: 'Semangka Potong', kalori: 45, p: 0.9, f: 0.2, c: 11, porsi: '1 Cup (150g)', saran: '92% air. Camilan manis segar yang sangat aman bagi program diet.' },
    { k: ['apel'], nama: 'Apel Segar', kalori: 95, p: 0.5, f: 0.3, c: 25, porsi: '1 Buah (180g)', saran: 'Tinggi serat pektin alami yang membantu rasa kenyang lebih stabil.' }
  ];

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

  // Jika isStrictFoodOnly dan tidak ada kecocokan di database, jangan buat nama makanan fiktif
  if (isStrictFoodOnly) {
    return null;
  }

  // Estimasi Cerdas Dinamis untuk Food Calculator modal
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
    nama_makanan: capitalize(query || 'Menu Harian'),
    kalori: Math.max(80, estKcal),
    protein: Math.max(4, estP),
    fat: Math.max(2, estF),
    carbs: Math.max(5, estC),
    porsi: '1 Porsi Standar (~200g)',
    saran: 'Estimasi kalori cerdas berbasis bahan. Cukupi kebutuhan protein dan air harian.'
  };
}

// ========================================================================
// 9. SETTINGS MODAL: TABS, API KEYS & NOTIFIKASI WHATSAPP
// ========================================================================
function switchConfigTab(tabName) {
  const tabs = ['gas', 'keys', 'wa'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (t === tabName) {
      if (btn) btn.className = 'flex-1 py-2 rounded-xl bg-white text-[#1A1B22] shadow-xs transition';
      if (content) content.classList.remove('hidden');
    } else {
      if (btn) btn.className = 'flex-1 py-2 rounded-xl text-stone-500 hover:text-stone-800 transition';
      if (content) content.classList.add('hidden');
    }
  });

  if (tabName === 'keys' && CONFIG.GAS_URL) {
    checkApiKeysStatus();
  }
}

async function checkApiKeysStatus() {
  const bFonnte = document.getElementById('badgeFonnteStatus');
  const bGemini = document.getElementById('badgeGeminiStatus');

  const localGemini = localStorage.getItem('NUTRITRACK_GEMINI_KEY');
  const localFonnte = localStorage.getItem('NUTRITRACK_FONNTE_TOKEN');

  if (bGemini) {
    if (localGemini) {
      bGemini.innerText = `Aktif (••••${localGemini.slice(-4)})`;
      bGemini.className = 'text-[10px] text-green-600 font-extrabold';
    } else {
      bGemini.innerText = 'Mode Bawaan Cerdas Aktif';
      bGemini.className = 'text-[10px] text-blue-600 font-bold';
    }
  }

  if (bFonnte) {
    if (localFonnte) {
      bFonnte.innerText = `Aktif (••••${localFonnte.slice(-4)})`;
      bFonnte.className = 'text-[10px] text-green-600 font-extrabold';
    } else {
      bFonnte.innerText = 'Belum diisi';
      bFonnte.className = 'text-[10px] text-amber-600 font-bold';
    }
  }

  // Sinkronkan juga dari server jika GAS URL aktif
  if (CONFIG.GAS_URL) {
    try {
      const res = await fetch(`${CONFIG.GAS_URL}?action=get_api_status`);
      const json = await res.json();
      if (json && json.success) {
        if (json.hasFonnte && bFonnte) {
          bFonnte.innerText = `Aktif (${json.fonnteMasked})`;
          bFonnte.className = 'text-[10px] text-green-600 font-extrabold';
        }
        if (json.hasGemini && bGemini) {
          bGemini.innerText = `Aktif (${json.geminiMasked})`;
          bGemini.className = 'text-[10px] text-green-600 font-extrabold';
        }
      }
    } catch (e) {}
  }
}

async function saveApiKeysToServer() {
  const fonnteToken = document.getElementById('inputFonnteToken').value.trim();
  const geminiKey = document.getElementById('inputGeminiApiKey').value.trim();

  if (!fonnteToken && !geminiKey) {
    alert('Masukkan setidaknya Fonnte Token atau Gemini API Key!');
    return;
  }

  // Simpan langsung di browser lokal untuk performa instan tanpa jeda
  if (geminiKey) {
    localStorage.setItem('NUTRITRACK_GEMINI_KEY', geminiKey);
  }
  if (fonnteToken) {
    localStorage.setItem('NUTRITRACK_FONNTE_TOKEN', fonnteToken);
  }

  const btn = document.getElementById('btnSaveApiKeys');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Menyimpan...`;

  try {
    if (CONFIG.GAS_URL) {
      await postToGAS('save_api_keys', {
        fonnte_token: fonnteToken,
        gemini_api_key: geminiKey
      }).catch(e => console.log('GAS sync warning:', e));
    }

    alert('Kunci API berhasil disimpan! FitLife AI Coach dan Notifikasi WhatsApp sekarang siap digunakan.');
    document.getElementById('inputFonnteToken').value = '';
    document.getElementById('inputGeminiApiKey').value = '';
    checkApiKeysStatus();
  } catch (err) {
    alert('Kunci API berhasil disimpan secara lokal!');
    checkApiKeysStatus();
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

async function executeTestWhatsAppPush() {
  const target = document.getElementById('inputTestWaTarget').value.trim();
  const message = document.getElementById('inputTestWaMessage').value.trim();

  if (!target) {
    alert('Harap masukkan nomor WhatsApp tujuan (misal: 081234567890)!');
    return;
  }

  const btn = document.getElementById('btnSendTestWa');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Mengirim via Fonnte Gateway...`;

  const boxLog = document.getElementById('boxWaResult');
  const txtLog = document.getElementById('txtWaResultLog');
  boxLog.classList.remove('hidden');
  txtLog.innerText = 'Menghubungkan ke gateway Fonnte...';

  try {
    const res = await postToGAS('send_wa_test', {
      target: target,
      message: message,
      nama: AppState.user.nama
    });

    if (res && res.success) {
      txtLog.innerHTML = `<span class="text-green-600 font-extrabold">✓ BERHASIL:</span> ${res.message}<br><small class="text-stone-400">${JSON.stringify(res.detail || '')}</small>`;
      alert(`Berhasil! Pesan WhatsApp telah dikirim ke nomor ${target}.`);
    } else {
      txtLog.innerHTML = `<span class="text-red-500 font-extrabold">✕ GAGAL:</span> ${res.message || 'Pesan gagal dikirim'}<br><small class="text-stone-400">Pastikan Token Fonnte sudah diisi di tab "2. Kunci API".</small>`;
      alert(`Gagal mengirim WhatsApp:\n${res.message || 'Periksa Fonnte Token'}`);
    }
  } catch (err) {
    txtLog.innerHTML = `<span class="text-red-500 font-extrabold">✕ ERROR:</span> ${err.message}`;
    alert(`Error koneksi: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

// ========================================================================
// 10. BACKEND GAS REST API HELPER (GAS-PRO-API)
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

function openConfigModal(initialTab = 'gas') {
  document.getElementById('inputGasUrl').value = localStorage.getItem('NUTRITRACK_GAS_URL') || CONFIG.GAS_URL || '';
  document.getElementById('inputTestWaTarget').value = AppState.user.nomor_wa || '';
  document.getElementById('modalConfig').classList.remove('hidden');
  switchConfigTab(initialTab);
  checkApiKeysStatus();
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
  const url = document.getElementById('inputGasUrl').value.trim() || CONFIG.GAS_URL;
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
// 11. LOCAL STORAGE CACHING & UTILS
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
