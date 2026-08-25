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
   * Fetch all database records from Cloudflare D1
   */
  public static async fetchAllData(): Promise<CloudflareSyncPayload | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${this.workerUrl}/api/all-data`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data as CloudflareSyncPayload;
      }
    } catch (err) {
      console.warn('Cloudflare fetchAllData notice (using local/fallback):', err);
    }
    return null;
  }

  /**
   * Save / Sync Task to Cloudflare D1
   */
  public static async syncTask(task: Task): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          title: task.title,
          type: task.category || 'งานวิชาการ',
          description: task.description || '',
          deadline: task.dueDate || '',
          status: 'ACTIVE',
          assigneeIds: [],
          gDriveFolderId: task.gDriveFolderId || '',
          gDriveFolderUrl: task.gDriveFolderUrl || '',
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('Cloudflare syncTask warning:', err);
      return false;
    }
  }

  /**
   * Save / Sync Submission to Cloudflare D1
   */
  public static async syncSubmission(sub: Submission): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/api/submissions`, {
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
      });
      return response.ok;
    } catch (err) {
      console.warn('Cloudflare syncSubmission warning:', err);
      return false;
    }
  }

  /**
   * Save / Sync Document to Cloudflare D1
   */
  public static async syncDocument(doc: DocumentItem): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          title: doc.title,
          category: doc.category,
          description: doc.description || '',
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          fileUrl: doc.fileUrl,
          uploadedBy: doc.uploadedBy,
          createdAt: doc.createdAt,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('Cloudflare syncDocument warning:', err);
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
      // Encode username and password cleanly inside department separator so worker database without username/password column preserves all credentials
      const encodedDepartment = `${school}@@@${username}@@@${password}`;
      const avatarUrl = user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

      const response = await fetch(`${this.workerUrl}/api/users`, {
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
      });
      return response.ok;
    } catch (err) {
      console.warn('Cloudflare syncUser warning:', err);
      return false;
    }
  }

  /**
   * Save / Sync System Settings to Cloudflare D1
   */
  public static async syncSettings(settings: SystemSettings): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return response.ok;
    } catch (err) {
      console.warn('Cloudflare syncSettings warning:', err);
      return false;
    }
  }
}
