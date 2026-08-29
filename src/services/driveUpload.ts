import { fileCache } from './fileCache';

/**
 * Fast and resilient Google Drive upload & management service for academic assignments and submissions
 */

export const GDRIVE_FOLDER_ID = '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu';
export const GDRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`;
export const GDRIVE_OFFICIAL_ORDERS_FOLDER_ID = '1hHTRwn9UpW43xgOUp8O4Yvn8AvioOey8'; // โฟลเดอร์หนังสือคำสั่ง
export const GDRIVE_SAMPLE_DOCS_FOLDER_ID = '1zFyOcMUxFzFxDXS0C_x41sA6Sy1E2eZS'; // โฟลเดอร์เอกสารตัวอย่าง

export const GAS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzve6nmcAMloypZThIb5aRyKfLd3NJCeoddYU8NToVMCXKltjG9WWEI6yA-tetESAt26w/exec';

export const PROTECTED_ROOT_FOLDER_IDS = new Set<string>([
  '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu', // โฟลเดอร์หลัก "วิชาการ Z"
  '1hHTRwn9UpW43xgOUp8O4Yvn8AvioOey8', // โฟลเดอร์หนังสือคำสั่ง
  '1zFyOcMUxFzFxDXS0C_x41sA6Sy1E2eZS', // โฟลเดอร์เอกสารตัวอย่าง
  GDRIVE_FOLDER_ID,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
]);

/**
 * Check if a folder ID or URL is a protected root/system folder
 */
export function isProtectedRootFolder(folderIdOrUrl?: string): boolean {
  if (!folderIdOrUrl) return false;
  const id = extractDriveFileId(folderIdOrUrl);
  if (!id) return false;
  if (PROTECTED_ROOT_FOLDER_IDS.has(id)) return true;
  if (id === GDRIVE_FOLDER_ID || id === '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu') return true;
  if (id === GDRIVE_OFFICIAL_ORDERS_FOLDER_ID || id === '1hHTRwn9UpW43xgOUp8O4Yvn8AvioOey8') return true;
  if (id === GDRIVE_SAMPLE_DOCS_FOLDER_ID || id === '1zFyOcMUxFzFxDXS0C_x41sA6Sy1E2eZS') return true;
  try {
    const raw = localStorage.getItem('academic_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.gdriveFolderId && (id === parsed.gdriveFolderId || id === extractDriveFileId(parsed.gdriveFolderId))) {
        return true;
      }
    }
  } catch {}
  return false;
}

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script Webhook API v3 (ระบบจัดการ Google Drive แบบเรียลไทม์)
 * รองรับ:
 * 1. ดาวน์โหลดไฟล์จาก Google Drive ตรงสู่ผู้ใช้แบบสมบูรณ์ (downloadFile / getFile) - รองรับ Word .docx, PDF, Excel, รูปภาพ ทุกชนิด
 * 2. สร้างโฟลเดอร์ตามชื่องานมอบหมายอัตโนมัติ (createFolder)
 * 3. อัปโหลดไฟล์ตรงเข้าโฟลเดอร์เป้าหมาย (upload)
 * 4. ลบไฟล์ออกจาก Google Drive อัตโนมัติ (deleteFile) - ลบเฉพาะไฟล์ ห้ามลบโฟลเดอร์เด็ดขาด
 * 5. ป้องกันและห้ามลบโฟลเดอร์ทุกกรณี (deleteFolder -> Disabled / Protected)
 * 6. กู้คืนโฟลเดอร์หลักออกจากถังขยะอัตโนมัติ (restoreRootFolders)
 * 7. ตรวจสอบสถานะการเชื่อมต่อ (doGet)
 */

var PROTECTED_ROOT_IDS = [
  '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu', // โฟลเดอร์หลัก "วิชาการ Z"
  '1hHTRwn9UpW43xgOUp8O4Yvn8AvioOey8', // โฟลเดอร์หนังสือคำสั่ง
  '1zFyOcMUxFzFxDXS0C_x41sA6Sy1E2eZS'  // โฟลเดอร์เอกสารตัวอย่าง
];

function ensureRootFoldersRestored() {
  for (var i = 0; i < PROTECTED_ROOT_IDS.length; i++) {
    try {
      var folder = DriveApp.getFolderById(PROTECTED_ROOT_IDS[i]);
      if (folder && folder.isTrashed()) {
        folder.setTrashed(false); // กู้คืนจากถังขยะกลับสู่ "ไดรฟ์ของฉัน" ทันที
      }
    } catch (e) {}
  }
}

function doPost(e) {
  try {
    // กู้คืนและตรวจสอบโฟลเดอร์หลักทุกครั้งที่มีการเรียกใช้งาน
    ensureRootFoldersRestored();

    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No post data received'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action || (data.base64 ? 'upload' : '');

    // ----------------------------------------------------
    // 0. ACTION: กู้คืนโฟลเดอร์หลักกลับสู่ไดรฟ์ของฉัน
    // ----------------------------------------------------
    if (action === 'restoreRootFolders' || action === 'untrash') {
      ensureRootFoldersRestored();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'restoreRootFolders',
        message: 'Protected root folders restored to My Drive successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 1. ACTION: ดาวน์โหลดดึงข้อมูลไฟล์จาก Google Drive (Word, PDF, Excel, รูปภาพ ฯลฯ)
    // ----------------------------------------------------
    if (action === 'downloadFile' || action === 'getFile' || action === 'download') {
      var dlFileId = data.fileId;
      var dlFileName = data.fileName || data.name;
      var dlFolderId = data.folderId || data.targetFolderId;

      if (!dlFileId && data.fileUrl) {
        var match = data.fileUrl.match(/\\/file\\/d\\/([a-zA-Z0-9_-]+)/) ||
                    data.fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match) dlFileId = match[1];
      }

      var targetFile = null;
      if (dlFileId && dlFileId.length >= 20 && PROTECTED_ROOT_IDS.indexOf(dlFileId) === -1) {
        try {
          targetFile = DriveApp.getFileById(dlFileId);
        } catch (errId) {}
      }

      // ค้นหาไฟล์จากชื่อไฟล์ทั่วทั้ง Google Drive
      if (!targetFile && dlFileName) {
        try {
          var filesIterator = DriveApp.getFilesByName(dlFileName);
          if (filesIterator.hasNext()) {
            targetFile = filesIterator.next();
          }
        } catch (errNameAll) {}
      }

      // ค้นหาในโฟลเดอร์เป้าหมาย
      if (!targetFile && dlFileName && dlFolderId) {
        try {
          var sFolder = DriveApp.getFolderById(dlFolderId);
          var sIterator = sFolder.getFilesByName(dlFileName);
          if (sIterator.hasNext()) {
            targetFile = sIterator.next();
          }
        } catch (errNameFolder) {}
      }

      if (targetFile) {
        try {
          var blob = targetFile.getBlob();
          var base64Data = Utilities.base64Encode(blob.getBytes());
          var mimeType = blob.getContentType() || targetFile.getMimeType() || 'application/octet-stream';
          
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            action: 'downloadFile',
            fileId: targetFile.getId(),
            fileName: targetFile.getName(),
            mimeType: mimeType,
            size: targetFile.getSize(),
            data: base64Data,
            downloadUrl: targetFile.getDownloadUrl() || ('https://drive.google.com/uc?export=download&id=' + targetFile.getId())
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (errBlob) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Failed to read file binary: ' + errBlob.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'File not found in Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

      if (targetFile) {
        try {
          var blob = targetFile.getBlob();
          var base64Data = Utilities.base64Encode(blob.getBytes());
          var mimeType = blob.getContentType() || targetFile.getMimeType() || 'application/octet-stream';
          
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            action: 'downloadFile',
            fileId: targetFile.getId(),
            fileName: targetFile.getName(),
            mimeType: mimeType,
            size: targetFile.getSize(),
            data: base64Data,
            downloadUrl: targetFile.getDownloadUrl() || ('https://drive.google.com/uc?export=download&id=' + targetFile.getId())
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (errBlob) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Failed to read file binary: ' + errBlob.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'File not found in Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 2. ACTION: สร้างโฟลเดอร์ตามหัวข้องานมอบหมาย
    // ----------------------------------------------------
    if (action === 'createFolder') {
      var folderName = data.folderName || data.name || 'งานที่มอบหมาย';
      var parentId = data.parentFolderId || data.folderId || '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu';
      var parentFolder;
      try {
        parentFolder = DriveApp.getFolderById(parentId);
        if (parentFolder.isTrashed()) {
          parentFolder.setTrashed(false);
        }
      } catch (err) {
        parentFolder = DriveApp.getRootFolder();
      }

      // ตรวจสอบว่ามีโฟลเดอร์ชื่อนี้อยู่แล้วหรือไม่
      var existingFolders = parentFolder.getFoldersByName(folderName);
      var targetFolder;
      if (existingFolders.hasNext()) {
        targetFolder = existingFolders.next();
      } else {
        targetFolder = parentFolder.createFolder(folderName);
      }

      // เปิดสิทธิ์แชร์แบบดูได้สำหรับทุกคนที่มีลิงก์
      try {
        targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'createFolder',
        folderId: targetFolder.getId(),
        folderUrl: targetFolder.getUrl(),
        folderName: targetFolder.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 3. ACTION: ลบเฉพาะไฟล์ออกจาก Google Drive (ห้ามลบโฟลเดอร์เด็ดขาด)
    // ----------------------------------------------------
    if (action === 'deleteFile' || action === 'delete') {
      var fileId = data.fileId;
      var fileName = data.fileName || data.name;
      var folderId = data.folderId || data.targetFolderId;

      if (!fileId && data.fileUrl) {
        var match = data.fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    data.fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      }

      if (fileId && fileId.length >= 20) {
        // ป้องกันไม่ให้ลบโฟลเดอร์หลัก
        if (PROTECTED_ROOT_IDS.indexOf(fileId) > -1) {
          ensureRootFoldersRestored();
          return ContentService.createTextOutput(JSON.stringify({
            status: 'warning',
            message: 'Protected folder cannot be deleted'
          })).setMimeType(ContentService.MimeType.JSON);
        }

        try {
          var fileToDelete = DriveApp.getFileById(fileId);
          // ความปลอดภัย: ป้องกันไม่ให้ลบถ้าเป็นโฟลเดอร์
          if (fileToDelete.getMimeType() === MimeType.FOLDER || fileToDelete.getMimeType() === 'application/vnd.google-apps.folder') {
            return ContentService.createTextOutput(JSON.stringify({
              status: 'warning',
              message: 'Folder deletion is prohibited by policy. Folder preserved.'
            })).setMimeType(ContentService.MimeType.JSON);
          }
          fileToDelete.setTrashed(true); // ย้ายลงถังขยะ Google Drive เฉพาะไฟล์
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            action: 'deleteFile',
            fileId: fileId,
            message: 'File trashed successfully'
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
          if (fileName) {
            try {
              var searchFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
              var files = searchFolder.getFilesByName(fileName);
              var deletedCount = 0;
              while (files.hasNext()) {
                var f = files.next();
                if (f.getMimeType() !== MimeType.FOLDER && f.getMimeType() !== 'application/vnd.google-apps.folder') {
                  f.setTrashed(true);
                  deletedCount++;
                }
              }
              if (deletedCount > 0) {
                return ContentService.createTextOutput(JSON.stringify({
                  status: 'success',
                  action: 'deleteFile',
                  message: 'File trashed by name successfully (' + deletedCount + ' files)'
                })).setMimeType(ContentService.MimeType.JSON);
              }
            } catch (e2) {}
          }
          return ContentService.createTextOutput(JSON.stringify({
            status: 'warning',
            message: 'File not found or already deleted: ' + err.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      } else if (fileName) {
        try {
          var targetFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
          var filesByName = targetFolder.getFilesByName(fileName);
          var delCount = 0;
          while (filesByName.hasNext()) {
            var fileItem = filesByName.next();
            if (fileItem.getMimeType() !== MimeType.FOLDER && fileItem.getMimeType() !== 'application/vnd.google-apps.folder') {
              fileItem.setTrashed(true);
              delCount++;
            }
          }
          if (delCount > 0) {
            return ContentService.createTextOutput(JSON.stringify({
              status: 'success',
              action: 'deleteFile',
              message: 'File trashed by name (' + delCount + ' items)'
            })).setMimeType(ContentService.MimeType.JSON);
          }
        } catch (e3) {}
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Invalid file ID or name for deletion'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 4. ACTION: นโยบายความปลอดภัยสูงสุด "ห้ามลบโฟลเดอร์ทุกกรณี"
    // ----------------------------------------------------
    if (action === 'deleteFolder') {
      ensureRootFoldersRestored();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'deleteFolder',
        message: 'Folder deletion is strictly disabled to preserve all folders and admin topic folders in Google Drive.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 5. ACTION: อัปโหลดไฟล์เข้าสู่โฟลเดอร์ Google Drive
    // ----------------------------------------------------
    if (data.base64) {
      var base64Clean = data.base64;
      if (base64Clean.indexOf(',') > -1) {
        base64Clean = base64Clean.split(',')[1];
      }
      var decoded = Utilities.base64Decode(base64Clean);
      var blob = Utilities.newBlob(decoded, data.type || 'application/octet-stream', data.name || 'uploaded_file');
      
      var targetFolderId = data.folderId || '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu';
      var folder;
      try {
        folder = DriveApp.getFolderById(targetFolderId);
        if (folder.isTrashed()) {
          folder.setTrashed(false);
        }
      } catch (err) {
        folder = DriveApp.getRootFolder();
      }

      var uploadedFile = folder.createFile(blob);

      try {
        uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'upload',
        fileId: uploadedFile.getId(),
        fileUrl: uploadedFile.getUrl(),
        downloadUrl: 'https://drive.google.com/uc?id=' + uploadedFile.getId() + '&export=download'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Invalid request or missing parameters'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  ensureRootFoldersRestored();

  // รองรับดาวน์โหลดไฟล์ผ่าน GET request ด้วย
  if (e && e.parameter && (e.parameter.action === 'downloadFile' || e.parameter.fileId)) {
    var fId = e.parameter.fileId;
    if (fId && fId.length >= 20) {
      try {
        var gFile = DriveApp.getFileById(fId);
        var gBlob = gFile.getBlob();
        var gBase64 = Utilities.base64Encode(gBlob.getBytes());
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          action: 'downloadFile',
          fileId: gFile.getId(),
          fileName: gFile.getName(),
          mimeType: gBlob.getContentType() || gFile.getMimeType(),
          size: gFile.getSize(),
          data: gBase64
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (eGet) {}
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'Academic Management Google Drive API v3 (Enhanced Real-Time Download & Strict Folder Protection)',
    version: '3.0',
    capabilities: ['downloadFile', 'createFolder', 'deleteFile', 'restoreRootFolders', 'upload'],
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}`;

/**
 * Returns the currently active Google Apps Script Webhook URL from localStorage/Settings
 */
export function getActiveGasWebhookUrl(): string {
  try {
    const raw = localStorage.getItem('academic_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.gasWebhookUrl === 'string' && parsed.gasWebhookUrl.trim().startsWith('http')) {
        return parsed.gasWebhookUrl.trim();
      }
    }
  } catch {}
  return GAS_WEBHOOK_URL;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  fileUrl: string;
  downloadUrl?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  targetFolderId?: string;
  error?: string;
}

export interface CreateFolderResult {
  success: boolean;
  folderId: string;
  folderUrl: string;
  folderName: string;
  error?: string;
}

/**
 * Extracts Google Drive File ID or Folder ID from URL or raw ID string
 */
export function extractDriveFileId(urlOrId?: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const clean = urlOrId.trim();
  if (
    !clean ||
    clean.startsWith('sample') ||
    clean.startsWith('doc_') ||
    clean.startsWith('task_folder_')
  ) {
    return null;
  }
  // Raw file or folder ID (typically 20-60 characters of letters, digits, -, _)
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(clean)) {
    return clean;
  }
  const match =
    clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    clean.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
    clean.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    clean.match(/\/document\/d\/([a-zA-Z0-9_-]+)/) ||
    clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Creates a dedicated task storage folder named after the task title
 */
export async function createGoogleDriveFolder(
  folderName: string,
  parentFolderId: string = GDRIVE_FOLDER_ID,
  webhookUrl?: string
): Promise<CreateFolderResult> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  const fallbackFolderId = `task_folder_${Date.now()}`;
  const fallbackResult: CreateFolderResult = {
    success: false,
    folderId: fallbackFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${parentFolderId}?task=${encodeURIComponent(folderName)}`,
    folderName,
    error: 'GAS_NOT_CONFIGURED_OR_UNAVAILABLE',
  };

  try {
    const payload = {
      action: 'createFolder',
      folderName: folderName.trim(),
      name: folderName.trim(),
      parentFolderId: parentFolderId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(activeWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && (data.status === 'success' || data.folderId)) {
        const folderId = data.folderId;
        const folderUrl = data.folderUrl || `https://drive.google.com/drive/folders/${folderId}`;
        return {
          success: true,
          folderId,
          folderUrl,
          folderName: data.folderName || folderName,
        };
      }
    }
  } catch (err) {
    console.warn('Folder creation GAS call error, using fallback:', err);
  }

  return fallbackResult;
}

/**
 * Upload file directly to a specified Google Drive folder
 * (e.g. Task-specific folder, Official Orders folder, or Sample Docs folder)
 */
export async function uploadFileToGoogleDrive(
  file: File,
  targetFolderId?: string,
  webhookUrl?: string
): Promise<DriveUploadResult> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  const resolvedFolderId = targetFolderId || GDRIVE_FOLDER_ID;
  const targetFolderUrl = `https://drive.google.com/drive/folders/${resolvedFolderId}`;
  const localPreviewUrl = URL.createObjectURL(file);
  const fileType = file.type || 'application/octet-stream';
  const tempFileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Immediately store in local resilient IndexedDB cache so the original file binary is NEVER lost
  try {
    await fileCache.saveFile(file.name, file, {
      name: file.name,
      driveUrl: targetFolderUrl,
      category: 'UPLOADED_FILE',
    });
    await fileCache.saveFile(tempFileId, file, {
      name: file.name,
      driveUrl: targetFolderUrl,
      category: 'UPLOADED_FILE',
    });
  } catch (err) {
    console.warn('Initial cache save warning:', err);
  }

  return new Promise((resolve) => {
    // 35s timeout to allow large files to upload to Google Drive reliably without premature abort
    const timer = setTimeout(() => {
      resolve({
        success: true,
        fileId: tempFileId,
        fileUrl: targetFolderUrl,
        downloadUrl: localPreviewUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType,
        targetFolderId: resolvedFolderId,
      });
    }, 35000);

    const reader = new FileReader();

    reader.onload = async () => {
      let base64Data = '';
      try {
        base64Data = (reader.result as string) || '';
        const payload = {
          action: 'upload',
          name: file.name,
          type: fileType,
          base64: base64Data,
          folderId: resolvedFolderId,
        };

        const response = await fetch(activeWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        clearTimeout(timer);

        if (response.ok) {
          try {
            const data = await response.json();
            if (data && (data.status === 'success' || data.fileUrl || data.fileId)) {
              const fileId = data.fileId || tempFileId;
              const fileUrl =
                data.fileUrl ||
                (data.fileId
                  ? `https://drive.google.com/file/d/${data.fileId}/view?usp=sharing`
                  : targetFolderUrl);

              // Cache file with the confirmed Google Drive fileId
              fileCache.saveFile(fileId, file, {
                name: file.name,
                driveFileId: fileId,
                driveUrl: fileUrl,
              }).catch(() => {});

              resolve({
                success: true,
                fileId,
                fileUrl,
                downloadUrl: base64Data || data.downloadUrl || localPreviewUrl || fileUrl,
                fileName: file.name,
                fileSize: file.size,
                fileType,
                targetFolderId: resolvedFolderId,
              });
              return;
            }
          } catch {
            // Ignore parse errors
          }
        }

        resolve({
          success: true,
          fileId: tempFileId,
          fileUrl: targetFolderUrl,
          downloadUrl: base64Data || localPreviewUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType,
          targetFolderId: resolvedFolderId,
        });
      } catch {
        clearTimeout(timer);
        resolve({
          success: true,
          fileId: tempFileId,
          fileUrl: targetFolderUrl,
          downloadUrl: base64Data || localPreviewUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType,
          targetFolderId: resolvedFolderId,
        });
      }
    };

    reader.onerror = () => {
      clearTimeout(timer);
      resolve({
        success: false,
        fileUrl: targetFolderUrl,
        downloadUrl: localPreviewUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType,
        targetFolderId: resolvedFolderId,
        error: 'ไม่สามารถอ่านไฟล์ได้',
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Delete file from Google Drive via GAS Webhook
 */
export async function deleteGoogleDriveFile(
  fileIdOrUrl: string,
  fileName?: string,
  folderId?: string,
  webhookUrl?: string
): Promise<boolean> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (!fileId && !fileName) {
    return true;
  }
  if (fileId && (fileId.startsWith('sample') || fileId.startsWith('doc_') || fileId.startsWith('task_folder_'))) {
    return true;
  }

  try {
    const payload: Record<string, any> = {
      action: 'deleteFile',
      fileId: fileId || undefined,
      fileUrl: fileIdOrUrl,
      fileName: fileName || undefined,
      name: fileName || undefined,
      folderId: folderId || undefined,
      targetFolderId: folderId || undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(activeWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data?.status === 'success' || res.ok;
    }
    return false;
  } catch (err) {
    console.warn('Google Drive file deletion request error:', err);
    return false;
  }
}

/**
 * Triggers native in-browser file download from a Blob
 */
export function triggerNativeBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(blobUrl);
  }, 1000);
}

/**
 * Converts a base64 string to a Blob with exact MIME type
 */
export function base64ToBlob(base64Data: string, mimeType: string = 'application/octet-stream'): Blob {
  let cleanBase64 = base64Data;
  if (cleanBase64.includes(',')) {
    const parts = cleanBase64.split(',');
    cleanBase64 = parts[1];
  }
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Downloads a file directly from Google Drive via GAS Webhook API or local cache
 * Returns real full binary data (Word .docx, PDF, Excel, Images, etc.)
 */
export async function downloadGoogleDriveFile(
  fileIdOrUrl: string,
  fileName?: string,
  folderId?: string,
  webhookUrl?: string
): Promise<{ success: boolean; blob?: Blob; fileName?: string; mimeType?: string; error?: string }> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  const fileId = extractDriveFileId(fileIdOrUrl);

  // 1. Check local resilient IndexedDB cache for original binary
  try {
    if (fileId) {
      const cached = await fileCache.getFile(fileId);
      if (cached && cached.blob && cached.blob.size > 0) {
        return {
          success: true,
          blob: cached.blob,
          fileName: cached.name || fileName || 'document',
          mimeType: cached.type || 'application/octet-stream',
        };
      }
    }
    if (fileName) {
      const cachedByName = await fileCache.getFile(fileName);
      if (cachedByName && cachedByName.blob && cachedByName.blob.size > 0) {
        return {
          success: true,
          blob: cachedByName.blob,
          fileName: cachedByName.name || fileName,
          mimeType: cachedByName.type || 'application/octet-stream',
        };
      }
    }
    if (fileIdOrUrl && fileIdOrUrl !== fileId) {
      const cachedByUrl = await fileCache.getFile(fileIdOrUrl);
      if (cachedByUrl && cachedByUrl.blob && cachedByUrl.blob.size > 0) {
        return {
          success: true,
          blob: cachedByUrl.blob,
          fileName: cachedByUrl.name || fileName || 'document',
          mimeType: cachedByUrl.type || 'application/octet-stream',
        };
      }
    }
  } catch (cacheErr) {
    console.warn('Cache lookup warning:', cacheErr);
  }

  // 2. Fetch directly from Google Apps Script Webhook API (downloadFile POST)
  try {
    const payload: Record<string, any> = {
      action: 'downloadFile',
      fileId: fileId && !isProtectedRootFolder(fileId) ? fileId : undefined,
      fileUrl: fileIdOrUrl,
      fileName: fileName || undefined,
      name: fileName || undefined,
      folderId: folderId || undefined,
      targetFolderId: folderId || undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(activeWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const result = await res.json().catch(() => null);
      if (result && result.status === 'success' && result.data) {
        const mimeType = result.mimeType || 'application/octet-stream';
        const finalName = result.fileName || fileName || 'document';
        const blob = base64ToBlob(result.data, mimeType);

        // Cache the newly fetched binary in IndexedDB
        if (fileId) fileCache.saveFile(fileId, blob, { name: finalName, driveFileId: fileId }).catch(() => {});
        if (finalName) fileCache.saveFile(finalName, blob, { name: finalName, driveFileId: fileId }).catch(() => {});

        return {
          success: true,
          blob,
          fileName: finalName,
          mimeType,
        };
      }
    }
  } catch (err) {
    console.warn('GAS Webhook direct binary download fallback:', err);
  }

  // 3. Fallback: Fetch via Google Apps Script GET request (?action=downloadFile)
  if (fileId && !isProtectedRootFolder(fileId)) {
    try {
      const getUrl = `${activeWebhook}${activeWebhook.includes('?') ? '&' : '?'}action=downloadFile&fileId=${encodeURIComponent(fileId)}&fileName=${encodeURIComponent(fileName || '')}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(getUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const result = await res.json().catch(() => null);
        if (result && result.status === 'success' && result.data) {
          const mimeType = result.mimeType || 'application/octet-stream';
          const finalName = result.fileName || fileName || 'document';
          const blob = base64ToBlob(result.data, mimeType);
          return {
            success: true,
            blob,
            fileName: finalName,
            mimeType,
          };
        }
      }
    } catch {}
  }

  // 4. Fallback: Direct Google Drive content export endpoint
  if (fileId && !fileId.startsWith('sample') && fileId !== GDRIVE_FOLDER_ID && !isProtectedRootFolder(fileId)) {
    try {
      const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
      const res = await fetch(directUrl, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) {
          return {
            success: true,
            blob,
            fileName: fileName || 'downloaded_file',
            mimeType: blob.type || 'application/octet-stream',
          };
        }
      }
    } catch {}
  }

  return {
    success: false,
    error: 'ไม่สามารถดึงไฟล์จาก Google Drive ได้โดยตรง',
  };
}

/**
 * Delete folder from Google Drive via GAS Webhook
 * STRICT SAFETY RULE: All Google Drive folders (root, admin topics, etc.) are permanently preserved
 * Folder deletion is completely disabled to protect users' folder structures.
 */
export async function deleteGoogleDriveFolder(
  folderIdOrUrl: string,
  webhookUrl?: string
): Promise<boolean> {
  // STRICT SAFETY: Do NOT delete any folders in Google Drive under any circumstances
  console.info('[FOLDER PRESERVATION] Preserving folder in Google Drive:', folderIdOrUrl);
  return true;
}

/**
 * Automatically restores protected root folders ("วิชาการ Z", "หนังสือคำสั่ง", "เอกสารตัวอย่าง")
 * from trash back to "My Drive" (ไดรฟ์ของฉัน)
 */
export async function restoreProtectedGoogleDriveRootFolders(webhookUrl?: string): Promise<boolean> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  try {
    const payload = {
      action: 'restoreRootFolders',
      rootFolderIds: Array.from(PROTECTED_ROOT_FOLDER_IDS),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(activeWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data?.status === 'success' || res.ok;
    }
    return false;
  } catch (err) {
    return false;
  }
}


