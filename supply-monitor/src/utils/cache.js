// --- UTILITÁRIOS DE CACHE (IndexedDB) ---
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('SupplyMonitorDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cacheStore')) {
        db.createObjectStore('cacheStore');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveToCache = async (key, data) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cacheStore', 'readwrite');
      const store = tx.objectStore('cacheStore');
      store.put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Falha ao salvar no cache local:", err);
  }
};

export const getFromCache = async (key) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cacheStore', 'readonly');
      const store = tx.objectStore('cacheStore');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Falha ao ler cache local:", err);
    return null;
  }
};
