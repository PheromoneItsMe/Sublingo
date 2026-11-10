/* SubLingo — media store (audio clips and frames of saved phrases) in IndexedDB of the extension. */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open('sublingo-media', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('media'); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((resolve, reject) => {
      const t = d.transaction('media', mode);
      const st = t.objectStore('media');
      let out;
      Promise.resolve(fn(st, (v) => { out = v; })).catch(reject);
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
    }));
  }
  SL.media = {
    // value: { audio: dataURL|null, image: dataURL|null, duration, at }
    put(id, value) { return tx('readwrite', (st) => { st.put(value, id); }).then(() => id); },
    get(id) {
      if (!id) return Promise.resolve(null);
      return tx('readonly', (st, set) => { const r = st.get(id); r.onsuccess = () => set(r.result || null); });
    },
    del(ids) { ids = [].concat(ids || []).filter(Boolean); if (!ids.length) return Promise.resolve(); return tx('readwrite', (st) => { ids.forEach(id => st.delete(id)); }); },
    count() { return tx('readonly', (st, set) => { const r = st.count(); r.onsuccess = () => set(r.result); }); },
    keys() { return tx('readonly', (st, set) => { const r = st.getAllKeys(); r.onsuccess = () => set(r.result || []); }); },
    newId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  };
})(SL);
