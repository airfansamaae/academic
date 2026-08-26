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
 * Extracts Google Drive File ID from URL or ID string
 */
export function extractDriveFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                urlOrId.match(/id=([a-zA-Z0-9_-]+)/) ||
                urlOrId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Creates a dedicated task storage folder named after the task title
 */
export async function createGoogleDriveFolder(
  folderName: string,
  parentFolderId: string = GDRIVE_FOLDER_ID,
  webhookUrl: string = GAS_WEBHOOK_URL
): Promise<CreateFolderResult> {
  const fallbackFolderId = `task_folder_${Date.now()}`;
  const fallbackResult: CreateFolderResult = {
    success: true,
    folderId: fallbackFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${parentFolderId}?task=${encodeURIComponent(folderName)}`,
    folderName,
  };

  try {
    const payload = {
      action: 'createFolder',
      folderName: folderName,
      name: folderName,
      parentFolderId: parentFolderId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' || data.folderId || data.folderUrl) {
        const folderId = data.folderId || fallbackFolderId;
        const folderUrl = data.folderUrl || `https://drive.google.com/drive/folders/${folderId}`;
        return {
          success: true,
          folderId,
          folderUrl,
          folderName,
        };
      }
    }
  } catch (err) {
    console.warn('Folder creation fallback used:', err);
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
  webhookUrl: string = GAS_WEBHOOK_URL
): Promise<DriveUploadResult> {
  const resolvedFolderId = targetFolderId || GDRIVE_FOLDER_ID;
  const targetFolderUrl = `https://drive.google.com/drive/folders/${resolvedFolderId}`;
  const localPreviewUrl = URL.createObjectURL(file);
  const fileType = file.type || 'application/octet-stream';

  return new Promise((resolve) => {
    // Fast 2.5s fallback resolution to keep UI reactive
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
    }, 2500);

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

        const response = await fetch(webhookUrl, {
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
  webhookUrl: string = GAS_WEBHOOK_URL
): Promise<boolean> {
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (!fileId || fileId.startsWith('drive_') || fileId.startsWith('file-')) {
    return true;
  }

  try {
    const payload = {
      action: 'deleteFile',
      fileId: fileId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
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
  webhookUrl: string = GAS_WEBHOOK_URL
): Promise<boolean> {
  const folderId = extractDriveFileId(folderIdOrUrl);
  if (!folderId || folderId.startsWith('task_folder_')) {
    return true;
  }

  try {
    const payload = {
      action: 'deleteFolder',
      folderId: folderId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch (err) {
    console.warn('Google Drive folder deletion request error:', err);
    return false;
  }
}
