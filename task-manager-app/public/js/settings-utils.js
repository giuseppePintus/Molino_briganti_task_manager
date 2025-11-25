(function(){
  const API_URL = (typeof window !== 'undefined') ? (window.API_URL || 'http://localhost:5000/api') : 'http://localhost:5000/api';

  function defaultCompanySettings(){
    return {
      businessName: 'Molino Briganti',
      logoUrl: 'images/logo INSEGNA.png',
      openingDays: [1,2,3,4,5,6],
      openMorningStart: '08:00', openMorningEnd: '13:00',
      openAfternoonStart: '15:00', openAfternoonEnd: '18:00',
      deliveryDays: [1,2,3,4,5,6],
      deliveryMorningStart: '08:00', deliveryMorningEnd: '12:00',
      deliveryAfternoonStart: '15:00', deliveryAfternoonEnd: '18:00',
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
  function parseTime(str){ if(!str) return null; const [h,m] = str.split(':').map(x=>parseInt(x,10)); return {h: h||0, m: m||0}; }
  function minutesOfDay(d){ return d.getHours()*60 + d.getMinutes(); }
  function withinWindow(mins, start, end){ return mins>=start && mins<=end; }

  function isHolidayDate(date){
    const s = load();
    const key = toDateKey(date);
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
  function getDeliveryWindows(){
    const s = load();
    const m1 = parseTime(s.deliveryMorningStart), m2 = parseTime(s.deliveryMorningEnd);
    const a1 = parseTime(s.deliveryAfternoonStart), a2 = parseTime(s.deliveryAfternoonEnd);
    const windows = [];
    if (m1 && m2) windows.push({ start: m1.h*60 + m1.m, end: m2.h*60 + m2.m });
    if (a1 && a2) windows.push({ start: a1.h*60 + a1.m, end: a2.h*60 + a2.m });
    return windows;
  }
  function getOpeningWindows(){
    const s = load();
    const m1 = parseTime(s.openMorningStart), m2 = parseTime(s.openMorningEnd);
    const a1 = parseTime(s.openAfternoonStart), a2 = parseTime(s.openAfternoonEnd);
    const windows = [];
    if (m1 && m2) windows.push({ start: m1.h*60 + m1.m, end: m2.h*60 + m2.m });
    if (a1 && a2) windows.push({ start: a1.h*60 + a1.m, end: a2.h*60 + a2.m });
    return windows;
  }
  function isWithinDeliveryWindows(date){
    const mins = minutesOfDay(date);
    const windows = getDeliveryWindows();
    if (windows.length===0) return true; // if not configured, allow
    return windows.some(w => withinWindow(mins, w.start, w.end));
  }
  function isWithinOpeningWindows(date){
    const mins = minutesOfDay(date);
    const windows = getOpeningWindows();
    if (windows.length===0) return true;
    return windows.some(w => withinWindow(mins, w.start, w.end));
  }
  function nextValidDeliveryDateTime(fromDate){
    const d = new Date(fromDate.getTime());
    for (let i=0;i<14;i++) { // search up to 2 weeks
      if (isDeliveryAllowedDate(d)) {
        const windows = getDeliveryWindows();
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
      const w = getDeliveryWindows();
      if (w.length>0) d.setHours(Math.floor(w[0].start/60), w[0].start%60, 0, 0);
      else d.setHours(8,0,0,0);
    }
    return d;
  }
  function nextValidOpeningDateTime(fromDate){
    const d = new Date(fromDate.getTime());
    for (let i=0;i<14;i++) {
      if (isPickupAllowedDate(d)) {
        const windows = getOpeningWindows();
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
      const w = getOpeningWindows();
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

  window.SettingsUtils = {
    load,
    loadAsync,
    defaultCompanySettings,
    isHolidayDate,
    isDeliveryAllowedDate,
    isPickupAllowedDate,
    isWithinDeliveryWindows,
    isWithinOpeningWindows,
    nextValidDeliveryDateTime,
    nextValidOpeningDateTime,
    clampToDeliveryWindows,
    clampToOpeningWindows
  };
})();
