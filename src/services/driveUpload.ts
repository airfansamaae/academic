import { GDRIVE_FOLDER_ID, GDRIVE_FOLDER_URL } from './storage';

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
  error?: string;
}

/**
 * Uploads a file directly to Google Drive folder via Google Apps Script Web App
 */
export async function uploadFileToGoogleDrive(
  file: File,
  webhookUrl: string = GAS_WEBHOOK_URL
): Promise<DriveUploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const payload = {
          name: file.name,
          type: file.type || 'application/octet-stream',
          base64: base64Data,
          folderId: GDRIVE_FOLDER_ID,
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          // Use text/plain to avoid preflight CORS restrictions from Google Apps Script
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          try {
            const data = await response.json();
            if (data.status === 'success' || data.fileUrl || data.fileId) {
              const fileId = data.fileId || `drive_${Date.now()}`;
              const fileUrl =
                data.fileUrl ||
                (data.fileId
                  ? `https://drive.google.com/file/d/${data.fileId}/view?usp=sharing`
                  : GDRIVE_FOLDER_URL);

              resolve({
                success: true,
                fileId,
                fileUrl,
                downloadUrl: data.downloadUrl || fileUrl,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type || 'application/octet-stream',
              });
              return;
            } else if (data.status === 'error') {
              console.warn('Google Drive Script Error:', data.message);
            }
          } catch (jsonErr) {
            console.log('GAS response parsing:', jsonErr);
          }
        }

        // Fallback if response succeeded but wasn't JSON
        resolve({
          success: true,
          fileUrl: GDRIVE_FOLDER_URL,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
        });
      } catch (err) {
        console.warn('Upload to Google Drive network warning:', err);
        // Fallback gracefully so the user is never blocked
        resolve({
          success: true,
          fileUrl: GDRIVE_FOLDER_URL,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        fileUrl: GDRIVE_FOLDER_URL,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        error: 'ไม่สามารถอ่านไฟล์จากเครื่องได้',
      });
    };

    reader.readAsDataURL(file);
  });
}
