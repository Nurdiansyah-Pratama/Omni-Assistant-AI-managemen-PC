# Omni Assistant

Project awal desktop virtual assistant menggunakan Electron, React, TypeScript,
Vite, dan Tailwind CSS.

## Fitur MVP

- Window transparan, frameless, dan selalu berada di atas window lain.
- Karakter assistant kecil di pojok kanan bawah layar.
- Klik karakter untuk membuka atau menutup panel chat.
- Daftar pesan dan input chat.
- Chat assistant menggunakan OpenAI, Gemini, HuggingFace, atau Auto Router.
- Analisis layar dapat menggunakan provider vision OpenAI atau Gemini.
- Karakter robot SVG dengan pilihan warna aksen yang tersimpan.
- Karakter dapat dipindahkan lewat pegangan di atasnya; posisi tersimpan.
- Animasi idle dan gerakan tangan ringan.
- Analisis screenshot untuk mode umum, coding, dan desain.
- Balon teks berisi tips serta ringkasan hasil vision.
- Monitor thermal zone CPU/ACPI, penggunaan RAM, dan proses pemakai memori terbesar.
- Kontrol ASUS fan profile dan Battery Health Charging.
- Otomatisasi fan dengan threshold, hysteresis, dan cooldown.
- Monitor Samsung SSD dari LibreHardwareMonitor dan Samsung Magician.
- Rekomendasi serta otomatisasi mode Performance, Balanced, dan Power Saving.
- Profile System otomatis: Idle, Coding, Gaming, Unity, Laravel, Heavy Workload, Battery Saver.
- Context Awareness real-time: app aktif, title aktif, proses, CPU/GPU/RAM/SSD, battery, fullscreen, network.
- Long-term memory lokal untuk pola penggunaan, preferensi, workflow history, dan keputusan AI.
- Workflow Automation berbasis rule JSON dengan cooldown dan safety guard.
- Dashboard **Dash** untuk profil aktif, activity, telemetry, dry-run, memory insight, dan log aksi.
- Struktur renderer, Electron, komponen, hook, service, dan type yang terpisah.

## Analisis Struktur Saat Ini

Project memakai Electron main process sebagai lapisan privileged dan React sebagai
renderer tanpa akses langsung ke Node.js. Fitur hardware lama tetap dipakai:

- `electron/systemControl.ts` untuk ASUS WMI, RAM trim, LibreHardwareMonitor, dan Samsung Magician.
- `electron/windowsHardware.ts` untuk GPU/fan telemetry Windows.
- `electron/libreHardwareMonitor.ts` untuk sensor CPU/GPU/SSD.
- `electron/vision.ts`, `electron/ai/*`, dan `electron/security/secure_store.ts` untuk AI.
- `src/components/system/SystemControlPanel.tsx` untuk panel PC lama.

Fitur baru ditambahkan sebagai layer orkestrasi di atas modul tersebut:

- `context_monitor` membaca konteks sistem.
- `profile_manager` memilih profil aktif dari config.
- `workflow_engine` menjalankan rule automation.
- `memory_manager` menyimpan pembelajaran lokal.
- `safety_guard` memblokir aksi berisiko, cooldown, pause, dry-run.
- `automation_actions` memetakan action workflow ke adapter hardware lama.
- `dashboard_ui` menyatukan snapshot untuk UI.

## Prasyarat

- Node.js 22.12 atau versi lebih baru.
- npm.

## Menjalankan mode development

```bash
npm install
npm run dev
```

Vite akan menjalankan renderer React di port `5173`, kemudian Electron dibuka
secara otomatis. Pastikan perintahnya `npm install`, bukan `nmp instal`.

Launcher development menjalankan Vite dan Electron langsung melalui Node.js,
sehingga tidak bergantung pada `cmd.exe` dari environment `PATH` Windows.

## Mengatur AI Chat dan Vision

1. Buka panel chat.
2. Klik tombol **AI** di bagian kanan atas.
3. Pilih provider **Auto**, **OpenAI**, **Gemini**, atau **HuggingFace**.
4. Masukkan model dan API key provider yang ingin dipakai.
5. Klik **Simpan API**, lalu **Test API**.
6. Pilih mode chat **Umum**, **Coding**, atau **Desain**.
7. Untuk vision, klik **Baca layar**. Screenshot hanya dikirim saat tombol ini
   ditekan atau saat user secara eksplisit meminta analisis layar.

Model default:

- OpenAI: `gpt-5.5`
- Gemini: `gemini-3.5-flash`
- HuggingFace: `Qwen/Qwen2.5-7B-Instruct`

Provider mode:

- **OpenAI**: chat dan vision.
- **Gemini**: chat dan vision.
- **HuggingFace**: chat text-only. Provider ini tidak mendukung vision di Omni.
- **Auto**: vision memakai OpenAI/Gemini, mode Coding memprioritaskan
  OpenAI/HuggingFace, mode Desain memprioritaskan Gemini/OpenAI.

Status provider dapat berupa:

- `AI Offline - Provider belum dikonfigurasi`
- `OpenAI Connected`
- `Gemini Connected`
- `HuggingFace Connected`
- `API key salah`
- `Quota habis`
- `Timeout`
- `Model not available`

API key disimpan terenkripsi menggunakan `safeStorage` Electron. Renderer hanya
menerima status `hasApiKey` dan tampilan masked seperti `sk-....`, `AIza....`,
atau `hf_....`. API key penuh tidak dicetak ke log.

Token HuggingFace hanya membutuhkan permission:

- `Make calls to Inference Providers`

Sebagai alternatif, key dapat diberikan melalui environment:

```powershell
$env:OPENAI_API_KEY="..."
npm run dev
```

atau:

```powershell
$env:GEMINI_API_KEY="..."
npm run dev
```

atau:

```powershell
$env:HF_API_KEY="hf_..."
npm run dev
```

### Cara Test Provider AI

1. Jalankan `npm run dev`.
2. Buka panel chat, klik **AI**.
3. Isi API key dan model untuk OpenAI, Gemini, atau HuggingFace.
4. Klik **Simpan API**.
5. Klik **Test API** pada provider yang ingin diuji.
6. Hasil test menampilkan `Connected`, `Invalid API Key`, `Timeout`,
   `Model not available`, atau `Quota exceeded`, lengkap dengan latency jika
   tersedia.

Jika API salah, quota habis, model tidak tersedia, atau request timeout,
aplikasi menampilkan error di UI dan tidak crash.

## Kontrol ASUS dan Otomatisasi

## Omni Office Assistant

Omni sekarang menyediakan local REST API untuk Office Add-in di:

```text
http://127.0.0.1:17878
```

Endpoint utama:

- `POST /api/office/chat`
- `POST /api/office/rewrite`
- `POST /api/office/summarize`
- `POST /api/office/generate`
- `POST /api/office/format`
- `POST /api/office/excel/formula`
- `POST /api/office/excel/analyze`
- `POST /api/office/powerpoint/generate-slides`
- `POST /api/office/project/create-plan`
- `POST /api/office/outlook/draft-email`

Request Office:

```json
{
  "app": "Word",
  "action": "rewrite",
  "selectedText": "teks terpilih",
  "context": {
    "officeApp": "Word",
    "documentTitle": "Proposal.docx",
    "selectedText": "teks terpilih",
    "documentExcerpt": "",
    "profile": "Office Productivity"
  },
  "userInstruction": "buat lebih akademik",
  "tone": "academic",
  "language": "id-ID"
}
```

Response:

```json
{
  "success": true,
  "result": "hasil Omni",
  "suggestedAction": "replace",
  "warnings": []
}
```

### Struktur Office Add-in

```text
office-addin/
  manifest.xml
  src/
    taskpane.html
    taskpane.css
    taskpane.js
    api_client.js
    office_context.js
    word_actions.js
    excel_actions.js
    powerpoint_actions.js
    project_actions.js
    outlook_actions.js
```

Task pane menampilkan:

- Header Omni Assistant.
- Detected App.
- Prompt/instruksi.
- Tombol Ask Omni, Rewrite, Summarize, Explain, Generate, Format, Fix Grammar,
  Translate, Make Professional, Make Academic, Continue Writing.
- Tombol khusus Word, Excel, PowerPoint, Project, dan Outlook.
- Preview output.
- Insert, Replace Selection, Copy.
- Checkbox izin membaca excerpt dokumen.

### Contoh Penggunaan Office

Word:

1. Pilih paragraf.
2. Klik **Rewrite** atau **Make Academic**.
3. Cek preview.
4. Klik **Replace Selection** jika setuju.

Excel:

1. Pilih range tabel.
2. Klik **Analisis tabel** atau **Buat/Jelaskan rumus**.
3. Preview insight/formula.
4. Klik **Insert** untuk menulis hasil ke cell aktif.

PowerPoint:

1. Pilih teks slide.
2. Klik **Singkatkan slide** atau **Generate slide outline**.
3. Preview bullet.
4. Insert atau copy ke slide.

Project:

1. Tulis deskripsi proyek di prompt.
2. Klik **Buat task list/WBS**, **Buat timeline**, atau **Risk register**.
3. Preview rencana.
4. Insert jika host Project mendukung penulisan selection.

Outlook:

1. Buka email atau compose window.
2. Klik **Draft email**, **Follow-up email**, atau **Action items**.
3. Preview isi email.
4. Insert ke body email.

### Menjalankan Lokal

```powershell
npm run dev
```

Saat Omni Assistant berjalan, local API otomatis aktif di:

```text
http://127.0.0.1:17878/api/health
```

Jika ingin mengganti port:

```powershell
$env:OMNI_LOCAL_API_PORT="17879"
npm run dev
```

Jika port diganti, update juga `office-addin/manifest.xml`.

### Sideload Add-in di Office Windows

Development cepat:

1. Jalankan Omni Assistant: `npm run dev`.
2. Pastikan `http://127.0.0.1:17878/api/health` aktif.
3. Buka Word/Excel/PowerPoint.
4. Pilih **Insert > Add-ins > My Add-ins > Shared Folder** atau gunakan menu
   sideload add-in sesuai aplikasi Office.
5. Pilih `office-addin/manifest.xml`.
6. Buka task pane **Omni Assistant**.

Catatan: beberapa konfigurasi Office Add-in produksi mewajibkan HTTPS. Untuk
development lokal, manifest saat ini memakai `http://localhost:17878`. Untuk
paket produksi, gunakan HTTPS localhost certificate atau host internal yang
trusted, lalu ubah `SourceLocation` di manifest.

### Build Paket Installer

Build aplikasi:

```powershell
npm run build
```

Untuk installer `.exe`, gunakan packaging Electron yang sudah Anda pakai untuk
`omni-assistant.exe`. Jika memakai `electron-builder`, pastikan folder
`office-addin` ikut masuk ke packaged resources dan manifest mengarah ke local
API Omni. Alur produksi yang disarankan:

1. Build renderer dan Electron: `npm run build`.
2. Package Omni menjadi `.exe`.
3. Sertakan `office-addin/manifest.xml` sebagai file sideload/admin deployment.
4. Pastikan firewall mengizinkan local loopback `127.0.0.1:17878`.
5. Untuk deployment organisasi, deploy manifest lewat Microsoft 365 Admin Center
   atau shared network catalog.

### Checklist Testing Office

- `GET /api/health` mengembalikan `ok: true`.
- Word selection bisa dibaca dan Replace Selection hanya terjadi setelah klik.
- Excel active range bisa dikirim dan formula recommendation tampil.
- PowerPoint text selection bisa diringkas menjadi bullet.
- Project action menghasilkan WBS/timeline/risk register di preview.
- Outlook compose bisa menerima draft email via Insert.
- Checkbox excerpt dokumen bekerja; tanpa izin hanya selection/instruksi yang dikirim.
- API key tidak pernah muncul di log.
- Dokumen besar tidak dibaca penuh tanpa izin.
- Ctrl+Z dapat membatalkan Insert/Replace di Office.
- Jika Omni desktop mati, add-in menampilkan backend `Offline`.

### Catatan Keamanan Office

- Add-in tidak auto-save dan tidak mengubah dokumen otomatis.
- Semua hasil AI masuk ke Preview lebih dulu.
- Insert/Replace hanya berjalan setelah klik user.
- Excerpt dokumen hanya dibaca jika user memberi izin lewat checkbox.
- Payload dipotong dan pola sensitif seperti password/token/API key direduksi.
- Semua aksi Office dicatat sebagai event ringkas di long-term memory, bukan isi
  dokumen lengkap.

### LibreHardwareMonitor

Omni mencoba membaca sensor LibreHardwareMonitor melalui:

1. WMI namespace `root\LibreHardwareMonitor`.
2. Remote Web Server `http://127.0.0.1:8085/data.json`.
3. Windows ACPI sebagai fallback suhu.

Di LibreHardwareMonitor, jalankan sebagai Administrator lalu aktifkan
**Options > Remote Web Server > Run**. Setelah aktif, panel **PC** menampilkan
CPU package temperature, CPU load, GPU temperature/load, fan RPM, dan status
koneksi LHM. URL dapat dioverride:

```powershell
$env:LIBRE_HARDWARE_MONITOR_URL="http://127.0.0.1:8085/data.json"
npm run dev
```

Omni juga membaca metrik GPU Windows yang digunakan Task Manager: nama GPU,
utilisasi engine tersibuk, serta pemakaian shared GPU memory. Pada Intel Iris Xe
di perangkat ini, Task Manager dan driver tidak mengekspos suhu GPU, sehingga
Omni menampilkan **Suhu tidak diekspos GPU** tanpa membuat nilai perkiraan.

Fan RPM dibaca lebih dahulu dari telemetry **MyASUS System Diagnosis** yang
diperbarui sekitar satu menit sekali. Omni hanya menerima telemetry yang berumur
maksimal tiga menit, lalu menggunakan ASUS WMI dan LibreHardwareMonitor sebagai
fallback. Karena pembacaan utama berasal dari MyASUS, ASUS System Diagnosis
perlu tetap terpasang dan aktif.

Fitur ini dibuat dan diuji strukturnya untuk ASUS VivoBook S5402ZA dengan ASUS
System Control Interface:

1. Buka chat dan klik tombol **PC**.
2. Lihat suhu, penggunaan RAM, dan proses pemakai RAM terbesar.
3. Atur batas panas dan batas suhu normal.
4. Aktifkan **Fan otomatis**, lalu simpan.

Perilaku default:

- Suhu mencapai `85 C`: mencoba mengubah fan ke **Performance**.
- Suhu turun ke `72 C`: mencoba mengembalikan fan ke **Standard**.
- Ada cooldown dua menit untuk mencegah mode berubah terlalu sering.
- Penggunaan RAM mencapai `90%`: Omni memangkas working set maksimal lima
  proses background besar, dengan cooldown sepuluh menit.

Mode Battery Health Charging:

- **Full Capacity**: 100%
- **Balanced**: 80%
- **Maximum Lifespan**: 60%

ASUS WMI dilindungi oleh Windows. Pembacaan monitor dapat berjalan sebagai user
biasa, tetapi perubahan fan dan battery mungkin memerlukan aplikasi dijalankan
dengan hak Administrator. Cara paling mudah:

```powershell
npm run dev:admin
```

Perintah tersebut membuka terminal baru melalui dialog UAC dan menjalankan Omni
di dalam proses elevated. Menjalankan MyASUS atau LibreHardwareMonitor sebagai
Administrator tidak otomatis memberikan hak Administrator kepada Electron.

Untuk build production:

```powershell
npm run start:admin
```

Jika ASUS WMI menolak perubahan, panel akan menampilkan error dan tombol
**Buka MyASUS** dapat digunakan sebagai fallback. Nilai WMI yang digunakan
spesifik untuk lini VivoBook dan tidak boleh dianggap cocok untuk semua laptop.

Omni tidak menutup proses secara otomatis. Fitur **Ringankan RAM** memakai
`EmptyWorkingSet` Windows pada proses background besar tanpa window utama.
Tindakan ini dapat membuat aplikasi sedikit lambat ketika halaman memorinya
dimuat kembali dan bukan pengganti menutup aplikasi yang memang tidak digunakan.

## Profile, Context, Memory, Workflow

Klik tombol **Dash** di header chat untuk membuka dashboard baru.

Default safety:

- **Dry-run aktif**: action dicatat tetapi tidak dieksekusi.
- **Pause** dapat menghentikan automation.
- **Manual override** mencegah automation mengganti profil/action otomatis.
- Action high-risk selalu diblokir sampai ada desain konfirmasi eksplisit.

Untuk mengizinkan action nyata, buka **Dash** lalu matikan **Dry-run**. Untuk
aksi ASUS/Samsung tertentu, jalankan:

```powershell
npm run dev:admin
```

Long-term memory disimpan di folder `app.getPath("userData")` sebagai JSON.
Memory tidak menyimpan password, token, isi chat pribadi, atau isi file pribadi.
Filter sederhana menolak catatan yang mengandung kata seperti password, token,
secret, atau API key. Gunakan tombol **Export**, **Import**, dan **Forget** di
dashboard untuk mengelola memory.

### Contoh Profile Config

File: `config/profiles.json`

```json
{
  "name": "Laravel Development",
  "activation": {
    "activeProcessesAll": ["Code"],
    "activeProcessesAny": ["Laragon", "xampp-control", "mysqld", "php"]
  },
  "priority": 70,
  "fanMode": "standard",
  "memoryManagement": "monitor",
  "ssdMode": "balanced",
  "relatedApps": ["Code", "Chrome", "Laragon", "XAMPP", "MySQL", "PHP"],
  "cooldownSeconds": 180
}
```

### Contoh Workflow Config

File: `config/workflows.json`

```json
{
  "name": "Unity Development Workflow",
  "trigger": {
    "detectedActivity": "Unity Development"
  },
  "conditions": {
    "ramUsageGreaterThan": 85
  },
  "actions": [
    "setFanPerformance",
    "setSSDBalanced",
    "freeMemorySafe",
    "showNotification"
  ],
  "cooldownSeconds": 300,
  "notification": "Unity Development Mode aktif."
}
```

### File Baru

- `electron/config.ts`
- `electron/context_monitor.ts`
- `electron/profile_manager.ts`
- `electron/memory_manager.ts`
- `electron/workflow_engine.ts`
- `electron/automation_actions.ts`
- `electron/safety_guard.ts`
- `electron/notification_service.ts`
- `electron/dashboard_ui.ts`
- `config/profiles.json`
- `config/workflows.json`
- `src/types/dashboard.ts`
- `src/hooks/useDashboard.ts`
- `src/components/dashboard_ui/DashboardPanel.tsx`

### File Diubah

- `electron/main.ts`
- `electron/preload.ts`
- `src/vite-env.d.ts`
- `src/App.tsx`
- `src/components/chat/ChatHeader.tsx`
- `src/components/chat/ChatPanel.tsx`
- `README.md`

### Cara Testing

1. Jalankan `npm run build` untuk validasi TypeScript dan bundling.
2. Jalankan `npm run dev`.
3. Buka chat, klik **Dash**.
4. Pastikan `activeApp`, `activeWindowTitle`, CPU/RAM, battery, dan activity terbaca.
5. Buka VS Code + Chrome + Laragon/XAMPP, cek profil **Laravel Development**.
6. Buka Unity Editor, cek profil **Unity Development**.
7. Jalankan game fullscreen atau app fullscreen GPU-heavy, cek kandidat **Gaming**.
8. Biarkan **Dry-run** aktif, cek log action tanpa perubahan hardware.
9. Matikan **Dry-run** hanya setelah yakin, lalu test action ringan seperti notifikasi.
10. Untuk fan/battery/SSD nyata, gunakan `npm run dev:admin`.
11. Test export/import/forget memory dari dashboard.

### Checklist Bug Yang Harus Dicek

- Profil tidak bolak-balik terlalu sering saat activity berubah cepat.
- Dry-run benar-benar mencegah action hardware.
- Pause/manual override memblokir workflow dan profile action.
- ASUS fan/battery gagal dengan pesan jelas jika tidak administrator.
- Samsung Magician tidak mengubah Performance otomatis tanpa konfirmasi.
- RAM trim tidak menyentuh proses whitelist atau proses sistem penting.
- Memory tidak menyimpan token/password/API key.
- Export/import memory tidak merusak schema.
- Context monitor tetap responsif walau WMI/counter Windows gagal.
- Dashboard tetap berjalan saat LibreHardwareMonitor tidak aktif.

## Samsung Magician

Panel **PC** mendeteksi instalasi dan service Samsung Magician, lalu membaca:

- Nama Samsung SSD.
- Suhu composite dan warning temperature dari LibreHardwareMonitor.
- Total activity serta read/write throughput SSD.
- Mode Performance Optimization aktif dari log service Samsung Magician.

Aktifkan **Optimasi SSD otomatis** untuk menggunakan kebijakan konservatif:

- **Balanced** menjadi mode default untuk penggunaan harian.
- **Power Saving** dipilih ketika laptop memakai baterai dan SSD idle sekitar
  lima menit.
- Omni menampilkan notifikasi balon dan pesan chat jika **Performance** layak
  dipakai: laptop memakai adaptor, aktivitas I/O SSD tinggi sekitar lima menit,
  dan suhu SSD berada setidaknya 5 C di bawah batas maksimum. Beban CPU/GPU
  dipakai sebagai konteks pendukung.
- Mode Performance tidak pernah diterapkan otomatis karena Samsung Magician
  dapat meminta restart Windows.
- Perubahan mode memiliki cooldown 30 menit agar tidak bolak-balik.
- Jika suhu mencapai batas maksimum, rekomendasi kembali ke **Balanced**.

Samsung Magician tidak menyediakan CLI publik untuk Performance Optimization.
Omni membuka Samsung Magician dan menggunakan Windows UI Automation untuk
memilih mode melalui antarmuka aplikasinya. Karena Magician berjalan elevated,
jalankan Omni dengan:

```powershell
npm run dev:admin
```

Perubahan masuk atau keluar dari mode Performance dapat meminta restart Windows.
Omni tidak pernah melakukan restart otomatis. Jika UI Automation tidak dapat
mengakses jendela Magician, aplikasinya tetap dibuka agar mode dapat diterapkan
secara manual.

## Build production

```bash
npm run build
npm start
```

Perintah build menghasilkan:

- `dist/` untuk renderer React.
- `dist-electron/` untuk proses main dan preload Electron.

Project ini belum membuat installer. Packaging dapat ditambahkan nanti dengan
Electron Forge atau electron-builder setelah fondasi MVP stabil.

## Struktur project

```text
electron/
  main.ts                 Proses utama dan pengaturan window
  preload.ts              API IPC aman untuk renderer
  openaiChatService.ts    Request chat ke OpenAI Responses API
  automation_actions.ts   Mapping action workflow ke adapter aman
  config.ts               Helper config dan persistence JSON
  context_monitor.ts      Pembaca context sistem real-time
  dashboard_ui.ts         Orchestrator snapshot dashboard
  memory_manager.ts       Long-term memory lokal
  notification_service.ts Notifikasi desktop
  profile_manager.ts      Evaluasi profile dan log transisi
  safety_guard.ts         Cooldown, dry-run, blacklist, manual override
  samsungMagician.ts      Telemetry, rekomendasi, dan kontrol Samsung Magician
  systemControl.ts        Monitor Windows dan adapter ASUS WMI
  vision.ts               Provider OpenAI dan Gemini
config/
  profiles.json           Definisi profile otomatis
  workflows.json          Definisi workflow automation
src/
  components/
    assistant/            Karakter virtual assistant
    chat/                 Komponen panel chat
    dashboard_ui/         Dashboard profile/context/memory/workflow
    system/               Panel suhu, RAM, fan, dan battery
    vision/               Pengaturan dan kontrol AI vision
  hooks/
    useChat.ts            State dan alur percakapan
    useSystemControl.ts   State monitor dan kontrol ASUS
    useVisionSettings.ts  Konfigurasi provider vision
  styles/
    index.css             Tailwind dan style global
  types/
    chat.ts               Type untuk pesan
  App.tsx
  main.tsx
```

## Catatan keamanan

Renderer tidak memiliki akses langsung ke Node.js. Komunikasi dengan proses
Electron dibatasi melalui API di `preload.ts` dengan `contextIsolation` aktif.

Omni tidak memantau layar secara terus-menerus. Screenshot hanya dibuat setelah
tombol **Analisis layar** atau **Baca layar** diklik. Screenshot dikompresi di
proses Electron lalu dikirim ke provider yang dipilih untuk dianalisis. Gambar
tidak disimpan ke file oleh aplikasi.

Penggunaan OpenAI atau Gemini dapat menimbulkan biaya sesuai akun dan harga
provider. Hindari menganalisis layar yang menampilkan password, API key, data
keuangan, atau informasi pribadi.

Versi ini dapat membaca layar, menjelaskan masalah, memberi saran coding, dan
memberi kritik desain. Omni belum mengendalikan mouse, keyboard, editor, atau
aplikasi lain secara otomatis. Fitur tindakan langsung membutuhkan lapisan
computer-use terpisah dengan konfirmasi pengguna untuk setiap aksi penting.
