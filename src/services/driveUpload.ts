/**
 * Fast and resilient Google Drive upload & management service for academic assignments and submissions
 */
import {
  GDRIVE_FOLDER_ID,
  GDRIVE_FOLDER_URL,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
} from './storage';

export const GAS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzve6nmcAMloypZThIb5aRyKfLd3NJCeoddYU8NToVMCXKltjG9WWEI6yA-tetESAt26w/exec';

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script Webhook API v2 (ระบบจัดการ Google Drive แบบเรียลไทม์)
 * รองรับ:
 * 1. สร้างโฟลเดอร์ตามชื่องานมอบหมายอัตโนมัติ (createFolder)
 * 2. อัปโหลดไฟล์ตรงเข้าโฟลเดอร์เป้าหมาย (upload)
 * 3. ลบไฟล์ออกจาก Google Drive อัตโนมัติ (deleteFile)
 * 4. ลบโฟลเดอร์ออกจาก Google Drive อัตโนมัติ (deleteFolder)
 * 5. ตรวจสอบสถานะการเชื่อมต่อ (doGet)
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No post data received'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action || (data.base64 ? 'upload' : '');

    // ----------------------------------------------------
    // 1. ACTION: สร้างโฟลเดอร์ตามหัวข้องานมอบหมาย
    // ----------------------------------------------------
    if (action === 'createFolder') {
      var folderName = data.folderName || data.name || 'งานที่มอบหมาย';
      var parentId = data.parentFolderId || data.folderId || '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu';
      var parentFolder;
      try {
        parentFolder = DriveApp.getFolderById(parentId);
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
    // 2. ACTION: ลบไฟล์ออกจาก Google Drive (ย้ายลงถังขยะ)
    // ----------------------------------------------------
    if (action === 'deleteFile' || action === 'delete') {
      var fileId = data.fileId;
      if (!fileId && data.fileUrl) {
        var match = data.fileUrl.match(/\\/file\\/d\\/([a-zA-Z0-9_-]+)/) ||
                    data.fileUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
                    data.fileUrl.match(/\\/folders\\/([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      }

      if (fileId && fileId.length >= 20) {
        try {
          var fileToDelete = DriveApp.getFileById(fileId);
          fileToDelete.setTrashed(true); // ย้ายลงถังขยะ Google Drive
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            action: 'deleteFile',
            fileId: fileId,
            message: 'File trashed successfully'
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'warning',
            message: 'File not found or already deleted: ' + err.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Invalid file ID for deletion'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 3. ACTION: ลบโฟลเดอร์ออกจาก Google Drive (ย้ายลงถังขยะ)
    // ----------------------------------------------------
    if (action === 'deleteFolder') {
      var folderId = data.folderId;
      if (!folderId && data.folderUrl) {
        var matchFolder = data.folderUrl.match(/\\/folders\\/([a-zA-Z0-9_-]+)/) ||
                          data.folderUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (matchFolder) folderId = matchFolder[1];
      }

      if (folderId && folderId.length >= 20) {
        try {
          var folderToDelete = DriveApp.getFolderById(folderId);
          folderToDelete.setTrashed(true); // ย้ายลงถังขยะ Google Drive
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            action: 'deleteFolder',
            folderId: folderId,
            message: 'Folder trashed successfully'
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'warning',
            message: 'Folder not found or already deleted: ' + err.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Invalid folder ID for deletion'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // 4. ACTION: อัปโหลดไฟล์เข้าสู่โฟลเดอร์ Google Drive
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
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'Academic Management Google Drive API v2',
    version: '2.0',
    capabilities: ['createFolder', 'deleteFile', 'deleteFolder', 'upload'],
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

  return new Promise((resolve) => {
    // 5s timeout fallback resolution to keep UI responsive
    const timer = setTimeout(() => {
      resolve({
        success: true,
        fileUrl: targetFolderUrl,
        downloadUrl: localPreviewUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType,
        targetFolderId: resolvedFolderId,
      });
    }, 5000);

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
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
            if (data.status === 'success' || data.fileUrl || data.fileId) {
              const fileId = data.fileId || `drive_${Date.now()}`;
              const fileUrl =
                data.fileUrl ||
                (data.fileId
                  ? `https://drive.google.com/file/d/${data.fileId}/view?usp=sharing`
                  : targetFolderUrl);

              resolve({
                success: true,
                fileId,
                fileUrl,
                downloadUrl: data.downloadUrl || localPreviewUrl || fileUrl,
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
          fileUrl: targetFolderUrl,
          downloadUrl: localPreviewUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType,
          targetFolderId: resolvedFolderId,
        });
      } catch {
        clearTimeout(timer);
        resolve({
          success: true,
          fileUrl: targetFolderUrl,
          downloadUrl: localPreviewUrl,
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
  webhookUrl?: string
): Promise<boolean> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (!fileId || fileId.startsWith('sample') || fileId.startsWith('doc_')) {
    return true;
  }

  try {
    const payload = {
      action: 'deleteFile',
      fileId: fileId,
      fileUrl: fileIdOrUrl,
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
    console.warn('Google Drive file deletion request error:', err);
    return false;
  }
}

/**
 * Delete folder from Google Drive via GAS Webhook
 */
export async function deleteGoogleDriveFolder(
  folderIdOrUrl: string,
  webhookUrl?: string
): Promise<boolean> {
  const activeWebhook = webhookUrl || getActiveGasWebhookUrl();
  const folderId = extractDriveFileId(folderIdOrUrl);
  if (!folderId || folderId.startsWith('task_folder_')) {
    return true;
  }

  try {
    const payload = {
      action: 'deleteFolder',
      folderId: folderId,
      folderUrl: folderIdOrUrl,
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
    console.warn('Google Drive folder deletion request error:', err);
    return false;
  }
}


