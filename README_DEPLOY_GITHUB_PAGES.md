# 🚀 Panduan Deploy NutriTrack & FitLife ke GitHub Pages
**Berdasarkan Standar `github-pages-deploy-guide` & `gas-pwa-github`**

Frontend NutriTrack & FitLife telah disiapkan sebagai **Progressive Web App (PWA) statis murni** (HTML/CSS/JS) tanpa dependensi server Node.js, sehingga dapat di-hosting 100% gratis dan super cepat di **GitHub Pages**.

---

### 📂 Struktur Folder Siap Deploy

Pastikan struktur berkas di dalam folder `nutritrack-pwa` terjaga:
```text
nutritrack-pwa/
├── index.html                     # Halaman utama PWA (5 Layar Interaktif)
├── manifest.json                  # PWA Manifest (Add to Home Screen)
├── sw.js                          # Service Worker (Offline Caching)
├── css/
│   └── style.css                  # Gaya animasi laser, circular gauge & micro-interactions
└── js/
    ├── config.js                  # HANYA berisi GAS_URL publik (Zero Secrets)
    └── app.js                     # Controller antarmuka, Chart.js & generator jsPDF
```

---

### 🛠️ Langkah-Langkah Deploy via Terminal Git

Buka **Terminal / PowerShell / Git Bash** di komputer Anda, lalu ikuti langkah demi langkah berikut:

#### **Langkah 1: Masuk ke Folder Proyek Frontend**
```powershell
cd "d:\Marskal Edi's File\Marskal's Project\webapp\Google script ft antigravity modul 4\nutritrack-pwa"
```

#### **Langkah 2: Buat Repositori Baru di GitHub**
1. Buka [github.com/new](https://github.com/new).
2. Beri nama repositori (misal: `nutritrack-fitlife-pwa`).
3. Pilih opsi **Public** (wajib untuk GitHub Pages gratis).
4. **JANGAN** centang "Add a README file" atau `.gitignore` (agar tidak konflik).
5. Klik **Create repository**.

#### **Langkah 3: Inisialisasi Git & Kirim Berkas**
Jalankan perintah ini satu per satu di terminal:

```bash
# 1. Inisialisasi git lokal
git init

# 2. Tambahkan semua berkas
git add .

# 3. Buat commit pertama
git commit -m "feat: Initial NutriTrack & FitLife PWA release"

# 4. Ganti nama branch utama ke main
git branch -M main

# 5. Hubungkan ke repositori GitHub Anda (ganti USERNAME & REPO-NAME)
git remote add origin https://github.com/USERNAME/REPO-NAME.git

# 6. Push ke GitHub
git push -u origin main
```
> 💡 *Catatan Autentikasi:* Jika terminal meminta password, gunakan **GitHub Personal Access Token (PAT)** dengan izin `repo`, bukan password login GitHub biasa.

#### **Langkah 4: Aktifkan GitHub Pages**
1. Di halaman repositori GitHub Anda, klik tab **Settings** (ikon gerigi).
2. Pada menu bilah kiri, klik **Pages**.
3. Di bawah bagian **Build and deployment**:
   - **Source:** Pilih `Deploy from a branch`.
   - **Branch:** Pilih `main` dan folder `/ (root)`.
4. Klik tombol **Save**.
5. Tunggu 1–2 menit, lalu segarkan halaman. Tautan aplikasi PWA Anda akan terbit:
   `https://USERNAME.github.io/REPO-NAME/`

---

### 📲 Cara Pasang di Handphone (PWA Native Feel)
1. Buka tautan GitHub Pages di browser handphone Anda:
   - **Android (Chrome):** Tekan menu titik tiga di pojok kanan atas $\rightarrow$ Pilih **"Tambahkan ke Layar Utama" / "Install app"**.
   - **iPhone (Safari):** Tekan tombol **Share** (kotak panah ke atas) $\rightarrow$ Pilih **"Add to Home Screen"**.
2. Aplikasi NutriTrack akan muncul dengan ikon tersendiri di layar ponsel dan terbuka secara layar penuh (*standalone*) bebas dari bilah browser!
