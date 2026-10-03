// Panorama Super App - Client API with Offline LocalStorage Fallback
const API = {
  baseUrl: 'api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/${endpoint}`;
    try {
      const token = localStorage.getItem('panorama_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.warn(`[API Network Failure: ${endpoint}]`, err);
      return { ok: false, status: 0, error: err.message, offline: true };
    }
  },

  async checkHealth() {
    const res = await this.request('health.php');
    return res.ok && res.data.online;
  },

  async login(identifier, pin) {
    const res = await this.request('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ identifier, pin })
    });
    if (res.ok && res.data && res.data.success) {
      if (res.data.token) {
        localStorage.setItem('panorama_token', res.data.token);
      }
      localStorage.setItem('panorama_user', JSON.stringify(res.data.user));
    } else {
      localStorage.removeItem('panorama_token');
      localStorage.removeItem('panorama_user');
    }
    return res.data || { success: false, message: 'Gagal terhubung ke server' };
  },

  async logout() {
    localStorage.removeItem('panorama_token');
    localStorage.removeItem('panorama_user');
    await this.request('auth.php?action=logout', { method: 'POST' });
  },

  async getSession() {
    const res = await this.request('auth.php?action=session');
    if (res.ok && res.data && res.data.authenticated && res.data.user) {
      localStorage.setItem('panorama_user', JSON.stringify(res.data.user));
      return res.data.user;
    }
    localStorage.removeItem('panorama_token');
    localStorage.removeItem('panorama_user');
    return null;
  },

  async getTrips(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await this.request(`trips.php${query ? '?' + query : ''}`);
    if (res.ok && Array.isArray(res.data)) {
      localStorage.setItem('panorama_cached_trips', JSON.stringify(res.data));
      return res.data;
    }
    const cached = localStorage.getItem('panorama_cached_trips');
    return cached ? JSON.parse(cached) : [];
  },

  async getTrip(id) {
    const res = await this.request(`trips.php?id=${id}`);
    if (res.ok && res.data.trip) return res.data.trip;
    const cached = (await this.getTrips()).find(t => t.id === id);
    return cached || null;
  },

  async createTrip(tripData) {
    const res = await this.request('trips.php', {
      method: 'POST',
      body: JSON.stringify(tripData)
    });
    return res.data || { success: false, message: 'Gagal menyimpan trip' };
  },

  async updateTrip(id, tripData) {
    const res = await this.request(`trips.php?id=${id}&action=update`, {
      method: 'POST',
      body: JSON.stringify({ ...tripData, id })
    });
    return res.data || { success: false, message: 'Gagal memperbarui trip' };
  },

  async cancelTrip(id, reason) {
    const res = await this.request(`trips.php?id=${id}&action=cancel`, {
      method: 'POST',
      body: JSON.stringify({ id, reason })
    });
    return res.data || { success: false, message: 'Gagal membatalkan trip' };
  },

  async updatePhotoUrl(id, photoAlbumUrl) {
    const res = await this.request(`trips.php?id=${id}&action=photo`, {
      method: 'POST',
      body: JSON.stringify({ id, photoAlbumUrl })
    });
    return res.data || { success: false, message: 'Gagal menyimpan tautan foto' };
  },

  async deleteTrip(id) {
    const res = await this.request(`trips.php?id=${id}&action=delete`, {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    return res.data || { success: false, message: 'Gagal menghapus trip' };
  },

  async getWorkers() {
    const res = await this.request('workers.php');
    if (res.ok && Array.isArray(res.data)) {
      localStorage.setItem('panorama_cached_workers', JSON.stringify(res.data));
      return res.data;
    }
    const cached = localStorage.getItem('panorama_cached_workers');
    return cached ? JSON.parse(cached) : [];
  },

  async saveWorker(workerData, id = null) {
    const endpoint = id ? `workers.php?id=${id}&action=update` : 'workers.php';
    const res = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...workerData, id })
    });
    return res.data || { success: false, message: 'Gagal menyimpan kru' };
  },

  async deleteWorker(id) {
    const res = await this.request(`workers.php?id=${id}&action=delete`, {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    return res.data || { success: false, message: 'Gagal menghapus kru' };
  },

  async getAgencies() {
    const res = await this.request('agencies.php');
    if (res.ok && Array.isArray(res.data)) {
      localStorage.setItem('panorama_cached_agencies', JSON.stringify(res.data));
      return res.data;
    }
    const cached = localStorage.getItem('panorama_cached_agencies');
    return cached ? JSON.parse(cached) : [];
  },

  async saveAgency(agencyData, id = null) {
    const endpoint = id ? `agencies.php?id=${id}&action=update` : 'agencies.php';
    const res = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...agencyData, id })
    });
    return res.data || { success: false, message: 'Gagal menyimpan mitra agen' };
  },

  async deleteAgency(id) {
    const res = await this.request(`agencies.php?id=${id}&action=delete`, {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    return res.data || { success: false, message: 'Gagal menghapus mitra agen' };
  },

  async getTemplates() {
    const res = await this.request('templates.php');
    if (res.ok && Array.isArray(res.data)) {
      localStorage.setItem('panorama_cached_templates', JSON.stringify(res.data));
      return res.data;
    }
    const cached = localStorage.getItem('panorama_cached_templates');
    return cached ? JSON.parse(cached) : [];
  },

  async saveTemplate(templateData, id = null) {
    const endpoint = id ? `templates.php?id=${id}&action=update` : 'templates.php';
    const res = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...templateData, id })
    });
    return res.data || { success: false, message: 'Gagal menyimpan template itinerary' };
  },

  async deleteTemplate(id) {
    const res = await this.request(`templates.php?id=${id}&action=delete`, {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    return res.data || { success: false, message: 'Gagal menghapus template itinerary' };
  },

  async getAnalyticsPnL() {
    const res = await this.request('analytics.php?type=pnl');
    return (res.ok && res.data) ? res.data : null;
  },

  async getAnalyticsPayroll() {
    const res = await this.request('analytics.php?type=payroll');
    return (res.ok && Array.isArray(res.data)) ? res.data : [];
  },

  async markPayrollPaid(tripId, role) {
    const res = await this.request('analytics.php?action=mark_paid', {
      method: 'POST',
      body: JSON.stringify({ tripId, role })
    });
    return res.data || { success: false, message: 'Gagal memperbarui status bayar' };
  }
};