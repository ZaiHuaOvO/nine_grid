/**
 * nine-grid - 主应用逻辑
 */
// ══════════════════════════════════════════
//  State
// ══════════════════════════════════════════

let singleCropper = null;
let singleCanvases = [];   // 9 个 canvas
let singleOriginalName = '';
let singleOriginalFile = null;

const batchState = [];
let batchIdCounter = 0;

let historyCurrentPage = 1;

const DEFAULT_NAME = '再花';
const DEFAULT_AVATAR = 'https://api.flowersink.com/img/%E7%B2%89%E6%AF%9B%E7%8C%AB%E7%8C%AB%E5%A4%B4.jpeg';

// 颜色选择器防抖
let colorDebounceTimers = {};

// ══════════════════════════════════════════
//  Utilities
// ══════════════════════════════════════════

function showToast(msg, type) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'fl-toast';
  if (type === 'error') t.className += ' fl-toast--error';
  else if (type === 'warning') t.className += ' fl-toast--warning';
  else if (type === 'info') t.className += ' fl-toast--info';
  t.textContent = msg;
  t.onclick = function () { t.remove(); };
  c.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function getBaseName(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * 颜色选择器防抖 — 停止操作 0.5s 后执行回调
 */
function debouncedColorUpdate(key, callback) {
  if (colorDebounceTimers[key]) {
    clearTimeout(colorDebounceTimers[key]);
  }
  colorDebounceTimers[key] = setTimeout(callback, 500);
}

/**
 * 简易 lightbox — 显示大图
 */
function openLightbox(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.onclick = function () { overlay.remove(); };

  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

// ══════════════════════════════════════════
//  Tab Switching
// ══════════════════════════════════════════

function switchTab(tabId) {
  document.querySelectorAll('.fl-tab').forEach(function (b) {
    b.classList.toggle('fl-tab--active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.fl-tab-content').forEach(function (c) {
    c.classList.toggle('fl-tab-content--active', c.id === 'tab-' + tabId);
  });
  if (tabId === 'history') loadHistory(1);
}

// ══════════════════════════════════════════
//  Cropper: Single Mode
// ══════════════════════════════════════════

function initSingleCropper(file) {
  if (singleCropper) {
    singleCropper.destroy();
    singleCropper = null;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = document.getElementById('singleCropperImg');
    img.src = e.target.result;

    document.getElementById('singleEditorCard').style.display = 'block';
    document.getElementById('singleGenerateBtn').style.display = 'none';

    img.onload = function () {
      singleCropper = new Cropper(img, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready: function () {
          generateSingleGrid();
        },
        crop: function () {
          const btn = document.getElementById('singleGenerateBtn');
          if (btn.style.display === 'none') {
            btn.style.display = '';
          }
        }
      });

      document.getElementById('singleDownloadBtn').disabled = true;
      singleCanvases = [];
    };
  };
  reader.readAsDataURL(file);
}

function resetCropper() {
  if (singleCropper) {
    const btn = document.getElementById('singleGenerateBtn');
    btn.style.display = 'none';
    singleCropper.reset();
    setTimeout(generateSingleGrid, 150);
  }
}

function generateSingleGrid() {
  if (!singleCropper) return;

  const gap = parseInt(document.getElementById('singleGapSlider').value);
  const bgColor = document.getElementById('singleBgColor').value;

  const croppedCanvas = singleCropper.getCroppedCanvas({
    width: 900,
    height: 900,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  const cellSize = 300;
  const canvases = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const c = document.createElement('canvas');
      c.width = cellSize;
      c.height = cellSize;
      const ctx = c.getContext('2d');
      ctx.drawImage(croppedCanvas, col * cellSize, row * cellSize, cellSize, cellSize, 0, 0, cellSize, cellSize);
      canvases.push(c);
    }
  }

  singleCanvases = canvases;

  renderMomentsPreview(
    document.getElementById('singlePreviewArea'),
    canvases, gap, bgColor
  );

  document.getElementById('singleDownloadBtn').disabled = false;

  const btn = document.getElementById('singleGenerateBtn');
  btn.style.display = 'none';

  // 保存历史（包含原图）
  saveHistory(singleOriginalFile, singleOriginalName, canvases);
}

function renderMomentsPreview(container, canvases, gap, bgColor) {
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'fl-moments-card';

  const header = document.createElement('div');
  header.className = 'fl-moments-header';
  header.innerHTML = `
    <img class="fl-moments-avatar" src="${DEFAULT_AVATAR}" alt="avatar">
    <span class="fl-moments-name">${DEFAULT_NAME}</span>
  `;
  card.appendChild(header);

  const gridWrap = document.createElement('div');
  gridWrap.className = 'fl-moments-grid-wrap';
  gridWrap.style.background = bgColor || '#f0f0f0';

  const grid = document.createElement('div');
  grid.className = 'fl-moments-grid';
  grid.style.setProperty('--fl-grid-gap', gap + 'px');

  canvases.forEach((c) => {
    const img = document.createElement('img');
    img.src = c.toDataURL('image/png');
    img.alt = 'grid';
    grid.appendChild(img);
  });

  gridWrap.appendChild(grid);
  card.appendChild(gridWrap);

  const footer = document.createElement('div');
  footer.className = 'fl-moments-footer';
  footer.innerHTML = '<span>Like</span><span>Comment</span>';
  card.appendChild(footer);

  container.appendChild(card);
}

function updateSinglePreview() {
  if (singleCanvases.length === 9) {
    const gap = parseInt(document.getElementById('singleGapSlider').value);
    const bgColor = document.getElementById('singleBgColor').value;
    renderMomentsPreview(
      document.getElementById('singlePreviewArea'),
      singleCanvases, gap, bgColor
    );
  }
}

// ══════════════════════════════════════════
//  Batch Mode
// ══════════════════════════════════════════

function addBatchItem(file) {
  const id = ++batchIdCounter;
  const baseName = getBaseName(file.name);
  const item = { id, file, cropper: null, canvases: [], baseName };
  batchState.push(item);

  const container = document.getElementById('batchItemsContainer');
  const div = document.createElement('div');
  div.className = 'fl-batch-item';
  div.id = 'batch-item-' + id;
  div.innerHTML = `
    <div class="fl-batch-header">
      <span class="fl-batch-filename">${escapeHtml(file.name)}</span>
      <button class="fl-btn fl-btn--sm fl-btn--danger" onclick="removeBatchItem(${id})">移除</button>
    </div>
    <div class="fl-batch-layout">
      <div>
        <div class="fl-section-title">图片选取</div>
        <div class="fl-cropper-area">
          <img id="batch-cropper-img-${id}" src="" alt="裁剪">
        </div>
        <div class="fl-crop-buttons">
          <button class="fl-btn fl-btn--solid fl-btn--sm" id="batch-gen-${id}" style="display:none;" onclick="generateBatchItem(${id})">生成</button>
          <button class="fl-btn fl-btn--sm" onclick="resetBatchCropper(${id})">重置</button>
          <button class="fl-btn fl-btn--sm fl-btn--success" onclick="downloadBatchItem(${id})" id="batch-dl-${id}" disabled>下载 ZIP</button>
        </div>
      </div>
      <div>
        <div class="fl-section-title">预览</div>
        <div class="fl-preview-area" id="batch-preview-${id}">
          <div class="fl-text-muted fl-text-caption">等待裁剪...</div>
        </div>
        <div class="fl-preview-controls">
          <div class="fl-preview-control-item">
            <label>背景颜色</label>
            <div class="fl-color-picker-wrap">
              <input type="color" id="batch-bgcolor-${id}" value="#f0f0f0">
              <span class="fl-color-picker-fill" style="background:#f0f0f0;"></span>
            </div>
          </div>
          <div class="fl-preview-control-item">
            <label>间距</label>
            <input type="range" min="1" max="10" step="1" value="2" oninput="updateBatchGap(${id}, this.value)">
            <span class="fl-gap-value" id="batch-gap-val-${id}" style="font-size:13px;min-width:24px;">2px</span>
          </div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(div);

  // 显示下载全部按钮
  document.getElementById('batchDownloadBar').classList.remove('fl-hidden');

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = document.getElementById('batch-cropper-img-' + id);
    img.src = e.target.result;
    img.onload = function () {
      const cropper = new Cropper(img, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready: function () {
          generateBatchItem(id);
        },
        crop: function () {
          const btn = document.getElementById('batch-gen-' + id);
          if (btn && btn.style.display === 'none') {
            btn.style.display = '';
          }
        }
      });
      item.cropper = cropper;
    };
  };
  reader.readAsDataURL(file);

  // 保存历史（批量自动保存）
  saveBatchItemToHistory(item, file);
}

/**
 * 批量处理时自动保存历史（含原图）
 */
function saveBatchItemToHistory(item, file) {
  // 延迟到生成后保存
  const checkInterval = setInterval(function () {
    if (item.canvases.length === 9) {
      clearInterval(checkInterval);
      const reader = new FileReader();
      reader.onload = function (e) {
        // 转 Blob
        fetch(e.target.result).then(r => r.blob()).then(originalBlob => {
          Promise.all(
            item.canvases.map(c => new Promise(resolve => c.toBlob(resolve, 'image/png')))
          ).then(blobs => {
            flAddHistory({
              original_name: file.name,
              original_image: originalBlob,
              images: blobs,
            }).catch(e => console.warn('保存历史失败', e));
          });
        });
      };
      reader.readAsDataURL(file);
    }
  }, 200);
}

function resetBatchCropper(id) {
  const item = batchState.find(i => i.id === id);
  if (item && item.cropper) {
    const btn = document.getElementById('batch-gen-' + id);
    if (btn) btn.style.display = 'none';
    item.cropper.reset();
    setTimeout(function () { generateBatchItem(id); }, 150);
  }
}

function removeBatchItem(id) {
  const idx = batchState.findIndex(item => item.id === id);
  if (idx >= 0) {
    if (batchState[idx].cropper) batchState[idx].cropper.destroy();
    batchState.splice(idx, 1);
  }
  const el = document.getElementById('batch-item-' + id);
  if (el) el.remove();
  if (batchState.length === 0) {
    document.getElementById('batchDownloadBar').classList.add('fl-hidden');
  }
}

function generateBatchItem(id) {
  const item = batchState.find(i => i.id === id);
  if (!item || !item.cropper) return;

  const gapSlider = document.querySelector('#batch-item-' + id + ' .fl-preview-control-item:nth-child(2) input[type="range"]');
  const gap = parseInt(gapSlider ? gapSlider.value : '2');

  const croppedCanvas = item.cropper.getCroppedCanvas({
    width: 900,
    height: 900,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  const cellSize = 300;
  const canvases = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const c = document.createElement('canvas');
      c.width = cellSize;
      c.height = cellSize;
      const ctx = c.getContext('2d');
      ctx.drawImage(croppedCanvas, col * cellSize, row * cellSize, cellSize, cellSize, 0, 0, cellSize, cellSize);
      canvases.push(c);
    }
  }

  item.canvases = canvases;

  const bgColorPicker = document.querySelector('#batch-item-' + id + ' .fl-color-picker-wrap input[type="color"]');
  const bgColor = bgColorPicker ? bgColorPicker.value : '#f0f0f0';

  const previewArea = document.getElementById('batch-preview-' + id);
  renderMomentsPreview(previewArea, canvases, gap, bgColor);

  document.getElementById('batch-dl-' + id).disabled = false;

  const btn = document.getElementById('batch-gen-' + id);
  if (btn) btn.style.display = 'none';
}

function updateBatchGap(id, value) {
  document.getElementById('batch-gap-val-' + id).textContent = value + 'px';
  const item = batchState.find(i => i.id === id);
  if (item && item.canvases.length === 9) {
    const bgColorPicker = document.querySelector('#batch-item-' + id + ' .fl-color-picker-wrap input[type="color"]');
    const bgColor = bgColorPicker ? bgColorPicker.value : '#f0f0f0';
    const previewArea = document.getElementById('batch-preview-' + id);
    renderMomentsPreview(previewArea, item.canvases, parseInt(value), bgColor);
  }
}

function updateBatchPreview(id) {
  const item = batchState.find(i => i.id === id);
  if (item && item.canvases.length === 9) {
    const gap = parseInt(document.querySelector('#batch-item-' + id + ' .fl-preview-control-item:nth-child(2) input[type="range"]').value || '2');
    const bgColor = document.querySelector('#batch-item-' + id + ' .fl-color-picker-wrap input[type="color"]').value;
    const fill = document.querySelector('#batch-item-' + id + ' .fl-color-picker-fill');
    if (fill) fill.style.background = bgColor;
    const previewArea = document.getElementById('batch-preview-' + id);
    renderMomentsPreview(previewArea, item.canvases, gap, bgColor);
  }
}

async function downloadBatchItem(id) {
  const item = batchState.find(i => i.id === id);
  if (!item || item.canvases.length !== 9) {
    showToast('请先生成九宫格', 'warning');
    return;
  }
  await downloadSingleGrid(item.baseName, item.canvases);
  showToast('下载完成', 'success');
}

async function downloadBatchAll() {
  const validItems = batchState.filter(i => i.canvases.length === 9);
  if (validItems.length === 0) {
    showToast('请先为图片生成九宫格', 'warning');
    return;
  }
  const items = validItems.map(i => ({
    baseName: i.baseName,
    canvases: i.canvases,
  }));
  await downloadBatchGrid(items);
  showToast('批量下载完成', 'success');
}

// ══════════════════════════════════════════
//  Batch File/Paste Handling
// ══════════════════════════════════════════

/**
 * 校验并加载单张图片
 */
function loadSingleFile(file) {
  if (file.size > 20 * 1024 * 1024) {
    showToast('图片超过 20MB 限制', 'error');
    return;
  }
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0) {
    showToast('不支持 ' + ext + ' 格式', 'error');
    return;
  }
  singleOriginalFile = file;
  singleOriginalName = file.name;
  initSingleCropper(file);
}

/**
 * 单张粘贴处理 — 多张只取第一张
 */
function handleSinglePaste(e) {
  const items = e.clipboardData && e.clipboardData.items;
  const files = e.clipboardData && e.clipboardData.files;
  let imageFile = null;

  if (items && items.length) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.indexOf('image/') === 0) {
        const file = item.getAsFile();
        if (file) {
          if (!file.name || file.name === '') {
            imageFile = new File([file], 'pasted-image-' + Date.now() + '.' + item.type.split('/')[1], { type: item.type });
          } else {
            imageFile = file;
          }
          break; // 只取第一张
        }
      }
    }
  } else if (files && files.length) {
    for (let j = 0; j < files.length; j++) {
      if (files[j].type && files[j].type.indexOf('image/') === 0) {
        imageFile = files[j];
        break; // 只取第一张
      }
    }
  }

  if (!imageFile) {
    showToast('未检测到剪贴板中的图片', 'warning');
    return;
  }

  showToast('已检测到图片', 'success');
  loadSingleFile(imageFile);
}

function handleBatchFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 20 * 1024 * 1024) {
      showToast(file.name + ' 超过 20MB 限制', 'error');
      continue;
    }
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0) {
      showToast(file.name + ' 不支持 ' + ext + ' 格式', 'error');
      continue;
    }
    addBatchItem(file);
  }
}

function handleBatchPaste(e) {
  const items = e.clipboardData && e.clipboardData.items;
  const files = e.clipboardData && e.clipboardData.files;
  const imageFiles = [];

  if (items && items.length) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.indexOf('image/') === 0) {
        const file = item.getAsFile();
        if (file) {
          if (!file.name || file.name === '') {
            file = new File([file], 'pasted-image-' + Date.now() + '.' + item.type.split('/')[1], { type: item.type });
          }
          imageFiles.push(file);
        }
      }
    }
  } else if (files && files.length) {
    for (let j = 0; j < files.length; j++) {
      if (files[j].type && files[j].type.indexOf('image/') === 0) {
        imageFiles.push(files[j]);
      }
    }
  }

  if (imageFiles.length === 0) {
    showToast('未检测到剪贴板中的图片', 'warning');
    return;
  }

  const resultDiv = document.getElementById('batchPasteResult');
  resultDiv.textContent = '已检测到 ' + imageFiles.length + ' 张图片';
  setTimeout(function () { resultDiv.textContent = ''; }, 3000);

  handleBatchFiles(imageFiles);
}

// ══════════════════════════════════════════
//  History
// ══════════════════════════════════════════

async function saveHistory(file, originalName, canvases) {
  try {
    // 保存原图 Blob
    const originalBlob = file;
    const blobs = await Promise.all(
      canvases.map(c => new Promise(resolve => c.toBlob(resolve, 'image/png')))
    );
    await flAddHistory({
      original_name: originalName,
      original_image: originalBlob,
      images: blobs,
    });
  } catch (e) {
    console.warn('保存历史记录失败', e);
  }
}

async function loadHistory(page) {
  if (page) historyCurrentPage = page;
  const kw = document.getElementById('historySearchInput').value;
  try {
    const result = await flSearchHistory(kw, historyCurrentPage, 20);
    renderHistoryTable(result);
    updateHistoryStorageInfo();
  } catch (e) {
    console.warn(e);
  }
}

function renderHistoryTable(result) {
  const tbody = document.getElementById('historyTableBody');
  if (!result.items || !result.items.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="fl-text-center fl-text-muted" style="padding:24px;">暂无历史记录</td></tr>';
    document.getElementById('historyPagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = result.items.map(function (item) {
    // 原图 — 可点击放大
    const thumb = item.thumbnail_url
      ? '<img src="' + item.thumbnail_url + '" class="fl-thumb" style="cursor:pointer;" onclick="openLightbox(\'' + item.thumbnail_url + '\')" alt="原图">'
      : '<span class="fl-text-muted">无</span>';
    const time = new Date(item.created_at).toLocaleString('zh-CN');
    const origName = escapeHtml(item.original_name);
    return '<tr>' +
      '<td>' + thumb + '</td>' +
      '<td class="fl-truncate" style="max-width:200px;">' + origName + '</td>' +
      '<td>' + time + '</td>' +
      '<td><div class="fl-action-group">' +
        '<button class="fl-btn fl-btn--sm" onclick="previewHistory(' + item.id + ',\'' + origName + '\')" title="预览">预览</button>' +
        '<button class="fl-btn fl-btn--sm" onclick="downloadFromHistory(' + item.id + ',\'' + origName + '\')" title="下载">下载</button>' +
        '<button class="fl-btn fl-btn--sm fl-btn--danger" onclick="confirmDeleteHistory(' + item.id + ')" title="删除">删除</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');

  renderHistoryPagination(result.total, result.page, result.pageSize);
}

function renderHistoryPagination(total, page, pageSize) {
  const tp = Math.ceil(total / pageSize) || 1;
  const div = document.getElementById('historyPagination');
  if (tp <= 1) { div.innerHTML = ''; return; }
  let html = '';
  const s = Math.max(1, page - 2), e = Math.min(tp, page + 2);
  if (page > 1) html += '<button onclick="loadHistory(' + (page - 1) + ')">上一页</button>';
  for (let i = s; i <= e; i++) html += '<button class="' + (i === page ? 'fl-pagination--active' : '') + '" onclick="loadHistory(' + i + ')">' + i + '</button>';
  if (page < tp) html += '<button onclick="loadHistory(' + (page + 1) + ')">下一页</button>';
  div.innerHTML = html;
}

async function previewHistory(id) {
  try {
    const record = await flGetHistoryDetail(id);
    if (!record || !record.images || record.images.length !== 9) {
      showToast('历史记录图片数据缺失', 'error');
      return;
    }

    const dataURLs = await Promise.all(record.images.map(blobToDataURL));
    const gap = parseInt(document.getElementById('previewGapSlider').value);
    const bgColor = document.getElementById('previewBgColor').value;

    renderPreviewModalCard(dataURLs, gap, bgColor);

    document.getElementById('previewGapSlider').oninput = function () {
      const v = parseInt(this.value);
      document.getElementById('previewGapValue').textContent = v + 'px';
      renderPreviewModalCard(dataURLs, v, document.getElementById('previewBgColor').value);
    };
    document.getElementById('previewBgColor').oninput = function () {
      const key = 'previewBg';
      const self = this;
      debouncedColorUpdate(key, function () {
        const gap = parseInt(document.getElementById('previewGapSlider').value);
        document.getElementById('previewBgColorFill').style.background = self.value;
        renderPreviewModalCard(dataURLs, gap, self.value);
      });
    };

    document.getElementById('previewModal').classList.add('fl-modal-overlay--open');
  } catch (e) {
    showToast('预览加载失败', 'error');
    console.warn(e);
  }
}

function renderPreviewModalCard(dataURLs, gap, bgColor) {
  const container = document.getElementById('previewModalCard');
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'fl-moments-card';
  card.style.maxWidth = '100%';

  const header = document.createElement('div');
  header.className = 'fl-moments-header';
  header.innerHTML = `
    <img class="fl-moments-avatar" src="${DEFAULT_AVATAR}" alt="avatar">
    <span class="fl-moments-name">${DEFAULT_NAME}</span>
  `;
  card.appendChild(header);

  const gridWrap = document.createElement('div');
  gridWrap.className = 'fl-moments-grid-wrap';
  gridWrap.style.background = bgColor || '#f0f0f0';

  const grid = document.createElement('div');
  grid.className = 'fl-moments-grid';
  grid.style.setProperty('--fl-grid-gap', gap + 'px');

  dataURLs.forEach(url => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'grid';
    grid.appendChild(img);
  });

  gridWrap.appendChild(grid);
  card.appendChild(gridWrap);

  const footer = document.createElement('div');
  footer.className = 'fl-moments-footer';
  footer.innerHTML = '<span>Like</span><span>Comment</span>';
  card.appendChild(footer);

  container.appendChild(card);
}

function closePreviewModal() {
  document.getElementById('previewModal').classList.remove('fl-modal-overlay--open');
}

function confirmDeleteHistory(id) {
  document.getElementById('confirmModalTitle').textContent = '删除历史记录';
  document.getElementById('confirmModalBody').textContent = '确定删除此历史记录？图片数据也将从本地删除，不可恢复。';
  document.getElementById('confirmModalOkBtn').onclick = async function () {
    try {
      await flDeleteHistory(id);
      showToast('已删除', 'success');
      loadHistory(historyCurrentPage);
    } catch (e) {
      showToast('删除失败', 'error');
    }
    closeConfirmModal();
  };
  document.getElementById('confirmModal').classList.add('fl-modal-overlay--open');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('fl-modal-overlay--open');
}

async function clearAllHistory() {
  document.getElementById('confirmModalTitle').textContent = '清空所有历史';
  document.getElementById('confirmModalBody').textContent = '确定清空所有历史记录？此操作不可恢复。';
  document.getElementById('confirmModalOkBtn').onclick = async function () {
    try {
      await flClearAllHistory();
      showToast('已清空所有历史', 'success');
      loadHistory(1);
    } catch (e) {
      showToast('清空失败', 'error');
    }
    closeConfirmModal();
  };
  document.getElementById('confirmModal').classList.add('fl-modal-overlay--open');
}

async function updateHistoryStorageInfo() {
  try {
    const info = await flGetStorageInfo();
    document.getElementById('historyStorageInfo').textContent = '共 ' + info.count + ' 条记录，占用 ' + info.totalSizeMB + ' MB';
  } catch (e) {
    document.getElementById('historyStorageInfo').textContent = '信息获取失败';
  }
}

// ══════════════════════════════════════════
//  DOM Events
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {

  // Tab switching
  document.querySelectorAll('.fl-tab').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(this.dataset.tab); });
  });

  // Single: file input
  document.getElementById('singleFileInput').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      loadSingleFile(this.files[0]);
    }
    this.value = '';
  });

  // Single: paste + drag-drop on upload zone
  const singleZone = document.getElementById('singleUploadZone');
  if (singleZone) {
    singleZone.addEventListener('paste', function (e) {
      e.preventDefault();
      handleSinglePaste(e);
    });
    singleZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      singleZone.classList.add('fl-batch-upload-area--dragover');
    });
    singleZone.addEventListener('dragleave', function () {
      singleZone.classList.remove('fl-batch-upload-area--dragover');
    });
    singleZone.addEventListener('drop', function (e) {
      e.preventDefault();
      singleZone.classList.remove('fl-batch-upload-area--dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        loadSingleFile(e.dataTransfer.files[0]);
      }
    });
  }

  document.getElementById('singleGenerateBtn').addEventListener('click', generateSingleGrid);
  document.getElementById('singleResetBtn').addEventListener('click', resetCropper);

  // Single: gap slider
  document.getElementById('singleGapSlider').addEventListener('input', function () {
    document.getElementById('singleGapValue').textContent = this.value + 'px';
    updateSinglePreview();
  });

  // Single: bg color — 防抖 0.5s
  document.getElementById('singleBgColor').addEventListener('input', function () {
    document.getElementById('singleBgColorFill').style.background = this.value;
    const key = 'singleBg';
    const self = this;
    debouncedColorUpdate(key, function () {
      updateSinglePreview();
    });
  });

  // Single: download
  document.getElementById('singleDownloadBtn').addEventListener('click', async function () {
    if (singleCanvases.length !== 9) {
      showToast('请先生成九宫格', 'warning');
      return;
    }
    const baseName = getBaseName(singleOriginalName);
    await downloadSingleGrid(baseName, singleCanvases);
    showToast('下载完成', 'success');
  });

  // Batch: file input (hidden inside zone)
  document.getElementById('batchFileInput').addEventListener('change', function () {
    if (this.files) {
      handleBatchFiles(this.files);
    }
    this.value = '';
  });

  // Batch: paste on upload zone
  const batchZone = document.getElementById('batchUploadZone');
  batchZone.addEventListener('paste', function (e) {
    e.preventDefault();
    handleBatchPaste(e);
  });
  batchZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    batchZone.classList.add('fl-batch-upload-area--dragover');
  });
  batchZone.addEventListener('dragleave', function () {
    batchZone.classList.remove('fl-batch-upload-area--dragover');
  });
  batchZone.addEventListener('drop', function (e) {
    e.preventDefault();
    batchZone.classList.remove('fl-batch-upload-area--dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleBatchFiles(e.dataTransfer.files);
    }
  });

  document.getElementById('batchDownloadAllBtn').addEventListener('click', downloadBatchAll);

  // History: search
  document.getElementById('historySearchInput').addEventListener('input', function () {
    loadHistory(1);
  });

  document.getElementById('clearAllHistoryBtn').addEventListener('click', clearAllHistory);

  // Close modals on overlay click
  document.getElementById('previewModal').addEventListener('click', function (e) {
    if (e.target === this) closePreviewModal();
  });
  document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target === this) closeConfirmModal();
  });

  loadHistory(1);
});
