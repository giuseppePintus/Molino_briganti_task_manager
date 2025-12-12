(function(){
  const API_URL = (typeof window !== 'undefined') ? (window.API_URL || `http://${window.location.hostname}:${window.location.port || 5000}/api`) : 'http://localhost:5000/api';

  function defaultCompanySettings(){
    return {
      businessName: 'Molino Briganti',
      logoUrl: 'images/logo INSEGNA.png',
      openingDays: [1,2,3,4,5,6],
      openMorningStart: '08:00', openMorningEnd: '13:00',
      openAfternoonStart: '15:00', openAfternoonEnd: '18:00',
      // Orari sabato apertura (se diversi)
      openSatMorningStart: '08:00', openSatMorningEnd: '12:00',
      openSatAfternoonStart: '', openSatAfternoonEnd: '',
      deliveryDays: [1,2,3,4,5,6],
      deliveryMorningStart: '08:00', deliveryMorningEnd: '12:00',
      deliveryAfternoonStart: '15:00', deliveryAfternoonEnd: '18:00',
      // Orari sabato consegne (se diversi)
      deliverySatMorningStart: '08:00', deliverySatMorningEnd: '12:00',
      deliverySatAfternoonStart: '', deliverySatAfternoonEnd: '',
      holidays: [],
      vehicles: 2
    };
  }
  async function loadAsync(){
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const resp = await fetch(`${API_URL}/settings`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        localStorage.setItem('companySettings', JSON.stringify(data));
        return Object.assign(defaultCompanySettings(), data);
      }
    } catch {}
    try { return Object.assign(defaultCompanySettings(), JSON.parse(localStorage.getItem('companySettings')||'{}')); }
    catch { return defaultCompanySettings(); }
  }

  // Backwards-compatible sync-ish access using cache or defaults
  function load(){
    try { return Object.assign(defaultCompanySettings(), JSON.parse(localStorage.getItem('companySettings')||'{}')); }
    catch { return defaultCompanySettings(); }
  }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toDateKey(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function toMonthDay(d){ return pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function parseTime(str){ if(!str) return null; const [h,m] = str.split(':').map(x=>parseInt(x,10)); return {h: h||0, m: m||0}; }
  function minutesOfDay(d){ return d.getHours()*60 + d.getMinutes(); }
  function withinWindow(mins, start, end){ return mins>=start && mins<=end; }

  // Festività italiane fisse (MM-DD)
  const italianHolidays = [
    '01-01', // Capodanno
    '01-06', // Epifania
    '04-25', // Festa della Liberazione
    '05-01', // Festa del Lavoro
    '06-02', // Festa della Repubblica
    '08-15', // Ferragosto
    '11-01', // Ognissanti
    '12-08', // Immacolata Concezione
    '12-25', // Natale
    '12-26'  // Santo Stefano
  ];

  function isHolidayDate(date){
    const s = load();
    const key = toDateKey(date);
    const monthDay = toMonthDay(date);
    
    // Controlla festività italiane fisse
    if (italianHolidays.includes(monthDay)) return true;
    
    // Controlla festività custom dalle impostazioni
    return Array.isArray(s.holidays) && s.holidays.includes(key);
  }
  function isDeliveryAllowedDate(date){
    const s = load();
    const dow = date.getDay(); // 0..6 (0=Dom)
    if (!Array.isArray(s.deliveryDays) || s.deliveryDays.length===0) return false;
    if (!s.deliveryDays.includes(dow)) return false;
    if (isHolidayDate(date)) return false;
    return true;
  }
  function isPickupAllowedDate(date){
    const s = load();
    const dow = date.getDay();
    if (!Array.isArray(s.openingDays) || s.openingDays.length===0) return false;
    if (!s.openingDays.includes(dow)) return false;
    if (isHolidayDate(date)) return false;
    return true;
  }
  function getDeliveryWindows(date){
    const s = load();
    const isSaturday = date ? date.getDay() === 6 : false;
    
    let m1, m2, a1, a2;
    if (isSaturday) {
      // Usa orari sabato se definiti, altrimenti fallback agli orari normali
      m1 = parseTime(s.deliverySatMorningStart || s.deliveryMorningStart);
      m2 = parseTime(s.deliverySatMorningEnd || s.deliveryMorningEnd);
      a1 = parseTime(s.deliverySatAfternoonStart);
      a2 = parseTime(s.deliverySatAfternoonEnd);
    } else {
      m1 = parseTime(s.deliveryMorningStart);
      m2 = parseTime(s.deliveryMorningEnd);
      a1 = parseTime(s.deliveryAfternoonStart);
      a2 = parseTime(s.deliveryAfternoonEnd);
    }
    
    const windows = [];
    if (m1 && m2) windows.push({ start: m1.h*60 + m1.m, end: m2.h*60 + m2.m });
    if (a1 && a2) windows.push({ start: a1.h*60 + a1.m, end: a2.h*60 + a2.m });
    return windows;
  }
  function getOpeningWindows(date){
    const s = load();
    const isSaturday = date ? date.getDay() === 6 : false;
    
    let m1, m2, a1, a2;
    if (isSaturday) {
      // Usa orari sabato se definiti, altrimenti fallback agli orari normali
      m1 = parseTime(s.openSatMorningStart || s.openMorningStart);
      m2 = parseTime(s.openSatMorningEnd || s.openMorningEnd);
      a1 = parseTime(s.openSatAfternoonStart);
      a2 = parseTime(s.openSatAfternoonEnd);
    } else {
      m1 = parseTime(s.openMorningStart);
      m2 = parseTime(s.openMorningEnd);
      a1 = parseTime(s.openAfternoonStart);
      a2 = parseTime(s.openAfternoonEnd);
    }
    
    const windows = [];
    if (m1 && m2) windows.push({ start: m1.h*60 + m1.m, end: m2.h*60 + m2.m });
    if (a1 && a2) windows.push({ start: a1.h*60 + a1.m, end: a2.h*60 + a2.m });
    return windows;
  }
  function isWithinDeliveryWindows(date){
    const mins = minutesOfDay(date);
    const windows = getDeliveryWindows(date);
    if (windows.length===0) return true; // if not configured, allow
    return windows.some(w => withinWindow(mins, w.start, w.end));
  }
  function isWithinOpeningWindows(date){
    const mins = minutesOfDay(date);
    const windows = getOpeningWindows(date);
    if (windows.length===0) return true;
    return windows.some(w => withinWindow(mins, w.start, w.end));
  }
  function nextValidDeliveryDateTime(fromDate){
    const d = new Date(fromDate.getTime());
    for (let i=0;i<14;i++) { // search up to 2 weeks
      if (isDeliveryAllowedDate(d)) {
        const windows = getDeliveryWindows(d);
        const mins = minutesOfDay(d);
        // If within a window, clamp to now or keep as is
        for (const w of windows){
          if (mins <= w.end) {
            if (mins < w.start) {
              d.setHours(Math.floor(w.start/60), w.start%60, 0, 0);
            }
            return d;
          }
        }
        // Past all windows: move to next day at first window start
      }
      d.setDate(d.getDate()+1);
      const w = getDeliveryWindows(d);
      if (w.length>0) d.setHours(Math.floor(w[0].start/60), w[0].start%60, 0, 0);
      else d.setHours(8,0,0,0);
    }
    return d;
  }
  function nextValidOpeningDateTime(fromDate){
    const d = new Date(fromDate.getTime());
    for (let i=0;i<14;i++) {
      if (isPickupAllowedDate(d)) {
        const windows = getOpeningWindows(d);
        const mins = minutesOfDay(d);
        for (const w of windows){
          if (mins <= w.end) {
            if (mins < w.start) {
              d.setHours(Math.floor(w.start/60), w.start%60, 0, 0);
            }
            return d;
          }
        }
      }
      d.setDate(d.getDate()+1);
      const w = getOpeningWindows(d);
      if (w.length>0) d.setHours(Math.floor(w[0].start/60), w[0].start%60, 0, 0);
      else d.setHours(8,0,0,0);
    }
    return d;
  }
  function clampToDeliveryWindows(date){
    const d = new Date(date.getTime());
    if (!isDeliveryAllowedDate(d)) return nextValidDeliveryDateTime(d);
    if (isWithinDeliveryWindows(d)) return d;
    return nextValidDeliveryDateTime(d);
  }
  function clampToOpeningWindows(date){
    const d = new Date(date.getTime());
    if (!isPickupAllowedDate(d)) return nextValidOpeningDateTime(d);
    if (isWithinOpeningWindows(d)) return d;
    return nextValidOpeningDateTime(d);
  }

  // Funzione per applicare il branding aziendale (logo e nome) alle pagine
  function applyBranding(settings) {
    if (!settings) settings = load();
    
    // Logo: update src with custom logoUrl (if different from default) + cache-buster
    // Applied ONCE on page load to avoid flicker
    if (!window.logoTimestampApplied) {
      window.logoTimestampApplied = true;
      const timestamp = Math.floor(Date.now() / 60000); // Change every minute
      const logoSelectors = ['.header-logo img', '.login-logo img'];
      for (const selector of logoSelectors) {
        const logoImg = document.querySelector(selector);
        if (logoImg && settings.logoUrl) {
          // Use the logoUrl from settings (which comes from database)
          let logoSrc = settings.logoUrl;
          if (logoSrc && !logoSrc.startsWith('http') && !logoSrc.startsWith('data:')) {
            // If it's a relative path, keep it as-is
            // The server will serve it from public/ or /uploads/
          }
          // Add timestamp cache-buster to force reload of changed images
          if (!logoSrc.includes('?t=')) {
            logoSrc = `${logoSrc}?t=${timestamp}`;
          }
          logoImg.src = logoSrc;
          logoImg.alt = settings.businessName || 'Logo Azienda';
        }
      }
    }
    
    // Aggiorna titolo pagina se businessName presente
    if (settings.businessName) {
      const pageName = document.title.includes('-') ? document.title.split('-').pop().trim() : 'Task Manager';
      document.title = settings.businessName + ' - ' + pageName;
    }
  }
  
  // Versione asincrona che carica e applica il branding
  async function loadAndApplyBranding() {
    const settings = await loadAsync();
    applyBranding(settings);
    return settings;
  }

  window.SettingsUtils = {
    load,
    loadAsync,
    loadAndApplyBranding,
    applyBranding,
    defaultCompanySettings,
    isHolidayDate,
    isDeliveryAllowedDate,
    isPickupAllowedDate,
    isWithinDeliveryWindows,
    isWithinOpeningWindows,
    nextValidDeliveryDateTime,
    nextValidOpeningDateTime,
    clampToDeliveryWindows,
    clampToOpeningWindows,
    getDeliveryWindows,
    getOpeningWindows
  };
})();
