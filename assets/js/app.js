// Panorama Super App - PWA Main Controller
const AppState = {
  currentUser: null,
  isAuthenticated: false,
  isDbOnline: true,
  trips: [],
  workers: [],
  agencies: [],
  templates: [],
  pnl: null,
  payroll: [],
  
  // UI State
  activeSubTab: 'daily', // 'daily', 'crew_status', 'pnl', 'agencies', 'payroll'
  crewTab: 'today',      // 'today', 'all'
  dailyDate: 'all',
  crewDate: new Date().toISOString().slice(0, 10),
  crewTimeSlot: 'all',
  crewRole: 'all',
  crewAvailability: 'all',
  crewSearch: '',
  dateFilter: {
    mode: 'all',         // 'all', 'single', 'range'
    startDate: '',
    endDate: ''
  },
  statusFilter: 'all',
  searchKeyword: '',
  deferredPrompt: null
};

// Utilities
function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatNumberDot(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  const num = Math.round(parseFloat(amount) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseNumberDot(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = val.toString().replace(/[^0-9]/g, '');
  return parseFloat(clean) || 0;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${months[mIdx] || parts[1]} ${parts[0]}`;
  }
  return dateStr;
}

function createWhatsAppUrl(phone, message) {
  if (!phone) return '#';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  if (clean.startsWith('+')) clean = clean.slice(1);
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function isSameShift(slot1, slot2) {
  if (!slot1 || !slot2) return false;
  if (slot1 === slot2) return true;
  const s1 = slot1.toLowerCase();
  const s2 = slot2.toLowerCase();
  if (s1.includes('sunrise') && s2.includes('sunrise')) return true;
  if ((s1.includes('pagi') || s1.includes('daylight')) && (s2.includes('pagi') || s2.includes('daylight'))) return true;
  if ((s1.includes('milky') || s1.includes('malam')) && (s2.includes('milky') || s2.includes('malam'))) return true;
  return false;
}

function generateGuestGreeting(guestName, code, timeSlot, tourPackage, pickupPoint) {
  return `Halo Kak ${guestName}, salam hangat dari Tim Panorama Tour Bromo! 🌋\n\nKami kru operasional untuk trip: *${tourPackage}* (Kode: *${code}*).\nJadwal penjemputan: *${timeSlot}* di lokasi: *${pickupPoint}*.\n\nMohon siapkan jaket tebal dan perlengkapan hangat. Sampai jumpa di lokasi penjemputan!`;
}

// Toast System
function showToast(type, title, message = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = Icons.check(18, '#059669');
  if (type === 'error') iconSvg = Icons.alertCircle(18, '#dc2626');
  if (type === 'warning') iconSvg = Icons.alertCircle(18, '#d97706');
  if (type === 'info') iconSvg = Icons.sparkles(18, '#0284c7');

  toast.innerHTML = `
    ${iconSvg}
    <div style="flex: 1;">
      <div style="font-weight: 700; color: #0f172a;">${title}</div>
      ${message ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.2s, transform 0.2s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Confirmation Modal
function requestConfirm({ title, message, confirmLabel = 'Ya, Lanjutkan', isDestructive = false, requiresInput = false, inputPlaceholder = '', onConfirm }) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 420px;">
        <div class="modal-header">
          <div style="font-weight: 800; font-size: 16px; color: #0f172a;">${title}</div>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">${Icons.x(16)}</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 13px; color: #475569;">${message}</p>
          ${requiresInput ? `
            <div class="form-group" style="margin-top: 8px;">
              <input type="text" id="confirm-input-val" class="form-input" placeholder="${inputPlaceholder}" autofocus />
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal()">Batal</button>
          <button class="btn ${isDestructive ? 'btn-danger' : 'btn-primary'}" id="btn-modal-confirm-action">
            ${confirmLabel}
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-modal-confirm-action').onclick = () => {
    const inputVal = requiresInput ? document.getElementById('confirm-input-val')?.value : null;
    closeModal();
    if (onConfirm) onConfirm(inputVal);
  };
}

function closeModal() {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}

// Application Core
const App = {
  onCurrencyInput(inputEl, callback) {
    if (!inputEl) return;
    const oldVal = inputEl.value || '';
    const selStart = inputEl.selectionStart;
    const digitsBeforeCursor = (oldVal.substring(0, selStart || 0).match(/\d/g) || []).length;
    
    const raw = parseNumberDot(oldVal);
    const hasDigits = oldVal.replace(/[^0-9]/g, '') !== '';
    const newVal = hasDigits ? formatNumberDot(raw) : '';
    inputEl.value = newVal;

    if (selStart !== null && selStart !== undefined) {
      let newCursor = 0;
      let digitsCount = 0;
      for (let i = 0; i < newVal.length; i++) {
        if (/\d/.test(newVal[i])) {
          digitsCount++;
        }
        if (digitsCount === digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }
      if (digitsBeforeCursor === 0) newCursor = 0;
      if (digitsCount < digitsBeforeCursor) newCursor = newVal.length;
      try { inputEl.setSelectionRange(newCursor, newCursor); } catch(e) {}
    }

    if (typeof callback === 'function') {
      callback(raw);
    }
  },
  async init() {
    // Health check
    API.checkHealth().then(online => {
      AppState.isDbOnline = online;
      this.updateDbStatusIndicator();
    });

    // PWA Install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      AppState.deferredPrompt = e;
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    // Load active session
    const user = await API.getSession();
    if (user) {
      AppState.currentUser = user;
      AppState.isAuthenticated = true;
      await this.loadInitialData();
      this.render();
    } else {
      AppState.isAuthenticated = false;
      this.render();
    }
  },

  async loadInitialData() {
    if (!AppState.isAuthenticated) return;
    const role = AppState.currentUser.role;
    const workerId = AppState.currentUser.id;

    // Load trips with role context
    AppState.trips = await API.getTrips({ role, workerId });
    
    // Load workers, agencies, templates
    AppState.workers = await API.getWorkers();
    AppState.agencies = await API.getAgencies();
    AppState.templates = await API.getTemplates();

    // If Admin, load analytics
    if (role === 'admin') {
      AppState.pnl = await API.getAnalyticsPnL();
      AppState.payroll = await API.getAnalyticsPayroll();
    }
  },

  updateDbStatusIndicator() {
    const badge = document.getElementById('db-status-badge');
    if (badge) {
      if (AppState.isDbOnline) {
        badge.style.background = '#dcfce7';
        badge.style.borderColor = '#bbf7d0';
        badge.style.color = '#15803d';
        badge.innerHTML = `${Icons.wifi(13, '#15803d')} <span>MySQL: Online</span>`;
      } else {
        badge.style.background = '#fef3c7';
        badge.style.borderColor = '#fde68a';
        badge.style.color = '#b45309';
        badge.innerHTML = `${Icons.wifi(13, '#b45309')} <span>Mode Offline</span>`;
      }
    }
  },

  render() {
    const root = document.getElementById('app-root');
    if (!root) return;

    if (!AppState.isAuthenticated || !AppState.currentUser) {
      root.className = 'app-container';
      root.innerHTML = this.renderLoginView();
      this.bindLoginEvents();
      return;
    }

    const isAdmin = AppState.currentUser.role === 'admin';
    root.className = `app-container ${isAdmin ? 'admin-expanded' : ''}`;

    let mainContentHtml = '';
    if (isAdmin) {
      mainContentHtml = this.renderAdminDashboard();
    } else if (AppState.currentUser.role === 'driver_jeep') {
      mainContentHtml = this.renderDriverJeepView();
    } else if (AppState.currentUser.role === 'driver_lapangan') {
      mainContentHtml = this.renderDriverLapanganView();
    } else if (AppState.currentUser.role === 'photographer') {
      mainContentHtml = this.renderPhotographerView();
    }

    root.innerHTML = `
      ${this.renderHeader()}
      <main class="main-content">
        ${mainContentHtml}
      </main>
    `;

    this.bindAppEvents();
  },

  renderHeader() {
    const u = AppState.currentUser;
    const roleBadges = {
      admin: '<span class="badge badge-admin">Admin</span>',
      driver_jeep: '<span class="badge badge-jeep">Driver Jeep</span>',
      driver_lapangan: '<span class="badge badge-field">Shuttle</span>',
      photographer: '<span class="badge badge-photo">Fotografer</span>'
    };

    return `
      <header class="mobile-header">
        <div class="brand-section">
          <img src="assets/icons/logo.png" alt="Panorama Logo" class="brand-logo-img" onerror="this.src='assets/icons/favicon.png'" />
          <div>
            <div class="brand-title">Panorama Tour</div>
            <div class="brand-subtitle">Super App Operations</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <div id="db-status-badge" class="badge" style="background: #dcfce7; border: 1px solid #bbf7d0; color: #15803d; font-size: 11px;">
            ${Icons.wifi(12, '#15803d')} <span>MySQL: Online</span>
          </div>

          <div class="header-user-badge">
            <div class="avatar-mini" style="display: flex; align-items: center; justify-content: center; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;">
              ${Icons.user(16, '#0284c7')}
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.1;">${u.name}</div>
              <div style="margin-top: 2px;">${roleBadges[u.role] || u.role}</div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App.forceRefreshApp()" title="Segarkan Versi & Bersihkan Cache" style="padding: 6px; color: #0284c7;">
              ${(typeof Icons?.refreshCw === 'function' ? Icons.refreshCw(16, '#0284c7') : (typeof Icons?.refresh === 'function' ? Icons.refresh(16, '#0284c7') : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'))}
            </button>
            <button class="btn btn-outline btn-sm" id="btn-logout" title="Keluar Akun" style="padding: 6px;">
              ${Icons.logOut(16, '#dc2626')}
            </button>
          </div>
        </div>
      </header>
    `;
  },

  // 1. LOGIN VIEW
  renderLoginView() {
    return `
      <div style="width: 100%; max-width: 440px; margin: auto; padding: 24px 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="assets/icons/logo.png" alt="Panorama Logo" style="width: 68px; height: 68px; border-radius: 16px; margin-bottom: 12px; box-shadow: var(--shadow-md);" onerror="this.src='assets/icons/favicon.png'" />
          <h1 style="font-size: 22px; font-weight: 800; color: #0f172a;">Panorama Tour</h1>
          <p style="font-size: 13px; color: #475569; margin-top: 2px;">Super App Operations & Crew Management</p>
          <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: #dcfce7; border: 1px solid #bbf7d0; margin-top: 10px; font-size: 11px; font-weight: 700; color: #15803d;">
            ${Icons.wifi(13, '#15803d')}
            <span>Database MySQL Shared Hosting: Online</span>
          </div>
        </div>

        <div class="metric-card" style="padding: 24px;">
          <div style="margin-bottom: 18px;">
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">Masuk ke Akun Anda</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Gunakan Username dan PIN Keamanan 6 Digit</div>
          </div>

          <form id="login-form" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                <span>Username Akun:</span>
                <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">Contoh: admin, andi, yoyok, annur</span>
              </label>
              <div style="position: relative;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b;">${Icons.user(16)}</span>
                <input type="text" id="login-identifier" class="form-input" style="padding-left: 34px;" placeholder="Masukkan username Anda" required autofocus />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">PIN Keamanan (6 Digit):</label>
              <div style="position: relative;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b;">${Icons.lock(16)}</span>
                <input type="password" id="login-pin" class="form-input" style="padding-left: 34px; padding-right: 36px; letter-spacing: 0.15em;" placeholder="6 digit angka PIN" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="current-password" value="" required />
                <button type="button" id="btn-toggle-pin" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b;">
                  ${Icons.eye(16)}
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-login-submit" style="padding: 10px; font-size: 14px; font-weight: 700; margin-top: 4px;">
              ${Icons.logIn(16)}
              <span>Masuk Sekarang</span>
            </button>
          </form>

          <div style="margin-top: 16px; text-align: center;">
            <button id="btn-install-pwa" class="btn btn-outline btn-sm" style="display: none; width: 100%; border-color: #bae6fd; color: #0284c7; background: #f0f9ff;">
              ${Icons.download(14)}
              <span>Pasang Aplikasi ke Layar Utama (PWA)</span>
            </button>
          </div>
        </div>

        <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
          Panorama Super App &bull; Native PHP + MySQL Relational Edition
          <div style="margin-top: 6px;">
            <a href="javascript:void(0)" onclick="App.forceRefreshApp()" style="color: #64748b; text-decoration: underline; font-size: 11px;">
              Segarkan / Muat Versi Terbaru
            </a>
          </div>
        </div>
      </div>
    `;
  },

  bindLoginEvents() {
    const form = document.getElementById('login-form');
    const pinInput = document.getElementById('login-pin');
    const togglePinBtn = document.getElementById('btn-toggle-pin');
    const installBtn = document.getElementById('btn-install-pwa');

    if (AppState.deferredPrompt && installBtn) {
      installBtn.style.display = 'inline-flex';
    }

    if (installBtn) {
      installBtn.onclick = async () => {
        if (!AppState.deferredPrompt) return;
        AppState.deferredPrompt.prompt();
        const { outcome } = await AppState.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          AppState.deferredPrompt = null;
          installBtn.style.display = 'none';
        }
      };
    }

    if (togglePinBtn && pinInput) {
      togglePinBtn.onclick = () => {
        if (pinInput.type === 'password') {
          pinInput.type = 'text';
          togglePinBtn.innerHTML = Icons.eyeOff(16);
        } else {
          pinInput.type = 'password';
          togglePinBtn.innerHTML = Icons.eye(16);
        }
      };
    }

    if (pinInput) {
      // Hanya izinkan input angka (filter non-digit real-time)
      pinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
      });
      pinInput.addEventListener('keypress', (e) => {
        if (!/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      });
    }



    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim();
        const pin = document.getElementById('login-pin').value.trim();
        const submitBtn = document.getElementById('btn-login-submit');

        if (!/^\d{6}$/.test(pin)) {
          showToast('error', 'PIN Tidak Valid', 'PIN keamanan harus terdiri dari 6 digit angka.');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `${Icons.sparkles(16)} <span>Memverifikasi...</span>`;

        const res = await API.login(identifier, pin);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${Icons.logIn(16)} <span>Masuk Sekarang</span>`;

        if (res.success && res.user) {
          AppState.currentUser = res.user;
          AppState.isAuthenticated = true;
          showToast('success', 'Berhasil Masuk', `Selamat datang, ${res.user.name}!`);
          await this.loadInitialData();
          this.render();
        } else {
          showToast('error', 'Gagal Masuk', res.message || 'Periksa kembali kredensial Anda');
        }
      };
    }
  },

  // 2. ADMIN DASHBOARD
  renderAdminDashboard() {
    const subTab = AppState.activeSubTab;
    
    // Quick statistics
    const totalTrips = AppState.trips.length;
    const scheduledTrips = AppState.trips.filter(t => t.tripStatus === 'scheduled').length;
    const completedTrips = AppState.trips.filter(t => t.tripStatus === 'completed').length;
    const totalRevenue = AppState.trips
      .filter(t => t.tripStatus !== 'cancelled')
      .reduce((sum, t) => sum + (t.packagePrice || 0), 0);

    return `
      <!-- Admin Subtab Navigation -->
      <div class="segmented-nav">
        <button class="segmented-btn ${subTab === 'daily' ? 'active' : ''}" onclick="App.switchSubTab('daily')">
          ${Icons.calendar(14)} <span>Operasional Harian</span>
        </button>
        <button class="segmented-btn ${subTab === 'crew_status' ? 'active' : ''}" onclick="App.switchSubTab('crew_status')">
          ${Icons.users(14)} <span>Status & Kapasitas Kru</span>
        </button>
        <button class="segmented-btn ${subTab === 'pnl' ? 'active' : ''}" onclick="App.switchSubTab('pnl')">
          ${Icons.wallet(14)} <span>Laba & Rugi (PnL)</span>
        </button>
        <button class="segmented-btn ${subTab === 'agencies' ? 'active' : ''}" onclick="App.switchSubTab('agencies')">
          ${Icons.database(14)} <span>Mitra Agen Travel</span>
        </button>
        <button class="segmented-btn ${subTab === 'payroll' ? 'active' : ''}" onclick="App.switchSubTab('payroll')">
          ${Icons.clock(14)} <span>Honor Kru & Payroll</span>
        </button>
      </div>

      ${subTab === 'daily' ? this.renderAdminDailyTab(totalTrips, scheduledTrips, completedTrips, totalRevenue) : ''}
      ${subTab === 'crew_status' ? this.renderAdminCrewStatusTab() : ''}
      ${subTab === 'pnl' ? this.renderAdminPnlTab() : ''}
      ${subTab === 'agencies' ? this.renderAdminAgenciesTab() : ''}
      ${subTab === 'payroll' ? this.renderAdminPayrollTab() : ''}
    `;
  },

  renderAdminDailyTab(total, scheduled, completed, revenue) {
    // Dynamic date & status filtering
    let filtered = [...AppState.trips];
    if (AppState.dailyDate && AppState.dailyDate !== 'all') {
      filtered = filtered.filter(t => t.date === AppState.dailyDate);
    }
    if (AppState.statusFilter !== 'all') {
      filtered = filtered.filter(t => t.tripStatus === AppState.statusFilter);
    }
    if (AppState.searchKeyword) {
      const q = AppState.searchKeyword.toLowerCase();
      filtered = filtered.filter(t => 
        (t.code && t.code.toLowerCase().includes(q)) ||
        (t.guestName && t.guestName.toLowerCase().includes(q)) ||
        (t.tourPackage && t.tourPackage.toLowerCase().includes(q)) ||
        (t.pickupPoint && t.pickupPoint.toLowerCase().includes(q))
      );
    }

    // Dynamic metrics based on current filtered subset
    const countTotal = filtered.length;
    const countScheduled = filtered.filter(t => t.tripStatus === 'scheduled').length;
    const countCompleted = filtered.filter(t => t.tripStatus === 'completed').length;
    const activeTripsList = filtered.filter(t => t.tripStatus !== 'cancelled');
    const totalRev = activeTripsList.reduce((sum, t) => sum + (t.packagePrice || 0), 0);
    const totalCashIn = activeTripsList.reduce((sum, t) => sum + (t.depositAmount || 0), 0);
    const totalPiutang = activeTripsList.reduce((sum, t) => sum + (t.remainingBalance ?? Math.max(0, (t.packagePrice || 0) - (t.depositAmount || 0))), 0);

    const activeDate = AppState.dailyDate;

    return `
      <!-- Quick Metrics (Real-time dynamic) -->
      <div class="metrics-grid admin-grid">
        <div class="metric-card">
          <div class="metric-title">Total Perjalanan</div>
          <div class="metric-value">${countTotal}</div>
          <div class="metric-sub">${activeDate === 'all' ? 'Semua jadwal trip terdaftar' : `Trip tanggal ${formatDate(activeDate)}`}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Trip Terjadwal</div>
          <div class="metric-value" style="color: #2563eb;">${countScheduled}</div>
          <div class="metric-sub">Siap diberangkatkan</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Trip Selesai</div>
          <div class="metric-value" style="color: #059669;">${countCompleted}</div>
          <div class="metric-sub">Operasional rampung</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Omset Penjualan</div>
          <div class="metric-value" style="color: #0f172a; font-size: 17px;">${formatIDR(totalRev)}</div>
          <div class="metric-sub">Kas Masuk: <strong style="color: #059669;">${formatIDR(totalCashIn)}</strong> &bull; Piutang: <strong style="color: #dc2626;">${formatIDR(totalPiutang)}</strong></div>
        </div>
      </div>

      <!-- Action Bar, Date Filter & Search Filters -->
      <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <!-- Search & Status -->
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 260px;">
            <div style="position: relative; flex: 1;">
              <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b;">${Icons.search(15)}</span>
              <input type="text" id="admin-search-input" class="form-input" style="padding-left: 32px; font-size: 12px;" placeholder="Cari tamu, kode PNR, paket..." value="${AppState.searchKeyword}" />
            </div>
            <select id="admin-status-filter" class="form-select" style="width: 140px; font-size: 12px; font-weight: 600;">
              <option value="all" ${AppState.statusFilter === 'all' ? 'selected' : ''}>Semua Status</option>
              <option value="scheduled" ${AppState.statusFilter === 'scheduled' ? 'selected' : ''}>Terjadwal</option>
              <option value="in_progress" ${AppState.statusFilter === 'in_progress' ? 'selected' : ''}>Berlangsung</option>
              <option value="completed" ${AppState.statusFilter === 'completed' ? 'selected' : ''}>Selesai</option>
              <option value="cancelled" ${AppState.statusFilter === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
            </select>
          </div>

          <!-- Master Data & Tambah Trip Buttons -->
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" onclick="App.openManageMasterModal()">
              ${Icons.database(14, '#2563eb')}
              <span>Master Data</span>
            </button>
            <button class="btn btn-warning btn-sm" style="font-weight: 700;" onclick="App.openAddBromoTripModal()" title="Tambah Trip Bromo Khusus & Cepat">
              <span>🌋 + Trip Bromo</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="App.openAddTripModal()">
              ${Icons.plus(15)}
              <span>Tambah Perjalanan</span>
            </button>
          </div>
        </div>

        <!-- Date Filtering Toolbar -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border-glass);">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-right: 4px;">Filter Tanggal:</span>
            <button class="btn btn-sm ${activeDate === 'all' ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px;" onclick="App.setDailyDate('all')">Semua Tanggal</button>
            <button class="btn btn-sm ${activeDate === new Date().toISOString().slice(0, 10) ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px;" onclick="App.setDailyDate(new Date().toISOString().slice(0, 10))">Hari Ini</button>
            <button class="btn btn-sm ${activeDate === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px;" onclick="App.setDailyDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10))">Besok</button>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: #64748b;">Pilih Tanggal:</span>
            <input type="date" class="form-input" style="padding: 3px 8px; font-size: 11px; font-weight: 700; width: 135px;"
              value="${activeDate !== 'all' ? activeDate : ''}" onchange="App.setDailyDate(this.value || 'all')" />
          </div>
        </div>
      </div>

      <!-- Trip Cards List -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${filtered.length === 0 ? `
          <div style="text-align: center; padding: 40px; background: #ffffff; border: 1px dashed var(--border-glass); border-radius: 16px; color: #64748b;">
            <p>Tidak ada data perjalanan yang sesuai dengan filter pencarian / tanggal ini.</p>
          </div>
        ` : filtered.map(t => this.renderTripCardAdmin(t)).join('')}
      </div>
    `;
  },
  renderTripCardAdmin(t) {
    const statusMap = {
      scheduled: '<span class="status-badge status-scheduled">Terjadwal</span>',
      in_progress: '<span class="status-badge status-in_progress">Berlangsung</span>',
      completed: '<span class="status-badge status-completed">Selesai</span>',
      cancelled: '<span class="status-badge status-cancelled">Dibatalkan</span>'
    };

    let payStatusHtml = '';
    const dpVal = t.depositAmount || 0;
    const remVal = t.remainingBalance ?? Math.max(0, (t.packagePrice || 0) - dpVal);
    if (t.agencyPaymentStatus === 'paid') {
      payStatusHtml = `
        <span class="badge pay-paid" title="Pembayaran Lunas Penuh">Lunas</span>
      `;
    } else if (t.agencyPaymentStatus === 'deposit') {
      payStatusHtml = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
          <span class="badge pay-deposit" title="Sudah Bayar Uang Muka (DP)">DP: ${formatIDR(dpVal)}</span>
          <span style="font-size: 10px; font-weight: 700; color: #dc2626;">Sisa: ${formatIDR(remVal)}</span>
        </div>
      `;
    } else {
      payStatusHtml = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
          <span class="badge pay-unpaid" title="Belum Ada Pembayaran">Belum Bayar</span>
          <span style="font-size: 10px; font-weight: 700; color: #dc2626;">Tagihan: ${formatIDR(t.packagePrice || 0)}</span>
        </div>
      `;
    }

    return `
      <div class="trip-card">
        <div class="trip-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="trip-code">${t.code}</span>
              ${statusMap[t.tripStatus] || t.tripStatus}
            </div>
            <div class="trip-package" style="margin-top: 2px;">${t.tourPackage}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${formatIDR(t.packagePrice)}</div>
            <div style="margin-top: 3px;">${payStatusHtml}</div>
          </div>
        </div>

        <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${t.guestName} (${t.guestCount} Pax)</div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 6px; font-size: 12px; color: #475569;">
          <div class="trip-info-row">${Icons.calendar(14, '#64748b')} <span>${formatDate(t.date)} &bull; ${t.timeSlot}</span></div>
          <div class="trip-info-row">${Icons.mapPin(14, '#64748b')} <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.pickupPoint}</span></div>
          <div class="trip-info-row">${Icons.phone(14, '#64748b')} <span>${t.guestPhone}</span></div>
          <div class="trip-info-row">${Icons.database(14, '#64748b')} <span>${t.agencyName || 'Tamu Mandiri'}</span></div>
        </div>

        <!-- Crew Assignment Pills -->
        <div class="crew-assignment-pills">
          <div class="crew-pill">
            ${Icons.truck(13, '#ea580c')}
            <span>Jeep: <strong>${t.jeepDriverName || 'Belum Dipilih'}</strong></span>
          </div>
          <div class="crew-pill">
            ${Icons.car(13, '#0284c7')}
            <span>Shuttle: <strong>${t.fieldDriverName || 'Belum Dipilih'}</strong></span>
          </div>
          <div class="crew-pill">
            ${Icons.camera(13, '#7c3aed')}
            <span>Foto: <strong>${t.photographerName || 'Belum Dipilih'}</strong></span>
          </div>
        </div>

        <!-- Card Footer Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-glass); margin-top: 4px;">
          <div style="display: flex; gap: 6px;">
            <select class="form-select btn-sm" style="width: auto; padding: 4px 8px; font-weight: 700;" onchange="App.quickUpdateTripStatus('${t.id}', this.value)">
              <option value="scheduled" ${t.tripStatus === 'scheduled' ? 'selected' : ''}>Terjadwal</option>
              <option value="in_progress" ${t.tripStatus === 'in_progress' ? 'selected' : ''}>Berlangsung</option>
              <option value="completed" ${t.tripStatus === 'completed' ? 'selected' : ''}>Selesai</option>
              <option value="cancelled" ${t.tripStatus === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
            </select>
          </div>

          <div style="display: flex; gap: 6px;">
            <button class="btn btn-outline btn-sm" onclick="App.openTripDetailModal('${t.id}')">
              ${Icons.eye(13)}
              <span>Detail & Rute</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="App.openAddTripModal('${t.id}')">
              ${Icons.edit(13)}
              <span>Edit</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="App.confirmDeleteTrip('${t.id}', '${t.code}')">
              ${Icons.trash(13)}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // 2B. ADMIN CREW STATUS & CAPACITY (MONITORING REAL-TIME PER TANGGAL & SESI WAKTU)
  renderAdminCrewStatusTab() {
    const targetDate = AppState.crewDate || new Date().toISOString().slice(0, 10);
    const allWorkers = AppState.workers.filter(w => w.role !== 'admin');

    // Hitung ketersediaan berdasarkan tanggal dan slot waktu terpilih
    const crewOverview = allWorkers.map(worker => {
      const avail = this.getCrewAvailability(worker.id, targetDate, AppState.crewTimeSlot);
      const activeTrips = (AppState.crewTimeSlot && AppState.crewTimeSlot !== 'all') ? avail.shiftTrips : avail.dailyTrips;
      const tripCount = avail.dailyCount;
      const availability = avail.status;

      // Total riwayat trip kru sepanjang karir
      const allWorkerTrips = AppState.trips.filter(t => 
        t.tripStatus !== 'cancelled' &&
        (t.jeepDriverId === worker.id || t.fieldDriverId === worker.id || t.photographerId === worker.id)
      );

      return {
        worker,
        avail,
        activeTrips,
        tripCount,
        availability,
        totalTrips: allWorkerTrips.length
      };
    });

    // KPI Summary
    const totalCrew = crewOverview.length;
    const availableCount = crewOverview.filter(c => c.availability === 'available').length;
    const busyCount = crewOverview.filter(c => c.availability === 'busy').length;
    const fullCount = crewOverview.filter(c => c.availability === 'full').length;

    // Filter data kru yang ditampilkan di kartu
    const filteredCrew = crewOverview.filter(item => {
      if (AppState.crewRole !== 'all' && item.worker.role !== AppState.crewRole) {
        return false;
      }
      if (AppState.crewAvailability !== 'all' && item.availability !== AppState.crewAvailability) {
        return false;
      }
      if (AppState.crewSearch && AppState.crewSearch.trim()) {
        const q = AppState.crewSearch.toLowerCase();
        const matchName = item.worker.name.toLowerCase().includes(q);
        const matchUnit = (item.worker.vehicleUnit || '').toLowerCase().includes(q);
        const matchPhone = (item.worker.phone || '').includes(q);
        if (!matchName && !matchUnit && !matchPhone) return false;
      }
      return true;
    });

    return `
      <!-- Header Section -->
      <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: #e0f2fe; color: #0284c7; border-radius: 8px;">
                ${Icons.users(16, '#0284c7')}
              </span>
              <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">Monitoring Status & Ketersediaan Kru Real-Time</h2>
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">
              Status ketersediaan dihitung <strong>per tanggal dan sesi waktu operasional</strong>. Batas maksimal sistem adalah <strong>2 trip serentak</strong> untuk mencegah bentrok armada di lapangan.
            </p>
          </div>

          <!-- Date Selector -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid var(--border-glass); padding: 4px 8px; border-radius: 8px;">
              <span style="font-size: 11px; font-weight: 700; color: #475569;">${Icons.calendar(13)} Tanggal:</span>
              <input type="date" class="form-input" style="padding: 4px 8px; font-size: 12px; font-weight: 700; border-radius: 6px; width: 140px;"
                value="${targetDate}" onchange="App.setCrewDate(this.value)" />
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-outline btn-sm ${targetDate === new Date().toISOString().slice(0, 10) ? 'active' : ''}" style="font-size: 11px; padding: 5px 8px;" onclick="App.setCrewDate(new Date().toISOString().slice(0, 10))">Hari Ini</button>
              <button class="btn btn-outline btn-sm ${targetDate === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? 'active' : ''}" style="font-size: 11px; padding: 5px 8px;" onclick="App.setCrewDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10))">Besok</button>
              <button class="btn btn-outline btn-sm ${targetDate === new Date(Date.now() + 172800000).toISOString().slice(0, 10) ? 'active' : ''}" style="font-size: 11px; padding: 5px 8px;" onclick="App.setCrewDate(new Date(Date.now() + 172800000).toISOString().slice(0, 10))">Lusa</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Live KPI Metric Cards -->
      <div class="metrics-grid admin-grid" style="margin-bottom: 14px;">
        <div class="metric-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="metric-title">Total Kru Terdaftar</div>
              <div class="metric-value" style="color: #0284c7;">${totalCrew} Kru</div>
              <div class="metric-subtitle">Jeep, Shuttle & Fotografer</div>
            </div>
            <div class="metric-icon" style="background: #e0f2fe; color: #0284c7;">${Icons.users(18, '#0284c7')}</div>
          </div>
        </div>

        <div class="metric-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="metric-title">Standby / Siap Tugas</div>
              <div class="metric-value" style="color: #059669;">${availableCount} Kru</div>
              <div class="metric-subtitle">Kapasitas Utuh (0/2 Trip)</div>
            </div>
            <div class="metric-icon" style="background: #dcfce7; color: #059669;">${Icons.check(18, '#059669')}</div>
          </div>
        </div>

        <div class="metric-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="metric-title">Sedang Bertugas (1 Trip)</div>
              <div class="metric-value" style="color: #d97706;">${busyCount} Kru</div>
              <div class="metric-subtitle">Sisa Kuota 1 Trip Lagi</div>
            </div>
            <div class="metric-icon" style="background: #fef3c7; color: #d97706;">${Icons.clock(18, '#d97706')}</div>
          </div>
        </div>

        <div class="metric-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="metric-title">Kapasitas Penuh (2/2)</div>
              <div class="metric-value" style="color: #dc2626;">${fullCount} Kru</div>
              <div class="metric-subtitle">Batas Maksimal (Terkunci)</div>
            </div>
            <div class="metric-icon" style="background: #fee2e2; color: #dc2626;">${Icons.alert(18, '#dc2626')}</div>
          </div>
        </div>
      </div>

      <!-- Filter Toolbar: Search + Sesi Waktu + Role Chips + Status Chips -->
      <div style="background: #ffffff; border: 1px solid var(--border-glass); padding: 12px; border-radius: 12px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between;">
          <div style="position: relative; flex: 1; min-width: 220px;">
            <input
              type="text"
              class="form-input"
              style="width: 100%; font-size: 12px; padding: 7px 10px;"
              placeholder="🔍 Cari nama kru, armada, atau HP..."
              value="${AppState.crewSearch || ''}"
              oninput="App.setCrewSearch(this.value)"
            />
          </div>

          <div style="min-width: 200px;">
            <select
              class="form-select"
              onchange="App.setCrewTimeSlot(this.value)"
              style="font-size: 12px; padding: 7px 10px; font-weight: 600;"
            >
              <option value="all" ${AppState.crewTimeSlot === 'all' ? 'selected' : ''}>🕒 Semua Sesi Waktu</option>
              <option value="02:00 WIB (Sunrise)" ${AppState.crewTimeSlot === '02:00 WIB (Sunrise)' ? 'selected' : ''}>02:00 WIB (Sunrise)</option>
              <option value="03:30 WIB (Sunrise)" ${AppState.crewTimeSlot === '03:30 WIB (Sunrise)' ? 'selected' : ''}>03:30 WIB (Sunrise)</option>
              <option value="08:00 WIB (Pagi)" ${AppState.crewTimeSlot === '08:00 WIB (Pagi)' ? 'selected' : ''}>08:00 WIB (Tour Pagi)</option>
              <option value="21:00 WIB (Milky Way)" ${AppState.crewTimeSlot === '21:00 WIB (Milky Way)' ? 'selected' : ''}>21:00 WIB (Milky Way Malam)</option>
            </select>
          </div>
        </div>

        <!-- Chips Row -->
        <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding-top: 6px; border-top: 1px solid var(--border-glass);">
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-right: 4px;">Role:</span>
            <button class="btn btn-sm ${AppState.crewRole === 'all' ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px; ${AppState.crewRole === 'all' ? 'color: #ffffff !important;' : ''}" onclick="App.setCrewRole('all')">Semua Role</button>
            <button class="btn btn-sm ${AppState.crewRole === 'driver_jeep' ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px; ${AppState.crewRole === 'driver_jeep' ? 'color: #ffffff !important;' : ''}" onclick="App.setCrewRole('driver_jeep')">Driver Jeep</button>
            <button class="btn btn-sm ${AppState.crewRole === 'driver_lapangan' ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px; ${AppState.crewRole === 'driver_lapangan' ? 'color: #ffffff !important;' : ''}" onclick="App.setCrewRole('driver_lapangan')">Driver Shuttle</button>
            <button class="btn btn-sm ${AppState.crewRole === 'photographer' ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px; ${AppState.crewRole === 'photographer' ? 'color: #ffffff !important;' : ''}" onclick="App.setCrewRole('photographer')">Fotografer</button>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-right: 4px;">Status:</span>
            <button class="btn btn-sm ${AppState.crewAvailability === 'all' ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; padding: 3px 8px; ${AppState.crewAvailability === 'all' ? 'color: #ffffff !important;' : ''}" onclick="App.setCrewAvailability('all')">Semua</button>
            <button class="btn btn-sm filter-chip-ready ${AppState.crewAvailability === 'available' ? 'active' : ''}" style="font-size: 11px; padding: 3px 8px;" onclick="App.setCrewAvailability('available')">🟢 Siap (0/2)</button>
            <button class="btn btn-sm filter-chip-busy ${AppState.crewAvailability === 'busy' ? 'active' : ''}" style="font-size: 11px; padding: 3px 8px;" onclick="App.setCrewAvailability('busy')">🟡 Sibuk (1/2)</button>
            <button class="btn btn-sm filter-chip-full ${AppState.crewAvailability === 'full' ? 'active' : ''}" style="font-size: 11px; padding: 3px 8px;" onclick="App.setCrewAvailability('full')">🔴 Penuh (2/2)</button>
          </div>
        </div>
      </div>

      <!-- Crew Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
        ${filteredCrew.length === 0 ? `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #ffffff; border: 1px dashed var(--border-glass); border-radius: 12px; color: #64748b;">
            Tidak ada kru yang sesuai dengan filter pencarian pada tanggal & sesi ini.
          </div>
        ` : filteredCrew.map(item => {
          const w = item.worker;
          const count = item.tripCount;
          
          let capacityBadge = '<span class="badge" style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 700;">🟢 Siap Tugas (0/2)</span>';
          if (item.availability === 'busy') {
            capacityBadge = `<span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700;">🟡 Sedang Tugas (${count}/2)</span>`;
          } else if (item.availability === 'full') {
            capacityBadge = `<span class="badge" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; font-weight: 700;">🔴 Penuh (${count}/2 - Terkunci)</span>`;
          }

          const roleLabels = {
            driver_jeep: { label: 'Driver Jeep', color: '#ea580c', icon: Icons.truck(14, '#ea580c') },
            driver_lapangan: { label: 'Driver Shuttle', color: '#0284c7', icon: Icons.car(14, '#0284c7') },
            photographer: { label: 'Fotografer', color: '#7c3aed', icon: Icons.camera(14, '#7c3aed') }
          };
          const rInfo = roleLabels[w.role] || { label: w.role, color: '#64748b', icon: '' };

          const waUrl = createWhatsAppUrl(w.phone, `Halo ${w.name}, terkait jadwal operasional trip Panorama Bromo tanggal ${formatDate(targetDate)}:`);

          return `
            <div class="metric-card" style="display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <!-- Top Card Bar -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="width: 38px; height: 38px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: ${rInfo.color}; flex-shrink: 0;">
                      ${rInfo.icon || Icons.user(18, rInfo.color)}
                    </div>
                    <div>
                      <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${w.name}</div>
                      <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: ${rInfo.color}; font-weight: 700;">
                        ${rInfo.icon} <span>${rInfo.label}</span> &bull; <span class="badge ${w.type === 'internal' ? 'badge-internal' : 'badge-external'}">${w.type.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div>${capacityBadge}</div>
                </div>

                <!-- Info Kru -->
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-glass); font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 3px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span>Unit Armada:</span>
                    <strong style="color: #0f172a;">${w.vehicleUnit || 'Kru Operasional'}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Kontak WhatsApp:</span>
                    <a href="${waUrl}" target="_blank" style="color: #059669; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                      ${Icons.phone(12, '#059669')} <span>${w.phone}</span>
                    </a>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Tarif Honor / Trip:</span>
                    <strong style="color: #0f172a;">${formatIDR(w.baseRatePerTrip)}</strong>
                  </div>
                </div>

                <!-- Jadwal Trip Aktif pada Tanggal Ini -->
                <div style="margin-top: 10px; background: #f8fafc; border-radius: 8px; padding: 10px; font-size: 11px; border: 1px solid #e2e8f0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-weight: 800; color: #0f172a;">Trip pada ${formatDate(targetDate)}:</span>
                    <span style="font-weight: 700; color: ${item.availability === 'full' ? '#dc2626' : (item.availability === 'busy' ? '#d97706' : '#059669')};">
                      ${count} / 2 Kuota Terpakai
                    </span>
                  </div>

                  ${item.activeTrips.length === 0 ? `
                    <div style="color: #94a3b8; font-style: italic; padding: 4px 0;">
                      Tidak ada penugasan trip pada tanggal & sesi ini (Standby / Siap jalan).
                    </div>
                  ` : item.activeTrips.map(t => `
                    <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 6px; padding: 6px 8px; margin-bottom: 4px; display: flex; flex-direction: column; gap: 2px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #0284c7;">${t.code}</strong>
                        <span style="font-size: 10px; color: #64748b; font-weight: 600;">${t.timeSlot}</span>
                      </div>
                      <div style="color: #334155; font-weight: 600;">
                        Tamu: ${t.guestName} (${t.guestCount} Pax)
                      </div>
                      <div style="color: #64748b; font-size: 10px;">
                        ${t.tourPackage}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Footer Stats Karir -->
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
                <span>Total Riwayat Trip:</span>
                <strong style="color: #0f172a;">${item.totalTrips} Trip Terjadwal</strong>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },
  // 2C. ADMIN PNL
  renderAdminPnlTab() {
    const pnl = AppState.pnl;
    if (!pnl) {
      return '<div style="text-align: center; padding: 40px; color: #64748b;">Memuat data laba & rugi...</div>';
    }

    return `
      <div style="margin-bottom: 12px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0f172a;">Laporan Laba & Rugi (Profit & Loss)</h2>
        <p style="font-size: 12px; color: #64748b;">Perhitungan real-time pendapatan kotor, biaya armada kru, dan margin profitabilitas.</p>
      </div>

      <div class="metrics-grid admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-title">Pendapatan Kontrak</div>
          <div class="metric-value" style="color: #059669;">${formatIDR(pnl.grossRevenue)}</div>
          <div class="metric-sub">${pnl.totalTrips} Trip Aktif Berjalan</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Realisasi Kas Masuk</div>
          <div class="metric-value" style="color: #059669;">${formatIDR(pnl.cashCollected || 0)}</div>
          <div class="metric-sub">Pelunasan + DP di Kas</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Sisa Piutang Tertunda</div>
          <div class="metric-value" style="color: #dc2626;">${formatIDR(pnl.outstandingReceivables || 0)}</div>
          <div class="metric-sub">Belum Ditagihkan / Dilunasi</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total Beban Operasional</div>
          <div class="metric-value" style="color: #dc2626;">${formatIDR(pnl.totalExpenses)}</div>
          <div class="metric-sub">Honor Kru & Pengeluaran Lapangan</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Laba Bersih Kontrak</div>
          <div class="metric-value" style="color: #2563eb;">${formatIDR(pnl.netProfit)}</div>
          <div class="metric-sub">Margin Kontrak: <strong>${pnl.profitMarginPercent}%</strong></div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Arus Kas Bersih Riil</div>
          <div class="metric-value" style="color: ${(pnl.realizedNetCash || 0) >= 0 ? '#15803d' : '#b91c1c'};">${formatIDR(pnl.realizedNetCash || 0)}</div>
          <div class="metric-sub">Kas Masuk - Beban Ops</div>
        </div>
      </div>

      <!-- Breakdown Table -->
      <div class="metric-card" style="margin-top: 14px;">
        <div style="font-weight: 800; font-size: 15px; margin-bottom: 12px; color: #0f172a;">Rincian Pengeluaran Operasional</div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Komponen Biaya</th>
                <th>Armada Internal</th>
                <th>Mitra Luar / Sewa</th>
                <th>Total Biaya</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Armada Driver Jeep</strong></td>
                <td>${formatIDR(pnl.jeepCosts?.internal)}</td>
                <td>${formatIDR(pnl.jeepCosts?.external)}</td>
                <td style="font-weight: 700; color: #ea580c;">${formatIDR(pnl.jeepCosts?.total)}</td>
              </tr>
              <tr>
                <td><strong>Driver Lapangan / Shuttle</strong></td>
                <td>${formatIDR(pnl.fieldDriverCosts?.internal)}</td>
                <td>${formatIDR(pnl.fieldDriverCosts?.external)}</td>
                <td style="font-weight: 700; color: #0284c7;">${formatIDR(pnl.fieldDriverCosts?.total)}</td>
              </tr>
              <tr>
                <td><strong>Dokumentasi Fotografer</strong></td>
                <td>${formatIDR(pnl.photographerCosts?.internal)}</td>
                <td>${formatIDR(pnl.photographerCosts?.external)}</td>
                <td style="font-weight: 700; color: #7c3aed;">${formatIDR(pnl.photographerCosts?.total)}</td>
              </tr>
              <tr>
                <td><strong>Biaya Langsung (Tiket TNBTS, BBM, Retribusi)</strong></td>
                <td colspan="2" style="color: #64748b;">Biaya Masuk Objek & Logistik</td>
                <td style="font-weight: 700; color: #d97706;">${formatIDR(pnl.operationalCosts)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800;">
                <td colspan="3">TOTAL PENGELUARAN</td>
                <td style="color: #dc2626; font-size: 15px;">${formatIDR(pnl.totalExpenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  // 2D. ADMIN AGENCIES & BILLING
  renderAdminAgenciesTab() {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h2 style="font-size: 16px; font-weight: 800; color: #0f172a;">Mitra Agen Travel & Rekap Tagihan</h2>
          <p style="font-size: 12px; color: #64748b;">Kelola rekanan agen B2B dan cetak invoice penagihan resmi.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px;">
        ${AppState.agencies.map(a => {
          const agencyTrips = AppState.trips.filter(t => t.agencyId === a.id && t.tripStatus !== 'cancelled');
          const totalAmount = agencyTrips.reduce((s, t) => s + (t.packagePrice || 0), 0);
          const totalDeposit = agencyTrips.reduce((s, t) => s + (t.depositAmount || 0), 0);
          const totalRemaining = agencyTrips.reduce((s, t) => s + (t.remainingBalance ?? Math.max(0, (t.packagePrice || 0) - (t.depositAmount || 0))), 0);
          
          const paidCount = agencyTrips.filter(t => t.agencyPaymentStatus === 'paid').length;
          const depositCount = agencyTrips.filter(t => t.agencyPaymentStatus === 'deposit').length;
          const unpaidCount = agencyTrips.filter(t => t.agencyPaymentStatus === 'unpaid').length;

          return `
            <div class="metric-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">${a.code}</span>
                  <div style="font-weight: 800; font-size: 15px; color: #0f172a; margin-top: 4px;">${a.name}</div>
                </div>
                <div style="font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;">
                  Mitra Resmi B2B
                </div>
              </div>

              <div style="margin-top: 10px; font-size: 12px; color: #475569;">
                <div>PIC: <strong>${a.contactPerson || '-'}</strong> (${a.phone})</div>
                <div>Alamat: <strong>${a.address || '-'}</strong></div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; background: #f8fafc; padding: 8px 10px; border-radius: 8px; font-size: 11px;">
                <div>
                  <span style="color: #64748b;">Total Kontrak:</span><br>
                  <strong style="color: #0f172a;">${formatIDR(totalAmount)}</strong>
                </div>
                <div>
                  <span style="color: #64748b;">DP / Terbayar:</span><br>
                  <strong style="color: #059669;">${formatIDR(totalDeposit)}</strong>
                </div>
                <div style="grid-column: 1 / -1; border-top: 1px dashed #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #dc2626; font-weight: 700;">Sisa Tagihan / Piutang:</span>
                  <strong style="color: #dc2626; font-size: 13px;">${formatIDR(totalRemaining)}</strong>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-glass);">
                <div style="font-size: 11px; color: #64748b;">
                  ${agencyTrips.length} Trip (${paidCount} Lunas &bull; ${depositCount} DP &bull; ${unpaidCount} Belum)
                </div>

                <button class="btn btn-outline btn-sm" onclick="App.openInvoiceModal('${a.id}')">
                  ${Icons.printer(14)}
                  <span>Buat Invoice</span>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // 2E. ADMIN PAYROLL
  renderAdminPayrollTab() {
    const payroll = AppState.payroll;

    return `
      <div style="margin-bottom: 12px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0f172a;">Rekapitulasi Honor & Payroll Kru</h2>
        <p style="font-size: 12px; color: #64748b;">Kelola pelunasan gaji driver jeep, shuttle lapangan, dan fotografer.</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${payroll.map(p => `
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; background: #f0f9ff; border: 1px solid #bae6fd; display: flex; align-items: center; justify-content: center; color: #0284c7; flex-shrink: 0;">
                  ${Icons.user(18, '#0284c7')}
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${p.worker.name}</div>
                  <div style="font-size: 11px; color: #64748b;">${p.worker.role} &bull; ${p.totalTripsCount} Trip &bull; ${p.totalDaysWorked} Hari Kerja</div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; text-align: right;">
                <div>
                  <div style="font-size: 10px; color: #15803d; font-weight: 700;">TERBAYAR</div>
                  <div style="font-weight: 800; font-size: 13px; color: #15803d;">${formatIDR(p.paidEarnings)}</div>
                </div>
                <div>
                  <div style="font-size: 10px; color: #dc2626; font-weight: 700;">TERTUNDA</div>
                  <div style="font-weight: 800; font-size: 13px; color: #dc2626;">${formatIDR(p.pendingEarnings)}</div>
                </div>
                <div>
                  <div style="font-size: 10px; color: #64748b; font-weight: 700;">TOTAL HONOR</div>
                  <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${formatIDR(p.totalEarnings)}</div>
                </div>
              </div>
            </div>

            <!-- List trips for this worker -->
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-glass);">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px;">Daftar Trip yang Ditugaskan:</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${p.trips.map(t => {
                  let fee = 0;
                  let pStatus = 'unpaid';
                  if (p.worker.role === 'driver_jeep') { fee = t.jeepFee; pStatus = t.jeepPayrollStatus; }
                  else if (p.worker.role === 'driver_lapangan') { fee = t.fieldDriverFee; pStatus = t.fieldPayrollStatus; }
                  else if (p.worker.role === 'photographer') { fee = t.photographerFee; pStatus = t.photographerPayrollStatus; }

                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
                      <div>
                        <strong>${t.code}</strong> &bull; ${formatDate(t.date)} (${t.guestName})
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 700; color: #0f172a;">${formatIDR(fee)}</span>
                        ${pStatus === 'paid' ? 
                          '<span class="badge pay-paid">Lunas</span>' : 
                          `<button class="btn btn-primary btn-sm" onclick="App.markPaid('${t.id}', '${p.worker.role}')">Tandai Lunas</button>`
                        }
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // 3. DRIVER JEEP VIEW
  renderDriverJeepView() {
    const u = AppState.currentUser;
    const today = new Date().toISOString().slice(0, 10);
    const trips = AppState.trips;
    const todayTrips = trips.filter(t => t.date === today);
    const displayTrips = AppState.crewTab === 'today' ? todayTrips : trips;

    // Honor summary
    const totalEarned = trips.reduce((s, t) => s + (t.jeepFee || 0), 0);
    const pendingEarned = trips.filter(t => t.jeepPayrollStatus === 'unpaid').reduce((s, t) => s + (t.jeepFee || 0), 0);

    return `
      <div class="metric-card" style="background: #fff7ed; border-color: #fed7aa;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${Icons.truck(18, '#ea580c')}
              <span style="font-size: 11px; font-weight: 800; color: #c2410c; text-transform: uppercase;">PORTAL DRIVER JEEP</span>
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${u.name}</div>
            <div style="font-size: 12px; color: #475569;">Unit Armada: <strong>${u.vehicleUnit || 'Armada Jeep'}</strong></div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${u.type === 'internal' ? 'badge-internal' : 'badge-external'}">Armada ${u.type.toUpperCase()}</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600;">Tarif: ${formatIDR(u.baseRatePerTrip)} / trip</div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Total Perjalanan</div>
          <div class="metric-value">${trips.length} Trip</div>
          <div class="metric-sub">${todayTrips.length} trip hari ini</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Honor Pending</div>
          <div class="metric-value" style="color: #ea580c; font-size: 17px;">${formatIDR(pendingEarned)}</div>
          <div class="metric-sub">Total: ${formatIDR(totalEarned)}</div>
        </div>
      </div>

      <!-- Tab filter -->
      <div class="segmented-nav">
        <button class="segmented-btn ${AppState.crewTab === 'today' ? 'active' : ''}" onclick="App.switchCrewTab('today')">
          ${Icons.calendar(14)} <span>Jadwal Hari Ini (${todayTrips.length})</span>
        </button>
        <button class="segmented-btn ${AppState.crewTab === 'all' ? 'active' : ''}" onclick="App.switchCrewTab('all')">
          ${Icons.clock(14)} <span>Semua Riwayat Trip (${trips.length})</span>
        </button>
      </div>

      <!-- Trips List -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${displayTrips.length === 0 ? `
          <div style="text-align: center; padding: 40px; background: #ffffff; border: 1px dashed var(--border-glass); border-radius: 16px; color: #64748b;">
            <p>Tidak ada jadwal perjalanan jeep untuk ditampilkan.</p>
          </div>
        ` : displayTrips.map(t => this.renderCrewTripCard(t, 'driver_jeep')).join('')}
      </div>
    `;
  },

  // 4. DRIVER LAPANGAN VIEW
  renderDriverLapanganView() {
    const u = AppState.currentUser;
    const today = new Date().toISOString().slice(0, 10);
    const trips = AppState.trips;
    const todayTrips = trips.filter(t => t.date === today);
    const displayTrips = AppState.crewTab === 'today' ? todayTrips : trips;

    const totalEarned = trips.reduce((s, t) => s + (t.fieldDriverFee || 0), 0);
    const pendingEarned = trips.filter(t => t.fieldPayrollStatus === 'unpaid').reduce((s, t) => s + (t.fieldDriverFee || 0), 0);

    return `
      <div class="metric-card" style="background: #f0f9ff; border-color: #bae6fd;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${Icons.car(18, '#0284c7')}
              <span style="font-size: 11px; font-weight: 800; color: #0369a1; text-transform: uppercase;">PORTAL DRIVER SHUTTLE / LAPANGAN</span>
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${u.name}</div>
            <div style="font-size: 12px; color: #475569;">Armada: <strong>${u.vehicleUnit || 'Unit Shuttle'}</strong></div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${u.type === 'internal' ? 'badge-internal' : 'badge-external'}">${u.type.toUpperCase()}</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600;">Tarif: ${formatIDR(u.baseRatePerTrip)} / trip</div>
          </div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Total Penjemputan</div>
          <div class="metric-value">${trips.length} Trip</div>
          <div class="metric-sub">${todayTrips.length} hari ini</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Honor Pending</div>
          <div class="metric-value" style="color: #0284c7; font-size: 17px;">${formatIDR(pendingEarned)}</div>
          <div class="metric-sub">Total: ${formatIDR(totalEarned)}</div>
        </div>
      </div>

      <div class="segmented-nav">
        <button class="segmented-btn ${AppState.crewTab === 'today' ? 'active' : ''}" onclick="App.switchCrewTab('today')">
          ${Icons.calendar(14)} <span>Jadwal Hari Ini (${todayTrips.length})</span>
        </button>
        <button class="segmented-btn ${AppState.crewTab === 'all' ? 'active' : ''}" onclick="App.switchCrewTab('all')">
          ${Icons.clock(14)} <span>Semua Riwayat (${trips.length})</span>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${displayTrips.length === 0 ? `
          <div style="text-align: center; padding: 40px; background: #ffffff; border: 1px dashed var(--border-glass); border-radius: 16px; color: #64748b;">
            <p>Tidak ada penjemputan shuttle yang ditugaskan.</p>
          </div>
        ` : displayTrips.map(t => this.renderCrewTripCard(t, 'driver_lapangan')).join('')}
      </div>
    `;
  },

  // 5. PHOTOGRAPHER VIEW
  renderPhotographerView() {
    const u = AppState.currentUser;
    const today = new Date().toISOString().slice(0, 10);
    const trips = AppState.trips;
    const todayTrips = trips.filter(t => t.date === today);
    const displayTrips = AppState.crewTab === 'today' ? todayTrips : trips;

    const totalEarned = trips.reduce((s, t) => s + (t.photographerFee || 0), 0);
    const pendingEarned = trips.filter(t => t.photographerPayrollStatus === 'unpaid').reduce((s, t) => s + (t.photographerFee || 0), 0);

    return `
      <div class="metric-card" style="background: #faf5ff; border-color: #e9d5ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${Icons.camera(18, '#7c3aed')}
              <span style="font-size: 11px; font-weight: 800; color: #6d28d9; text-transform: uppercase;">PORTAL FOTOGRAFER DOKUMENTASI</span>
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${u.name}</div>
            <div style="font-size: 12px; color: #475569;">Gear Kit: <strong>${u.vehicleUnit || 'Kamera & Drone Kit'}</strong></div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${u.type === 'internal' ? 'badge-internal' : 'badge-external'}">${u.type.toUpperCase()}</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600;">Tarif: ${formatIDR(u.baseRatePerTrip)} / trip</div>
          </div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Sesi Dokumentasi</div>
          <div class="metric-value">${trips.length} Trip</div>
          <div class="metric-sub">${todayTrips.length} hari ini</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Honor Pending</div>
          <div class="metric-value" style="color: #7c3aed; font-size: 17px;">${formatIDR(pendingEarned)}</div>
          <div class="metric-sub">Total: ${formatIDR(totalEarned)}</div>
        </div>
      </div>

      <div class="segmented-nav">
        <button class="segmented-btn ${AppState.crewTab === 'today' ? 'active' : ''}" onclick="App.switchCrewTab('today')">
          ${Icons.calendar(14)} <span>Jadwal Hari Ini (${todayTrips.length})</span>
        </button>
        <button class="segmented-btn ${AppState.crewTab === 'all' ? 'active' : ''}" onclick="App.switchCrewTab('all')">
          ${Icons.clock(14)} <span>Semua Riwayat (${trips.length})</span>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${displayTrips.length === 0 ? `
          <div style="text-align: center; padding: 40px; background: #ffffff; border: 1px dashed var(--border-glass); border-radius: 16px; color: #64748b;">
            <p>Tidak ada jadwal dokumentasi yang ditugaskan.</p>
          </div>
        ` : displayTrips.map(t => this.renderCrewTripCard(t, 'photographer')).join('')}
      </div>
    `;
  },

  renderCrewTripCard(t, role) {
    const waUrl = createWhatsAppUrl(t.guestPhone, generateGuestGreeting(t.guestName, t.code, t.timeSlot, t.tourPackage, t.pickupPoint));

    let fee = 0;
    let pStatus = 'unpaid';
    if (role === 'driver_jeep') { fee = t.jeepFee; pStatus = t.jeepPayrollStatus; }
    else if (role === 'driver_lapangan') { fee = t.fieldDriverFee; pStatus = t.fieldPayrollStatus; }
    else if (role === 'photographer') { fee = t.photographerFee; pStatus = t.photographerPayrollStatus; }

    const statusMap = {
      scheduled: 'Terjadwal',
      in_progress: 'Berlangsung',
      completed: 'Selesai',
      cancelled: 'Dibatalkan'
    };

    return `
      <div class="trip-card">
        <div class="trip-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="trip-code">${t.code}</span>
              <span class="status-badge status-${t.tripStatus}">${statusMap[t.tripStatus] || t.tripStatus}</span>
            </div>
            <div class="trip-package" style="margin-top: 2px;">${t.tourPackage}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${formatIDR(fee)}</div>
            <span class="badge ${pStatus === 'paid' ? 'pay-paid' : 'pay-unpaid'}">${pStatus === 'paid' ? 'Lunas' : 'Belum Bayar'}</span>
          </div>
        </div>

        <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${t.guestName} (${t.guestCount} Tamu)</div>

        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569;">
          <div class="trip-info-row">${Icons.calendar(14, '#64748b')} <span>${formatDate(t.date)} &bull; <strong>${t.timeSlot}</strong></span></div>
          <div class="trip-info-row">${Icons.mapPin(14, '#64748b')} <span>Penjemputan: <strong>${t.pickupPoint}</strong></span></div>
          ${t.notes ? `<div style="background: #fffbeb; padding: 6px 10px; border-radius: 6px; color: #b45309; font-size: 11px; margin-top: 4px;">Catatan: ${t.notes}</div>` : ''}
        </div>

        ${role === 'photographer' ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-glass);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b;">Tautan Album Google Drive / Cloud:</span>
              ${t.photoAlbumUrl ? `<a href="${t.photoAlbumUrl}" target="_blank" class="btn btn-outline btn-sm" style="padding: 2px 6px;">${Icons.externalLink(12)} Buka</a>` : ''}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <input type="url" id="photo-url-${t.id}" class="form-input btn-sm" placeholder="https://drive.google.com/..." value="${t.photoAlbumUrl || ''}" />
              <button class="btn btn-primary btn-sm" onclick="App.savePhotoUrl('${t.id}')">Simpan</button>
            </div>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--border-glass);">
          <a href="${waUrl}" target="_blank" class="btn btn-outline btn-sm" style="color: #15803d; border-color: #bbf7d0; background: #f0fdf4;">
            ${Icons.phone(13, '#15803d')}
            <span>WhatsApp Tamu</span>
          </a>

          <button class="btn btn-outline btn-sm" onclick="App.openTripDetailModal('${t.id}')">
            ${Icons.eye(13)}
            <span>Detail & Itinerary</span>
          </button>
        </div>
      </div>
    `;
  },

  // Event handlers & Modals
  bindAppEvents() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        requestConfirm({
          title: 'Keluar dari Akun?',
          message: 'Sesi akun Anda akan ditutup. Anda harus login kembali untuk mengakses data.',
          confirmLabel: 'Ya, Keluar',
          isDestructive: true,
          onConfirm: async () => {
            await API.logout();
            AppState.currentUser = null;
            AppState.isAuthenticated = false;
            showToast('info', 'Logout Berhasil', 'Anda telah keluar.');
            this.render();
          }
        });
      };
    }

    const searchInput = document.getElementById('admin-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        AppState.searchKeyword = e.target.value;
        this.render();
      };
    }

    const statusFilter = document.getElementById('admin-status-filter');
    if (statusFilter) {
      statusFilter.onchange = (e) => {
        AppState.statusFilter = e.target.value;
        this.render();
      };
    }
  },

  getCrewActiveTrips(workerId, date = null, timeSlot = null, excludeTripId = null) {
    return AppState.trips.filter(t => {
      if (excludeTripId && t.id === excludeTripId) return false;
      if (t.tripStatus === 'cancelled') return false;
      if (date && t.date !== date) return false;
      if (timeSlot && timeSlot !== 'all' && !isSameShift(t.timeSlot, timeSlot)) return false;
      return (
        t.jeepDriverId === workerId ||
        t.fieldDriverId === workerId ||
        t.photographerId === workerId
      );
    });
  },

  getCrewAvailability(workerId, date, timeSlot, excludeTripId = null) {
    const maxAllowed = 2;
    if (!workerId || !date) {
      return {
        count: 0,
        dailyCount: 0,
        shiftCount: 0,
        maxAllowed,
        isAvailable: true,
        status: 'available',
        badgeText: 'Siap (0/2 Hari Ini)',
        icon: '🟢',
        dailyTrips: [],
        shiftTrips: []
      };
    }

    // Semua trip aktif kru pada tanggal ini (total beban harian)
    const dailyTrips = AppState.trips.filter(t => {
      if (excludeTripId && t.id === excludeTripId) return false;
      if (t.tripStatus === 'cancelled') return false;
      if (t.date !== date) return false;
      return (
        t.jeepDriverId === workerId ||
        t.fieldDriverId === workerId ||
        t.photographerId === workerId
      );
    });
    const dailyCount = dailyTrips.length;

    // Trip pada shift / sesi waktu ini
    const shiftTrips = (timeSlot && timeSlot !== 'all')
      ? dailyTrips.filter(t => isSameShift(t.timeSlot, timeSlot))
      : dailyTrips;
    const shiftCount = shiftTrips.length;

    let status = 'available';
    let isAvailable = true;
    let icon = '🟢';
    let badgeText = 'Siap (0/2 Hari Ini)';

    if (dailyCount >= maxAllowed) {
      status = 'full';
      isAvailable = false;
      icon = '🔴';
      badgeText = `PENUH (${dailyCount}/2 Hari Ini - Terkunci)`;
    } else if (shiftCount >= 1) {
      status = 'busy';
      isAvailable = true;
      icon = '🟡';
      const slotName = shiftTrips[0]?.timeSlot?.split(' ')[0] || 'Sesi';
      badgeText = `1 Trip (Ada Jadwal ${slotName})`;
    } else if (dailyCount === 1) {
      status = 'busy';
      isAvailable = true;
      icon = '🟡';
      badgeText = '1 Trip Hari Ini';
    } else {
      status = 'available';
      isAvailable = true;
      icon = '🟢';
      badgeText = 'Siap (0/2 Hari Ini)';
    }

    return {
      count: dailyCount,
      dailyCount,
      shiftCount,
      maxAllowed,
      isAvailable,
      status,
      icon,
      badgeText,
      dailyTrips,
      shiftTrips
    };
  },

  setDailyDate(date) {
    AppState.dailyDate = date;
    this.render();
  },

  setCrewDate(date) {
    AppState.crewDate = date;
    this.render();
  },

  setCrewTimeSlot(slot) {
    AppState.crewTimeSlot = slot;
    this.render();
  },

  setCrewRole(role) {
    AppState.crewRole = role;
    this.render();
  },

  setCrewAvailability(avail) {
    AppState.crewAvailability = avail;
    this.render();
  },

  setCrewSearch(val) {
    AppState.crewSearch = val;
    this.render();
  },

  switchSubTab(tab) {
    AppState.activeSubTab = tab;
    this.render();
  },

  switchCrewTab(tab) {
    AppState.crewTab = tab;
    this.render();
  },

  async quickUpdateTripStatus(id, newStatus) {
    const res = await API.updateTrip(id, { tripStatus: newStatus });
    if (res.success) {
      showToast('success', 'Status Diperbarui', `Trip berstatus: ${newStatus}`);
      await this.loadInitialData();
      this.render();
    } else {
      showToast('error', 'Gagal Update', res.message);
    }
  },

  async quickUpdatePaymentStatus(id, newStatus, depositAmount = null) {
    const payload = { agencyPaymentStatus: newStatus };
    if (depositAmount !== null) {
      payload.depositAmount = depositAmount;
    }
    const res = await API.updateTrip(id, payload);
    if (res.success) {
      showToast('success', 'Status Pembayaran Diperbarui', `Status pembayaran: ${newStatus.toUpperCase()}`);
      await this.loadInitialData();
      this.render();
    } else {
      showToast('error', 'Gagal Update', res.message);
    }
  },

  async markPaid(tripId, role) {
    const res = await API.markPayrollPaid(tripId, role);
    if (res.success) {
      showToast('success', 'Honor Terbayar', 'Status honor berhasil diperbarui menjadi Lunas.');
      await this.loadInitialData();
      this.render();
    } else {
      showToast('error', 'Gagal', res.message);
    }
  },

  async savePhotoUrl(tripId) {
    const input = document.getElementById(`photo-url-${tripId}`);
    if (!input) return;
    const url = input.value.trim();
    if (url && !/^https?:\/\/.+/i.test(url)) {
      showToast('error', 'URL Tidak Valid', 'Format link harus diawali https:// (contoh: Google Drive).');
      return;
    }
    const res = await API.updatePhotoUrl(tripId, url);
    if (res.success) {
      showToast('success', 'Tautan Disimpan', 'Tautan album foto berhasil disimpan.');
      await this.loadInitialData();
      this.render();
    } else {
      showToast('error', 'Gagal Menyimpan', res.message);
    }
  },

  confirmDeleteTrip(id, code) {
    requestConfirm({
      title: `Hapus Trip ${code}?`,
      message: 'Perjalanan ini akan dihapus secara permanen dari database MySQL.',
      confirmLabel: 'Ya, Hapus',
      isDestructive: true,
      onConfirm: async () => {
        const res = await API.deleteTrip(id);
        if (res.success) {
          showToast('success', 'Trip Dihapus', `Trip ${code} berhasil dihapus.`);
          await this.loadInitialData();
          this.render();
        } else {
          showToast('error', 'Gagal Menghapus', res.message);
        }
      }
    });
  },

  async forceRefreshApp() {
    showToast('info', 'Memperbarui Aplikasi', 'Membersihkan cache browser & memuat versi terbaru...');
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      }
    } catch (e) {
      console.warn('Cache purge warning:', e);
    }
    setTimeout(() => {
      window.location.reload();
    }, 600);
  },

  // Modals Implementation
  openTripDetailModal(tripId) {
    const trip = AppState.trips.find(t => t.id === tripId);
    if (!trip) return;

    const modalRoot = document.getElementById('modal-root');
    const isAdmin = AppState.currentUser.role === 'admin';

    // Cari data kru yang ditugaskan
    const jeepWorker = AppState.workers.find(w => w.id === trip.jeepDriverId);
    const fieldWorker = AppState.workers.find(w => w.id === trip.fieldDriverId);
    const photoWorker = AppState.workers.find(w => w.id === trip.photographerId);

    // Hitung profit trip jika admin
    const revenue = trip.packagePrice || 0;
    const directCost = trip.operationalCost || 0;
    const crewCost = (trip.jeepFee || 0) + (trip.fieldDriverFee || 0) + (trip.photographerFee || 0) + (trip.guideFee || 0);
    const totalExpenses = directCost + crewCost;
    const netProfit = revenue - totalExpenses;
    const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <div>
              <div style="font-weight: 800; font-size: 17px; color: #0f172a;">${trip.code}</div>
              <div style="font-size: 12px; color: #059669; font-weight: 700;">${trip.tourPackage}</div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="closeModal()">${Icons.x(16)}</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Tamu & Jadwal -->
            <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 10px; padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
              <div>Tamu Pemesan: <strong style="color: #0f172a;">${trip.guestName} (${trip.guestCount} Pax)</strong></div>
              <div>No. WhatsApp: <a href="${createWhatsAppUrl(trip.guestPhone, generateGuestGreeting(trip.guestName, trip.code, trip.timeSlot, trip.tourPackage, trip.pickupPoint))}" target="_blank" style="color: #0284c7; font-weight: 700; text-decoration: none;">${trip.guestPhone}</a></div>
              <div>Tanggal Operasional: <strong style="color: #0f172a;">${formatDate(trip.date)}</strong></div>
              <div>Slot Waktu: <strong style="color: #0f172a;">${trip.timeSlot}</strong></div>
              <div style="grid-column: 1 / -1;">Titik Penjemputan: <strong style="color: #0f172a;">${trip.pickupPoint}</strong></div>
              ${trip.agencyName ? `<div>Mitra Agen: <strong>${trip.agencyName}</strong></div>` : ''}
              <div>Status Trip: <span class="badge ${trip.tripStatus === 'completed' ? 'pay-paid' : 'pay-pending'}">${trip.tripStatus.toUpperCase()}</span></div>
              ${trip.notes ? `<div style="grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fef3c7; padding: 6px 10px; border-radius: 6px; color: #b45309;">📝 Catatan: ${trip.notes}</div>` : ''}
            </div>

            <!-- Kru Operasional & Armada Detail -->
            <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 10px; padding: 12px;">
              <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                ${Icons.users(15, '#0284c7')} <span>Kru Operasional & Armada yang Ditugaskan:</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                <!-- Driver Jeep -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px;">
                  <div>
                    <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                      <span>🚙 Driver Jeep: ${trip.jeepDriverName || 'Belum Ditugaskan'}</span>
                      <span class="badge ${trip.jeepStatus === 'internal' ? 'badge-internal' : 'badge-external'}" style="font-size: 9px;">${(trip.jeepStatus || 'INTERNAL').toUpperCase()}</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Unit: <strong>${trip.jeepUnit || 'Toyota Hardtop 4x4'}</strong> ${jeepWorker?.phone ? `&bull; WA: <a href="${createWhatsAppUrl(jeepWorker.phone, '')}" target="_blank" style="color: #059669;">${jeepWorker.phone}</a>` : ''}
                    </div>
                  </div>
                  ${isAdmin ? `
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: #0f172a;">${formatIDR(trip.jeepFee)}</div>
                      <span class="badge ${trip.jeepPayrollStatus === 'paid' ? 'pay-paid' : 'pay-pending'}" style="font-size: 9px;">${trip.jeepPayrollStatus === 'paid' ? 'LUNAS' : 'PENDING'}</span>
                    </div>
                  ` : ''}
                </div>

                <!-- Driver Shuttle -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px;">
                  <div>
                    <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                      <span>🚐 Driver Shuttle: ${trip.fieldDriverName || 'Belum Ditugaskan'}</span>
                      <span class="badge ${trip.fieldDriverStatus === 'internal' ? 'badge-internal' : 'badge-external'}" style="font-size: 9px;">${(trip.fieldDriverStatus || 'INTERNAL').toUpperCase()}</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Unit: <strong>${trip.fieldDriverUnit || 'HiAce / Shuttle'}</strong> ${fieldWorker?.phone ? `&bull; WA: <a href="${createWhatsAppUrl(fieldWorker.phone, '')}" target="_blank" style="color: #059669;">${fieldWorker.phone}</a>` : ''}
                    </div>
                    ${(() => {
                      const dayDrivers = {};
                      (trip.itinerary || []).forEach(it => {
                        if (it.dayFieldDriverName) {
                          dayDrivers[it.day || 1] = `${it.dayFieldDriverName} (${it.dayFieldDriverUnit || 'Shuttle'})`;
                        }
                      });
                      const dayKeys = Object.keys(dayDrivers);
                      if (dayKeys.length > 1) {
                        return `<div style="font-size: 10px; color: #0284c7; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
                          <strong>Plotting Harian:</strong> ${dayKeys.map(d => `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 9px;">Hari ${d}: ${dayDrivers[d]}</span>`).join(' ')}
                        </div>`;
                      }
                      return '';
                    })()}
                  </div>
                  ${isAdmin ? `
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: #0f172a;">${formatIDR(trip.fieldDriverFee)}</div>
                      <span class="badge ${trip.fieldPayrollStatus === 'paid' ? 'pay-paid' : 'pay-pending'}" style="font-size: 9px;">${trip.fieldPayrollStatus === 'paid' ? 'LUNAS' : 'PENDING'}</span>
                    </div>
                  ` : ''}
                </div>

                <!-- Fotografer -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px;">
                  <div>
                    <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                      <span>📷 Fotografer: ${trip.photographerName || 'Belum Ditugaskan'}</span>
                      <span class="badge ${trip.photographerStatus === 'internal' ? 'badge-internal' : 'badge-external'}" style="font-size: 9px;">${(trip.photographerStatus || 'INTERNAL').toUpperCase()}</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Kamera Kit ${photoWorker?.phone ? `&bull; WA: <a href="${createWhatsAppUrl(photoWorker.phone, '')}" target="_blank" style="color: #059669;">${photoWorker.phone}</a>` : ''}
                    </div>
                  </div>
                  ${isAdmin ? `
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: #0f172a;">${formatIDR(trip.photographerFee)}</div>
                      <span class="badge ${trip.photographerPayrollStatus === 'paid' ? 'pay-paid' : 'pay-pending'}" style="font-size: 9px;">${trip.photographerPayrollStatus === 'paid' ? 'LUNAS' : 'PENDING'}</span>
                    </div>
                  ` : ''}
                </div>

                <!-- Tour Guide (Opsional) -->
                ${trip.guideName ? (() => {
                  const guideWorker = AppState.workers.find(w => w.name === trip.guideName || (w.role === 'guide' && w.name.toLowerCase().includes(trip.guideName.toLowerCase())));
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px;">
                      <div>
                        <div style="font-weight: 700; color: #065f46; display: flex; align-items: center; gap: 6px;">
                          <span>🧭 Tour Guide: ${trip.guideName}</span>
                          <span class="badge badge-guide" style="font-size: 9px;">GUIDE</span>
                        </div>
                        <div style="font-size: 11px; color: #047857; margin-top: 2px;">
                          Pemandu Wisata ${guideWorker?.phone ? `&bull; WA: <a href="${createWhatsAppUrl(guideWorker.phone, '')}" target="_blank" style="color: #047857; font-weight: 700;">${guideWorker.phone}</a>` : ''}
                        </div>
                      </div>
                      ${isAdmin ? `
                        <div style="text-align: right;">
                          <div style="font-weight: 700; color: #065f46;">${formatIDR(trip.guideFee || 0)}</div>
                          <span class="badge ${trip.guidePayrollStatus === 'paid' ? 'pay-paid' : 'pay-pending'}" style="font-size: 9px;">${trip.guidePayrollStatus === 'paid' ? 'LUNAS' : 'PENDING'}</span>
                        </div>
                      ` : ''}
                    </div>
                  `;
                })() : ''}
              </div>
            </div>

            ${isAdmin ? `
              <!-- Ringkasan Finansial PnL Trip (Admin Only) -->
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-weight: 800; color: #166534; text-transform: uppercase;">Ringkasan Finansial & Tagihan:</span>
                  <span class="badge pay-${trip.agencyPaymentStatus}">${trip.agencyPaymentStatus === 'paid' ? 'LUNAS' : (trip.agencyPaymentStatus === 'deposit' ? 'DP / DEPOSIT' : 'BELUM BAYAR')}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px;">
                  <div>Harga Jual: <strong style="color: #0f172a;">${formatIDR(revenue)}</strong></div>
                  <div>Kas Masuk: <strong style="color: #059669;">${formatIDR(trip.depositAmount || 0)}</strong></div>
                  <div>Sisa Piutang: <strong style="color: ${(trip.remainingBalance || 0) > 0 ? '#dc2626' : '#059669'};">${formatIDR(trip.remainingBalance || 0)}</strong></div>
                  <div>Tiket & Ops: <strong style="color: #dc2626;">-${formatIDR(directCost)}</strong></div>
                  <div>Beban Kru: <strong style="color: #ea580c;">-${formatIDR(crewCost)}</strong></div>
                  <div>Laba Bersih: <strong style="color: #15803d; font-size: 12px;">${formatIDR(netProfit)}</strong> (${marginPct}%)</div>
                </div>
              </div>
            ` : ''}

            <!-- Itinerary Stops Grouped by Day -->
            <div>
              <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>Rute & Aktivitas Kunjungan (Itinerary):</span>
                <span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 11px;">${(trip.itinerary || []).length} Kegiatan</span>
              </div>
              <div>
                ${(() => {
                  if (!trip.itinerary || trip.itinerary.length === 0) {
                    return '<div style="color: #94a3b8; font-size: 12px; font-style: italic; padding: 8px 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px;">Tidak ada rincian aktivitas khusus.</div>';
                  }
                  const dayMap = {};
                  trip.itinerary.forEach((s, idx) => {
                    const dayNum = s.day || 1;
                    if (!dayMap[dayNum]) {
                      dayMap[dayNum] = {
                        day: dayNum,
                        title: s.dayTitle || `Hari ${dayNum}`,
                        items: []
                      };
                    }
                    dayMap[dayNum].items.push({ ...s, originalIdx: idx + 1 });
                  });

                  return Object.values(dayMap).map(grp => `
                    <div class="day-group-card">
                      <div class="day-group-header">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                          <span>📅 ${grp.title}</span>
                          ${grp.items[0]?.dayFieldDriverName ? `
                            <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 700;">🚐 Driver: ${grp.items[0].dayFieldDriverName}</span>
                          ` : ''}
                        </div>
                        <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 10px;">${grp.items.length} Kegiatan</span>
                      </div>
                      <div style="padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;">
                        ${grp.items.map((s, itemIdx) => `
                          <div style="display: flex; gap: 8px; padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
                            <div style="font-weight: 800; color: #059669; width: 18px;">${itemIdx + 1}.</div>
                            <div style="flex: 1;">
                              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; flex-wrap: wrap;">
                                <strong style="color: #0f172a; font-size: 12px;">${s.title}</strong>
                                ${s.time ? `<span class="badge" style="background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700;">⏰ ${s.time}</span>` : ''}
                              </div>
                              ${s.operationalDesc ? `<div style="color: #475569; font-size: 11px; margin-top: 2px;">🔧 <em>Operasional:</em> ${s.operationalDesc}</div>` : ''}
                              ${s.notes ? `<div style="color: #64748b; font-size: 11px; margin-top: 2px;">📝 <strong>Catatan:</strong> ${s.notes}</div>` : ''}
                              ${isAdmin ? `
                                <div style="display: flex; gap: 10px; margin-top: 4px; font-size: 10px; color: #64748b; flex-wrap: wrap; background: #ffffff; padding: 3px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                  <span>Ops: <strong style="color: #dc2626;">${formatIDR(s.operationalCost || 0)}</strong></span>
                                  <span>Tiket: <strong style="color: #ea580c;">${formatIDR(s.ticketCost || 0)}</strong></span>
                                  <span>Hotel: <strong style="color: #7c3aed;">${formatIDR(s.hotelCost || 0)}</strong></span>
                                </div>
                              ` : ''}
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `).join('');
                })()}
              </div>
            </div>

            ${trip.photoAlbumUrl ? `
              <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 12px;">
                <div style="font-weight: 700; font-size: 12px; color: #6d28d9; margin-bottom: 4px;">Tautan Album Google Drive / Cloud:</div>
                <a href="${trip.photoAlbumUrl}" target="_blank" style="color: #0284c7; font-size: 12px; word-break: break-all;">${trip.photoAlbumUrl}</a>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
            ${isAdmin && trip.tripStatus !== 'cancelled' ? `
              <button class="btn btn-danger" onclick="App.cancelTripPrompt('${trip.id}', '${trip.code}')">
                Batalkan Trip
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },
  cancelTripPrompt(tripId, code) {
    closeModal();
    requestConfirm({
      title: `Batalkan Trip ${code}?`,
      message: 'Masukkan alasan pembatalan perjalanan ini:',
      confirmLabel: 'Ya, Batalkan',
      isDestructive: true,
      requiresInput: true,
      inputPlaceholder: 'Contoh: Tamu reschedule / cuaca ekstrem',
      onConfirm: async (reason) => {
        if (!reason || !reason.trim()) {
          showToast('error', 'Gagal', 'Alasan pembatalan wajib diisi.');
          return;
        }
        const res = await API.cancelTrip(tripId, reason.trim());
        if (res.success) {
          showToast('info', 'Trip Dibatalkan', `Trip ${code} telah dibatalkan.`);
          await this.loadInitialData();
          this.render();
        } else {
          showToast('error', 'Gagal Membatalkan', res.message);
        }
      }
    });
  },

  openAddTripModal(tripToEditId = null) {
    App._editingTripId = tripToEditId;
    const editTrip = tripToEditId ? AppState.trips.find(t => t.id === tripToEditId) : null;
    const modalRoot = document.getElementById('modal-root');

    let defaultDate = editTrip ? editTrip.date : null;
    if (!defaultDate) {
      if (AppState.dailyDate && AppState.dailyDate !== 'all') {
        defaultDate = AppState.dailyDate;
      } else if (AppState.crewDate) {
        defaultDate = AppState.crewDate;
      } else {
        const validTrips = AppState.trips.filter(t => t.tripStatus !== 'cancelled' && t.date);
        defaultDate = validTrips.length > 0 ? validTrips[0].date : new Date().toISOString().slice(0, 10);
      }
    }

    let selectedTplId = editTrip ? (editTrip.itineraryTemplateId || '') : (AppState.templates[0]?.id || '');
    const currentTpl = AppState.templates.find(t => t.id === selectedTplId);
    const defaultTourPackage = editTrip?.tourPackage || (currentTpl ? currentTpl.name : 'Paket Bromo Sunrise');
    const defaultPackagePrice = editTrip?.packagePrice ?? (currentTpl ? currentTpl.defaultPrice : 1750000);

    // Initialize in-memory current trip itinerary
    App._currentTripItinerary = editTrip?.itinerary && Array.isArray(editTrip.itinerary) && editTrip.itinerary.length > 0 
      ? JSON.parse(JSON.stringify(editTrip.itinerary)) 
      : (currentTpl?.items && currentTpl.items.length > 0 
          ? JSON.parse(JSON.stringify(currentTpl.items)) 
          : [
              { id: 'act-1', day: 1, dayTitle: 'Hari 1 - Tour Sunrise Bromo', time: '02:00 WIB', title: 'Penjemputan Tamu', operationalDesc: 'Shuttle Armada', operationalCost: 0, ticketCost: 0, hotelCost: 0, notes: 'Titik jemput hotel / meeting point' },
              { id: 'act-2', day: 1, dayTitle: 'Hari 1 - Tour Sunrise Bromo', time: '04:00 WIB', title: 'Sunrise Point Penanjakan 1', operationalDesc: 'Jeep Hardtop 4x4', operationalCost: 0, ticketCost: 0, hotelCost: 0, notes: 'Spot view matahari terbit Bromo' },
              { id: 'act-3', day: 1, dayTitle: 'Hari 1 - Tour Sunrise Bromo', time: '06:30 WIB', title: 'Kawah Bromo & Pura Luhur Poten', operationalDesc: 'Lautan Pasir Bromo', operationalCost: 0, ticketCost: 0, hotelCost: 0, notes: 'Eksplorasi kaldera aktif' },
              { id: 'act-4', day: 1, dayTitle: 'Hari 1 - Tour Sunrise Bromo', time: '08:30 WIB', title: 'Pasir Berbisik & Bukit Teletubbies', operationalDesc: 'Padang Savana', operationalCost: 0, ticketCost: 0, hotelCost: 0, notes: 'Sesi dokumentasi foto' },
              { id: 'act-5', day: 1, dayTitle: 'Hari 1 - Tour Sunrise Bromo', time: '11:00 WIB', title: 'Drop-off Kembali', operationalDesc: 'Shuttle drop-off', operationalCost: 0, ticketCost: 0, hotelCost: 0, notes: 'Trip selesai kembali ke titik asal' }
            ]
        );
    App._currentTripDuration = currentTpl?.duration || (editTrip ? '12 Jam' : '12 Jam');

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 680px;">
          <div class="modal-header">
            <div style="font-weight: 800; font-size: 16px; color: #0f172a;">
              ${editTrip ? `Edit Perjalanan: ${editTrip.code}` : 'Tambah Perjalanan Baru'}
            </div>
            <button class="btn btn-outline btn-sm" onclick="closeModal()">${Icons.x(16)}</button>
          </div>
          <div class="modal-body">
            <form id="add-trip-form" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Tanggal Trip:*</label>
                  <input type="date" id="trip-date" class="form-input" value="${defaultDate}" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Mitra Agen Travel:*</label>
                  <select id="trip-agency-id" class="form-select">
                    <option value="" data-name="" data-comm="0">-- Langsung / Tanpa Agen (0%) --</option>
                    ${AppState.agencies.map(a => `
                      <option value="${a.id}" data-name="${a.name}"  ${editTrip?.agencyId === a.id ? 'selected' : ''}>
                        ${a.name} (${a.code})
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Nama Tamu / Pemesan:*</label>
                  <input type="text" id="trip-guest-name" class="form-input" placeholder="Nama tamu pemesan" value="${editTrip?.guestName || ''}" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Jumlah Tamu (Pax):*</label>
                  <input type="number" id="trip-guest-count" class="form-input" min="1" max="100" value="${editTrip?.guestCount || 4}" required />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label">Nomor WhatsApp Tamu:</label>
                  <input type="tel" id="trip-guest-phone" class="form-input" placeholder="0812-xxxx-xxxx" value="${editTrip?.guestPhone || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Catatan Tambahan (Opsional):</label>
                  <input type="text" id="trip-notes" class="form-input" placeholder="Contoh: Bawa jaket ekstra, permintaan khusus" value="${editTrip?.notes || ''}" />
                </div>
              </div>

              <!-- Section: Ringkasan Rencana Perjalanan & Itinerary -->
              <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-weight: 800; font-size: 14px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                    ${Icons.mapPin(16, '#059669')} <span>Rencana Perjalanan & Itinerary:</span>
                  </div>
                  <span id="trip-itinerary-badge" class="badge" style="background: #e0f2fe; color: #0284c7; font-weight: 700;">1 Hari</span>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 11px; font-weight: 700;">Nama Paket / Rute Wisata:*</label>
                  <input type="text" id="trip-tour-package-input" class="form-input" placeholder="Contoh: Paket Bromo Sunrise Hemat 4 Spot" value="${defaultTourPackage}" required />
                </div>

                <!-- Quick Preset Loader row -->
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="flex: 1;">
                    <select id="trip-template-quick-select" class="form-select" style="font-size: 12px; padding: 6px 10px;" onchange="App.applyQuickTemplate(this.value)">
                      <option value="">-- Muat Preset Template Master --</option>
                      ${AppState.templates.map(tpl => `
                        <option value="${tpl.id}" data-name="${tpl.name}" data-price="${tpl.defaultPrice}">
                          ${tpl.name} (${tpl.duration || '12 Jam'} - ${formatIDR(tpl.defaultPrice)})
                        </option>
                      `).join('')}
                    </select>
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" style="font-size: 11px; white-space: nowrap; height: 34px;" onclick="App.applyQuickTemplate(document.getElementById('trip-template-quick-select')?.value)">
                    ${Icons.refreshCw(12)} <span>Terapkan</span>
                  </button>
                </div>

                <!-- Dynamic Preview of Days and Activities -->
                <div id="trip-itinerary-preview-container"></div>

                <!-- Action Button to Open Dedicated Multi-Day Builder Modal -->
                <button type="button" class="btn btn-primary" onclick="App.openItineraryBuilderModal()" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px; font-weight: 700; background: #059669; border-color: #059669; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.2);">
                  ${Icons.mapPin(16, '#ffffff')} <span>Kelola / Susun Itinerary Multi-Hari & Plotting Kru</span>
                </button>
              </div>

              <!-- Section: Finansial & Harga Jual -->
              <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="form-label" style="font-weight: 700; color: #0f172a; margin-bottom: 0;">
                    ${Icons.dollarSign(15, '#059669')} <span>Rincian Finansial & Harga Jual:</span>
                  </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px; font-weight: 700;">Harga Paket Jual (IDR):*</label>
                    <input type="text" inputmode="numeric" id="trip-package-price" class="form-input currency-input" value="${formatNumberDot(defaultPackagePrice)}" placeholder="1.750.000" oninput="App.onCurrencyInput(this); refreshProfitPreview();" required />
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px; font-weight: 700;">Biaya Otomatis dari Itinerary:</label>
                    <div id="trip-itinerary-cost-display" style="padding: 7px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; color: #dc2626; font-size: 12px; display: flex; align-items: center; min-height: 35px;">
                      Rp 0
                    </div>
                  </div>
                </div>

                <!-- Status Pembayaran & Uang Muka DP -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px;">Status Pembayaran:</label>
                    <select id="trip-payment-status" class="form-select">
                      <option value="unpaid" ${(!editTrip || editTrip.agencyPaymentStatus === 'unpaid') ? 'selected' : ''}>Belum Bayar</option>
                      <option value="deposit" ${editTrip?.agencyPaymentStatus === 'deposit' ? 'selected' : ''}>DP / Uang Muka (Deposit)</option>
                      <option value="paid" ${editTrip?.agencyPaymentStatus === 'paid' ? 'selected' : ''}>Lunas (Paid Full)</option>
                    </select>
                  </div>

                  <div class="form-group" id="group-deposit-amount" style="margin-bottom: 0; ${editTrip?.agencyPaymentStatus === 'deposit' ? '' : 'display: none;'}">
                    <label class="form-label" style="font-size: 11px;">Nominal DP Masuk (IDR):</label>
                    <input type="text" inputmode="numeric" id="trip-deposit-amount" class="form-input currency-input" value="${formatNumberDot(editTrip?.depositAmount || 0)}" placeholder="Contoh: 500.000" oninput="App.onCurrencyInput(this); refreshProfitPreview();" />
                  </div>

                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px;">Sisa Tagihan / Piutang:</label>
                    <input type="text" id="trip-remaining-balance-display" class="form-input" readonly style="background: #f1f5f9; font-weight: 800; color: #dc2626;" value="${formatIDR(editTrip?.remainingBalance ?? (editTrip?.packagePrice || 1750000))}" />
                  </div>
                </div>
              </div>

              <!-- Dynamic Real-time Live Profit Simulation -->
              <div id="modal-profit-preview"></div>

              <div class="modal-footer" style="padding: 14px 0 0 0; border-top: none;">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Batal</button>
                <button type="submit" class="btn btn-primary" id="btn-save-trip">
                  ${editTrip ? 'Simpan Perubahan' : 'Simpan Perjalanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Live Dynamic Profit Simulation
    const refreshProfitPreview = () => {
      const container = document.getElementById('modal-profit-preview');
      if (!container) return;

      const packagePrice = parseNumberDot(document.getElementById('trip-package-price')?.value) || 0;

      // Hitung biaya langsung dan kru dari App._currentTripItinerary
      let directCost = 0;
      let crewCost = 0;
      const itin = App._currentTripItinerary || [];
      const seenDays = new Set();

      itin.forEach(item => {
        directCost += (parseNumberDot(item.operationalCost) || 0) + (parseNumberDot(item.ticketCost) || 0) + (parseNumberDot(item.hotelCost) || 0);
        if (item.jeepFee) {
          crewCost += parseNumberDot(item.jeepFee) || 0;
        }
        if (item.photographerFee) {
          crewCost += parseNumberDot(item.photographerFee) || 0;
        }
        if (item.guideFee) {
          crewCost += parseNumberDot(item.guideFee) || 0;
        }
        const dNum = item.day || 1;
        if (!seenDays.has(dNum)) {
          seenDays.add(dNum);
          if (item.dayFieldDriverFee) {
            crewCost += parseNumberDot(item.dayFieldDriverFee) || 0;
          }
        }
      });

      // Update cost display badge
      const costDisplay = document.getElementById('trip-itinerary-cost-display');
      if (costDisplay) {
        costDisplay.innerHTML = `<span>${formatIDR(directCost + crewCost)} <small style="color: #64748b; font-weight: normal;">(Ops: ${formatIDR(directCost)}, Kru: ${formatIDR(crewCost)})</small></span>`;
      }

      if (editTrip?.photographerFee) {
        crewCost += parseFloat(editTrip.photographerFee) || 0;
      }
      if (editTrip?.guideFee) {
        crewCost += parseFloat(editTrip.guideFee) || 0;
      }

      const totalExpenses = directCost + crewCost;
      const netProfit = packagePrice - totalExpenses;
      const marginPercent = packagePrice > 0 ? Math.round((netProfit / packagePrice) * 100) : 0;
      const isProfitable = netProfit >= 0;

      // Dynamic DP & Remaining Balance Calculations
      const payStatus = document.getElementById('trip-payment-status')?.value || (editTrip?.agencyPaymentStatus || 'unpaid');
      const depGroup = document.getElementById('group-deposit-amount');
      const depInput = document.getElementById('trip-deposit-amount');
      const remDisplay = document.getElementById('trip-remaining-balance-display');
      const badgePreview = document.getElementById('trip-pay-badge-preview');

      let currentDeposit = 0;
      if (payStatus === 'paid') {
        if (depGroup) depGroup.style.display = 'none';
        currentDeposit = packagePrice;
        if (remDisplay) remDisplay.value = formatIDR(0);
        if (badgePreview) badgePreview.innerHTML = '<span class="badge pay-paid">Lunas</span>';
      } else if (payStatus === 'deposit') {
        if (depGroup) depGroup.style.display = 'block';
        currentDeposit = parseNumberDot(depInput?.value) || 0;
        const remaining = Math.max(0, packagePrice - currentDeposit);
        if (remDisplay) remDisplay.value = formatIDR(remaining);
        if (badgePreview) badgePreview.innerHTML = `<span class="badge pay-deposit">DP: ${formatIDR(currentDeposit)}</span>`;
      } else {
        if (depGroup) depGroup.style.display = 'none';
        currentDeposit = 0;
        if (remDisplay) remDisplay.value = formatIDR(packagePrice);
        if (badgePreview) badgePreview.innerHTML = '<span class="badge pay-unpaid">Belum Bayar</span>';
      }

      const currentRemaining = Math.max(0, packagePrice - currentDeposit);

      container.innerHTML = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dcfce7; padding-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase;">
              Simulasi Finansial & Realisasi Kas:
            </div>
            <div style="font-size: 11px; font-weight: 800; color: ${isProfitable ? '#15803d' : '#dc2626'};">
              ${isProfitable ? 'PROFITABEL' : 'DEFISIT / RUGI'} (${marginPercent}%)
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; font-size: 11px;">
            <div>
              <span style="color: #64748b;">Harga Jual:</span><br>
              <strong style="color: #0f172a;">${formatIDR(packagePrice)}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Kas Masuk (DP/Lunas):</span><br>
              <strong style="color: #059669;">+ ${formatIDR(currentDeposit)}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Sisa Piutang:</span><br>
              <strong style="color: #dc2626;">${formatIDR(currentRemaining)}</strong>
            </div>
            ${directCost > 0 ? `
              <div>
                <span style="color: #64748b;">Biaya Itinerary:</span><br>
                <strong style="color: #dc2626;">- ${formatIDR(directCost)}</strong>
              </div>
            ` : ''}
            <div>
              <span style="color: #64748b;">Honor Kru:</span><br>
              <strong style="color: #ea580c;">- ${formatIDR(crewCost)}</strong>
            </div>

            <div>
              <span style="color: #166534; font-weight: 700;">Laba Bersih:</span><br>
              <strong style="color: ${isProfitable ? '#15803d' : '#dc2626'}; font-size: 13px;">${formatIDR(netProfit)}</strong>
            </div>
          </div>
        </div>
      `;
    };

    // Initial profit preview & itinerary preview
    refreshProfitPreview();
    App.renderTripModalItineraryPreview();

    document.getElementById('trip-package-price')?.addEventListener('input', refreshProfitPreview);
    document.getElementById('trip-agency-id')?.addEventListener('change', refreshProfitPreview);

    document.getElementById('trip-payment-status')?.addEventListener('change', () => {
      const pStat = document.getElementById('trip-payment-status').value;
      const pkg = parseFloat(document.getElementById('trip-package-price')?.value) || 0;
      const depInp = document.getElementById('trip-deposit-amount');
      if (pStat === 'paid') {
        if (depInp) depInp.value = pkg;
      } else if (pStat === 'unpaid') {
        if (depInp) depInp.value = 0;
      }
      refreshProfitPreview();
    });
    document.getElementById('trip-deposit-amount')?.addEventListener('input', refreshProfitPreview);

    document.getElementById('add-trip-form').onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-trip');
      saveBtn.disabled = true;

      const date = document.getElementById('trip-date').value;
      const guestName = document.getElementById('trip-guest-name').value.trim();
      const guestCount = parseInt(document.getElementById('trip-guest-count').value, 10) || 1;
      const guestPhone = document.getElementById('trip-guest-phone')?.value.trim() || '';
      const notes = document.getElementById('trip-notes')?.value.trim() || '';
      const packagePrice = parseNumberDot(document.getElementById('trip-package-price').value) || 0;

      // Collect Itinerary & Tour Package
      const itinerary = App._currentTripItinerary || [];
      const tourPackage = document.getElementById('trip-tour-package-input')?.value.trim() || 'Paket Bromo Tour';
      const templateId = document.getElementById('trip-template-quick-select')?.value || null;

      const agencySelect = document.getElementById('trip-agency-id');
      const agencyOption = agencySelect ? agencySelect.options[agencySelect.selectedIndex] : null;
      const agencyId = agencySelect ? agencySelect.value : null;
      const agencyName = agencyOption ? agencyOption.getAttribute('data-name') : null;

      // Direct costs & crew extracted from itinerary
      let operationalCost = 0;
      let jeepDriverId = editTrip?.jeepDriverId || null;
      let jeepDriverName = editTrip?.jeepDriverName || null;
      let jeepUnit = editTrip?.jeepUnit || null;
      let jeepFee = editTrip?.jeepFee || 0;
      let fieldDriverId = editTrip?.fieldDriverId || null;
      let fieldDriverName = editTrip?.fieldDriverName || null;
      let fieldDriverUnit = editTrip?.fieldDriverUnit || null;
      let fieldDriverFee = editTrip?.fieldDriverFee || 0;
      let guideName = editTrip?.guideName || null;
      let guideFee = editTrip?.guideFee || 0;
      let photographerId = editTrip?.photographerId || null;
      let photographerName = editTrip?.photographerName || null;
      let photographerFee = editTrip?.photographerFee || 0;

      itinerary.forEach(item => {
        // Support both grouped day object (with .activities) and flat activity item (allActivities)
        const isGrouped = Array.isArray(item.activities);
        
        // Field Driver extraction (supports day.fieldDriverId, item.dayFieldDriverId)
        const curFieldId = item.dayFieldDriverId || item.fieldDriverId;
        if (curFieldId && !fieldDriverId) {
          fieldDriverId = curFieldId;
          fieldDriverName = item.dayFieldDriverName || item.fieldDriverName;
          fieldDriverUnit = item.dayFieldDriverUnit || item.fieldDriverUnit;
          fieldDriverFee = parseFloat(item.dayFieldDriverFee || item.fieldDriverFee) || 0;
        }

        // Guide extraction (supports day.dayGuideName, item.guideName)
        const curGuideName = item.dayGuideName || item.guideName;
        if (curGuideName && !guideName) {
          guideName = curGuideName;
          guideFee = parseFloat(item.dayGuideFee || item.guideFee) || 0;
        }

        if (isGrouped) {
          item.activities.forEach(act => {
            operationalCost += (parseFloat(act.operationalCost) || 0) + (parseFloat(act.ticketCost) || 0) + (parseFloat(act.hotelCost) || 0);
            if (act.jeepDriverId && !jeepDriverId) {
              jeepDriverId = act.jeepDriverId;
              jeepDriverName = act.jeepDriverName;
              jeepUnit = act.jeepUnit;
              jeepFee = parseFloat(act.jeepFee) || 0;
            }
            if (act.photographerId && !photographerId) {
              photographerId = act.photographerId;
              photographerName = act.photographerName;
              photographerFee = parseFloat(act.photographerFee) || 0;
            }
          });
        } else {
          operationalCost += (parseFloat(item.operationalCost) || 0) + (parseFloat(item.ticketCost) || 0) + (parseFloat(item.hotelCost) || 0);
          if (item.jeepDriverId && !jeepDriverId) {
            jeepDriverId = item.jeepDriverId;
            jeepDriverName = item.jeepDriverName;
            jeepUnit = item.jeepUnit;
            jeepFee = parseFloat(item.jeepFee) || 0;
          }
          if (item.photographerId && !photographerId) {
            photographerId = item.photographerId;
            photographerName = item.photographerName;
            photographerFee = parseFloat(item.photographerFee) || 0;
          }
        }
      });

      // Fallback slot & pickup point for DB constraints (support flat itinerary[0].time as well)
      const firstTime = itinerary[0]?.activities?.[0]?.time || itinerary[0]?.time || editTrip?.timeSlot || '02:00 WIB (Fleksibel)';
      const timeSlot = firstTime.includes('WIB') ? firstTime : `${firstTime || '02:00'} WIB`;
      const pickupPoint = editTrip?.pickupPoint || 'Sesuai Itinerary / Meeting Point';

      // Validate crew capacity if assigned
      if (jeepDriverId) {
        const chk = App.getCrewAvailability(jeepDriverId, date, timeSlot, editTrip?.id);
        if (!chk.isAvailable) {
          showToast('error', 'Kapasitas Penuh', `Driver Jeep ${jeepDriverName} sudah mencapai batas maksimal 2 trip per hari pada tanggal ${formatDate(date)}.`);
          saveBtn.disabled = false;
          return;
        }
      }
      if (fieldDriverId) {
        const chk = App.getCrewAvailability(fieldDriverId, date, timeSlot, editTrip?.id);
        if (!chk.isAvailable) {
          showToast('error', 'Kapasitas Penuh', `Driver Shuttle ${fieldDriverName} sudah mencapai batas maksimal 2 trip per hari pada tanggal ${formatDate(date)}.`);
          saveBtn.disabled = false;
          return;
        }
      }

      const agencyPaymentStatus = document.getElementById('trip-payment-status')?.value || 'unpaid';
      let depositAmount = 0;
      if (agencyPaymentStatus === 'paid') {
        depositAmount = packagePrice;
      } else if (agencyPaymentStatus === 'deposit') {
        depositAmount = parseNumberDot(document.getElementById('trip-deposit-amount')?.value) || 0;
      } else {
        depositAmount = 0;
      }

      const payload = {
        date, timeSlot, guestName, guestCount, guestPhone,
        pickupPoint, notes, packagePrice, operationalCost,
        tourPackage, itineraryTemplateId: templateId,
        agencyId, agencyName, agencyPaymentStatus, depositAmount,
        jeepDriverId, jeepDriverName, jeepUnit, jeepFee,
        fieldDriverId, fieldDriverName, fieldDriverUnit, fieldDriverFee,
        photographerId, photographerName, photographerFee,
        guideName: guideName || editTrip?.guideName || null,
        guideFee: guideFee || editTrip?.guideFee || 0,
        itinerary
      };

      let res;
      if (editTrip) {
        res = await API.updateTrip(editTrip.id, payload);
      } else {
        res = await API.createTrip(payload);
      }

      saveBtn.disabled = false;
      if (res.success) {
        closeModal();
        showToast(
          'success',
          editTrip ? 'Trip Diperbarui' : 'Trip Ditambahkan',
          'Data perjalanan berhasil disimpan ke MySQL.'
        );
        await App.loadInitialData();
        App.render();
      } else {
        showToast('error', 'Gagal Menyimpan', res.message);
      }
    };
  },

  openAddBromoTripModal() {
    const modalRoot = document.getElementById('modal-root');

    let defaultDate = '';
    if (AppState.dailyDate && AppState.dailyDate !== 'all') {
      defaultDate = AppState.dailyDate;
    } else if (AppState.crewDate) {
      defaultDate = AppState.crewDate;
    } else {
      const validTrips = AppState.trips.filter(t => t.tripStatus !== 'cancelled' && t.date);
      defaultDate = validTrips.length > 0 ? validTrips[0].date : new Date().toISOString().slice(0, 10);
    }

    const jeepDrivers = AppState.workers.filter(w => w.role === 'driver_jeep');
    const photographers = AppState.workers.filter(w => w.role === 'photographer');
    const guides = AppState.workers.filter(w => w.role === 'guide');

    const defaultPackagePrice = 1750000;
    const defaultJeepFee = 650000;

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 640px;">
          <div class="modal-header" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-bottom: 1px solid #fde68a;">
            <div>
              <div style="font-weight: 800; font-size: 16px; color: #92400e; display: flex; align-items: center; gap: 8px;">
                <span>🌋 Tambah Trip Bromo (Simpel)</span>
                <span class="badge" style="background: #ea580c; color: #ffffff; font-size: 10px; font-weight: 800;">1 HARI CEPAT</span>
              </div>
              <div style="font-size: 11px; color: #b45309; margin-top: 2px;">
                Input ringkas untuk trip harian Bromo dengan plotting kru langsung dan pencatatan kas/DP.
              </div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="closeModal()">${Icons.x(16)}</button>
          </div>
          <div class="modal-body">
            <form id="add-bromo-trip-form" style="display: flex; flex-direction: column; gap: 14px;">
              <!-- 1. Jadwal & Waktu -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Tanggal Trip:*</label>
                  <input type="date" id="bromo-trip-date" class="form-input" value="${defaultDate}" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Slot Waktu:*</label>
                  <select id="bromo-time-slot" class="form-select">
                    <option value="02:00 WIB (Sunrise)" selected>02:00 WIB (Sunrise Bromo - Kloter 1)</option>
                    <option value="03:30 WIB (Sunrise)">03:30 WIB (Sunrise Bromo - Kloter 2)</option>
                    <option value="08:00 WIB (Pagi)">08:00 WIB (Tour Pagi / Bromo Siang)</option>
                    <option value="14:00 WIB (Sunset)">14:00 WIB (Sunset Bromo)</option>
                    <option value="21:00 WIB (Milky Way)">21:00 WIB (Milky Way Malam)</option>
                  </select>
                </div>
              </div>

              <!-- 2. Data Tamu & Agen -->
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Nama Tamu / Pemesan:*</label>
                  <input type="text" id="bromo-guest-name" class="form-input" placeholder="Nama tamu pemesan" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Jumlah Tamu (Pax):*</label>
                  <input type="number" id="bromo-guest-count" class="form-input" min="1" max="100" value="4" required />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label">Nomor WhatsApp Tamu (Opsional):</label>
                  <input type="tel" id="bromo-guest-phone" class="form-input" placeholder="0812-xxxx-xxxx (opsional)" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Mitra Agen Travel:*</label>
                  <select id="bromo-agency-id" class="form-select">
                    <option value="" data-name="" data-comm="0">-- Langsung / Tanpa Agen (0%) --</option>
                    ${AppState.agencies.map(a => `
                      <option value="${a.id}" data-name="${a.name}" >
                        ${a.name} (${a.code})
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- 3. Titik Jemput & Catatan -->
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Titik Penjemputan:*</label>
                <input type="text" id="bromo-pickup-point" class="form-input" placeholder="Contoh: Rest Area Sukapura / Wonokitri / Hotel Malang" required />
              </div>

              <div class="form-group">
                <label class="form-label">Catatan Tambahan (Opsional):</label>
                <input type="text" id="bromo-notes" class="form-input" placeholder="Contoh: Bawa balita, minta jeep warna putih" />
              </div>

              <!-- 4. Plotting Kru (Jeep, Fotografer, Guide Opsional) -->
              <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
                <div style="font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    ${Icons.users(15, '#0284c7')} <span>Plotting Kru Operasional Bromo:</span>
                  </span>
                  <span style="font-size: 10px; color: #64748b;">Maksimal 2 trip / hari</span>
                </div>

                <!-- Driver Jeep -->
                <div class="form-group" style="margin-bottom: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 0;">1. Driver Jeep & Armada 4x4:*</label>
                    <span id="bromo-jeep-status-badge" style="font-size: 10px;"></span>
                  </div>
                  <select id="bromo-jeep-driver" class="form-select" required></select>
                </div>

                <!-- Fotografer -->
                <div class="form-group" style="margin-bottom: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 0;">2. Fotografer Dokumentasi:</label>
                    <span id="bromo-photo-status-badge" style="font-size: 10px;"></span>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 130px; gap: 8px;">
                    <select id="bromo-photographer" class="form-select"></select>
                    <input type="text" inputmode="numeric" id="bromo-photo-fee" class="form-input currency-input" placeholder="Honor Foto" value="0" title="Honor Fotografer" oninput="App.onCurrencyInput(this); refreshBromoProfitPreview();" />
                  </div>
                </div>

                <!-- Guide (Opsional) -->
                <div class="form-group" style="margin-bottom: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 0;">3. Tour Guide (Opsional):</label>
                    <span style="font-size: 10px; color: #64748b;">Bebas diisi jika tamu perlu pemandu</span>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 130px; gap: 8px;">
                    <input type="text" id="bromo-guide-name" list="bromo-guides-list" class="form-input" placeholder="Nama Tour Guide (Opsional)" />
                    <input type="text" inputmode="numeric" id="bromo-guide-fee" class="form-input currency-input" placeholder="Honor Guide" value="0" title="Honor Tour Guide" oninput="App.onCurrencyInput(this); refreshBromoProfitPreview();" />
                  </div>
                  <datalist id="bromo-guides-list">
                    ${guides.map(g => `<option value="${g.name}">${g.name} (${g.phone})</option>`).join('')}
                  </datalist>
                </div>
              </div>

              <!-- 5. Harga Paket, Biaya Jeep & Kolom Tiket Masuk Bromo -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700; color: #0f172a;">Harga Paket Jual (IDR):*</label>
                  <input type="text" inputmode="numeric" id="bromo-package-price" class="form-input currency-input" value="${formatNumberDot(defaultPackagePrice)}" placeholder="1.750.000" oninput="App.onCurrencyInput(this); refreshBromoProfitPreview();" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700; color: #ea580c;">Harga / Biaya Jeep 4x4 (IDR):*</label>
                  <input type="text" inputmode="numeric" id="bromo-jeep-fee" class="form-input currency-input" value="${formatNumberDot(defaultJeepFee)}" placeholder="650.000" oninput="App.onCurrencyInput(this); refreshBromoProfitPreview();" required />
                </div>
              </div>

              <!-- Kolom Tiket Masuk TNBTS Bromo & Biaya Ops Tambahan -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="font-weight: 700; color: #b45309; margin-bottom: 0;">🎟️ Harga Tiket Bromo TNBTS (IDR):*</label>
                    <span id="bromo-ticket-calc-hint" style="font-size: 10px; color: #92400e;">(4 pax + karcis mobil)</span>
                  </div>
                  <input type="text" inputmode="numeric" id="bromo-ticket-cost" class="form-input currency-input" value="${formatNumberDot((54000 * 4) + 25000)}" placeholder="241.000" oninput="App.onCurrencyInput(this); this.dataset.userEdited='true'; refreshBromoProfitPreview();" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700; color: #475569;">Biaya Ops Tambahan Bromo (IDR):</label>
                  <input type="text" inputmode="numeric" id="bromo-extra-ops-cost" class="form-input currency-input" value="0" placeholder="0" oninput="App.onCurrencyInput(this); refreshBromoProfitPreview();" />
                </div>
              </div>

              <!-- 6. Status Pembayaran & Uang Muka (DP) -->
              <div style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="form-label" style="font-weight: 700; color: #0f172a; margin-bottom: 0;">
                    ${Icons.dollarSign(15, '#059669')} <span>Status Pembayaran & Uang Muka (DP):</span>
                  </label>
                  <span id="bromo-pay-badge-preview"></span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px;">Status Pembayaran:</label>
                    <select id="bromo-payment-status" class="form-select">
                      <option value="unpaid">Belum Bayar</option>
                      <option value="deposit">DP / Uang Muka (Deposit)</option>
                      <option value="paid">Lunas (Paid Full)</option>
                    </select>
                  </div>

                  <div class="form-group" id="group-bromo-deposit-amount" style="margin-bottom: 0; display: none;">
                    <label class="form-label" style="font-size: 11px;">Nominal DP Masuk (IDR):</label>
                    <input type="text" inputmode="numeric" id="bromo-deposit-amount" class="form-input currency-input" value="${formatNumberDot(500000)}" placeholder="Contoh: 500.000" oninput="App.onCurrencyInput(this); refreshBromoProfitPreview();" />
                  </div>

                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px;">Sisa Tagihan / Piutang:</label>
                    <input type="text" id="bromo-remaining-balance-display" class="form-input" readonly style="background: #f1f5f9; font-weight: 800; color: #dc2626;" value="${formatIDR(defaultPackagePrice)}" />
                  </div>
                </div>
              </div>

              <!-- 7. Dynamic Profit & Margin Preview -->
              <div id="bromo-profit-preview"></div>

              <div class="modal-footer" style="padding: 14px 0 0 0; border-top: none;">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Batal</button>
                <button type="submit" class="btn btn-warning" id="btn-save-bromo-trip" style="font-weight: 800; padding: 8px 18px;">
                  🌋 Simpan Trip Bromo
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Dynamic Crew Selects Builder for Bromo
    const refreshBromoCrewSelects = () => {
      const curDate = document.getElementById('bromo-trip-date')?.value || defaultDate;
      const curSlot = document.getElementById('bromo-time-slot')?.value || '02:00 WIB (Sunrise)';

      const jeepSelect = document.getElementById('bromo-jeep-driver');
      if (jeepSelect) {
        let h = '<option value="">-- Pilih Driver Jeep & Unit 4x4 --</option>';
        jeepDrivers.forEach(w => {
          const avail = App.getCrewAvailability(w.id, curDate, curSlot);
          const disabled = !avail.isAvailable ? 'disabled style="color: #ef4444;"' : '';
          h += `
            <option value="${w.id}" data-name="${w.name}" data-unit="${w.vehicleUnit || 'Hardtop 4x4'}" data-rate="${w.baseRatePerTrip || 650000}" ${disabled}>
              ${avail.icon} ${w.name} • ${w.vehicleUnit || 'Hardtop'} • ${avail.badgeText}
            </option>
          `;
        });
        jeepSelect.innerHTML = h;
      }

      const photoSelect = document.getElementById('bromo-photographer');
      if (photoSelect) {
        let h = '<option value="">-- Tanpa Fotografer (Opsional) --</option>';
        photographers.forEach(w => {
          const avail = App.getCrewAvailability(w.id, curDate, curSlot);
          const disabled = !avail.isAvailable ? 'disabled style="color: #ef4444;"' : '';
          h += `
            <option value="${w.id}" data-name="${w.name}" data-rate="${w.baseRatePerTrip || 200000}" ${disabled}>
              ${avail.icon} ${w.name} • ${avail.badgeText}
            </option>
          `;
        });
        photoSelect.innerHTML = h;
      }
    };

    // Live Dynamic Profit Simulation for Bromo
    const refreshBromoProfitPreview = () => {
      const container = document.getElementById('bromo-profit-preview');
      if (!container) return;

      const packagePrice = parseNumberDot(document.getElementById('bromo-package-price')?.value) || 0;
      const guestCount = parseInt(document.getElementById('bromo-guest-count')?.value, 10) || 4;
      const bromoTicketCost = parseNumberDot(document.getElementById('bromo-ticket-cost')?.value) || 0;
      const extraOpsCost = parseNumberDot(document.getElementById('bromo-extra-ops-cost')?.value) || 0;
      const directOpsCost = bromoTicketCost + extraOpsCost;
      const jeepFee = parseNumberDot(document.getElementById('bromo-jeep-fee')?.value) || 0;
      const photoFee = parseNumberDot(document.getElementById('bromo-photo-fee')?.value) || 0;
      const guideFee = parseNumberDot(document.getElementById('bromo-guide-fee')?.value) || 0;

      const totalCrewExpenses = jeepFee + photoFee + guideFee;
      const totalExpenses = directOpsCost + totalCrewExpenses;
      const netProfit = packagePrice - totalExpenses;
      const marginPercent = packagePrice > 0 ? Math.round((netProfit / packagePrice) * 100) : 0;
      const isProfitable = netProfit >= 0;

      const payStatus = document.getElementById('bromo-payment-status')?.value || 'unpaid';
      const depGroup = document.getElementById('group-bromo-deposit-amount');
      const depInput = document.getElementById('bromo-deposit-amount');
      const remDisplay = document.getElementById('bromo-remaining-balance-display');
      const badgePreview = document.getElementById('bromo-pay-badge-preview');

      let currentDeposit = 0;
      if (payStatus === 'paid') {
        if (depGroup) depGroup.style.display = 'none';
        currentDeposit = packagePrice;
        if (remDisplay) remDisplay.value = formatIDR(0);
        if (badgePreview) badgePreview.innerHTML = '<span class="badge pay-paid">Lunas</span>';
      } else if (payStatus === 'deposit') {
        if (depGroup) depGroup.style.display = 'block';
        currentDeposit = parseNumberDot(depInput?.value) || 0;
        const remaining = Math.max(0, packagePrice - currentDeposit);
        if (remDisplay) remDisplay.value = formatIDR(remaining);
        if (badgePreview) badgePreview.innerHTML = `<span class="badge pay-deposit">DP: ${formatIDR(currentDeposit)}</span>`;
      } else {
        if (depGroup) depGroup.style.display = 'none';
        currentDeposit = 0;
        if (remDisplay) remDisplay.value = formatIDR(packagePrice);
        if (badgePreview) badgePreview.innerHTML = '<span class="badge pay-unpaid">Belum Bayar</span>';
      }

      const currentRemaining = Math.max(0, packagePrice - currentDeposit);

      container.innerHTML = `
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fef3c7; padding-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase;">
              Simulasi Keuangan & Arus Kas Bromo:
            </div>
            <div style="font-size: 11px; font-weight: 800; color: ${isProfitable ? '#15803d' : '#dc2626'};">
              ${isProfitable ? 'PROFITABEL' : 'DEFISIT / RUGI'} (${marginPercent}%)
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; font-size: 11px;">
            <div>
              <span style="color: #64748b;">Harga Jual:</span><br>
              <strong style="color: #0f172a;">${formatIDR(packagePrice)}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Kas Masuk (DP):</span><br>
              <strong style="color: #059669;">+ ${formatIDR(currentDeposit)}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Sisa Piutang:</span><br>
              <strong style="color: #dc2626;">${formatIDR(currentRemaining)}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Tiket TNBTS Bromo:</span><br>
              <strong style="color: #ea580c;">- ${formatIDR(bromoTicketCost)}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Biaya Jeep 4x4:</span><br>
              <strong style="color: #b45309;">- ${formatIDR(jeepFee)}</strong>
            </div>
            ${photoFee > 0 ? `
              <div>
                <span style="color: #64748b;">Honor Foto:</span><br>
                <strong style="color: #7c3aed;">- ${formatIDR(photoFee)}</strong>
              </div>
            ` : ''}
            ${guideFee > 0 ? `
              <div>
                <span style="color: #64748b;">Honor Guide:</span><br>
                <strong style="color: #0d9488;">- ${formatIDR(guideFee)}</strong>
              </div>
            ` : ''}

            <div>
              <span style="color: #166534; font-weight: 700;">Laba Bersih:</span><br>
              <strong style="color: ${isProfitable ? '#15803d' : '#dc2626'}; font-size: 13px;">${formatIDR(netProfit)}</strong>
            </div>
          </div>
        </div>
      `;
    };

    // Initialize
    refreshBromoCrewSelects();
    refreshBromoProfitPreview();

    // Event listeners
    document.getElementById('bromo-trip-date')?.addEventListener('change', () => {
      refreshBromoCrewSelects();
      refreshBromoProfitPreview();
    });
    document.getElementById('bromo-time-slot')?.addEventListener('change', () => {
      refreshBromoCrewSelects();
      refreshBromoProfitPreview();
    });

    document.getElementById('bromo-jeep-driver')?.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      if (opt && opt.value) {
        const rate = parseFloat(opt.getAttribute('data-rate')) || 650000;
        const feeInp = document.getElementById('bromo-jeep-fee');
        if (feeInp && (!feeInp.value || feeInp.value === '650000')) {
          feeInp.value = rate;
        }
      }
      refreshBromoProfitPreview();
    });

    document.getElementById('bromo-photographer')?.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      const feeInp = document.getElementById('bromo-photo-fee');
      if (opt && opt.value) {
        const rate = parseFloat(opt.getAttribute('data-rate')) || 200000;
        if (feeInp) feeInp.value = rate;
      } else {
        if (feeInp) feeInp.value = 0;
      }
      refreshBromoProfitPreview();
    });

    document.getElementById('bromo-guest-count')?.addEventListener('input', (e) => {
      const gCount = parseInt(e.target.value, 10) || 1;
      const ticketInp = document.getElementById('bromo-ticket-cost');
      const hint = document.getElementById('bromo-ticket-calc-hint');
      if (ticketInp && !ticketInp.dataset.userEdited) {
        ticketInp.value = formatNumberDot((54000 * gCount) + 25000);
      }
      if (hint) {
        hint.textContent = `(${gCount} pax + karcis mobil)`;
      }
      refreshBromoProfitPreview();
    });
    document.getElementById('bromo-package-price')?.addEventListener('input', refreshBromoProfitPreview);
    document.getElementById('bromo-ticket-cost')?.addEventListener('input', refreshBromoProfitPreview);
    document.getElementById('bromo-extra-ops-cost')?.addEventListener('input', refreshBromoProfitPreview);
    document.getElementById('bromo-jeep-fee')?.addEventListener('input', refreshBromoProfitPreview);
    document.getElementById('bromo-photo-fee')?.addEventListener('input', refreshBromoProfitPreview);
    document.getElementById('bromo-guide-fee')?.addEventListener('input', refreshBromoProfitPreview);
    document.getElementById('bromo-agency-id')?.addEventListener('change', refreshBromoProfitPreview);

    document.getElementById('bromo-payment-status')?.addEventListener('change', () => {
      const pStat = document.getElementById('bromo-payment-status').value;
      const pkg = parseFloat(document.getElementById('bromo-package-price')?.value) || 0;
      const depInp = document.getElementById('bromo-deposit-amount');
      if (pStat === 'paid') {
        if (depInp) depInp.value = pkg;
      } else if (pStat === 'unpaid') {
        if (depInp) depInp.value = 0;
      }
      refreshBromoProfitPreview();
    });
    document.getElementById('bromo-deposit-amount')?.addEventListener('input', refreshBromoProfitPreview);

    // Form Submit
    document.getElementById('add-bromo-trip-form').onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-bromo-trip');
      saveBtn.disabled = true;

      const date = document.getElementById('bromo-trip-date').value;
      const timeSlot = document.getElementById('bromo-time-slot').value;
      const guestName = document.getElementById('bromo-guest-name').value.trim();
      const guestCount = parseInt(document.getElementById('bromo-guest-count').value, 10) || 1;
      const guestPhone = document.getElementById('bromo-guest-phone')?.value.trim() || '';
      const pickupPoint = document.getElementById('bromo-pickup-point').value.trim();
      const notes = document.getElementById('bromo-notes')?.value.trim() || '';
      const packagePrice = parseNumberDot(document.getElementById('bromo-package-price').value) || 0;
      const jeepFee = parseNumberDot(document.getElementById('bromo-jeep-fee').value) || 0;
      const bromoTicketCost = parseNumberDot(document.getElementById('bromo-ticket-cost')?.value) || ((54000 * guestCount) + 25000);
      const extraOpsCost = parseNumberDot(document.getElementById('bromo-extra-ops-cost')?.value) || 0;

      const jeepSelect = document.getElementById('bromo-jeep-driver');
      const jeepOption = jeepSelect ? jeepSelect.options[jeepSelect.selectedIndex] : null;
      const jeepDriverId = jeepSelect ? jeepSelect.value || null : null;
      const jeepDriverName = jeepDriverId && jeepOption ? jeepOption.getAttribute('data-name') : null;
      const jeepUnit = jeepDriverId && jeepOption ? jeepOption.getAttribute('data-unit') : 'Toyota Hardtop 4x4';

      if (!jeepDriverId) {
        showToast('warning', 'Pilih Driver Jeep', 'Silakan pilih driver jeep yang bertugas sebelum menyimpan.');
        saveBtn.disabled = false;
        return;
      }

      // Check Jeep availability
      const jeepChk = App.getCrewAvailability(jeepDriverId, date, timeSlot);
      if (!jeepChk.isAvailable) {
        showToast('error', 'Kapasitas Penuh', `Driver Jeep ${jeepDriverName} sudah mencapai batas maksimal 2 trip per hari.`);
        saveBtn.disabled = false;
        return;
      }

      const photoSelect = document.getElementById('bromo-photographer');
      const photoOption = photoSelect && photoSelect.selectedIndex >= 0 ? photoSelect.options[photoSelect.selectedIndex] : null;
      const photographerId = photoSelect ? photoSelect.value || null : null;
      const photographerName = photographerId && photoOption ? photoOption.getAttribute('data-name') : null;
      const photographerFee = parseNumberDot(document.getElementById('bromo-photo-fee')?.value) || 0;

      if (photographerId) {
        const photoChk = App.getCrewAvailability(photographerId, date, timeSlot);
        if (!photoChk.isAvailable) {
          showToast('error', 'Kapasitas Penuh', `Fotografer ${photographerName} sudah mencapai batas maksimal 2 trip per hari.`);
          saveBtn.disabled = false;
          return;
        }
      }

      const guideName = document.getElementById('bromo-guide-name')?.value.trim() || null;
      const guideFee = parseNumberDot(document.getElementById('bromo-guide-fee')?.value) || 0;

      const agencySelect = document.getElementById('bromo-agency-id');
      const agencyOption = agencySelect ? agencySelect.options[agencySelect.selectedIndex] : null;
      const agencyId = agencySelect ? agencySelect.value : null;
      const agencyName = agencyOption ? agencyOption.getAttribute('data-name') : null;

      const paymentStatus = document.getElementById('bromo-payment-status')?.value || 'unpaid';
      let depositAmount = 0;
      if (paymentStatus === 'paid') {
        depositAmount = packagePrice;
      } else if (paymentStatus === 'deposit') {
        depositAmount = parseNumberDot(document.getElementById('bromo-deposit-amount')?.value) || 0;
      } else {
        depositAmount = 0;
      }

      // Auto-construct standard 1-day Bromo itinerary
      const bromoItinerary = [
        {
          id: 'act-' + Date.now() + '-1',
          day: 1,
          dayTitle: 'Hari 1 - Eksplorasi Bromo',
          activityType: 'shuttle_transfer',
          title: `Penjemputan Tamu (${pickupPoint})`,
          time: timeSlot.split(' ')[0] || '02:00 WIB',
          hotelName: '',
          operationalDesc: 'Armada jemput standby',
          operationalCost: 0,
          ticketCost: 0,
          hotelCost: 0,
          notes: notes || 'Standby tepat waktu di titik jemput'
        },
        {
          id: 'act-' + Date.now() + '-2',
          day: 1,
          dayTitle: 'Hari 1 - Eksplorasi Bromo',
          activityType: 'bromo_sunrise',
          title: 'Golden Sunrise Penanjakan 1 & Kaldera Bromo',
          time: '03:30 - 06:00 WIB',
          hotelName: '',
          jeepDriverId: jeepDriverId,
          jeepDriverName: jeepDriverName,
          jeepUnit: jeepUnit,
          jeepFee: jeepFee,
          operationalDesc: `Armada Jeep 4x4 (${jeepDriverName})`,
          operationalCost: 0,
          ticketCost: bromoTicketCost,
          hotelCost: 0,
          notes: 'Suhu dingin 5-10°C, kenakan jaket tebal.'
        },
        {
          id: 'act-' + Date.now() + '-3',
          day: 1,
          dayTitle: 'Hari 1 - Eksplorasi Bromo',
          activityType: 'spot_wisata',
          title: 'Kawah Bromo, Pasir Berbisik & Bukit Teletubbies',
          time: '06:30 - 09:30 WIB',
          hotelName: '',
          operationalDesc: 'Eksplorasi kaldera Bromo',
          operationalCost: 25000,
          ticketCost: 0,
          hotelCost: 0,
          notes: photographerName ? `Sesi foto bersama fotografer ${photographerName}` : ''
        },
        {
          id: 'act-' + Date.now() + '-4',
          day: 1,
          dayTitle: 'Hari 1 - Eksplorasi Bromo',
          activityType: 'shuttle_transfer',
          title: 'Perjalanan Kembali & Drop Off',
          time: '10:00 WIB / Selesai',
          hotelName: '',
          operationalDesc: 'Pengantaran kembali',
          operationalCost: 0,
          ticketCost: 0,
          hotelCost: 0,
          notes: 'Trip selesai dengan aman & memuaskan'
        }
      ];

      const payload = {
        date,
        timeSlot,
        guestName,
        guestCount,
        guestPhone,
        pickupPoint,
        notes,
        packagePrice,
        tourPackage: 'Paket Bromo Sunrise & Exploration',
        agencyId,
        agencyName,
        agencyPaymentStatus: paymentStatus,
        depositAmount,
        jeepDriverId,
        jeepDriverName,
        jeepUnit,
        jeepFee,
        fieldDriverId: null,
        fieldDriverName: null,
        fieldDriverFee: 0,
        photographerId,
        photographerName,
        photographerFee,
        guideName,
        guideFee,
        operationalCost: bromoTicketCost + extraOpsCost,
        itinerary: bromoItinerary
      };

      const res = await API.createTrip(payload);
      saveBtn.disabled = false;

      if (res.success) {
        closeModal();
        showToast('success', 'Trip Bromo Ditambahkan', `Trip Bromo untuk ${guestName} (${timeSlot}) berhasil disimpan.`);
        await App.loadInitialData();
        App.render();
      } else {
        showToast('error', 'Gagal Menyimpan', res.message);
      }
    };
  },

  onTemplateSelected(tplId) {
    this.applyQuickTemplate(tplId);
  },

  applyQuickTemplate(tplId) {
    if (!tplId) return;
    const tpl = AppState.templates.find(t => t.id === tplId);
    if (!tpl) return;

    // Load items into current trip itinerary
    App._currentTripItinerary = JSON.parse(JSON.stringify(tpl.items || []));
    App._currentTripDuration = tpl.duration || '12 Jam';

    const pkgInput = document.getElementById('trip-tour-package-input');
    if (pkgInput) pkgInput.value = tpl.name;

    const priceInput = document.getElementById('trip-package-price');
    if (priceInput && (!priceInput.value || parseFloat(priceInput.value) === 0 || parseFloat(priceInput.value) === 1750000)) {
      priceInput.value = tpl.defaultPrice;
      priceInput.dispatchEvent(new Event('input'));
    }

    // Auto-calculate and sync total cost
    let totalCost = 0;
    (App._currentTripItinerary || []).forEach(act => {
      totalCost += (parseFloat(act.operationalCost) || 0) + (parseFloat(act.ticketCost) || 0) + (parseFloat(act.hotelCost) || 0);
    });
    const opCostInput = document.getElementById('trip-operational-cost');
    if (opCostInput && totalCost > 0) {
      opCostInput.value = totalCost;
      opCostInput.dispatchEvent(new Event('input'));
    }

    App.renderTripModalItineraryPreview();
    showToast('success', 'Preset Diterapkan', `Template "${tpl.name}" dimuat ke perjalanan. Template master aman.`);
  },

  renderTripModalItineraryPreview() {
    const container = document.getElementById('trip-itinerary-preview-container');
    const badge = document.getElementById('trip-itinerary-badge');
    const acts = App._currentTripItinerary || [];

    // Group by day
    const dayMap = {};
    let totalOps = 0, totalTickets = 0, totalHotels = 0, totalJeep = 0, totalPhoto = 0, totalGuide = 0;
    acts.forEach(item => {
      const dNum = item.day || 1;
      if (!dayMap[dNum]) {
        dayMap[dNum] = {
          day: dNum,
          title: item.dayTitle || `Hari ${dNum}`,
          fieldDriverName: item.dayFieldDriverName || null,
          fieldDriverUnit: item.dayFieldDriverUnit || null,
          activities: []
        };
      }
      dayMap[dNum].activities.push(item);
      totalOps += (parseNumberDot(item.operationalCost) || 0);
      totalTickets += (parseNumberDot(item.ticketCost) || 0);
      totalHotels += (parseNumberDot(item.hotelCost) || 0);
      totalJeep += (parseNumberDot(item.jeepFee) || 0);
      totalPhoto += (parseNumberDot(item.photographerFee) || 0);
      totalGuide += (parseNumberDot(item.guideFee) || 0);
    });

    const days = Object.values(dayMap).sort((a, b) => a.day - b.day);
    const totalDays = days.length > 0 ? days.length : 1;
    const grandTotal = totalOps + totalTickets + totalHotels + totalJeep + totalPhoto + totalGuide;

    if (badge) {
      badge.textContent = `${totalDays} Hari (${acts.length} Kegiatan)`;
    }

    const costDisplay = document.getElementById('trip-itinerary-cost-display');
    if (costDisplay) {
      costDisplay.innerHTML = `<span>${formatIDR(grandTotal)}</span> <small style="color: #64748b; font-weight: normal; margin-left: 6px;">(Ops: ${formatIDR(totalOps)}, Tiket: ${formatIDR(totalTickets)}, Hotel: ${formatIDR(totalHotels)})</small>`;
    }

    if (!container) return;
    if (acts.length === 0) {
      container.innerHTML = `
        <div style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 8px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center;">
          Belum ada susunan kegiatan rute. Klik tombol di bawah untuk menyusun itinerary.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <!-- Cost summary pills -->
        <div style="display: flex; gap: 8px; font-size: 10px; flex-wrap: wrap; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; align-items: center;">
          <span style="color: #475569;">🎟️ Tiket Bromo/Wisata: <strong style="color: #ea580c;">${formatIDR(totalTickets)}</strong></span>
          <span style="color: #475569;">&bull; 🚙 Jeep: <strong style="color: #b45309;">${formatIDR(totalJeep)}</strong></span>
          ${totalPhoto > 0 ? `<span style="color: #475569;">&bull; 📷 Foto: <strong style="color: #6d28d9;">${formatIDR(totalPhoto)}</strong></span>` : ''}
          ${totalGuide > 0 ? `<span style="color: #475569;">&bull; 🚩 Guide: <strong style="color: #0d9488;">${formatIDR(totalGuide)}</strong></span>` : ''}
          <span style="color: #475569;">&bull; 🛠️ Ops: <strong style="color: #dc2626;">${formatIDR(totalOps)}</strong></span>
          ${totalHotels > 0 ? `<span style="color: #475569;">&bull; 🏨 Hotel: <strong style="color: #7c3aed;">${formatIDR(totalHotels)}</strong></span>` : ''}
          <span style="margin-left: auto; color: #166534; font-weight: 800;">Total Itinerary: ${formatIDR(grandTotal)}</span>
        </div>

        <!-- Days list preview with Daily Driver Lapangan and Spot Details -->
        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; padding-right: 2px;">
          ${days.map(d => {
            const dayDriverName = d.fieldDriverName || d.activities[0]?.dayFieldDriverName;
            const dayDriverUnit = d.fieldDriverUnit || d.activities[0]?.dayFieldDriverUnit;
            return `
              <div style="font-size: 11px; padding: 6px 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <strong style="color: #0284c7;">📅 ${d.title}</strong>
                  ${dayDriverName ? `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 700;">🚐 ${dayDriverName} (${dayDriverUnit || 'Shuttle'})</span>` : ''}
                </div>
                <div style="color: #64748b; font-size: 11px; display: flex; flex-wrap: wrap; gap: 4px;">
                  ${d.activities.map(a => {
                    const aType = a.activityType || App.inferActivityType(a);
                    if (aType === 'hotel') {
                      return `<span style="background: #f5f3ff; color: #6d28d9; padding: 1px 6px; border-radius: 4px; border: 1px solid #ddd6fe; font-size: 10px; font-weight: 600;">🏨 ${a.hotelName ? `Hotel: ${a.hotelName}` : a.title}</span>`;
                    } else if (aType === 'bromo_sunrise' || aType === 'milky_way') {
                      return `<span style="background: #fffbeb; color: #b45309; padding: 1px 6px; border-radius: 4px; border: 1px solid #fde68a; font-size: 10px; font-weight: 600;">🌄 ${a.title}${a.jeepDriverName ? ` (🚙 ${a.jeepDriverName})` : ''}${a.photographerName ? ` (📷 ${a.photographerName})` : ''}${a.guideName ? ` (🧭 ${a.guideName})` : ''}</span>`;
                    } else {
                      return `<span style="background: #f8fafc; color: #334155; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 10px;">${a.title}</span>`;
                    }
                  }).join(' ')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // Master Activity Types definition & inference
  ACTIVITY_TYPES: [
    {
      id: 'bromo_sunrise',
      label: '🌄 Bromo Sunrise / Sunset (Jeep 4x4)',
      badge: 'Jeep Bromo',
      color: '#d97706',
      bgColor: '#fef3c7',
      defaultTitle: 'Golden Sunrise Bromo Penanjakan 1 (Jeep 4x4)',
      defaultOpDesc: 'Sewa Jeep Hardtop 4x4 & Driver Bromo',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 0,
      defaultNotes: 'Suhu dingin 5-10°C, kenakan jaket tebal. Standby jeep tepat waktu.',
      defaultTime: '03:30 - 06:00 WIB',
      presetSpots: [
        'Golden Sunrise Penanjakan 1',
        'Sunrise Bukit Kingkong (Kingkong Hill)',
        'Sunrise Bukit Cinta (Love Hill)',
        'Sunrise Seruni Point (Penanjakan 2)',
        'Mentigen Hill Sunrise View',
        'Sunset Bromo Bukit Teletubbies'
      ]
    },
    {
      id: 'hotel',
      label: '🏨 Akomodasi (Hotel / Penginapan / Homestay)',
      badge: 'Hotel',
      color: '#7c3aed',
      bgColor: '#ede9fe',
      defaultTitle: 'Check-in & Istirahat Hotel',
      defaultOpDesc: 'Voucher reservasi kamar hotel / homestay',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 450000,
      defaultNotes: 'Tunjukkan voucher booking & ID booking saat check-in resepsionis.',
      defaultTime: '14:00 WIB / Menginap',
      presetHotels: [
        'Hotel Tugu Malang',
        'Grand Mercure Malang Mirama',
        'Hotel Santika Premiere Malang',
        'Lava View Lodge Bromo',
        'Bromo Terrace Hotel',
        'Whiz Prime Hotel Bromo',
        'Plataran Bromo Resort & Spa',
        'Jiwa Jawa Resort Bromo',
        'Swiss-Belinn Malang',
        'Ijen Suites Resort & Convention Malang',
        'Hotel Harris Malang',
        'Cemara Indah Hotel Bromo'
      ]
    },
    {
      id: 'spot_wisata',
      label: '🌋 Spot Wisata / Destinasi Non-Jeep',
      badge: 'Spot Wisata',
      color: '#059669',
      bgColor: '#d1fae5',
      defaultTitle: 'Kawah Bromo & Pura Luhur Poten',
      defaultOpDesc: 'Guide lokal / tiket destinasi wisata',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 0,
      defaultNotes: 'Dapat jalan kaki atau sewa kuda menuju tangga bibir kawah.',
      defaultTime: '06:30 - 08:30 WIB',
      presetSpots: [
        'Kawah Bromo & Pura Luhur Poten',
        'Pasir Berbisik (Whispering Sands)',
        'Savana & Bukit Teletubbies Bromo',
        'Air Terjun Madakaripura',
        'Museum Angkut Batu',
        'Jatim Park 2 (Batu Secret Zoo)',
        'Flora Wisata San Terra Pujon',
        'Kampung Warna-Warni Jodipan Malang',
        'Coban Rondo & Taman Labirin'
      ]
    },
    {
      id: 'shuttle_transfer',
      label: '🚐 Penjemputan / Shuttle / Antar-Jemput',
      badge: 'Shuttle Transfer',
      color: '#0284c7',
      bgColor: '#e0f2fe',
      defaultTitle: 'Penjemputan Tamu di Meeting Point / Hotel',
      defaultOpDesc: 'Armada shuttle lokal & BBM',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 0,
      defaultNotes: 'Driver standby 15 menit sebelum waktu penjemputan.',
      defaultTime: '00:00 - 01:00 WIB',
      presetSpots: [
        'Penjemputan Tamu di Meeting Point / Hotel',
        'Penjemputan Bandara Abdulrachman Saleh Malang (MLG)',
        'Penjemputan Stasiun Malang Kotabaru',
        'Transit Rest Area Sukapura / Wonokitri',
        'Pengantaran Pulang (Drop Off) Malang / Batu',
        'Drop Off Bandara Juanda Surabaya (SUB)'
      ]
    },
    {
      id: 'kuliner',
      label: '🍽️ Kuliner / Resto / Istirahat Makan',
      badge: 'Kuliner / Resto',
      color: '#e11d48',
      bgColor: '#ffe4e6',
      defaultTitle: 'Sarapan Pagi di Resto Lokal',
      defaultOpDesc: 'Voucher makan / prasmanan lokal',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 0,
      defaultNotes: 'Menu prasmanan khas Jawa Timur + teh/kopi hangat.',
      defaultTime: '08:30 - 09:30 WIB',
      presetSpots: [
        'Sarapan Pagi di Resto Lokal Bromo',
        'Makan Siang di Resto Tradisional Malang',
        'Makan Malam (Dinner Session)',
        'Coffee Break & Belanja Oleh-Oleh Malang'
      ]
    },
    {
      id: 'milky_way',
      label: '🌌 Bromo Milky Way & Fotografi Malam',
      badge: 'Milky Way',
      color: '#4f46e5',
      bgColor: '#e0e7ff',
      defaultTitle: 'Hunting Milky Way Kingkong Hill & Lautan Pasir',
      defaultOpDesc: 'Jeep 4x4 & perlengkapan astro lighting',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 0,
      defaultNotes: 'Bawa tripod kokoh & lensa aperture lebar (f/2.8).',
      defaultTime: '23:00 - 03:00 WIB',
      presetSpots: [
        'Hunting Milky Way Kingkong Hill',
        'Hunting Milky Way Lautan Pasir Bromo',
        'Astro-photography Bukit Cinta'
      ]
    },
    {
      id: 'custom',
      label: '✨ Kegiatan Kustom / Lainnya',
      badge: 'Kustom',
      color: '#475569',
      bgColor: '#f1f5f9',
      defaultTitle: 'Kegiatan Acara Khusus',
      defaultOpDesc: 'Operasional kegiatan mandiri',
      defaultOpCost: 0,
      defaultTicketCost: 0,
      defaultHotelCost: 0,
      defaultNotes: 'Agenda fleksibel sesuai permintaan tamu.',
      defaultTime: ''
    }
  ],

  inferActivityType(act) {
    if (act.activityType) return act.activityType;
    const str = `${act.title || ''} ${act.operationalDesc || ''} ${act.notes || ''}`.toLowerCase();
    if ((act.hotelCost && parseFloat(act.hotelCost) > 0) || act.hotelName || /hotel|nginap|kamar|homestay|resort|villa|lodging|check-in/i.test(str)) {
      return 'hotel';
    }
    if (/sunrise|sunset|penanjakan|kingkong|seruni|mentigen|bukit cinta|jeep|hardtop/i.test(str)) {
      return 'bromo_sunrise';
    }
    if (/milky\s*way|bintang|night\s*photo/i.test(str)) {
      return 'milky_way';
    }
    if (/jemput|drop|shuttle|antar|transfer|stasiun|bandara/i.test(str)) {
      return 'shuttle_transfer';
    }
    if (/makan|resto|kuliner|sarapan|dinner|lunch/i.test(str)) {
      return 'kuliner';
    }
    return 'spot_wisata';
  },

  openItineraryBuilderModal(options = {}) {
    const mode = options.mode || 'trip'; // 'trip' or 'template'
    const templateId = options.templateId || null;

    let tourPackage = '';
    let category = 'bromo_sunrise';
    let duration = '12 Jam';
    let price = 1750000;
    let description = '';
    let days = [];

    if (mode === 'template') {
      if (templateId) {
        const tpl = AppState.templates.find(t => t.id === templateId);
        if (tpl) {
          tourPackage = tpl.name || '';
          category = tpl.category || 'bromo_sunrise';
          duration = tpl.duration || '12 Jam';
          price = tpl.defaultPrice || 1750000;
          description = tpl.description || '';

          const dayMap = {};
          (tpl.items || []).forEach(it => {
            const dNum = parseInt(it.day, 10) || 1;
            if (!dayMap[dNum]) {
              dayMap[dNum] = {
                day: dNum,
                title: it.dayTitle || `Hari ${dNum}`,
                fieldDriverId: null,
                fieldDriverName: null,
                fieldDriverUnit: null,
                fieldDriverFee: 0,
                activities: []
              };
            }
            const aType = it.activityType || App.inferActivityType(it);
            dayMap[dNum].activities.push({
              id: it.id || ('stop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
              time: it.time || '',
              activityType: aType,
              title: it.title || '',
              hotelName: it.hotelName || '',
              ticketName: it.ticketName || ((aType === 'bromo_sunrise' || aType === 'milky_way') ? 'Tiket TNBTS Bromo' : ''),
              jeepDriverId: null,
              jeepDriverName: null,
              jeepUnit: null,
              jeepFee: parseNumberDot(it.jeepFee) || ((aType === 'bromo_sunrise' || aType === 'milky_way') ? 250000 : 0),
              photographerId: null,
              photographerName: null,
              photographerFee: parseNumberDot(it.photographerFee) || 0,
              guideName: null,
              guideFee: parseNumberDot(it.guideFee) || 0,
              operationalDesc: it.operationalDesc || '',
              operationalCost: parseNumberDot(it.operationalCost) || 0,
              ticketCost: parseNumberDot(it.ticketCost) || 0,
              hotelCost: parseNumberDot(it.hotelCost) || 0,
              notes: it.notes || it.description || ''
            });
          });
          days = Object.values(dayMap).sort((a, b) => a.day - b.day);
        }
      }

      if (days.length === 0) {
        days = [
          {
            day: 1,
            title: 'Hari 1 - Penjemputan & Sunrise Bromo',
            fieldDriverId: null,
            fieldDriverName: null,
            fieldDriverUnit: null,
            fieldDriverFee: 0,
            activities: [
              {
                id: 'stop-' + Date.now() + '-1',
                time: '00:00 - 01:00 WIB',
                activityType: 'shuttle_transfer',
                title: 'Penjemputan Tamu di Meeting Point / Hotel',
                hotelName: '',
                jeepDriverId: null,
                jeepDriverName: null,
                jeepUnit: null,
                jeepFee: 0,
                operationalDesc: 'Armada shuttle / BBM',
                operationalCost: 0,
                ticketCost: 0,
                hotelCost: 0,
                notes: 'Briefing dan cek kelengkapan barang bawaan'
              },
              {
                id: 'stop-' + Date.now() + '-2',
                time: '03:30 - 06:00 WIB',
                activityType: 'bromo_sunrise',
                title: 'Golden Sunrise View Point Penanjakan 1',
                hotelName: '',
                jeepDriverId: null,
                jeepDriverName: null,
                jeepUnit: null,
                jeepFee: 0,
                operationalDesc: 'Sewa Jeep Hardtop 4x4',
                operationalCost: 0,
                ticketCost: 0,
                hotelCost: 0,
                notes: 'Suhu dingin 5-10 derajat celcius, kenakan jaket tebal'
              },
              {
                id: 'stop-' + Date.now() + '-3',
                time: '06:30 - 08:30 WIB',
                activityType: 'spot_wisata',
                title: 'Kawah Bromo & Pura Luhur Poten',
                hotelName: '',
                jeepDriverId: null,
                jeepDriverName: null,
                jeepUnit: null,
                jeepFee: 0,
                operationalDesc: 'Guide lokal / masker',
                operationalCost: 0,
                ticketCost: 0,
                hotelCost: 0,
                notes: 'Jalan kaki atau sewa kuda menuju bibir kawah'
              }
            ]
          }
        ];
      }
    } else {
      // mode === 'trip'
      tourPackage = document.getElementById('trip-tour-package-input')?.value.trim() || 'Paket Tour Bromo';
      duration = App._currentTripDuration || '12 Jam';
      price = parseFloat(document.getElementById('trip-package-price')?.value) || 0;

      const currentActs = App._currentTripItinerary || [];
      const dayMap = {};

      const tripFieldDriverId = document.getElementById('trip-field-driver')?.value || (App._editingTripId ? (AppState.trips.find(t => t.id === App._editingTripId)?.fieldDriverId || null) : null);
      const tripFieldDriver = AppState.workers.find(w => w.id === tripFieldDriverId);
      const tripFieldFee = parseFloat(document.getElementById('trip-field-fee')?.value) || (tripFieldDriver?.baseRatePerTrip || 175000);

      const tripJeepDriverId = document.getElementById('trip-jeep-driver')?.value || (App._editingTripId ? (AppState.trips.find(t => t.id === App._editingTripId)?.jeepDriverId || null) : null);
      const tripJeepDriver = AppState.workers.find(w => w.id === tripJeepDriverId);
      const tripJeepFee = parseFloat(document.getElementById('trip-jeep-fee')?.value) || (tripJeepDriver?.baseRatePerTrip || 250000);

      currentActs.forEach(item => {
        const dNum = parseInt(item.day, 10) || 1;
        if (!dayMap[dNum]) {
          dayMap[dNum] = {
            day: dNum,
            title: item.dayTitle || `Hari ${dNum}`,
            fieldDriverId: item.dayFieldDriverId || (dNum === 1 ? tripFieldDriverId : null),
            fieldDriverName: item.dayFieldDriverName || (dNum === 1 && tripFieldDriver ? tripFieldDriver.name : null),
            fieldDriverUnit: item.dayFieldDriverUnit || (dNum === 1 && tripFieldDriver ? tripFieldDriver.vehicleUnit : null),
            fieldDriverFee: item.dayFieldDriverFee || (dNum === 1 ? tripFieldFee : (tripFieldDriver?.baseRatePerTrip || 175000)),
            activities: []
          };
        }
        const aType = item.activityType || App.inferActivityType(item);
        dayMap[dNum].activities.push({
          id: item.id || ('act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
          time: item.time || '',
          activityType: aType,
          title: item.title || '',
          hotelName: item.hotelName || (aType === 'hotel' ? (item.title.replace(/^Akomodasi:?\s*/i, '').replace(/^Check-in\s*Hotel:?\s*/i, '')) : ''),
          jeepDriverId: item.jeepDriverId || ((aType === 'bromo_sunrise' || aType === 'milky_way') ? tripJeepDriverId : null),
          jeepDriverName: item.jeepDriverName || ((aType === 'bromo_sunrise' || aType === 'milky_way') && tripJeepDriver ? tripJeepDriver.name : null),
          jeepUnit: item.jeepUnit || ((aType === 'bromo_sunrise' || aType === 'milky_way') && tripJeepDriver ? tripJeepDriver.vehicleUnit : null),
          jeepFee: item.jeepFee || ((aType === 'bromo_sunrise' || aType === 'milky_way') ? tripJeepFee : 0),
          photographerId: item.photographerId || null,
          photographerName: item.photographerName || null,
          photographerFee: parseFloat(item.photographerFee) || 0,
          guideName: item.guideName || null,
          guideFee: parseFloat(item.guideFee) || 0,
          operationalDesc: item.operationalDesc || '',
          operationalCost: parseFloat(item.operationalCost) || 0,
          ticketCost: parseFloat(item.ticketCost) || 0,
          hotelCost: parseFloat(item.hotelCost) || 0,
          notes: item.notes || item.description || ''
        });
      });

      days = Object.values(dayMap).sort((a, b) => a.day - b.day);
      if (days.length === 0) {
        days = [
          {
            day: 1,
            title: 'Hari 1 - Eksplorasi Bromo',
            fieldDriverId: tripFieldDriverId,
            fieldDriverName: tripFieldDriver?.name || null,
            fieldDriverUnit: tripFieldDriver?.vehicleUnit || null,
            fieldDriverFee: tripFieldFee,
            activities: [
              {
                id: 'act-' + Date.now() + '-1',
                time: '00:00 - 01:00 WIB',
                activityType: 'shuttle_transfer',
                title: 'Penjemputan Tamu di Meeting Point / Hotel',
                hotelName: '',
                jeepDriverId: null,
                jeepDriverName: null,
                jeepUnit: null,
                jeepFee: 0,
                operationalDesc: 'BBM Shuttle',
                operationalCost: 0,
                ticketCost: 0,
                hotelCost: 0,
                notes: 'Standby tepat waktu'
              },
              {
                id: 'act-' + Date.now() + '-2',
                time: '03:30 - 06:00 WIB',
                activityType: 'bromo_sunrise',
                title: 'Golden Sunrise Point Penanjakan 1',
                hotelName: '',
                jeepDriverId: tripJeepDriverId,
                jeepDriverName: tripJeepDriver?.name || null,
                jeepUnit: tripJeepDriver?.vehicleUnit || null,
                jeepFee: tripJeepFee,
                operationalDesc: 'Jeep Bromo 4x4',
                operationalCost: 0,
                ticketCost: 0,
                hotelCost: 0,
                notes: 'Spot golden sunrise kaldera Bromo'
              }
            ]
          }
        ];
      }
    }

    App._builderState = {
      mode: mode,
      templateId: templateId,
      tourPackage: tourPackage,
      category: category,
      duration: duration,
      price: price,
      description: description,
      days: days,
      activeDay: 1
    };

    const s = App._builderState;
    const isTemplateMode = (s.mode === 'template');
    const isEditTpl = isTemplateMode && !!s.templateId;

    const modalTitle = isTemplateMode 
      ? (isEditTpl ? `Edit Master Template: ${s.tourPackage}` : 'Tambah Master Template Itinerary Baru')
      : 'Penyusun Itinerary & Rincian Biaya Perjalanan';

    const modalSubtitle = isTemplateMode
      ? 'Kelola rancangan rute master multi-hari, durasi, dan estimasi biaya acuan operasional, tiket, serta hotel (tanpa plotting kru)'
      : 'Atur jadwal multi-hari, jenis kegiatan, serta penugasan driver lapangan tiap hari & driver jeep sunrise';

    const existingContainer = document.getElementById('itinerary-builder-modal-container');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.id = 'itinerary-builder-modal-container';
    container.className = 'sub-modal-overlay';
    container.innerHTML = `
      <div class="modal-content" style="max-width: 860px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
        <!-- Modal Header -->
        <div class="modal-header" style="padding: 14px 18px; border-bottom: 1px solid var(--border-glass); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 800; font-size: 15px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <span>🧭</span>
              <span id="modal-builder-title-text">${modalTitle}</span>
              <span class="badge" style="background: ${isTemplateMode ? '#fef3c7' : '#e0f2fe'}; color: ${isTemplateMode ? '#b45309' : '#0369a1'}; font-weight: 700; font-size: 10px;">
                ${isTemplateMode ? 'Template Master' : 'Rute Trip Operasional'}
              </span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              ${modalSubtitle}
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="App.closeItineraryBuilderModal()" title="Tutup">${Icons.x(16)}</button>
        </div>

        <!-- Modal Body Scrollable -->
        <div class="modal-body" style="padding: 14px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px;">
          ${isTemplateMode ? `
            <!-- Template Header Config -->
            <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
              <div class="builder-top-grid">
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Nama Paket Wisata / Template:*</label>
                  <input type="text" id="modal-builder-tour-package" class="form-input" style="font-size: 12px;" value="${(s.tourPackage || '').replace(/"/g, '&quot;')}" placeholder="Contoh: Bromo Sunrise Classic 4 Spot" required />
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Kategori Tur:*</label>
                  <select id="modal-builder-category" class="form-select" style="font-size: 12px;">
                    <option value="bromo_sunrise" ${s.category === 'bromo_sunrise' ? 'selected' : ''}>Sunrise Bromo</option>
                    <option value="milky_way" ${s.category === 'milky_way' ? 'selected' : ''}>Milky Way Night</option>
                    <option value="custom_trip" ${s.category === 'custom_trip' ? 'selected' : ''}>Custom / Private</option>
                    <option value="open_trip" ${s.category === 'open_trip' ? 'selected' : ''}>Open Trip</option>
                  </select>
                </div>
              </div>

              <div class="builder-two-col">
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Estimasi Durasi Tur:*</label>
                  <input type="text" id="modal-builder-duration" class="form-input" style="font-size: 12px;" value="${(s.duration || '').replace(/"/g, '&quot;')}" placeholder="Contoh: 12 Jam / 2 Hari 1 Malam" required oninput="App._builderState.duration = this.value" />
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Harga Paket Acuan (IDR):*</label>
                  <input type="text" inputmode="numeric" id="modal-builder-price" class="form-input currency-input" style="font-size: 12px;" value="${formatNumberDot(s.price || 1750000)}" placeholder="1.750.000" oninput="App.onCurrencyInput(this, v => { App._builderState.price = v; })" required />
                </div>
              </div>

              <div>
                <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Deskripsi & Keunggulan Paket:</label>
                <textarea id="modal-builder-desc" class="form-textarea" rows="2" style="font-size: 12px;" placeholder="Jelaskan ringkasan spot, fasilitas, dan keunggulan paket wisata ini...">${s.description || ''}</textarea>
              </div>

              <!-- Preset Cloner -->
              <div class="builder-preset-strip">
                <span style="font-size: 11px; font-weight: 700; color: #475569; white-space: nowrap;">Salin dari Preset Lain:</span>
                <select id="builder-preset-select" class="form-select" style="font-size: 12px; padding: 4px 8px; flex: 1; min-width: 160px;">
                  <option value="">-- Pilih Template Acuan (Opsional) --</option>
                  ${AppState.templates.filter(t => t.id !== s.templateId).map(tpl => `
                    <option value="${tpl.id}">${tpl.name} (${tpl.duration || '12 Jam'} - ${formatIDR(tpl.defaultPrice)})</option>
                  `).join('')}
                </select>
                <button type="button" class="btn btn-outline btn-sm" style="font-size: 11px; height: 32px; white-space: nowrap;" onclick="App.applyPresetToBuilder(document.getElementById('builder-preset-select')?.value)">
                  ${Icons.refreshCw(12)} <span>Muat</span>
                </button>
                <span class="preset-note" style="font-size: 10px; color: #94a3b8; font-style: italic; margin-left: auto;">*Salin struktur rute dari master lain</span>
              </div>
            </div>
          ` : `
            <!-- Trip Itinerary Config -->
            <div style="background: #ffffff; border: 1px solid var(--border-glass); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
              <div class="builder-top-grid">
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Nama Paket Wisata / Perjalanan:</label>
                  <input type="text" id="modal-builder-tour-package" class="form-input" style="font-size: 12px;" value="${(s.tourPackage || '').replace(/"/g, '&quot;')}" placeholder="Contoh: Bromo Sunrise Classic 4 Spot" />
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #0f172a; display: block; margin-bottom: 2px;">Estimasi Durasi Tur:</label>
                  <input type="text" id="modal-builder-duration" class="form-input" style="font-size: 12px;" value="${(s.duration || '').replace(/"/g, '&quot;')}" placeholder="Contoh: 2 Hari 1 Malam / 12 Jam" oninput="App._builderState.duration = this.value" />
                </div>
              </div>

              <!-- Preset Loader Strip -->
              <div class="builder-preset-strip">
                <span style="font-size: 11px; font-weight: 700; color: #475569; white-space: nowrap;">Gunakan Preset:</span>
                <select id="builder-preset-select" class="form-select" style="font-size: 12px; padding: 5px 8px; flex: 1; min-width: 160px;">
                  <option value="">-- Pilih Template Itinerary Master --</option>
                  ${AppState.templates.map(tpl => `
                    <option value="${tpl.id}">${tpl.name} (${tpl.duration || '12 Jam'} - ${formatIDR(tpl.defaultPrice)})</option>
                  `).join('')}
                </select>
                <button type="button" class="btn btn-outline btn-sm" style="font-size: 11px; white-space: nowrap; height: 32px;" onclick="App.applyPresetToBuilder(document.getElementById('builder-preset-select')?.value)">
                  ${Icons.refreshCw(12)} <span>Muat Preset</span>
                </button>
                <span class="preset-note" style="font-size: 10px; color: #94a3b8; font-style: italic; margin-left: auto;">*Template master tidak akan tertimpa.</span>
              </div>
            </div>
          `}

          <!-- Multi-Day Tabs Header -->
          <div class="builder-day-tabs-wrapper">
            <div id="builder-day-tabs" class="builder-day-tabs-scroll"></div>
            <button type="button" class="btn btn-outline btn-sm" style="color: #059669; border-color: #a7f3d0; font-weight: 700; font-size: 11px; padding: 5px 10px; white-space: nowrap; flex-shrink: 0;" onclick="App.addBuilderDay()">
              ${Icons.plus(12)} <span>+ Tambah Hari</span>
            </button>
          </div>

          <!-- Active Day Content Card -->
          <div id="builder-day-view" style="background: #f8fafc; border: 1px solid var(--border-glass); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
            <!-- Filled by App.renderBuilderDayView() -->
          </div>

          <!-- Total Budget Summary Card -->
          <div class="builder-totals-card" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Estimasi Total Pengeluaran Itinerary:</span>
              <div style="font-size: 11px; color: #15803d;">Biaya langsung seluruh spot kegiatan, tiket bromo, dan kru di rute ini</div>
            </div>
            <div class="builder-totals-list" style="display: flex; gap: 8px; font-size: 11px; align-items: center; flex-wrap: wrap;">
              <div>🎟️ Tiket: <strong id="builder-total-ticket" style="color: #ea580c;">Rp 0</strong></div>
              <div>🚙 Jeep: <strong id="builder-total-jeep" style="color: #b45309;">Rp 0</strong></div>
              <div>📷 Foto: <strong id="builder-total-photo" style="color: #7c3aed;">Rp 0</strong></div>
              <div>🚩 Guide: <strong id="builder-total-guide" style="color: #0d9488;">Rp 0</strong></div>
              ${!isTemplateMode ? `<div>🚐 Driver Lapangan: <strong id="builder-total-driver" style="color: #0369a1;">Rp 0</strong></div>` : ''}
              <div>🛠️ Ops: <strong id="builder-total-op" style="color: #dc2626;">Rp 0</strong></div>
              <div>🏨 Hotel: <strong id="builder-total-hotel" style="color: #6d28d9;">Rp 0</strong></div>
              <div class="builder-grand-total-item" style="border-left: 2px solid #86efac; padding-left: 10px;">
                Total: <strong id="builder-grand-total" style="font-size: 14px; color: #15803d; font-weight: 800;">Rp 0</strong>
              </div>
            </div>
          </div>

          ${!isTemplateMode ? `
            <!-- Option to Save this Itinerary as New Master Template (Clean without crew) -->
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: #1e293b; user-select: none;">
                <input type="checkbox" id="builder-chk-save-as-template" onchange="App.toggleBuilderSaveAsTemplate(this.checked)" />
                <span>Simpan juga sebagai Template Master Baru di Database (tanpa menyimpan kru)</span>
              </label>
              <div id="builder-save-as-template-fields" style="display: none; flex-direction: column; gap: 8px; margin-top: 4px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
                  <div>
                    <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Nama Template Master Baru:*</label>
                    <input type="text" id="builder-new-template-name" class="form-input" style="font-size: 11px;" placeholder="Contoh: Bromo Sunrise 2D1N (Standar)" />
                  </div>
                  <div>
                    <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Kategori Master:*</label>
                    <select id="builder-new-template-category" class="form-select" style="font-size: 11px;">
                      <option value="bromo_sunrise">Sunrise Bromo</option>
                      <option value="milky_way">Milky Way Night</option>
                      <option value="custom_trip">Custom / Private</option>
                      <option value="open_trip">Open Trip</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Deskripsi Template Master:</label>
                  <input type="text" id="builder-new-template-description" class="form-input" style="font-size: 11px;" placeholder="Keterangan singkat paket master untuk agen..." />
                </div>
                <div style="font-size: 10px; color: #0284c7;">
                  ℹ️ Template master akan tersimpan bersih berisi jenis spot, estimasi biaya, dan hotel tanpa data plotting kru.
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer builder-modal-footer" style="padding: 12px 18px; border-top: 1px solid var(--border-glass); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
          <button type="button" class="btn btn-outline" onclick="App.closeItineraryBuilderModal()">Batal</button>
          <button type="button" class="btn btn-primary" id="btn-submit-builder" onclick="App.saveItineraryBuilder()" style="display: flex; align-items: center; gap: 6px; font-weight: 700; background: #059669; border-color: #059669;">
            ${Icons.check(14)}
            <span>${isTemplateMode ? (isEditTpl ? 'Simpan Perubahan Master' : 'Buat Template Master') : 'Terapkan ke Perjalanan (Trip)'}</span>
          </button>
        </div>

        <!-- Global Datalist for Hotel Recommendations -->
        <datalist id="hotel-preset-datalist">
          <option value="Hotel Tugu Malang">
          <option value="Grand Mercure Malang Mirama">
          <option value="Hotel Santika Premiere Malang">
          <option value="Lava View Lodge Bromo">
          <option value="Bromo Terrace Hotel">
          <option value="Whiz Prime Hotel Bromo">
          <option value="Plataran Bromo Resort & Spa">
          <option value="Jiwa Jawa Resort Bromo">
          <option value="Swiss-Belinn Malang">
          <option value="Ijen Suites Resort & Convention Malang">
          <option value="Hotel Harris Malang">
          <option value="Cemara Indah Hotel Bromo">
        </datalist>
      </div>
    `;

    document.body.appendChild(container);

    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
  },

  renderBuilderDayTabs() {
    const s = App._builderState;
    const container = document.getElementById('builder-day-tabs');
    if (!container) return;

    container.innerHTML = s.days.map(d => `
      <div class="builder-day-tab ${d.day === s.activeDay ? 'active' : ''}" onclick="App.switchBuilderDay(${d.day})">
        <span>Hari ${d.day}</span>
        ${s.mode === 'trip' && d.fieldDriverName ? `<span style="font-size: 9px; opacity: 0.9;">(🚐 ${d.fieldDriverName.split(' ')[0]})</span>` : ''}
        <span class="badge" style="font-size: 9px; padding: 1px 5px; background: ${d.day === s.activeDay ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}; color: ${d.day === s.activeDay ? '#ffffff' : '#475569'};">${d.activities.length} spot</span>
      </div>
    `).join('');
  },

  renderBuilderDayView() {
    const s = App._builderState;
    const container = document.getElementById('builder-day-view');
    if (!container) return;

    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay) return;

    const isTemplateMode = (s.mode === 'template');
    const fieldDrivers = AppState.workers.filter(w => w.role === 'driver_lapangan');
    const jeepDrivers = AppState.workers.filter(w => w.role === 'driver_jeep');
    const photographers = AppState.workers.filter(w => w.role === 'photographer');
    const guides = AppState.workers.filter(w => w.role === 'guide');
    const tripDate = document.getElementById('trip-date')?.value || new Date().toISOString().split('T')[0];
    const tripTimeSlot = document.getElementById('trip-time-slot')?.value || '02:00 WIB (Sunrise)';
    const editTripId = App._editingTripId || null;

    // Field Driver Detail card for active day in trip mode
    let dayFieldDriverDetail = '';
    if (!isTemplateMode && curDay.fieldDriverId) {
      const fWorker = AppState.workers.find(w => w.id === curDay.fieldDriverId);
      if (fWorker) {
        const avail = App.getCrewAvailability(fWorker.id, tripDate, tripTimeSlot, editTripId);
        dayFieldDriverDetail = `
          <div style="font-size: 11px; padding: 6px 10px; background: #ffffff; border: 1px solid #bae6fd; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div>
              <strong style="color: #0369a1;">${fWorker.name}</strong> (${(fWorker.type || 'internal').toUpperCase()})
              <span style="color: #64748b;"> &bull; Armada: <strong>${fWorker.vehicleUnit || 'HiAce / Shuttle'}</strong></span>
              ${fWorker.phone ? ` &bull; WA: <a href="${createWhatsAppUrl(fWorker.phone, '')}" target="_blank" style="color: #059669; font-weight: 600;">${fWorker.phone}</a>` : ''}
            </div>
            <div>
              <span class="badge ${avail.isAvailable ? 'badge-internal' : 'badge-danger'}" style="font-size: 10px;">${avail.badgeText}</span>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <!-- Day Header -->
      <div class="builder-day-header">
        <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 800; font-size: 13px; color: #0284c7; white-space: nowrap;">📅 Hari ${curDay.day}:</span>
          <input type="text" class="form-input" style="font-size: 12px; font-weight: 700; flex: 1; min-width: 160px;" value="${(curDay.title || '').replace(/"/g, '&quot;')}" oninput="App.onActiveDayTitleChange(this.value)" placeholder="Rute / Agenda Hari ${curDay.day}" />
        </div>
        ${s.days.length > 1 ? `
          <button type="button" class="btn btn-danger btn-sm" style="font-size: 11px; padding: 4px 8px; white-space: nowrap;" onclick="App.removeBuilderDay(${curDay.day})">
            ${Icons.trash(12)} <span>Hapus Hari</span>
          </button>
        ` : ''}
      </div>

      <!-- Field Driver Plotting Per Day (Trip Mode Only) -->
      ${!isTemplateMode ? `
        <div class="builder-day-driver-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 800; font-size: 12px; color: #0369a1; display: flex; align-items: center; gap: 6px;">
              <span>🚐 Plotting Driver Lapangan / Shuttle (Hari ${curDay.day}):</span>
            </div>
            <span style="font-size: 10px; color: #0284c7; font-weight: 600;">Pilihan Driver Lapangan per Hari</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 140px; gap: 8px;">
            <div>
              <select class="form-select day-field-driver-select" style="font-size: 11px; font-weight: 600;" onchange="App.onDayFieldDriverChange(${curDay.day}, this.value)">
                <option value="">-- Belum Ditugaskan / Tanpa Driver Lapangan --</option>
                ${fieldDrivers.map(w => {
                  const avail = App.getCrewAvailability(w.id, tripDate, tripTimeSlot, editTripId);
                  return `
                    <option value="${w.id}" data-name="${w.name}" data-unit="${w.vehicleUnit || 'HiAce'}" data-rate="${w.baseRatePerTrip}" ${curDay.fieldDriverId === w.id ? 'selected' : ''}>
                      ${w.name} (${(w.type || 'internal').toUpperCase()}) • ${w.vehicleUnit || 'Shuttle'} • ${avail.badgeText}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>
            <div>
              <input type="text" inputmode="numeric" class="form-input currency-input day-field-driver-fee" style="font-size: 11px;" placeholder="Tarif Driver" value="${formatNumberDot(curDay.fieldDriverFee || 175000)}" title="Tarif / Honor Driver Lapangan Hari ${curDay.day}" oninput="App.onCurrencyInput(this); App.onDayFieldDriverFeeChange(${curDay.day}, this.value)" />
            </div>
          </div>
          ${dayFieldDriverDetail}
        </div>
      ` : `
        <div style="font-size: 10px; color: #0369a1; background: #f0f9ff; border: 1px dashed #bae6fd; border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 6px;">
          <span>ℹ️ <em>Template Master: Driver lapangan per hari diatur saat penyusunan trip perjalanan (bukan di template master).</em></span>
        </div>
      `}

      <!-- Activities List Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
        <span style="font-size: 12px; font-weight: 800; color: #0f172a;">
          Daftar Kegiatan & Spot Wisata Hari ${curDay.day} (${curDay.activities.length} Kegiatan):
        </span>
        <button type="button" class="btn btn-outline btn-sm" style="font-size: 11px; color: #0284c7; border-color: #bae6fd; padding: 4px 8px;" onclick="App.addBuilderActivity()">
          ${Icons.plus(12)} <span>+ Tambah Kegiatan</span>
        </button>
      </div>

      <!-- Activities Cards -->
      <div id="builder-activities-list" style="display: flex; flex-direction: column; gap: 8px;">
        ${curDay.activities.map((act, idx) => {
          const actType = act.activityType || App.inferActivityType(act);
          const typeObj = App.ACTIVITY_TYPES.find(t => t.id === actType) || App.ACTIVITY_TYPES[0];

          let jeepDetailInfo = '';
          if (!isTemplateMode && act.jeepDriverId) {
            const jWorker = AppState.workers.find(w => w.id === act.jeepDriverId);
            if (jWorker) {
              const avail = App.getCrewAvailability(jWorker.id, tripDate, tripTimeSlot, editTripId);
              jeepDetailInfo = `
                <div style="font-size: 10px; padding: 4px 8px; background: #ffffff; border: 1px solid #fde68a; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-top: 4px;">
                  <div>
                    <strong style="color: #b45309;">${jWorker.name}</strong> (${(jWorker.type || 'internal').toUpperCase()})
                    <span style="color: #64748b;"> &bull; Armada: <strong>${jWorker.vehicleUnit || 'Hardtop 4x4'}</strong></span>
                    ${jWorker.phone ? ` &bull; WA: <a href="${createWhatsAppUrl(jWorker.phone, '')}" target="_blank" style="color: #059669; font-weight: 600;">${jWorker.phone}</a>` : ''}
                  </div>
                  <span class="badge ${avail.isAvailable ? 'badge-internal' : 'badge-danger'}" style="font-size: 9px;">${avail.badgeText}</span>
                </div>
              `;
            }
          }

          let photoDetailInfo = '';
          if (!isTemplateMode && act.photographerId) {
            const pWorker = AppState.workers.find(w => w.id === act.photographerId);
            if (pWorker) {
              const avail = App.getCrewAvailability(pWorker.id, tripDate, tripTimeSlot, editTripId);
              photoDetailInfo = `
                <div style="font-size: 10px; padding: 4px 8px; background: #ffffff; border: 1px solid #ddd6fe; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-top: 4px;">
                  <div>
                    <strong style="color: #6d28d9;">📷 ${pWorker.name}</strong> (${(pWorker.type || 'internal').toUpperCase()})
                    ${pWorker.phone ? ` &bull; WA: <a href="${createWhatsAppUrl(pWorker.phone, '')}" target="_blank" style="color: #059669; font-weight: 600;">${pWorker.phone}</a>` : ''}
                  </div>
                  <span class="badge ${avail.isAvailable ? 'badge-internal' : 'badge-danger'}" style="font-size: 9px;">${avail.badgeText}</span>
                </div>
              `;
            }
          }

          let guideDetailInfo = '';
          if (!isTemplateMode && act.guideName) {
            const gWorker = AppState.workers.find(w => w.name === act.guideName || (w.role === 'guide' && w.name.toLowerCase() === act.guideName.toLowerCase()));
            guideDetailInfo = `
              <div style="font-size: 10px; padding: 4px 8px; background: #ffffff; border: 1px solid #a7f3d0; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-top: 4px;">
                <div>
                  <strong style="color: #047857;">🧭 ${act.guideName}</strong> <span class="badge badge-guide" style="font-size: 9px;">GUIDE</span>
                  ${gWorker?.phone ? ` &bull; WA: <a href="${createWhatsAppUrl(gWorker.phone, '')}" target="_blank" style="color: #047857; font-weight: 600;">${gWorker.phone}</a>` : ''}
                </div>
                <span style="font-size: 9px; color: #065f46; font-weight: 700;">Honor: ${formatIDR(act.guideFee || 0)}</span>
              </div>
            `;
          }

          return `
            <div class="builder-activity-card" data-idx="${idx}">
              <!-- Top bar: Kegiatan #idx, Activity Type Selector, and Delete button -->
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 240px;">
                  <span style="font-size: 11px; font-weight: 800; color: #0284c7; white-space: nowrap;">Kegiatan #${idx + 1}</span>
                  
                  <!-- Jenis Kegiatan Selector -->
                  <div style="flex: 1; min-width: 200px;">
                    <select class="form-select act-type" style="font-size: 11px; font-weight: 700; padding: 4px 8px; border-color: ${typeObj.color};" onchange="App.onBuilderActivityTypeChange(${idx}, this.value)">
                      ${App.ACTIVITY_TYPES.map(t => `
                        <option value="${t.id}" ${actType === t.id ? 'selected' : ''}>${t.label}</option>
                      `).join('')}
                    </select>
                  </div>
                </div>

                <button type="button" class="btn btn-danger btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="App.removeBuilderActivity(${idx})" title="Hapus Kegiatan">
                  ${Icons.trash(12)} <span>Hapus</span>
                </button>
              </div>

              <!-- Time & Title Grid -->
              <div class="builder-act-header-grid">
                <div>
                  <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Jam / Waktu (Opsional):</label>
                  <input type="text" class="form-input act-time" style="font-size: 11px; padding: 4px 8px;" placeholder="03:30 / Fleksibel" value="${(act.time || '').replace(/"/g, '&quot;')}" oninput="App.syncBuilderCardToState(${idx})" />
                </div>
                <div>
                  <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">
                    ${actType === 'hotel' ? 'Nama Agenda / Check-in Hotel:*' : 'Nama Kegiatan / Agenda:*'}
                  </label>
                  <input type="text" class="form-input act-title" style="font-size: 11px; padding: 4px 8px; font-weight: 600;" placeholder="${actType === 'hotel' ? 'Contoh: Check-in Hotel & Istirahat' : 'Nama spot / agenda kegiatan'}" value="${(act.title || '').replace(/"/g, '&quot;')}" required oninput="App.syncBuilderCardToState(${idx})" />
                </div>
              </div>

              <!-- Special Conditional: Akomodasi (Hotel) -->
              ${actType === 'hotel' ? `
                <div class="builder-hotel-box">
                  <div style="font-size: 11px; font-weight: 700; color: #6d28d9; display: flex; align-items: center; gap: 6px;">
                    <span>🏨 Detail Akomodasi Hotel:</span>
                  </div>
                  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
                    <div>
                      <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Nama Hotel / Penginapan:*</label>
                      <input type="text" list="hotel-preset-datalist" class="form-input act-hotel-name" style="font-size: 11px; padding: 4px 8px; font-weight: 700; color: #4c1d95; border-color: #a78bfa;" placeholder="Ketik atau pilih nama hotel..." value="${(act.hotelName || '').replace(/"/g, '&quot;')}" oninput="App.onHotelNameInput(${idx}, this.value)" />
                    </div>
                    <div>
                      <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Pilihan Cepat Hotel:</label>
                      <select class="form-select" style="font-size: 11px; padding: 4px 6px;" onchange="if(this.value){ App.onHotelNameInput(${idx}, this.value); }">
                        <option value="">-- Hotel Populer --</option>
                        ${(typeObj.presetHotels || []).map(h => `<option value="${h}" ${act.hotelName === h ? 'selected' : ''}>${h}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Special Conditional: Bromo Sunrise/Sunset/Milky Way Crew Plotting (Driver Jeep, Fotografer, Guide) -->
              ${(actType === 'bromo_sunrise' || actType === 'milky_way') ? (
                !isTemplateMode ? `
                  <div class="builder-jeep-box">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #fde68a; padding-bottom: 6px;">
                      <div style="font-size: 11px; font-weight: 800; color: #b45309; display: flex; align-items: center; gap: 6px;">
                        <span>🌋 Plotting Kru Bromo (Jeep 4x4, Fotografer & Guide):</span>
                      </div>
                      <span style="font-size: 10px; color: #92400e; font-weight: 600;">Sesi Kaldera & Sunrise</span>
                    </div>

                    <!-- 1. Driver Jeep & Armada 4x4 -->
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 10px; font-weight: 700; color: #92400e; margin-bottom: 0;">1. Driver Jeep & Armada 4x4:*</label>
                        <span style="font-size: 10px; color: #b45309;">Tarif Jeep (IDR)</span>
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 140px; gap: 8px;">
                        <div>
                          <select class="form-select act-jeep-driver" style="font-size: 11px; padding: 4px 8px; font-weight: 600;" onchange="App.onActivityJeepDriverChange(${idx}, this.value)">
                            <option value="">-- Pilih Driver Jeep & Unit 4x4 --</option>
                            ${jeepDrivers.map(w => {
                              const avail = App.getCrewAvailability(w.id, tripDate, tripTimeSlot, editTripId);
                              return `
                                <option value="${w.id}" data-name="${w.name}" data-unit="${w.vehicleUnit || 'Hardtop'}" data-rate="${w.baseRatePerTrip}" ${act.jeepDriverId === w.id ? 'selected' : ''}>
                                  ${w.name} (${(w.type || 'internal').toUpperCase()}) • ${w.vehicleUnit || 'Hardtop'} • ${avail.badgeText}
                                </option>
                              `;
                            }).join('')}
                          </select>
                        </div>
                        <div>
                          <input type="text" inputmode="numeric" class="form-input currency-input act-jeep-fee" style="font-size: 11px; padding: 4px 8px;" placeholder="250.000" value="${formatNumberDot(act.jeepFee || 250000)}" title="Tarif / Honor Driver Jeep" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                        </div>
                      </div>
                      ${jeepDetailInfo}
                    </div>

                    <!-- 2. Fotografer Dokumentasi (Opsional) -->
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 10px; font-weight: 700; color: #92400e; margin-bottom: 0;">2. Fotografer Dokumentasi (Opsional):</label>
                        <span style="font-size: 10px; color: #b45309;">Honor Foto (IDR)</span>
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 140px; gap: 8px;">
                        <div>
                          <select class="form-select act-photo-driver" style="font-size: 11px; padding: 4px 8px; font-weight: 600;" onchange="App.onActivityPhotographerChange(${idx}, this.value)">
                            <option value="">-- Tanpa Fotografer (Opsional) --</option>
                            ${photographers.map(w => {
                              const avail = App.getCrewAvailability(w.id, tripDate, tripTimeSlot, editTripId);
                              return `
                                <option value="${w.id}" data-name="${w.name}" data-rate="${w.baseRatePerTrip || 200000}" ${act.photographerId === w.id ? 'selected' : ''}>
                                  ${w.name} (${(w.type || 'internal').toUpperCase()}) • ${avail.badgeText}
                                </option>
                              `;
                            }).join('')}
                          </select>
                        </div>
                        <div>
                          <input type="text" inputmode="numeric" class="form-input currency-input act-photo-fee" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.photographerFee || 0)}" title="Tarif / Honor Fotografer" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                        </div>
                      </div>
                      ${photoDetailInfo}
                    </div>

                    <!-- 3. Tour Guide / Pemandu (Opsional) -->
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 10px; font-weight: 700; color: #92400e; margin-bottom: 0;">3. Tour Guide / Pemandu (Opsional):</label>
                        <span style="font-size: 10px; color: #b45309;">Honor Guide (IDR)</span>
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 140px; gap: 8px;">
                        <div>
                          <input type="text" class="form-input act-guide-name" list="builder-guides-list-${idx}" style="font-size: 11px; padding: 4px 8px; font-weight: 600;" placeholder="Pilih / Ketik Nama Tour Guide" value="${act.guideName || ''}" onchange="App.onActivityGuideChange(${idx}, this.value)" oninput="App.syncBuilderCardToState(${idx})" />
                          <datalist id="builder-guides-list-${idx}">
                            ${guides.map(g => `<option value="${g.name}">${g.name} (${g.phone})</option>`).join('')}
                          </datalist>
                        </div>
                        <div>
                          <input type="text" inputmode="numeric" class="form-input currency-input act-guide-fee" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.guideFee || 0)}" title="Tarif / Honor Tour Guide" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                        </div>
                      </div>
                      ${guideDetailInfo}
                    </div>
                  </div>
                ` : `
                  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div style="font-size: 11px; font-weight: 800; color: #b45309; display: flex; align-items: center; gap: 6px;">
                        <span>🌋 Estimasi Biaya Kru Bromo (Master Acuan):</span>
                      </div>
                      <span style="font-size: 10px; color: #92400e; font-weight: 600;">Acuan Biaya Template</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #92400e; display: block; margin-bottom: 2px;">🚙 Est. Sewa Jeep 4x4 (IDR):*</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-jeep-fee" style="font-size: 11px; padding: 4px 8px;" placeholder="250.000" value="${formatNumberDot(act.jeepFee || 250000)}" title="Estimasi Sewa Jeep 4x4" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #92400e; display: block; margin-bottom: 2px;">📷 Est. Fotografer (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-photo-fee" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.photographerFee || 0)}" title="Estimasi Honor Fotografer" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #92400e; display: block; margin-bottom: 2px;">🚩 Est. Tour Guide (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-guide-fee" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.guideFee || 0)}" title="Estimasi Honor Tour Guide" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                    </div>
                    <div style="font-size: 9px; color: #b45309; font-style: italic;">
                      *Personil kru spesifik akan dipilih saat membuat jadwal perjalanan (Trip). Nominal ini digunakan untuk estimasi pengeluaran template.
                    </div>
                  </div>
                `
              ) : ''}

              <!-- Dynamic Costs Grid (Menyesuaikan Jenis Kegiatan) -->
              ${(() => {
                if (actType === 'hotel') {
                  return `
                    <div class="builder-cost-grid" style="grid-template-columns: 1fr;">
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #6d28d9; display: block; margin-bottom: 2px;">Biaya Hotel / Nginap (IDR):*</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-hotel-cost" style="font-size: 11px; padding: 4px 8px; border-color: #a78bfa; font-weight: 700; color: #6d28d9; background: #faf5ff;" placeholder="0" value="${formatNumberDot(act.hotelCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                    </div>
                  `;
                } else if (actType === 'shuttle_transfer') {
                  return `
                    <div class="builder-cost-grid" style="grid-template-columns: 1fr;">
                      <div>
                        <label style="font-size: 10px; font-weight: 600; color: #0284c7; display: block; margin-bottom: 2px;">Biaya Operasional Shuttle / Armada (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-op-cost" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.operationalCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                    </div>
                  `;
                } else if (actType === 'kuliner') {
                  return `
                    <div class="builder-cost-grid" style="grid-template-columns: 1fr;">
                      <div>
                        <label style="font-size: 10px; font-weight: 600; color: #e11d48; display: block; margin-bottom: 2px;">Biaya Konsumsi / Makan / Resto (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-op-cost" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.operationalCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                    </div>
                  `;
                } else if (actType === 'bromo_sunrise' || actType === 'milky_way') {
                  return `
                    <div class="builder-cost-grid" style="grid-template-columns: 1fr 140px 140px; gap: 8px;">
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #ea580c; display: block; margin-bottom: 2px;">🎟️ Tiket Masuk Bromo (Keterangan / Pax):*</label>
                        <input type="text" class="form-input act-ticket-name" style="font-size: 11px; padding: 4px 8px;" placeholder="Contoh: Tiket Masuk TNBTS Bromo (Domestik / 4 Pax)" value="${(act.ticketName || 'Tiket TNBTS Bromo').replace(/"/g, '&quot;')}" oninput="App.syncBuilderCardToState(${idx})" />
                      </div>
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #ea580c; display: block; margin-bottom: 2px;">Harga Tiket Bromo (IDR):*</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-ticket-cost" style="font-size: 11px; padding: 4px 8px; font-weight: 700; color: #ea580c;" placeholder="0" value="${formatNumberDot(act.ticketCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                      <div>
                        <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Biaya Ops Tambahan (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-op-cost" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.operationalCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                    </div>
                  `;
                } else {
                  return `
                    <div class="builder-cost-grid" style="grid-template-columns: 1fr 140px 140px; gap: 8px;">
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #ea580c; display: block; margin-bottom: 2px;">🎟️ Keterangan Tiket / Retribusi:</label>
                        <input type="text" class="form-input act-ticket-name" style="font-size: 11px; padding: 4px 8px;" placeholder="Contoh: Tiket Retribusi Wisata" value="${(act.ticketName || '').replace(/"/g, '&quot;')}" oninput="App.syncBuilderCardToState(${idx})" />
                      </div>
                      <div>
                        <label style="font-size: 10px; font-weight: 700; color: #ea580c; display: block; margin-bottom: 2px;">Harga Tiket (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-ticket-cost" style="font-size: 11px; padding: 4px 8px; font-weight: 700; color: #ea580c;" placeholder="0" value="${formatNumberDot(act.ticketCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                      <div>
                        <label style="font-size: 10px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Biaya Operasional (IDR):</label>
                        <input type="text" inputmode="numeric" class="form-input currency-input act-op-cost" style="font-size: 11px; padding: 4px 8px;" placeholder="0" value="${formatNumberDot(act.operationalCost || 0)}" oninput="App.onCurrencyInput(this); App.syncBuilderCardToState(${idx})" />
                      </div>
                    </div>
                  `;
                }
              })()}

              <!-- Notes & Operational Description -->
              <div class="builder-act-notes-grid">
                <div>
                  <label style="font-size: 10px; font-weight: 600; color: #64748b; display: block; margin-bottom: 2px;">Keterangan Operasional:</label>
                  <input type="text" class="form-input act-op-desc" style="font-size: 11px; padding: 4px 8px;" placeholder="Contoh: Sewa jeep, armada shuttle, bensin" value="${(act.operationalDesc || '').replace(/"/g, '&quot;')}" oninput="App.syncBuilderCardToState(${idx})" />
                </div>
                <div>
                  <label style="font-size: 10px; font-weight: 600; color: #64748b; display: block; margin-bottom: 2px;">Catatan Khusus Aktivitas:</label>
                  <input type="text" class="form-input act-notes" style="font-size: 11px; padding: 4px 8px;" placeholder="Contoh: Bawa jaket tebal, voucher kamar" value="${(act.notes || '').replace(/"/g, '&quot;')}" oninput="App.syncBuilderCardToState(${idx})" />
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    App.updateBuilderTotals();
  },

  onActiveDayTitleChange(val) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (curDay) curDay.title = val;
  },

  onDayFieldDriverChange(dayNum, workerId) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === dayNum);
    if (!curDay) return;

    curDay.fieldDriverId = workerId || null;
    const w = AppState.workers.find(u => u.id === workerId);
    if (w) {
      curDay.fieldDriverName = w.name;
      curDay.fieldDriverUnit = w.vehicleUnit || 'HiAce / Shuttle';
      if (!curDay.fieldDriverFee || curDay.fieldDriverFee === 0) {
        curDay.fieldDriverFee = w.baseRatePerTrip || 175000;
      }
    } else {
      curDay.fieldDriverName = null;
      curDay.fieldDriverUnit = null;
    }

    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
  },

  onDayFieldDriverFeeChange(dayNum, fee) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === dayNum);
    if (curDay) {
      curDay.fieldDriverFee = parseNumberDot(fee) || 0;
      App.updateBuilderTotals();
    }
  },

  onBuilderActivityTypeChange(actIdx, newType) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;
    const act = curDay.activities[actIdx];

    const typeObj = App.ACTIVITY_TYPES.find(t => t.id === newType) || App.ACTIVITY_TYPES[0];
    act.activityType = newType;

    // Adjust costs automatically based on activity type
    act.operationalCost = typeObj.defaultOpCost;
    act.ticketCost = typeObj.defaultTicketCost;
    act.hotelCost = typeObj.defaultHotelCost;

    if (!act.time && typeObj.defaultTime) {
      act.time = typeObj.defaultTime;
    }
    if (!act.operationalDesc && typeObj.defaultOpDesc) {
      act.operationalDesc = typeObj.defaultOpDesc;
    }
    if (!act.notes && typeObj.defaultNotes) {
      act.notes = typeObj.defaultNotes;
    }

    if (newType === 'hotel') {
      if (!act.hotelName) {
        act.hotelName = 'Hotel Tugu Malang';
      }
      act.title = `Akomodasi: ${act.hotelName}`;
    } else if (newType === 'bromo_sunrise' || newType === 'milky_way') {
      act.title = typeObj.defaultTitle;
      // Default to trip's jeep driver if trip mode
      if (s.mode === 'trip' && !act.jeepDriverId) {
        const tripJeepId = document.getElementById('trip-jeep-driver')?.value || (App._editingTripId ? (AppState.trips.find(t => t.id === App._editingTripId)?.jeepDriverId || null) : null);
        if (tripJeepId) {
          const w = AppState.workers.find(u => u.id === tripJeepId);
          if (w) {
            act.jeepDriverId = w.id;
            act.jeepDriverName = w.name;
            act.jeepUnit = w.vehicleUnit || 'Hardtop 4x4';
            act.jeepFee = parseFloat(document.getElementById('trip-jeep-fee')?.value) || w.baseRatePerTrip || 250000;
          }
        }
      }
    } else {
      act.title = typeObj.defaultTitle;
    }

    App.renderBuilderDayView();
    App.updateBuilderTotals();
  },

  onHotelNameInput(actIdx, hotelName) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;
    const act = curDay.activities[actIdx];

    act.hotelName = hotelName;
    act.title = hotelName ? `Akomodasi: ${hotelName}` : 'Check-in Hotel & Istirahat';

    const card = document.querySelectorAll('#builder-activities-list .builder-activity-card')[actIdx];
    if (card) {
      const titleInp = card.querySelector('.act-title');
      if (titleInp) titleInp.value = act.title;
      const hotelInp = card.querySelector('.act-hotel-name');
      if (hotelInp && hotelInp.value !== hotelName) hotelInp.value = hotelName;
    }
    App.syncBuilderCardToState(actIdx);
  },

  onActivityJeepDriverChange(actIdx, workerId) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;
    const act = curDay.activities[actIdx];

    act.jeepDriverId = workerId || null;
    const w = AppState.workers.find(u => u.id === workerId);
    if (w) {
      act.jeepDriverName = w.name;
      act.jeepUnit = w.vehicleUnit || 'Hardtop 4x4';
      if (!act.jeepFee || act.jeepFee === 0) {
        act.jeepFee = w.baseRatePerTrip || 250000;
      }
    } else {
      act.jeepDriverName = null;
      act.jeepUnit = null;
    }

    App.renderBuilderDayView();
  },

  onActivityPhotographerChange(actIdx, workerId) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;
    const act = curDay.activities[actIdx];

    act.photographerId = workerId || null;
    const w = AppState.workers.find(u => u.id === workerId);
    if (w) {
      act.photographerName = w.name;
      if (!act.photographerFee || act.photographerFee === 0) {
        act.photographerFee = w.baseRatePerTrip || 200000;
      }
    } else {
      act.photographerName = null;
      act.photographerFee = 0;
    }

    App.renderBuilderDayView();
  },

  onActivityGuideChange(actIdx, guideName) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;
    const act = curDay.activities[actIdx];

    act.guideName = guideName ? guideName.trim() : null;
    const gName = act.guideName;
    if (gName) {
      const w = AppState.workers.find(u => u.name.toLowerCase() === gName.toLowerCase() || (u.role === 'guide' && u.name.toLowerCase().includes(gName.toLowerCase())));
      if (w && (!act.guideFee || act.guideFee === 0)) {
        act.guideFee = w.baseRatePerTrip || 200000;
      }
    } else {
      act.guideFee = 0;
    }

    App.renderBuilderDayView();
  },

  pickSpotPreset(actIdx, spotTitle) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;

    curDay.activities[actIdx].title = spotTitle;
    const card = document.querySelectorAll('#builder-activities-list .builder-activity-card')[actIdx];
    if (card) {
      const titleInp = card.querySelector('.act-title');
      if (titleInp) titleInp.value = spotTitle;
    }
    App.syncBuilderCardToState(actIdx);
  },

  syncBuilderCardToState(idx) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[idx]) return;

    const cards = document.querySelectorAll('#builder-activities-list .builder-activity-card');
    const card = cards[idx];
    if (!card) return;

    curDay.activities[idx].time = card.querySelector('.act-time')?.value.trim() || '';
    curDay.activities[idx].title = card.querySelector('.act-title')?.value.trim() || '';
    if (card.querySelector('.act-hotel-name')) {
      curDay.activities[idx].hotelName = card.querySelector('.act-hotel-name')?.value.trim() || '';
    }
    if (card.querySelector('.act-ticket-name')) {
      curDay.activities[idx].ticketName = card.querySelector('.act-ticket-name')?.value.trim() || '';
    }
    if (card.querySelector('.act-jeep-fee')) {
      curDay.activities[idx].jeepFee = parseNumberDot(card.querySelector('.act-jeep-fee')?.value) || 0;
    }
    if (card.querySelector('.act-photo-fee')) {
      curDay.activities[idx].photographerFee = parseNumberDot(card.querySelector('.act-photo-fee')?.value) || 0;
    }
    if (card.querySelector('.act-guide-name')) {
      curDay.activities[idx].guideName = card.querySelector('.act-guide-name')?.value.trim() || '';
    }
    if (card.querySelector('.act-guide-fee')) {
      curDay.activities[idx].guideFee = parseNumberDot(card.querySelector('.act-guide-fee')?.value) || 0;
    }
    curDay.activities[idx].operationalCost = card.querySelector('.act-op-cost') ? (parseNumberDot(card.querySelector('.act-op-cost').value) || 0) : 0;
    curDay.activities[idx].ticketCost = card.querySelector('.act-ticket-cost') ? (parseNumberDot(card.querySelector('.act-ticket-cost').value) || 0) : 0;
    curDay.activities[idx].hotelCost = card.querySelector('.act-hotel-cost') ? (parseNumberDot(card.querySelector('.act-hotel-cost').value) || 0) : 0;
    curDay.activities[idx].operationalDesc = card.querySelector('.act-op-desc')?.value.trim() || '';
    curDay.activities[idx].notes = card.querySelector('.act-notes')?.value.trim() || '';

    App.updateBuilderTotals();
  },

  addBuilderDay() {
    const s = App._builderState;
    const nextDayNum = s.days.length + 1;
    const day1 = s.days[0];
    const defDriverId = s.mode === 'trip' && day1 ? day1.fieldDriverId : null;
    const defDriverName = s.mode === 'trip' && day1 ? day1.fieldDriverName : null;
    const defDriverUnit = s.mode === 'trip' && day1 ? day1.fieldDriverUnit : null;
    const defDriverFee = s.mode === 'trip' && day1 ? day1.fieldDriverFee : 175000;

    s.days.push({
      day: nextDayNum,
      title: `Hari ${nextDayNum} - Eksplorasi Lanjutan`,
      fieldDriverId: defDriverId,
      fieldDriverName: defDriverName,
      fieldDriverUnit: defDriverUnit,
      fieldDriverFee: defDriverFee,
      activities: [
        {
          id: 'act-' + Date.now(),
          time: '08:00 WIB',
          activityType: 'spot_wisata',
          title: 'Kegiatan Hari ' + nextDayNum,
          hotelName: '',
          jeepDriverId: null,
          jeepDriverName: null,
          jeepUnit: null,
          jeepFee: 0,
          operationalDesc: '',
          operationalCost: 0,
          ticketCost: 0,
          hotelCost: 0,
          notes: ''
        }
      ]
    });
    s.activeDay = nextDayNum;
    s.duration = `${nextDayNum} Hari ${nextDayNum - 1} Malam`;
    const durInp = document.getElementById('modal-builder-duration');
    if (durInp) durInp.value = s.duration;

    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
  },

  removeBuilderDay(dayNum) {
    const s = App._builderState;
    if (s.days.length <= 1) {
      showToast('warning', 'Peringatan', 'Itinerary minimal harus memiliki 1 hari perjalanan.');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus Hari ${dayNum} beserta seluruh kegiatannya?`)) {
      s.days = s.days.filter(d => d.day !== dayNum);
      s.days.forEach((d, idx) => {
        d.day = idx + 1;
        if (!d.title || d.title.startsWith('Hari ')) {
          d.title = `Hari ${idx + 1} - ${d.title.split(' - ')[1] || 'Eksplorasi'}`;
        }
      });
      if (s.activeDay > s.days.length) {
        s.activeDay = s.days.length;
      }
      s.duration = s.days.length > 1 ? `${s.days.length} Hari ${s.days.length - 1} Malam` : '12 Jam';
      const durInp = document.getElementById('modal-builder-duration');
      if (durInp) durInp.value = s.duration;

      App.renderBuilderDayTabs();
      App.renderBuilderDayView();
    }
  },

  switchBuilderDay(dayNum) {
    App._builderState.activeDay = dayNum;
    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
  },

  addBuilderActivity() {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay) return;

    curDay.activities.push({
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      time: '',
      activityType: 'spot_wisata',
      title: 'Kunjungan Spot Baru',
      hotelName: '',
      jeepDriverId: null,
      jeepDriverName: null,
      jeepUnit: null,
      jeepFee: 0,
      operationalDesc: '',
      operationalCost: 0,
      ticketCost: 0,
      hotelCost: 0,
      notes: ''
    });

    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
  },

  removeBuilderActivity(actIdx) {
    const s = App._builderState;
    const curDay = s.days.find(d => d.day === s.activeDay);
    if (!curDay || !curDay.activities[actIdx]) return;

    curDay.activities.splice(actIdx, 1);
    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
  },

  updateBuilderTotals() {
    const s = App._builderState;
    let totalOp = 0, totalTicket = 0, totalHotel = 0, totalJeep = 0, totalPhoto = 0, totalGuide = 0, totalDriver = 0;

    s.days.forEach(d => {
      if (s.mode === 'trip' && d.fieldDriverFee) {
        totalDriver += (parseNumberDot(d.fieldDriverFee) || 0);
      }
      d.activities.forEach(a => {
        totalOp += (parseNumberDot(a.operationalCost) || 0);
        totalTicket += (parseNumberDot(a.ticketCost) || 0);
        totalHotel += (parseNumberDot(a.hotelCost) || 0);
        totalJeep += (parseNumberDot(a.jeepFee) || 0);
        totalPhoto += (parseNumberDot(a.photographerFee) || 0);
        totalGuide += (parseNumberDot(a.guideFee) || 0);
      });
    });

    const grandTotal = totalOp + totalTicket + totalHotel + totalJeep + totalPhoto + totalGuide + totalDriver;

    const opEl = document.getElementById('builder-total-op');
    const ticketEl = document.getElementById('builder-total-ticket');
    const hotelEl = document.getElementById('builder-total-hotel');
    const jeepEl = document.getElementById('builder-total-jeep');
    const photoEl = document.getElementById('builder-total-photo');
    const guideEl = document.getElementById('builder-total-guide');
    const driverEl = document.getElementById('builder-total-driver');
    const grandEl = document.getElementById('builder-grand-total');

    if (opEl) opEl.textContent = formatIDR(totalOp);
    if (ticketEl) ticketEl.textContent = formatIDR(totalTicket);
    if (hotelEl) hotelEl.textContent = formatIDR(totalHotel);
    if (jeepEl) jeepEl.textContent = formatIDR(totalJeep);
    if (photoEl) photoEl.textContent = formatIDR(totalPhoto);
    if (guideEl) guideEl.textContent = formatIDR(totalGuide);
    if (driverEl) driverEl.textContent = formatIDR(totalDriver);
    if (grandEl) grandEl.textContent = formatIDR(grandTotal);

    return { totalOp, totalTicket, totalHotel, totalJeep, totalPhoto, totalGuide, totalDriver, grandTotal };
  },

  applyPresetToBuilder(tplId) {
    if (!tplId) return;
    const tpl = AppState.templates.find(t => t.id === tplId);
    if (!tpl) return;

    const items = tpl.items || [];
    const dayMap = {};
    const s = App._builderState;

    items.forEach(item => {
      const dNum = parseInt(item.day, 10) || 1;
      if (!dayMap[dNum]) {
        // In trip mode, preserve previously assigned field driver for this day if exists
        const existingDay = s.days.find(d => d.day === dNum);
        dayMap[dNum] = {
          day: dNum,
          title: item.dayTitle || `Hari ${dNum} - ${tpl.name}`,
          fieldDriverId: s.mode === 'trip' && existingDay ? existingDay.fieldDriverId : null,
          fieldDriverName: s.mode === 'trip' && existingDay ? existingDay.fieldDriverName : null,
          fieldDriverUnit: s.mode === 'trip' && existingDay ? existingDay.fieldDriverUnit : null,
          fieldDriverFee: s.mode === 'trip' && existingDay ? existingDay.fieldDriverFee : 175000,
          activities: []
        };
      }
      const aType = item.activityType || App.inferActivityType(item);
      dayMap[dNum].activities.push({
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        time: item.time || '',
        activityType: aType,
        title: item.title || '',
        hotelName: item.hotelName || '',
        ticketName: item.ticketName || ((aType === 'bromo_sunrise' || aType === 'milky_way') ? 'Tiket TNBTS Bromo' : ''),
        jeepDriverId: null,
        jeepDriverName: null,
        jeepUnit: null,
        jeepFee: parseNumberDot(item.jeepFee) || ((aType === 'bromo_sunrise' || aType === 'milky_way') ? 250000 : 0),
        photographerId: null,
        photographerName: null,
        photographerFee: parseNumberDot(item.photographerFee) || 0,
        guideName: null,
        guideFee: parseNumberDot(item.guideFee) || 0,
        operationalDesc: item.operationalDesc || '',
        operationalCost: parseNumberDot(item.operationalCost) || 0,
        ticketCost: parseNumberDot(item.ticketCost) || 0,
        hotelCost: parseNumberDot(item.hotelCost) || 0,
        notes: item.notes || item.description || ''
      });
    });

    let days = Object.values(dayMap);
    if (days.length === 0) {
      days = [{ day: 1, title: 'Hari 1 - ' + tpl.name, fieldDriverId: null, fieldDriverName: null, fieldDriverUnit: null, fieldDriverFee: 0, activities: [] }];
    }
    days.sort((a, b) => a.day - b.day);

    App._builderState.days = days;
    App._builderState.activeDay = 1;
    App._builderState.tourPackage = tpl.name;
    App._builderState.duration = tpl.duration || (days.length > 1 ? `${days.length} Hari ${days.length - 1} Malam` : '12 Jam');

    const pkgInp = document.getElementById('modal-builder-tour-package');
    const durInp = document.getElementById('modal-builder-duration');
    if (pkgInp) pkgInp.value = tpl.name;
    if (durInp) durInp.value = App._builderState.duration;

    App.renderBuilderDayTabs();
    App.renderBuilderDayView();
    showToast('success', 'Preset Diterapkan', `Preset "${tpl.name}" dimuat ke penyusun rute. Template master tidak akan terubah.`);
  },

  toggleBuilderSaveAsTemplate(checked) {
    const fields = document.getElementById('builder-save-as-template-fields');
    if (fields) fields.style.display = checked ? 'flex' : 'none';

    if (checked) {
      const nameInp = document.getElementById('builder-new-template-name');
      const tourPkg = document.getElementById('modal-builder-tour-package')?.value.trim() || '';
      if (nameInp && !nameInp.value) {
        nameInp.value = tourPkg ? `${tourPkg} (Master)` : '';
      }
    }
  },

  saveItineraryBuilder() {
    const s = App._builderState;
    if (s && s.mode === 'template') {
      App.saveItineraryBuilderToTemplate();
    } else {
      App.saveItineraryBuilderToTrip();
    }
  },

  async saveItineraryBuilderToTemplate() {
    const s = App._builderState;
    const nameInput = document.getElementById('modal-builder-tour-package');
    const catInput = document.getElementById('modal-builder-category');
    const durInput = document.getElementById('modal-builder-duration');
    const priceInput = document.getElementById('modal-builder-price');
    const descInput = document.getElementById('modal-builder-desc');

    const name = nameInput ? nameInput.value.trim() : (s.tourPackage || '');
    if (!name) {
      showToast('warning', 'Validasi Gagal', 'Nama paket / template itinerary wajib diisi.');
      nameInput?.focus();
      return;
    }

    const category = catInput ? catInput.value : (s.category || 'bromo_sunrise');
    const duration = durInput ? durInput.value.trim() : (s.duration || '12 Jam');
    const defaultPrice = priceInput ? (parseNumberDot(priceInput.value) || 0) : (s.price || 0);
    const description = descInput ? descInput.value.trim() : (s.description || '');

    // Collect activities - STRICTLY EXCLUDE CREW DATA FROM TEMPLATE
    const allActivities = [];
    s.days.forEach(d => {
      d.activities.forEach(act => {
        if (act.title && act.title.trim()) {
          const aType = act.activityType || App.inferActivityType(act);
          allActivities.push({
            id: act.id || ('stop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
            day: d.day,
            dayTitle: d.title || (`Hari ${d.day}`),
            activityType: aType,
            hotelName: aType === 'hotel' ? (act.hotelName || '').trim() : '',
            ticketName: (act.ticketName || '').trim(),
            time: act.time || '',
            title: act.title.trim(),
            operationalDesc: act.operationalDesc || '',
            operationalCost: parseNumberDot(act.operationalCost) || 0,
            ticketCost: parseNumberDot(act.ticketCost) || 0,
            hotelCost: parseNumberDot(act.hotelCost) || 0,
            jeepFee: parseNumberDot(act.jeepFee) || 0,
            photographerFee: parseNumberDot(act.photographerFee) || 0,
            guideFee: parseNumberDot(act.guideFee) || 0,
            notes: act.notes || '',
            description: (act.notes ? act.notes + ' ' : '') + (act.operationalDesc ? '(' + act.operationalDesc + ')' : '')
          });
        }
      });
    });

    if (allActivities.length === 0) {
      showToast('warning', 'Aktivitas Kosong', 'Tambahkan minimal 1 spot kegiatan yang memiliki nama sebelum menyimpan template.');
      return;
    }

    const payload = {
      name,
      category,
      duration,
      defaultPrice,
      description,
      items: allActivities
    };

    const submitBtn = document.getElementById('btn-submit-builder');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `${Icons.refreshCw(14)} <span>Menyimpan Template...</span>`;
    }

    try {
      const res = await API.saveTemplate(payload, s.templateId || null);
      if (res.success || res.template) {
        showToast('success', s.templateId ? 'Template Diperbarui' : 'Template Dibuat', `Template "${name}" berhasil disimpan ke Master Data (bersih tanpa plotting kru).`);
        await App.loadInitialData();
        App.closeItineraryBuilderModal();
        App.openManageMasterModal('templates');
      } else {
        showToast('error', 'Gagal Menyimpan', res.message || 'Terjadi kesalahan sistem.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${Icons.check(14)} <span>${s.templateId ? 'Simpan Perubahan Master' : 'Buat Template Master'}</span>`;
        }
      }
    } catch (err) {
      showToast('error', 'Kesalahan Jaringan', err.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${Icons.check(14)} <span>${s.templateId ? 'Simpan Perubahan Master' : 'Buat Template Master'}</span>`;
      }
    }
  },

  async saveItineraryBuilderToTrip() {
    const s = App._builderState;
    const tourPackage = document.getElementById('modal-builder-tour-package')?.value.trim() || s.tourPackage || 'Paket Bromo Tour';
    const duration = document.getElementById('modal-builder-duration')?.value.trim() || s.duration || '12 Jam';

    const allActivities = [];
    let firstAssignedFieldDriver = null;
    let totalFieldFee = 0;
    let firstAssignedJeepDriver = null;
    let firstJeepFee = 0;
    let totalOps = 0, totalTickets = 0, totalHotels = 0, totalJeep = 0, totalPhoto = 0, totalGuide = 0;

    s.days.forEach(d => {
      if (d.fieldDriverId) {
        if (!firstAssignedFieldDriver) {
          firstAssignedFieldDriver = {
            id: d.fieldDriverId,
            name: d.fieldDriverName,
            unit: d.fieldDriverUnit,
            fee: parseNumberDot(d.fieldDriverFee) || 0
          };
        }
        totalFieldFee += (parseNumberDot(d.fieldDriverFee) || 0);
      }

      d.activities.forEach(act => {
        if (act.title && act.title.trim()) {
          const aType = act.activityType || App.inferActivityType(act);
          const opCost = parseNumberDot(act.operationalCost) || 0;
          const ticketCost = parseNumberDot(act.ticketCost) || 0;
          const hotelCost = parseNumberDot(act.hotelCost) || 0;
          const jFee = parseNumberDot(act.jeepFee) || 0;
          const pFee = parseNumberDot(act.photographerFee) || 0;
          const gFee = parseNumberDot(act.guideFee) || 0;

          totalOps += opCost;
          totalTickets += ticketCost;
          totalHotels += hotelCost;
          totalJeep += jFee;
          totalPhoto += pFee;
          totalGuide += gFee;

          if ((aType === 'bromo_sunrise' || aType === 'milky_way') && act.jeepDriverId && !firstAssignedJeepDriver) {
            firstAssignedJeepDriver = {
              id: act.jeepDriverId,
              name: act.jeepDriverName,
              unit: act.jeepUnit,
              fee: jFee
            };
            firstJeepFee = jFee;
          }

          allActivities.push({
            id: act.id || ('act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
            day: d.day,
            dayTitle: d.title || (`Hari ${d.day}`),
            activityType: aType,
            title: act.title.trim(),
            hotelName: aType === 'hotel' ? (act.hotelName || '').trim() : '',
            ticketName: (act.ticketName || '').trim(),
            dayFieldDriverId: d.fieldDriverId || null,
            dayFieldDriverName: d.fieldDriverName || null,
            dayFieldDriverUnit: d.fieldDriverUnit || null,
            dayFieldDriverFee: parseNumberDot(d.fieldDriverFee) || 0,
            jeepDriverId: (aType === 'bromo_sunrise' || aType === 'milky_way') ? (act.jeepDriverId || null) : null,
            jeepDriverName: (aType === 'bromo_sunrise' || aType === 'milky_way') ? (act.jeepDriverName || null) : null,
            jeepUnit: (aType === 'bromo_sunrise' || aType === 'milky_way') ? (act.jeepUnit || null) : null,
            jeepFee: jFee,
            photographerId: act.photographerId || null,
            photographerName: act.photographerName || null,
            photographerFee: pFee,
            guideName: act.guideName || null,
            guideFee: gFee,
            time: act.time || '',
            operationalDesc: act.operationalDesc || '',
            operationalCost: opCost,
            ticketCost: ticketCost,
            hotelCost: hotelCost,
            notes: act.notes || '',
            description: (act.notes ? act.notes + ' ' : '') + (act.operationalDesc ? '(' + act.operationalDesc + ')' : '')
          });
        }
      });
    });

    if (allActivities.length === 0) {
      showToast('warning', 'Aktivitas Kosong', 'Tambahkan minimal 1 kegiatan yang memiliki nama sebelum menerapkan.');
      return;
    }

    App._currentTripItinerary = allActivities;
    App._currentTripDuration = duration;

    // Sync to Trip Modal Inputs
    const pkgInput = document.getElementById('trip-tour-package-input');
    if (pkgInput) pkgInput.value = tourPackage;

    // 1. Sync Field Driver to Trip Modal
    if (firstAssignedFieldDriver) {
      const fieldSelect = document.getElementById('trip-field-driver');
      if (fieldSelect) {
        fieldSelect.value = firstAssignedFieldDriver.id;
      }
      const fieldFeeInp = document.getElementById('trip-field-fee');
      if (fieldFeeInp) {
        fieldFeeInp.value = totalFieldFee > 0 ? totalFieldFee : firstAssignedFieldDriver.fee;
      }
    }

    // 2. Sync Jeep Driver to Trip Modal
    if (firstAssignedJeepDriver) {
      const jeepSelect = document.getElementById('trip-jeep-driver');
      if (jeepSelect) {
        jeepSelect.value = firstAssignedJeepDriver.id;
      }
      const jeepFeeInp = document.getElementById('trip-jeep-fee');
      if (jeepFeeInp) {
        jeepFeeInp.value = firstJeepFee > 0 ? firstJeepFee : firstAssignedJeepDriver.fee;
      }
    }

    // 3. Sync Operational Cost (Direct Cost) to Trip Modal
    const grandCost = totalOps + totalTickets + totalHotels;
    const opCostInput = document.getElementById('trip-operational-cost');
    if (opCostInput && grandCost > 0) {
      opCostInput.value = grandCost;
    }

    // Trigger update in Trip Modal (cards, badges & profit summary)
    document.getElementById('trip-field-driver')?.dispatchEvent(new Event('change'));
    document.getElementById('trip-jeep-driver')?.dispatchEvent(new Event('change'));
    document.getElementById('trip-operational-cost')?.dispatchEvent(new Event('input'));

    App.renderTripModalItineraryPreview();

    // Check save as new template in master data (STRICTLY CLEAN WITHOUT CREW DATA)
    const saveNewTpl = document.getElementById('builder-chk-save-as-template')?.checked;
    if (saveNewTpl) {
      const newTplName = document.getElementById('builder-new-template-name')?.value.trim() || (tourPackage + ' (Master)');
      const newCat = document.getElementById('builder-new-template-category')?.value || 'custom_trip';
      const newDesc = document.getElementById('builder-new-template-description')?.value.trim() || '';
      const defPrice = parseFloat(document.getElementById('trip-package-price')?.value) || 0;

      const cleanTemplateItems = allActivities.map(a => ({
        day: a.day,
        dayTitle: a.dayTitle,
        activityType: a.activityType,
        hotelName: a.hotelName,
        ticketName: a.ticketName,
        time: a.time,
        title: a.title,
        operationalCost: a.operationalCost,
        ticketCost: a.ticketCost,
        hotelCost: a.hotelCost,
        jeepFee: a.jeepFee,
        photographerFee: a.photographerFee,
        guideFee: a.guideFee,
        operationalDesc: a.operationalDesc,
        notes: a.notes
      }));

      await API.saveTemplate({
        name: newTplName,
        category: newCat,
        duration: duration,
        description: newDesc,
        defaultPrice: defPrice,
        items: cleanTemplateItems
      });
      await App.loadInitialData();
      showToast('success', 'Tersimpan', `Itinerary diterapkan ke trip dan tersimpan sebagai template master "${newTplName}" (bersih tanpa plotting kru).`);
    } else {
      showToast('success', 'Itinerary Diterapkan', `Itinerary ${s.days.length} hari & plotting kru berhasil diperbarui untuk trip ini.`);
    }

    App.closeItineraryBuilderModal();
  },

  closeItineraryBuilderModal() {
    const s = App._builderState;
    const container = document.getElementById('itinerary-builder-modal-container');
    if (container) container.remove();
    if (s && s.mode === 'template') {
      App.openManageMasterModal('templates');
    }
  },

  openManageMasterModal(initialTab = 'workers') {
    if (!AppState.currentUser || AppState.currentUser.role !== 'admin') return;
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 820px;">
          <div class="modal-header">
            <div style="font-weight: 800; font-size: 16px; color: #0f172a;">Manajemen Master Data</div>
            <button class="btn btn-outline btn-sm" onclick="closeModal()">${Icons.x(16)}</button>
          </div>
          <div class="modal-body">
            <div class="segmented-nav" style="margin-bottom: 14px;">
              <button class="segmented-btn ${initialTab === 'workers' ? 'active' : ''}" id="tab-master-workers" onclick="App.switchMasterSubTab('workers')">
                Master Kru (${AppState.workers.length})
              </button>
              <button class="segmented-btn ${initialTab === 'agencies' ? 'active' : ''}" id="tab-master-agencies" onclick="App.switchMasterSubTab('agencies')">
                Master Agen (${AppState.agencies.length})
              </button>
              <button class="segmented-btn ${initialTab === 'templates' ? 'active' : ''}" id="tab-master-templates" onclick="App.switchMasterSubTab('templates')">
                Template Itinerary (${AppState.templates.length})
              </button>
            </div>

            <div id="master-subtab-content">
              ${initialTab === 'templates' ? this.renderMasterTemplatesContent() : (initialTab === 'agencies' ? this.renderMasterAgenciesContent() : this.renderMasterWorkersContent())}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
          </div>
        </div>
      </div>
    `;
  },

  switchMasterSubTab(tab) {
    document.getElementById('tab-master-workers')?.classList.toggle('active', tab === 'workers');
    document.getElementById('tab-master-agencies')?.classList.toggle('active', tab === 'agencies');
    document.getElementById('tab-master-templates')?.classList.toggle('active', tab === 'templates');

    const btnWorkers = document.getElementById('tab-master-workers');
    if (btnWorkers) btnWorkers.textContent = `Master Kru (${AppState.workers.length})`;
    const btnAgencies = document.getElementById('tab-master-agencies');
    if (btnAgencies) btnAgencies.textContent = `Master Agen (${AppState.agencies.length})`;
    const btnTemplates = document.getElementById('tab-master-templates');
    if (btnTemplates) btnTemplates.textContent = `Template Itinerary (${AppState.templates.length})`;

    const container = document.getElementById('master-subtab-content');
    if (container) {
      if (tab === 'workers') container.innerHTML = this.renderMasterWorkersContent();
      else if (tab === 'agencies') container.innerHTML = this.renderMasterAgenciesContent();
      else if (tab === 'templates') container.innerHTML = this.renderMasterTemplatesContent();
    }
  },

  renderRoleBadge(role) {
    const roleBadges = {
      admin: '<span class="badge badge-admin">Admin</span>',
      driver_jeep: '<span class="badge badge-jeep">Driver Jeep</span>',
      driver_lapangan: '<span class="badge badge-field">Driver Lapangan</span>',
      photographer: '<span class="badge badge-photo">Photographer</span>',
      guide: '<span class="badge badge-guide">Tour Guide</span>'
    };
    return roleBadges[role] || `<span class="badge badge-field">${role}</span>`;
  },

  renderMasterWorkersContent() {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a;">Daftar Akun Kru & Driver</span>
          <div style="font-size: 11px; color: #64748b;">Kelola akun login, nomor kontak, unit armada, dan tarif honor trip</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.openWorkerModal()">+ Tambah Kru Baru</button>
      </div>

      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama Kru</th>
              <th>Peran</th>
              <th>Username</th>
              <th>No. WhatsApp</th>
              <th>Unit / Armada</th>
              <th>Tarif Honor</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${AppState.workers.map(w => `
              <tr>
                <td>
                  <strong>${w.name}</strong>
                  ${w.type === 'external' ? '<span class="badge" style="background: #fef3c7; color: #b45309; font-size: 9px; margin-left: 4px;">Mitra Luar</span>' : ''}
                </td>
                <td>${this.renderRoleBadge(w.role)}</td>
                <td><code>${w.username || '-'}</code></td>
                <td>${w.phone ? `<a href="${createWhatsAppUrl(w.phone, 'Halo ' + w.name)}" target="_blank" style="color: #0284c7; text-decoration: none; font-weight: 600;">${w.phone}</a>` : '-'}</td>
                <td>${w.vehicleUnit || '-'}</td>
                <td><strong>${formatIDR(w.baseRatePerTrip)}</strong></td>
                <td>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <button class="btn btn-outline btn-sm" style="padding: 3px 7px;" onclick="App.openWorkerModal('${w.id}')" title="Edit Data Kru">
                      ${Icons.edit ? Icons.edit(12) : '✏️'}
                    </button>
                    ${w.id === 'w-admin-1' ? '<small style="color: #94a3b8; font-size: 10px; margin-left: 2px;">Protected</small>' : `
                      <button class="btn btn-danger btn-sm" style="padding: 3px 7px;" onclick="App.deleteWorkerAction('${w.id}', '${w.name.replace(/'/g, "\\'")}')" title="Hapus Kru">
                        ${Icons.trash ? Icons.trash(12) : '🗑️'}
                      </button>
                    `}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderMasterAgenciesContent() {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a;">Daftar Mitra Agen Travel B2B</span>
          <div style="font-size: 11px; color: #64748b;">Kelola biro travel mitra rekanan untuk kemitraan pesanan B2B</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.openAgencyModal()">+ Tambah Agen Baru</button>
      </div>

      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama Agen</th>
              <th>Kode</th>
              <th>PIC</th>
              <th>No. WhatsApp</th>
              <th>Email</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${AppState.agencies.map(a => `
              <tr>
                <td><strong>${a.name}</strong></td>
                <td><code style="font-weight: 700;">${a.code}</code></td>
                <td>${a.contactPerson || '-'}</td>
                <td>${a.phone ? `<a href="${createWhatsAppUrl(a.phone, 'Halo ' + a.name)}" target="_blank" style="color: #0284c7; text-decoration: none; font-weight: 600;">${a.phone}</a>` : '-'}</td>
                <td><small style="color: #64748b;">${a.email || '-'}</small></td>
                <td>
                  <span class="badge" style="background: ${a.id === 'ag-direct' ? '#f1f5f9' : '#e0f2fe'}; color: ${a.id === 'ag-direct' ? '#475569' : '#0369a1'}; font-weight: 700;">
                    ${a.id === 'ag-direct' ? 'Tamu Langsung' : 'Mitra B2B'}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <button class="btn btn-outline btn-sm" style="padding: 3px 7px;" onclick="App.openAgencyModal('${a.id}')" title="Edit Mitra Agen">
                      ${Icons.edit ? Icons.edit(12) : '✏️'}
                    </button>
                    ${a.id === 'ag-direct' ? '<small style="color: #94a3b8; font-size: 10px; margin-left: 2px;">Default</small>' : `
                      <button class="btn btn-danger btn-sm" style="padding: 3px 7px;" onclick="App.deleteAgencyAction('${a.id}', '${a.name.replace(/'/g, "\\'")}')" title="Hapus Agen">
                        ${Icons.trash ? Icons.trash(12) : '🗑️'}
                      </button>
                    `}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // 1. MODAL FORM KRU (DRIVER / FOTOGRAFER / GUIDE)
  openWorkerModal(workerId = null) {
    const isEdit = !!workerId;
    const worker = isEdit ? AppState.workers.find(w => w.id === workerId) : null;
    if (isEdit && !worker) {
      showToast('error', 'Kru Tidak Ditemukan');
      return;
    }

    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 580px;">
          <div class="modal-header">
            <div>
              <div style="font-weight: 800; font-size: 16px; color: #0f172a;">
                ${isEdit ? 'Edit Data Kru Operasional' : 'Tambah Kru Operasional Baru'}
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                ${isEdit ? `Perbarui data profil & tarif honor ${worker.name}` : 'Daftarkan Driver Jeep, Shuttle, Fotografer, atau Tour Guide'}
              </div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App.openManageMasterModal('workers')">${Icons.x(16)}</button>
          </div>

          <form id="form-master-worker" onsubmit="event.preventDefault(); App.submitWorkerForm('${workerId || ''}');">
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Nama Lengkap Kru:*</label>
                  <input type="text" id="m-worker-name" class="form-input" required
                    placeholder="Contoh: Mas Yoyok / Budi Santoso"
                    value="${worker ? worker.name : ''}"
                    oninput="App.onWorkerNameInput(this.value, ${isEdit})" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Peran / Jabatan:*</label>
                  <select id="m-worker-role" class="form-select" required onchange="App.onWorkerRoleChange(this.value, ${isEdit})">
                    <option value="driver_jeep" ${worker?.role === 'driver_jeep' ? 'selected' : ''}>🚙 Driver Jeep (Armada 4x4)</option>
                    <option value="driver_lapangan" ${worker?.role === 'driver_lapangan' || (!worker ? 'selected' : '')}>🚐 Driver Lapangan / Shuttle</option>
                    <option value="photographer" ${worker?.role === 'photographer' ? 'selected' : ''}>📷 Fotografer Dokumentasi</option>
                    <option value="guide" ${worker?.role === 'guide' ? 'selected' : ''}>🚩 Tour Guide</option>
                    ${worker?.role === 'admin' ? '<option value="admin" selected>🛡️ Administrator</option>' : ''}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Username Akun (Login):*</label>
                  <input type="text" id="m-worker-username" class="form-input" required
                    placeholder="contoh: yoyok"
                    ${worker?.id === 'w-admin-1' ? 'readonly style="background: #f1f5f9;"' : ''}
                    value="${worker ? (worker.username || '') : ''}" />
                  <small style="font-size: 10px; color: #64748b;">Huruf kecil tanpa spasi</small>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">PIN Akses / Login:*</label>
                  <input type="text" id="m-worker-pin" class="form-input" maxlength="10" required
                    placeholder="123456"
                    value="${worker ? (worker.pin || '123456') : '123456'}" />
                  <small style="font-size: 10px; color: #64748b;">Angka (default: 123456)</small>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Nomor WhatsApp / HP:*</label>
                  <input type="tel" id="m-worker-phone" class="form-input" required
                    placeholder="0812-3456-7890"
                    value="${worker ? (worker.phone || '') : '0812-0000-0000'}" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Tipe Kerjasama:*</label>
                  <select id="m-worker-type" class="form-select">
                    <option value="internal" ${worker?.type === 'internal' ? 'selected' : ''}>Karyawan / Unit Internal</option>
                    <option value="external" ${worker?.type === 'external' ? 'selected' : ''}>Mitra Lepas / Freelance / Sewa</option>
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Armada / Peralatan Kerja:</label>
                  <input type="text" id="m-worker-unit" class="form-input"
                    placeholder="Contoh: HiAce Shuttle N 7788 OP"
                    value="${worker ? (worker.vehicleUnit || '') : 'HiAce Shuttle / Innova'}" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Tarif Honor per Trip (IDR):*</label>
                  <input type="number" id="m-worker-rate" class="form-input" min="0" step="5000" required
                    placeholder="175000"
                    value="${worker ? worker.baseRatePerTrip : 175000}" />
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" onclick="App.openManageMasterModal('workers')">Batal</button>
              <button type="submit" class="btn btn-primary" id="btn-save-m-worker" style="font-weight: 700;">
                ${isEdit ? 'Simpan Perubahan' : '+ Tambahkan Kru'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  onWorkerNameInput(val, isEdit) {
    if (isEdit) return;
    const uField = document.getElementById('m-worker-username');
    if (!uField) return;
    const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean && !uField.dataset.userEdited) {
      uField.value = clean;
    }
  },

  onWorkerRoleChange(role, isEdit) {
    if (isEdit) return;
    const rateField = document.getElementById('m-worker-rate');
    const unitField = document.getElementById('m-worker-unit');
    if (!rateField || !unitField) return;

    if (role === 'driver_jeep') {
      rateField.value = 250000;
      unitField.value = 'Jeep Hardtop 4x4';
    } else if (role === 'driver_lapangan') {
      rateField.value = 175000;
      unitField.value = 'HiAce Shuttle / Innova';
    } else if (role === 'photographer') {
      rateField.value = 200000;
      unitField.value = 'Camera Kit & Dokumentasi';
    } else if (role === 'guide') {
      rateField.value = 150000;
      unitField.value = 'Lisensi Tour Guide';
    }
  },

  async submitWorkerForm(workerId) {
    const isEdit = !!workerId;
    const name = document.getElementById('m-worker-name')?.value.trim();
    const role = document.getElementById('m-worker-role')?.value;
    const username = document.getElementById('m-worker-username')?.value.trim().toLowerCase();
    const pin = document.getElementById('m-worker-pin')?.value.trim() || '123456';
    const phone = document.getElementById('m-worker-phone')?.value.trim();
    const type = document.getElementById('m-worker-type')?.value || 'internal';
    const vehicleUnit = document.getElementById('m-worker-unit')?.value.trim() || '';
    const baseRatePerTrip = parseFloat(document.getElementById('m-worker-rate')?.value) || 0;

    if (!name) {
      showToast('error', 'Validasi Gagal', 'Nama lengkap kru wajib diisi.');
      return;
    }
    if (!username) {
      showToast('error', 'Validasi Gagal', 'Username akun wajib diisi.');
      return;
    }

    const saveBtn = document.getElementById('btn-save-m-worker');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const payload = {
        name, role, username, pin, phone, type, vehicleUnit, baseRatePerTrip
      };
      const res = await API.saveWorker(payload, workerId || null);
      if (res.success) {
        showToast('success', isEdit ? 'Kru Diperbarui' : 'Kru Ditambahkan', `Akun ${name} (${username}) berhasil disimpan.`);
        await App.loadInitialData();
        App.openManageMasterModal('workers');
      } else {
        showToast('error', 'Gagal Menyimpan', res.message || 'Terjadi kesalahan.');
        if (saveBtn) saveBtn.disabled = false;
      }
    } catch (e) {
      showToast('error', 'Kesalahan', e.message);
      if (saveBtn) saveBtn.disabled = false;
    }
  },

  deleteWorkerAction(id, name) {
    if (id === 'w-admin-1') {
      showToast('warning', 'Otoritas Dilindungi', 'Akun Administrator utama tidak dapat dihapus.');
      return;
    }
    requestConfirm({
      title: 'Hapus Akun Kru',
      message: `Apakah Anda yakin ingin menghapus akun kru <strong>${name}</strong>? Tindakan ini akan menghapus akun login dan profil kru dari sistem.`,
      confirmLabel: 'Ya, Hapus Kru',
      isDestructive: true,
      onConfirm: async () => {
        const res = await API.deleteWorker(id);
        if (res.success) {
          showToast('success', 'Kru Dihapus', `Data kru ${name} berhasil dihapus.`);
          await App.loadInitialData();
          App.openManageMasterModal('workers');
        } else {
          showToast('error', 'Gagal Menghapus', res.message);
        }
      }
    });
  },

  // 2. MODAL FORM AGEN TRAVEL (B2B)
  openAgencyModal(agencyId = null) {
    const isEdit = !!agencyId;
    const agency = isEdit ? AppState.agencies.find(a => a.id === agencyId) : null;
    if (isEdit && !agency) {
      showToast('error', 'Mitra Tidak Ditemukan');
      return;
    }

    const defaultCode = 'AG-' + Math.floor(Math.random() * 89 + 10);
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 580px;">
          <div class="modal-header">
            <div>
              <div style="font-weight: 800; font-size: 16px; color: #0f172a;">
                ${isEdit ? 'Edit Data Mitra Agen Travel' : 'Tambah Mitra Agen Travel Baru'}
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                ${isEdit ? `Perbarui data kemitraan B2B untuk ${agency.name}` : 'Daftarkan mitra agen travel rekanan untuk kemitraan pesanan B2B'}
              </div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App.openManageMasterModal('agencies')">${Icons.x(16)}</button>
          </div>

          <form id="form-master-agency" onsubmit="event.preventDefault(); App.submitAgencyForm('${agencyId || ''}');">
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Nama Mitra Agen / Biro Travel:*</label>
                  <input type="text" id="m-agency-name" class="form-input" required
                    placeholder="Contoh: Java Heritage Tour & Travel"
                    value="${agency ? agency.name : ''}" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Kode Agen:*</label>
                  <input type="text" id="m-agency-code" class="form-input" required
                    placeholder="Contoh: AG-05"
                    ${agency?.id === 'ag-direct' ? 'readonly style="background: #f1f5f9;"' : ''}
                    value="${agency ? agency.code : defaultCode}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Nama PIC / Penanggung Jawab:</label>
                  <input type="text" id="m-agency-contact" class="form-input"
                    placeholder="Contoh: Ibu Rina / Bpk Doni"
                    value="${agency ? (agency.contactPerson || '') : ''}" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 700;">Nomor WhatsApp / HP PIC:*</label>
                  <input type="tel" id="m-agency-phone" class="form-input" required
                    placeholder="0812-3344-5566"
                    value="${agency ? agency.phone : ''}" />
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Email Kontak Agen (Opsional):</label>
                <input type="email" id="m-agency-email" class="form-input"
                  placeholder="Contoh: booking@mitratour.com"
                  value="${agency ? (agency.email || '') : ''}" />
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Alamat Kantor / Domisili Agen (Opsional):</label>
                <textarea id="m-agency-address" class="form-input" rows="2"
                  placeholder="Contoh: Jl. Basuki Rahmat No. 12, Surabaya">${agency ? (agency.address || '') : ''}</textarea>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" onclick="App.openManageMasterModal('agencies')">Batal</button>
              <button type="submit" class="btn btn-primary" id="btn-save-m-agency" style="font-weight: 700;">
                ${isEdit ? 'Simpan Perubahan' : '+ Daftarkan Agen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitAgencyForm(agencyId) {
    const isEdit = !!agencyId;
    const name = document.getElementById('m-agency-name')?.value.trim();
    const code = document.getElementById('m-agency-code')?.value.trim().toUpperCase();
    const contactPerson = document.getElementById('m-agency-contact')?.value.trim() || 'PIC Operasional';
    const phone = document.getElementById('m-agency-phone')?.value.trim();
    const email = document.getElementById('m-agency-email')?.value.trim() || '';
    const address = document.getElementById('m-agency-address')?.value.trim() || '';

    if (!name) {
      showToast('error', 'Validasi Gagal', 'Nama mitra agen wajib diisi.');
      return;
    }
    if (!phone) {
      showToast('error', 'Validasi Gagal', 'Nomor telepon / WA PIC wajib diisi.');
      return;
    }

    const saveBtn = document.getElementById('btn-save-m-agency');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const payload = {
        name, code, contactPerson, phone, email, address
      };
      const res = await API.saveAgency(payload, agencyId || null);
      if (res.success) {
        showToast('success', isEdit ? 'Agen Diperbarui' : 'Agen Ditambahkan', `Mitra ${name} (${code}) berhasil disimpan.`);
        await App.loadInitialData();
        App.openManageMasterModal('agencies');
      } else {
        showToast('error', 'Gagal Menyimpan', res.message || 'Terjadi kesalahan.');
        if (saveBtn) saveBtn.disabled = false;
      }
    } catch (e) {
      showToast('error', 'Kesalahan', e.message);
      if (saveBtn) saveBtn.disabled = false;
    }
  },

  deleteAgencyAction(id, name) {
    if (id === 'ag-direct') {
      showToast('warning', 'Otoritas Dilindungi', 'Agen Direct adalah agen bawaan sistem untuk tamu non-agen dan tidak dapat dihapus.');
      return;
    }
    requestConfirm({
      title: 'Hapus Mitra Agen',
      message: `Apakah Anda yakin ingin menghapus data mitra travel <strong>${name}</strong>?`,
      confirmLabel: 'Ya, Hapus Agen',
      isDestructive: true,
      onConfirm: async () => {
        const res = await API.deleteAgency(id);
        if (res.success) {
          showToast('success', 'Agen Dihapus', `Data mitra agen ${name} berhasil dihapus.`);
          await App.loadInitialData();
          App.openManageMasterModal('agencies');
        } else {
          showToast('error', 'Gagal Menghapus', res.message);
        }
      }
    });
  },

  // Backwards compatibility aliases
  promptAddWorker() {
    this.openWorkerModal();
  },

  promptAddAgency() {
    this.openAgencyModal();
  },

  renderMasterTemplatesContent() {
    const categoryLabels = {
      'bromo_sunrise': { label: 'Sunrise Bromo', badge: '#0284c7', bg: '#e0f2fe' },
      'milky_way': { label: 'Milky Way Night', badge: '#7c3aed', bg: '#f3e8ff' },
      'custom_trip': { label: 'Custom / Private', badge: '#d97706', bg: '#fef3c7' },
      'open_trip': { label: 'Open Trip', badge: '#059669', bg: '#d1fae5' }
    };

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a;">Daftar Paket & Template Itinerary</span>
          <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Kelola master paket rute, durasi, estimasi biaya operasional, dan daftar spot kunjungan.</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.openTemplateFormModal()">
          ${Icons.plus(13)}
          <span>Tambah Template Baru</span>
        </button>
      </div>

      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama Paket & Deskripsi</th>
              <th>Kategori</th>
              <th>Durasi</th>
              <th>Harga Dasar</th>
              <th>Rute & Spot</th>
              <th style="text-align: right;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${AppState.templates.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; padding: 24px; color: #94a3b8;">
                  Belum ada template itinerary. Silakan klik tombol "Tambah Template Baru".
                </td>
              </tr>
            ` : AppState.templates.map(t => {
              const cat = categoryLabels[t.category] || { label: t.category, badge: '#475569', bg: '#f1f5f9' };
              const items = Array.isArray(t.items) ? t.items : [];
              const itemCount = items.length;
              const totalOpCost = items.reduce((s, i) => s + (parseFloat(i.operationalCost) || 0), 0);
              const totalTicketCost = items.reduce((s, i) => s + (parseFloat(i.ticketCost) || 0), 0);
              const totalHotelCost = items.reduce((s, i) => s + (parseFloat(i.hotelCost) || 0), 0);
              const grandCost = totalOpCost + totalTicketCost + totalHotelCost;
              const uniqueDays = new Set(items.map(i => parseInt(i.day, 10) || 1)).size || (items.length > 0 ? 1 : 0);
              const cleanName = (t.name || '').replace(/'/g, "\'");

              return `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${t.name}</div>
                    ${t.description ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px; max-width: 260px; line-height: 1.3;">${t.description}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge" style="background: ${cat.bg}; color: ${cat.badge}; border: 1px solid ${cat.badge}33; font-size: 10px; font-weight: 700; white-space: nowrap;">
                      ${cat.label}
                    </span>
                  </td>
                  <td><span style="font-size: 11px; font-weight: 600; color: #334155;">${t.duration || '-'}</span></td>
                  <td><strong style="color: #0284c7; font-size: 12px;">${formatIDR(t.defaultPrice)}</strong></td>
                  <td>
                    <button class="btn btn-outline btn-sm" style="font-size: 10px; padding: 2px 7px;" onclick="App.previewTemplateStops('${t.id}')">
                      ${Icons.mapPin(11, '#0284c7')}
                      <span>${uniqueDays ? `${uniqueDays} Hari &bull; ` : ''}${itemCount} Spot (${formatIDR(grandCost)})</span>
                    </button>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 4px;">
                      <button class="btn btn-outline btn-sm" title="Edit Template" onclick="App.openTemplateFormModal('${t.id}')">
                        ${Icons.edit(12, '#2563eb')}
                      </button>
                      <button class="btn btn-danger btn-sm" title="Hapus Template" onclick="App.deleteTemplateAction('${t.id}', '${cleanName}')">
                        ${Icons.trash(12)}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  previewTemplateStops(id) {
    const tpl = AppState.templates.find(t => t.id === id);
    if (!tpl) return;

    const items = Array.isArray(tpl.items) ? tpl.items : [];
    let totalOpCost = 0, totalTicketCost = 0, totalHotelCost = 0;
    const dayMap = {};

    items.forEach(it => {
      const dNum = parseInt(it.day, 10) || 1;
      if (!dayMap[dNum]) {
        dayMap[dNum] = {
          day: dNum,
          title: it.dayTitle || `Hari ${dNum}`,
          activities: []
        };
      }
      dayMap[dNum].activities.push(it);
      totalOpCost += (parseFloat(it.operationalCost) || 0);
      totalTicketCost += (parseFloat(it.ticketCost) || 0);
      totalHotelCost += (parseFloat(it.hotelCost) || 0);
    });

    const days = Object.values(dayMap).sort((a, b) => a.day - b.day);
    const grandCost = totalOpCost + totalTicketCost + totalHotelCost;
    const totalDays = days.length > 0 ? days.length : 1;

    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 760px; max-height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <div>
              <div style="font-weight: 800; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                <span>📑</span>
                <span>${tpl.name}</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Durasi: <strong>${tpl.duration || '-'}</strong> &bull; Harga Dasar Acuan: <strong style="color: #0284c7;">${formatIDR(tpl.defaultPrice)}</strong>
              </div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App.openManageMasterModal('templates')">${Icons.x(16)}</button>
          </div>
          <div class="modal-body" style="padding: 16px; overflow-y: auto; flex: 1;">
            <!-- Running Cost Breakdown -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Total Estimasi Biaya (Ops + Tiket + Hotel)</span>
                <div style="font-size: 16px; font-weight: 800; color: #15803d;">${formatIDR(grandCost)}</div>
              </div>
              <div style="display: flex; gap: 10px; font-size: 11px; flex-wrap: wrap; align-items: center;">
                <span>🛠️ Ops: <strong style="color: #dc2626;">${formatIDR(totalOpCost)}</strong></span>
                <span>🎟️ Tiket: <strong style="color: #ea580c;">${formatIDR(totalTicketCost)}</strong></span>
                <span>🏨 Hotel: <strong style="color: #7c3aed;">${formatIDR(totalHotelCost)}</strong></span>
                <span class="badge" style="background: #ffffff; color: #166534; border: 1px solid #bbf7d0; font-weight: 700;">${totalDays} Hari &bull; ${items.length} Spot</span>
              </div>
            </div>

            ${tpl.description ? `
              <div style="font-size: 12px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; line-height: 1.4;">
                <strong>Deskripsi Paket:</strong><br>${tpl.description}
              </div>
            ` : ''}

            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">Susunan Rute Multi-Hari (Timeline Spot):</div>

            ${items.length === 0 ? `
              <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
                Belum ada rincian spot kegiatan pada template ini.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${days.map(d => `
                  <div class="day-group-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div class="day-group-header" style="background: #f1f5f9; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                      <div style="font-weight: 700; font-size: 12px; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                        <span>📅</span>
                        <span>${d.title}</span>
                      </div>
                      <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 10px; font-weight: 700;">${d.activities.length} Kegiatan</span>
                    </div>
                    <div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;">
                      ${d.activities.map((it, idx) => `
                        <div style="display: flex; gap: 10px; align-items: flex-start; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                          <div style="width: 22px; height: 22px; border-radius: 50%; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; flex-shrink: 0; margin-top: 2px;">
                            ${idx + 1}
                          </div>
                          <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="font-weight: 700; font-size: 12px; color: #0f172a;">${it.title}</span>
                                ${it.hotelName ? `<span class="badge" style="background: #ede9fe; color: #6d28d9; font-size: 10px; font-weight: 700;">🏨 ${it.hotelName}</span>` : ''}
                                ${(it.activityType === 'bromo_sunrise' || (!it.activityType && /sunrise/i.test(it.title))) ? `<span class="badge" style="background: #fffbeb; color: #b45309; font-size: 10px; font-weight: 700;">🌄 Bromo Sunrise</span>` : ''}
                              </div>
                              ${it.time ? `<span style="font-size: 10px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 1px 6px; border-radius: 4px;">${it.time}</span>` : ''}
                            </div>
                            ${it.notes ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">📝 ${it.notes}</div>` : ''}
                            ${it.operationalDesc ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 1px;">⚙️ ${it.operationalDesc}</div>` : ''}
                          </div>
                          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0;">
                            ${it.operationalCost ? `<span style="font-size: 10px; color: #dc2626; font-weight: 600;">🛠️ ${formatIDR(it.operationalCost)}</span>` : ''}
                            ${it.ticketCost ? `<span style="font-size: 10px; color: #ea580c; font-weight: 600;">🎟️ ${formatIDR(it.ticketCost)}</span>` : ''}
                            ${it.hotelCost ? `<span style="font-size: 10px; color: #7c3aed; font-weight: 600;">🏨 ${formatIDR(it.hotelCost)}</span>` : ''}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          <div class="modal-footer" style="padding: 12px 16px; border-top: 1px solid var(--border-glass); display: flex; justify-content: space-between;">
            <button class="btn btn-primary btn-sm" onclick="App.openTemplateFormModal('${tpl.id}')">
              ${Icons.edit(13)}
              <span>Edit Template Ini</span>
            </button>
            <button class="btn btn-outline" onclick="App.openManageMasterModal('templates')">Kembali</button>
          </div>
        </div>
      </div>
    `;
  },

  openTemplateFormModal(templateId = null) {
    this.openItineraryBuilderModal({ mode: 'template', templateId: templateId });
  },

  deleteTemplateAction(id, name) {
    requestConfirm({
      title: 'Hapus Template Itinerary',
      message: `Apakah Anda yakin ingin menghapus template itinerary <strong>${name}</strong>? Seluruh titik kunjungan bawaan untuk template ini akan dihapus.`,
      confirmLabel: 'Ya, Hapus Template',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await API.deleteTemplate(id);
          if (res.success) {
            showToast('success', 'Template Dihapus', `Template "${name}" telah dihapus.`);
            await App.loadInitialData();
            App.openManageMasterModal('templates');
          } else {
            showToast('error', 'Gagal Menghapus', res.message || 'Tidak dapat menghapus template.');
          }
        } catch (err) {
          showToast('error', 'Kesalahan', err.message);
        }
      }
    });
  },

  openInvoiceModal(agencyId) {
    const agency = AppState.agencies.find(a => a.id === agencyId);
    if (!agency) return;

    const trips = AppState.trips.filter(t => t.agencyId === agencyId && t.tripStatus !== 'cancelled');
    const totalContract = trips.reduce((s, t) => s + (t.packagePrice || 0), 0);
    const totalDeposit = trips.reduce((s, t) => s + (t.depositAmount || 0), 0);
    const totalRemaining = trips.reduce((s, t) => s + (t.remainingBalance ?? Math.max(0, (t.packagePrice || 0) - (t.depositAmount || 0))), 0);
    const invoiceNum = `INV-${agency.code}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*89+10)}`;

    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 720px;">
          <div class="modal-header no-print">
            <div style="font-weight: 800; font-size: 16px; color: #0f172a;">Invoice Penagihan Agen Travel</div>
            <button class="btn btn-outline btn-sm" onclick="closeModal()">${Icons.x(16)}</button>
          </div>
          <div class="modal-body" id="invoice-printable-area">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
              <div>
                <h1 style="font-size: 20px; font-weight: 800; color: #0f172a;">PANORAMA TOUR INDONESIA</h1>
                <p style="font-size: 11px; color: #475569;">Jl. Raya Bromo, Sukapura, Probolinggo &bull; Telp: 0811-0011-2233</p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 15px; font-weight: 800; color: #059669;">INVOICE OPERASIONAL</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${invoiceNum}</div>
                <div style="font-size: 11px; color: #64748b;">Tanggal: ${formatDate(new Date().toISOString().slice(0,10))}</div>
              </div>
            </div>

            <div style="margin-bottom: 16px; font-size: 12px; color: #0f172a;">
              <div>Ditagihkan Kepada:</div>
              <div style="font-size: 14px; font-weight: 800;">${agency.name} (${agency.code})</div>
              <div>PIC: ${agency.contactPerson || '-'} &bull; ${agency.phone}</div>
              <div>Alamat: ${agency.address || '-'}</div>
            </div>

            <div class="data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Kode & Tanggal</th>
                    <th>Nama Tamu & Paket</th>
                    <th>Status</th>
                    <th style="text-align: right;">Total Paket</th>
                    <th style="text-align: right;">DP / Terbayar</th>
                    <th style="text-align: right;">Sisa Tagihan</th>
                  </tr>
                </thead>
                <tbody>
                  ${trips.map((t, idx) => {
                    const dp = t.depositAmount || 0;
                    const rem = t.remainingBalance ?? Math.max(0, (t.packagePrice || 0) - dp);
                    let badgeLabel = 'Belum Bayar';
                    if (t.agencyPaymentStatus === 'paid') badgeLabel = 'Lunas';
                    else if (t.agencyPaymentStatus === 'deposit') badgeLabel = 'DP';

                    return `
                      <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${t.code}</strong><br><small style="color: #64748b;">${formatDate(t.date)}</small></td>
                        <td>${t.guestName} (${t.guestCount} Pax)<br><small style="color: #059669;">${t.tourPackage}</small></td>
                        <td><span class="badge pay-${t.agencyPaymentStatus}">${badgeLabel}</span></td>
                        <td style="text-align: right; font-weight: 600;">${formatIDR(t.packagePrice)}</td>
                        <td style="text-align: right; color: #059669; font-weight: 600;">${dp > 0 ? formatIDR(dp) : '-'}</td>
                        <td style="text-align: right; font-weight: 700; color: ${rem > 0 ? '#dc2626' : '#059669'};">${formatIDR(rem)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: #f8fafc; font-size: 12px;">
                    <td colspan="4" style="text-align: right; font-weight: 700;">Total Nilai Pemesanan:</td>
                    <td style="text-align: right; font-weight: 700;">${formatIDR(totalContract)}</td>
                    <td style="text-align: right; font-weight: 700; color: #059669;">${formatIDR(totalDeposit)}</td>
                    <td style="text-align: right; font-weight: 800; color: #dc2626;">${formatIDR(totalRemaining)}</td>
                  </tr>
                  <tr style="background: #eff6ff; font-weight: 800; font-size: 14px;">
                    <td colspan="6" style="text-align: right; color: #1e3a8a;">SISA TOTAL TAGIHAN HARUS DIBAYAR:</td>
                    <td style="text-align: right; color: #dc2626; font-size: 16px;">${formatIDR(totalRemaining)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style="margin-top: 24px; font-size: 11px; color: #64748b; line-height: 1.5;">
              Pembayaran dapat ditransfer melalui Rekening Resmi:<br>
              <strong>Bank BCA: 123-456-7890 a.n. Panorama Tour Indonesia</strong><br>
              Terima kasih atas kemitraan dan kerjasamanya!
            </div>
          </div>

          <div class="modal-footer no-print">
            <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
            <button class="btn btn-primary" onclick="window.print()">
              ${Icons.printer(15)}
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
};

// Expose App and AppState to window for inline HTML onclick handlers
window.App = App;
window.AppState = AppState;

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
