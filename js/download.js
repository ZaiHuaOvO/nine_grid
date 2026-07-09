/**
 * nine-grid - 下载模块
 * 处理 ZIP 打包与下载逻辑
 */

/**
 * 生成4位随机数字
 */
function ngRandomId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * 将图片 Blob 转为 canvas 并导出为 dataURL
 */
function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * 生成单张图片的九宫格下载结构
 * @param {string} baseName - 原图片名（不含扩展名）
 * @param {HTMLCanvasElement[]} canvases - 9个canvas数组
 * @returns {Promise<{zip: JSZip, folderName: string}>}
 */
async function packSingleGrid(baseName, canvases) {
  const randId = ngRandomId();
  const folderName = baseName + '_' + randId;
  const zip = new JSZip();
  const folder = zip.folder(folderName);

  for (let i = 0; i < canvases.length; i++) {
    const blob = await new Promise(resolve => canvases[i].toBlob(resolve, 'image/png'));
    folder.file(baseName + '_' + (i + 1) + '.png', blob);
  }

  return { zip, folderName, randId };
}

/**
 * 下载单个压缩包
 */
async function downloadSingleGrid(baseName, canvases) {
  const { zip, folderName } = await packSingleGrid(baseName, canvases);
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, folderName + '.zip');
  return folderName;
}

/**
 * 下载批量压缩包
 * @param {Array<{baseName, canvases}>} items
 */
async function downloadBatchGrid(items) {
  const batchId = '批量处理_' + ngRandomId();
  const zip = new JSZip();

  for (const item of items) {
    const randId = ngRandomId();
    const folderName = item.baseName + '_' + randId;
    const folder = zip.folder(folderName);

    for (let i = 0; i < item.canvases.length; i++) {
      const blob = await new Promise(resolve => item.canvases[i].toBlob(resolve, 'image/png'));
      folder.file(item.baseName + '_' + (i + 1) + '.png', blob);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, batchId + '.zip');
}

/**
 * 从历史记录下载九宫格
 */
async function downloadFromHistory(id, originalName) {
  const record = await ngGetHistoryDetail(id);
  if (!record || !record.images || record.images.length !== 9) {
    showToast('历史记录图片数据缺失', 'error');
    return;
  }

  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const randId = ngRandomId();
  const folderName = baseName + '_' + randId;
  const zip = new JSZip();
  const folder = zip.folder(folderName);

  for (let i = 0; i < record.images.length; i++) {
    folder.file(baseName + '_' + (i + 1) + '.png', record.images[i]);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, folderName + '.zip');
}
