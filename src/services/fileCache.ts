/**
 * Resilient IndexedDB File Cache Service
 * Stores exact original binary blobs of uploaded files (Word, PDF, Excel, Images, etc.)
 * Ensures that downloaded files are 100% the exact original files the user uploaded.
 */

const DB_NAME = 'AcademicSystemFileCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface CachedFileRecord {
  id: string; // fileId, driveFileId, or docId
  name: string; // original filename (e.g. "SAR_2568.docx")
  type: string; // MIME type
  size: number; // File size in bytes
  blob: Blob; // The exact original binary blob
  dataUrl?: string; // Optional base64 data URL
  driveFileId?: string;
  driveUrl?: string;
  category?: string;
  updatedAt: number;
}

class FileCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('driveFileId', 'driveFileId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save a real uploaded File / Blob into IndexedDB
   */
  async saveFile(
    id: string,
    fileOrBlob: File | Blob,
    metadata?: {
      name?: string;
      driveFileId?: string;
      driveUrl?: string;
      category?: string;
    }
  ): Promise<boolean> {
    try {
      const db = await this.getDB();
      const name = metadata?.name || (fileOrBlob instanceof File ? fileOrBlob.name : 'document');
      const type = fileOrBlob.type || 'application/octet-stream';
      const size = fileOrBlob.size;

      const record: CachedFileRecord = {
        id,
        name,
        type,
        size,
        blob: fileOrBlob,
        driveFileId: metadata?.driveFileId,
        driveUrl: metadata?.driveUrl,
        category: metadata?.category,
        updatedAt: Date.now(),
      };

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.warn('Error saving file to IndexedDB:', req.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('Failed to store file in IndexedDB cache:', err);
      return false;
    }
  }

  /**
   * Retrieve exact original Blob by file ID, driveFileId, or file name
   */
  async getFile(
    idOrNameOrDriveId: string
  ): Promise<{ blob: Blob; name: string; type: string; size: number } | null> {
    try {
      const db = await this.getDB();
      const cleanKey = (idOrNameOrDriveId || '').trim();
      if (!cleanKey) return null;

      // 1. Try Direct Primary Key Lookup
      const directRecord = await new Promise<CachedFileRecord | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(cleanKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (directRecord && directRecord.blob) {
        return {
          blob: directRecord.blob,
          name: directRecord.name,
          type: directRecord.type,
          size: directRecord.size,
        };
      }

      // 2. Try Index Lookup by driveFileId
      const driveRecord = await new Promise<CachedFileRecord | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('driveFileId');
        const req = index.get(cleanKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (driveRecord && driveRecord.blob) {
        return {
          blob: driveRecord.blob,
          name: driveRecord.name,
          type: driveRecord.type,
          size: driveRecord.size,
        };
      }

      // 3. Try Index Lookup by file name
      const nameRecord = await new Promise<CachedFileRecord | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('name');
        const req = index.get(cleanKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (nameRecord && nameRecord.blob) {
        return {
          blob: nameRecord.blob,
          name: nameRecord.name,
          type: nameRecord.type,
          size: nameRecord.size,
        };
      }

      // 4. Cursor scan for partial / case-insensitive filename matches
      const allRecords = await new Promise<CachedFileRecord[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const matched = allRecords.find(
        (r) =>
          r.name?.toLowerCase() === cleanKey.toLowerCase() ||
          cleanKey.toLowerCase().includes(r.name?.toLowerCase() || '') ||
          (r.name && cleanKey.toLowerCase().includes(r.name.toLowerCase().replace(/\.[^/.]+$/, '')))
      );

      if (matched && matched.blob) {
        return {
          blob: matched.blob,
          name: matched.name,
          type: matched.type,
          size: matched.size,
        };
      }

      return null;
    } catch (err) {
      console.warn('Error reading from file cache:', err);
      return null;
    }
  }

  /**
   * Delete cached file from IndexedDB
   */
  async deleteFile(id: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
}

export const fileCache = new FileCacheService();
