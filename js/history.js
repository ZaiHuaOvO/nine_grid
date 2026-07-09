/**
 * nine-grid - IndexedDB 历史队列存储
 * 数据库: NineGridHistory v2
 * 对象存储: historyItems
 *   { original_name, original_image: Blob, images: [Blob...9], created_at }
 */

const NG_DB_NAME = 'NineGridHistory';
const NG_STORE_NAME = 'historyItems';
const NG_DB_VERSION = 2;

function ngOpenDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NG_DB_NAME, NG_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(NG_STORE_NAME)) {
        const store = db.createObjectStore(NG_STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('original_name', 'original_name', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 添加历史记录
 * @param {Object} item - { original_name, original_image: Blob, images: [blob1...blob9], created_at }
 */
async function ngAddHistory(item) {
  const db = await ngOpenDB();
  const tx = db.transaction(NG_STORE_NAME, 'readwrite');
  const store = tx.objectStore(NG_STORE_NAME);
  const record = {
    original_name: item.original_name,
    original_image: item.original_image || null,
    images: item.images || [],
    created_at: item.created_at || new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function ngSearchHistory(keyword, page, pageSize) {
  const db = await ngOpenDB();
  const tx = db.transaction(NG_STORE_NAME, 'readonly');
  const store = tx.objectStore(NG_STORE_NAME);
  const all = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });

  let filtered = all;
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = all.filter(item =>
      (item.original_name || '').toLowerCase().includes(kw)
    );
  }

  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  // 为每条记录生成原图缩略图 (original_image) object URL
  items.forEach(item => {
    if (item.original_image) {
      item.thumbnail_url = URL.createObjectURL(item.original_image);
    }
  });

  return { items, total, page, pageSize };
}

async function ngGetHistoryDetail(id) {
  const db = await ngOpenDB();
  const tx = db.transaction(NG_STORE_NAME, 'readonly');
  const store = tx.objectStore(NG_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function ngDeleteHistory(id) {
  const db = await ngOpenDB();
  const tx = db.transaction(NG_STORE_NAME, 'readwrite');
  const store = tx.objectStore(NG_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function ngClearAllHistory() {
  const db = await ngOpenDB();
  const tx = db.transaction(NG_STORE_NAME, 'readwrite');
  const store = tx.objectStore(NG_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function ngGetStorageInfo() {
  const db = await ngOpenDB();
  const tx = db.transaction(NG_STORE_NAME, 'readonly');
  const store = tx.objectStore(NG_STORE_NAME);
  const all = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
  const totalSize = all.reduce((sum, item) => {
    let s = 0;
    if (item.original_image) s += item.original_image.size;
    if (item.images) {
      s += item.images.reduce((a, b) => a + (b ? b.size : 0), 0);
    }
    return sum + s;
  }, 0);
  return {
    count: all.length,
    totalSizeBytes: totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
  };
}
