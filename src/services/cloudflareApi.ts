/**
 * Cloudflare D1 / Worker Real-time Sync API Client
 * Syncs all textual data, tasks, submissions, documents, users, and settings to Cloudflare
 */

import { Task, Submission, DocumentItem, Announcement, User, SystemSettings } from '../types';

export const CLOUDFLARE_WORKER_URL = 'https://academic-api.airfansamaae.workers.dev';

export interface CloudflareSyncPayload {
  users?: User[];
  tasks?: Task[];
  announcements?: Announcement[];
  submissions?: Submission[];
  documents?: DocumentItem[];
  settings?: SystemSettings;
}

export class CloudflareApiService {
  private static workerUrl = CLOUDFLARE_WORKER_URL;

  public static setWorkerUrl(url: string) {
    if (url) {
      this.workerUrl = url.replace(/\/+$/, '');
    }
  }

  public static getWorkerUrl(): string {
    return this.workerUrl;
  }

  /**
   * Fast fetch helper with strict AbortController timeout
   */
  private static async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3500): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Fetch all database records from Cloudflare D1
   */
  public static async fetchAllData(): Promise<CloudflareSyncPayload | null> {
    try {
      // 1. Fetch main all-data payload
      const resAll = await this.fetchWithTimeout(`${this.workerUrl}/api/all-data`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }, 4000).catch(() => null);

      let data: CloudflareSyncPayload = {};
      if (resAll && resAll.ok) {
        try {
          const parsed = await resAll.json();
          if (parsed && typeof parsed === 'object') {
            data = parsed as CloudflareSyncPayload;
          }
        } catch {}
      }

      // 2. Fetch dedicated /api/documents endpoint to ensure all uploaded docs are synced across all browsers
      try {
        const resDocs = await this.fetchWithTimeout(`${this.workerUrl}/api/documents`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }, 3500).catch(() => null);

        if (resDocs && resDocs.ok) {
          const docsData = await resDocs.json();
          let directDocs: DocumentItem[] = [];
          if (Array.isArray(docsData)) {
            directDocs = docsData;
          } else if (docsData && Array.isArray(docsData.documents)) {
            directDocs = docsData.documents;
          } else if (docsData && Array.isArray(docsData.data)) {
            directDocs = docsData.data;
          }

          if (directDocs.length > 0) {
            const existingDocs = Array.isArray(data.documents) ? data.documents : [];
            const docMap = new Map<string, DocumentItem>();
            existingDocs.forEach((d) => {
              if (d && d.id) docMap.set(d.id, d);
            });
            directDocs.forEach((d) => {
              if (d && d.id) {
                const existing = docMap.get(d.id);
                if (!existing || new Date(d.updatedAt || d.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
                  docMap.set(d.id, d);
                }
              }
            });
            data.documents = Array.from(docMap.values());
          }
        }
      } catch {}

      return data;
    } catch (err) {
      // Non-blocking fallback
    }
    return null;
  }

  /**
   * Save / Sync Task to Cloudflare D1
   */
  public static async syncTask(task: Task): Promise<boolean> {
    try {
      const deadline =
        task.startDate && task.startDate !== task.dueDate
          ? `${task.startDate}..${task.dueDate}`
          : task.dueDate || '';

      const response = await this.fetchWithTimeout(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          title: task.title,
          type: task.category || 'งานวิชาการ',
          description: task.description || '',
          deadline,
          startDate: task.startDate || '',
          status: 'ACTIVE',
          assigneeIds: [],
          gDriveFolderId: task.gDriveFolderId || '',
          gDriveFolderUrl: task.gDriveFolderUrl || '',
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        }),
      }, 3500);
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Save / Sync Submission to Cloudflare D1
   */
  public static async syncSubmission(sub: Submission): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.workerUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sub.id,
          taskId: sub.taskId,
          taskTitle: sub.taskTitle || '',
          memberId: sub.memberId,
          memberName: sub.memberName,
          department: sub.memberSchool || '',
          status: sub.status,
          note: sub.description || sub.subject || '',
          score: sub.score !== undefined ? sub.score : null,
          feedback: sub.feedback || '',
          files: Array.isArray(sub.files) ? sub.files : [],
          submittedAt: sub.submittedAt,
          updatedAt: sub.updatedAt,
        }),
      }, 3500);
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Save / Sync Document to Cloudflare D1
   */
  public static async syncDocument(doc: DocumentItem): Promise<boolean> {
    try {
      const safeFileData = doc.fileData && doc.fileData.length < 500000 ? doc.fileData : undefined;
      const docPayload = {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        description: doc.description || '',
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        fileUrl: doc.fileUrl,
        gDriveFolderId: doc.gDriveFolderId,
        gDriveFileId: doc.gDriveFileId,
        fileData: safeFileData,
        uploadedBy: doc.uploadedBy,
        status: 'ACTIVE',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };

      // 1. Direct /api/documents endpoint
      const p1 = this.fetchWithTimeout(`${this.workerUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docPayload),
      }, 4000).catch(() => null);

      // 2. Dual-persistence backup into /api/tasks table with type: 'DOCUMENT_ITEM'
      const metaJson = JSON.stringify({
        category: doc.category,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        fileUrl: doc.fileUrl,
        gDriveFileId: doc.gDriveFileId,
        gDriveFolderId: doc.gDriveFolderId,
        uploadedBy: doc.uploadedBy,
        description: doc.description,
      });

      const p2 = this.fetchWithTimeout(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          title: doc.title,
          type: 'DOCUMENT_ITEM',
          description: metaJson,
          deadline: doc.category || 'SAMPLE_DOC',
          startDate: doc.fileName || '',
          status: 'ACTIVE',
          assigneeIds: [],
          gDriveFolderId: doc.gDriveFolderId || '',
          gDriveFolderUrl: doc.fileUrl || '',
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }),
      }, 4000).catch(() => null);

      await Promise.allSettled([p1, p2]);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete Task from Cloudflare D1
   */
  public static async deleteTask(id: string): Promise<boolean> {
    try {
      // 1. Soft-delete by setting status: 'DELETED' on Cloudflare D1
      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: '[DELETED]',
          type: 'DELETED',
          description: '',
          deadline: '',
          status: 'DELETED',
          assigneeIds: [],
          gDriveFolderId: '',
          gDriveFolderUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }, 3500).catch(() => {});

      // 2. Also send DELETE and delete endpoint
      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 3500).catch(() => {});

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete Document from Cloudflare D1
   */
  public static async deleteDocument(id: string): Promise<boolean> {
    try {
      // 1. Mark document as deleted on Cloudflare D1
      await this.fetchWithTimeout(`${this.workerUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: '[DELETED]',
          category: 'DELETED',
          description: 'DELETED',
          fileName: '',
          fileType: '',
          fileSize: '',
          fileUrl: '',
          uploadedBy: 'admin',
          createdAt: new Date().toISOString(),
        }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/documents/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 3500).catch(() => {});

      // 2. Also soft-delete and remove from /api/tasks dual-backup
      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: '[DELETED]',
          type: 'DELETED',
          description: '',
          deadline: '',
          status: 'DELETED',
          assigneeIds: [],
          gDriveFolderId: '',
          gDriveFolderUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete Submission from Cloudflare D1
   */
  public static async deleteSubmission(id: string, taskId = ''): Promise<boolean> {
    try {
      // 1. Soft-delete submission on Cloudflare D1
      await this.fetchWithTimeout(`${this.workerUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          taskId: taskId,
          taskTitle: '',
          memberId: '',
          memberName: '',
          department: '',
          status: 'DELETED',
          note: '',
          score: 0,
          feedback: '',
          files: [],
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/submissions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/submissions/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 3500).catch(() => {});

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete Announcement from Cloudflare D1
   */
  public static async deleteAnnouncement(id: string): Promise<boolean> {
    try {
      // 1. Soft-delete in tasks table
      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: '[DELETED]',
          type: 'DELETED',
          description: '',
          deadline: '',
          status: 'DELETED',
          assigneeIds: [],
          gDriveFolderId: '',
          gDriveFolderUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/announcements/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 3500).catch(() => {});

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Save / Sync Announcement to Cloudflare D1
   */
  public static async syncAnnouncement(ann: Announcement): Promise<boolean> {
    try {
      const deadline =
        ann.endDate && ann.endDate !== ann.date
          ? `${ann.date}..${ann.endDate}`
          : ann.date || '';

      // Store in tasks table with type 'ANNOUNCEMENT' for full persistence
      const response = await this.fetchWithTimeout(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ann.id,
          title: ann.title,
          type: 'ANNOUNCEMENT',
          description: ann.details || '',
          deadline,
          startDate: ann.date || '',
          endDate: ann.endDate || '',
          status: 'ACTIVE',
          assigneeIds: [],
          gDriveFolderId: ann.type || 'ACTIVITY',
          gDriveFolderUrl: ann.createdBy || 'ผู้ดูแลระบบวิชาการ',
          createdAt: ann.createdAt,
          updatedAt: ann.updatedAt,
        }),
      }, 3500);

      // Also attempt dedicated /api/announcements endpoint
      this.fetchWithTimeout(`${this.workerUrl}/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann),
      }, 3500).catch(() => {});

      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete User from Cloudflare D1
   */
  public static async deleteUser(id: string, username = ''): Promise<boolean> {
    try {
      // 1. Soft-delete user on Cloudflare D1
      await this.fetchWithTimeout(`${this.workerUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          username: username || id,
          fullName: '[DELETED]',
          department: '',
          role: 'MEMBER',
          status: 'DELETED',
          password: '',
          passwordHash: '',
          avatarUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _deleted: true }),
      }, 3500).catch(() => {});

      await this.fetchWithTimeout(`${this.workerUrl}/api/users/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 3500).catch(() => {});

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Save / Sync User to Cloudflare D1
   */
  public static async syncUser(user: User): Promise<boolean> {
    try {
      const username = user.username || user.fullName || user.id;
      const password = user.password || '123456';
      const school = user.school || 'โรงเรียนวิชาการวิทยาคาร';
      const encodedDepartment = `${school}@@@${username}@@@${password}`;
      const avatarUrl = user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

      const response = await this.fetchWithTimeout(`${this.workerUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id || `user-${username}`,
          username: username,
          fullName: user.fullName,
          department: encodedDepartment,
          role: user.role,
          status: user.status,
          password: password,
          passwordHash: password,
          avatarUrl: avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      }, 3500);
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Save / Sync System Settings to Cloudflare D1
   */
  public static async syncSettings(settings: SystemSettings): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.workerUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }, 3500);
      return response.ok;
    } catch (err) {
      return false;
    }
  }
}
