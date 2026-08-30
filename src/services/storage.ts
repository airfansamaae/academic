import {
  User,
  UserRole,
  UserStatus,
  Task,
  Announcement,
  AnnouncementType,
  Submission,
  DocumentItem,
  SystemSettings,
  SubmissionFile,
} from '../types';
import { CloudflareApiService, CLOUDFLARE_WORKER_URL } from './cloudflareApi';
import {
  deleteGoogleDriveFile,
  deleteGoogleDriveFolder,
  isProtectedRootFolder,
  restoreProtectedGoogleDriveRootFolders,
  extractDriveFileId,
  GDRIVE_FOLDER_ID,
  GDRIVE_FOLDER_URL,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
  GAS_WEBHOOK_URL,
} from './driveUpload';

export {
  GDRIVE_FOLDER_ID,
  GDRIVE_FOLDER_URL,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
  GAS_WEBHOOK_URL,
};
export const CLOUDFLARE_DB_ID = 'databases/9bf82f5b-b9f5-4138-ac36-27dcd09c50e0/metrics';

const STORAGE_KEYS = {
  USERS: 'academic_app_users_v2',
  TASKS: 'academic_app_tasks_v2',
  ANNOUNCEMENTS: 'academic_app_announcements_v2',
  SUBMISSIONS: 'academic_app_submissions_v2',
  DOCUMENTS: 'academic_app_documents_v2',
  SETTINGS: 'academic_app_settings_v2',
  CURRENT_USER: 'academic_app_current_user_v2',
  REMEMBERED_ID: 'academic_app_remembered_id_v2',
  DELETED_TASKS: 'academic_app_deleted_tasks_v2',
  DELETED_DOCUMENTS: 'academic_app_deleted_docs_v2',
  DELETED_SUBMISSIONS: 'academic_app_deleted_subs_v2',
  DELETED_ANNOUNCEMENTS: 'academic_app_deleted_anns_v2',
  DELETED_USERS: 'academic_app_deleted_users_v2',
};

const getNowISO = () => new Date().toISOString();

// Real-time broadcast channel for ultra-low latency (<10ms) sync across Chrome tabs/windows
const SYNC_CHANNEL_NAME = 'academic_system_realtime_channel';
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      try {
        window.dispatchEvent(new CustomEvent('academic-realtime-sync', { detail: event.data }));
      } catch {}
    };
  } catch (e) {
    console.warn('BroadcastChannel not supported in this environment', e);
  }
}

export function broadcastLocalChange(type: string, data?: any) {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type, data, timestamp: Date.now() });
    }
    window.dispatchEvent(new CustomEvent('academic-realtime-sync', { detail: { type, data } }));
  } catch {}
}

// Helper to get formatted dates relative to today
const getRelativeDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

// Initial Seed Data
const INITIAL_USERS: User[] = [
  {
    id: 'user-admin-01',
    username: 'Admin',
    password: '456789',
    fullName: 'ผู้ดูแลระบบวิชาการ (Master Admin)',
    school: 'โรงเรียนวิชาการวิทยาคาร',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'user-mem-01',
    username: 'teacher_somchai',
    password: 'password123',
    fullName: 'ครูสมชาย ใจดี',
    school: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    createdAt: '2026-08-05T09:00:00.000Z',
    updatedAt: '2026-08-05T09:00:00.000Z',
  },
  {
    id: 'user-mem-02',
    username: 'teacher_siriporn',
    password: 'password123',
    fullName: 'ครูศิริพร บุญรักษา',
    school: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    createdAt: '2026-08-06T10:30:00.000Z',
    updatedAt: '2026-08-06T10:30:00.000Z',
  },
  {
    id: 'user-mem-03',
    username: 'teacher_nattapong',
    password: 'password123',
    fullName: 'ครูณัฐพงษ์ วิทยากร',
    school: 'กลุ่มสาระการเรียนรู้ภาษาไทย',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    createdAt: '2026-08-10T14:15:00.000Z',
    updatedAt: '2026-08-10T14:15:00.000Z',
  },
  {
    id: 'user-pending-01',
    username: 'teacher_kamonwan',
    password: 'password123',
    fullName: 'ครูกมลวรรณ รัตนศิลป์ (รออนุมัติ)',
    school: 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'PENDING',
    createdAt: '2026-08-21T11:00:00.000Z',
    updatedAt: '2026-08-21T11:00:00.000Z',
  },
];

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-01',
    title: 'ส่งแผนการจัดการเรียนรู้ ประจำภาคเรียนที่ 1/2569 (ทุกกลุ่มสาระ)',
    description: 'ให้คุณครูทุกท่านจัดทำแผนการสอนพร้อมหน่วยการเรียนรู้ และโครงสร้างรายวิชา อัปโหลดไฟล์ PDF หรือ Word ที่จัดทำเสร็จสมบูรณ์ลงในระบบ',
    category: 'งานวิชาการและแผนการสอน',
    dueDate: getRelativeDate(0), // Today
    assignedBy: 'ผู้ดูแลระบบวิชาการ',
    gDriveFolderId: GDRIVE_FOLDER_ID,
    createdAt: '2026-08-15T08:30:00.000Z',
    updatedAt: '2026-08-15T08:30:00.000Z',
  },
  {
    id: 'task-02',
    title: 'ส่งบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5) กลางภาค',
    description: 'บันทึกคะแนนเก็บระหว่างภาคและเวลาเรียนของนักเรียน ตรวจสอบความถูกต้องก่อนส่งเพื่อรวบรวมส่งฝ่ายวิชาการ',
    category: 'งานวัดและประเมินผล',
    dueDate: getRelativeDate(3), // In 3 days
    assignedBy: 'ผู้ดูแลระบบวิชาการ',
    gDriveFolderId: GDRIVE_FOLDER_ID,
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-18T09:00:00.000Z',
  },
  {
    id: 'task-03',
    title: 'รายงานผลการดำเนินโครงการตามแผนปฏิบัติการประจำปี (งบประมาณงวดที่ 1)',
    description: 'สรุปการใช้งบประมาณ ภาพกิจกรรม และแบบประเมินความพึงพอใจของผู้เข้าร่วมโครงการ',
    category: 'งานแผนงานและโครงการ',
    dueDate: getRelativeDate(-4), // 4 days ago (Overdue)
    assignedBy: 'ผู้ดูแลระบบวิชาการ',
    gDriveFolderId: GDRIVE_FOLDER_ID,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'task-04',
    title: 'ส่งรายงานวิจัยในชั้นเรียน (Classroom Action Research)',
    description: 'เอกสารวิจัยในชั้นเรียน 5 บท เพื่อแก้ปัญหาหรือพัฒนาการเรียนรู้ของผู้เรียนประจำปีการศึกษา',
    category: 'งานวิจัยและพัฒนานวัตกรรม',
    dueDate: getRelativeDate(7),
    assignedBy: 'ผู้ดูแลระบบวิชาการ',
    gDriveFolderId: GDRIVE_FOLDER_ID,
    createdAt: '2026-08-19T13:00:00.000Z',
    updatedAt: '2026-08-19T13:00:00.000Z',
  },
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-01',
    taskId: 'task-01',
    taskTitle: 'ส่งแผนการจัดการเรียนรู้ ประจำภาคเรียนที่ 1/2569 (ทุกกลุ่มสาระ)',
    memberId: 'user-mem-01',
    memberName: 'ครูสมชาย ใจดี',
    memberSchool: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    memberAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    subject: 'แผนการจัดการเรียนรู้วิชาวิทยาการคำนวณ ม.4-6 ครบ 8 หน่วย',
    description: 'แนบไฟล์แผนการสอนพร้อมเครื่องมือวัดผลและตารางวิเคราะห์หลักสูตรตามตัวชี้วัดเรียบร้อยครับ',
    files: [
      {
        id: 'file-01',
        name: 'Lesson_Plan_Computing_2569.pdf',
        size: 3420000,
        type: 'application/pdf',
        gDriveUrl: `https://drive.google.com/file/d/sample1/view?usp=sharing`,
        uploadedAt: '2026-08-21T14:20:00.000Z',
      },
      {
        id: 'file-02',
        name: 'Curriculum_Matrix_Unit1_8.docx',
        size: 1250000,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        gDriveUrl: `https://drive.google.com/file/d/sample2/view?usp=sharing`,
        uploadedAt: '2026-08-21T14:22:00.000Z',
      },
    ],
    status: 'REVIEWED',
    submittedAt: '2026-08-21T14:25:00.000Z',
    updatedAt: '2026-08-22T08:00:00.000Z',
    feedback: 'แผนการสอนจัดทำได้ละเอียด ตรงตามมาตรฐานและตัวชี้วัดยอดเยี่ยมมากครับ มีการบูรณาการ STEM ชัดเจน 🌟',
    feedbackEmoji: '🌟 ยอดเยี่ยมมาก',
    score: 100,
    checkedBy: 'ผู้ดูแลระบบวิชาการ',
  },
  {
    id: 'sub-02',
    taskId: 'task-01',
    taskTitle: 'ส่งแผนการจัดการเรียนรู้ ประจำภาคเรียนที่ 1/2569 (ทุกกลุ่มสาระ)',
    memberId: 'user-mem-02',
    memberName: 'ครูศิริพร บุญรักษา',
    memberSchool: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    memberAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    subject: 'แผนการจัดการเรียนรู้รายวิชาคณิตศาสตร์พื้นฐาน ม.3',
    description: 'ส่งแผนการจัดการเรียนรู้จำนวน 4 หน่วยการเรียนรู้แรก พร้อมใบงานและเฉลยค่ะ',
    files: [
      {
        id: 'file-03',
        name: 'Math_Lesson_Plan_M3_2569.pdf',
        size: 4850000,
        type: 'application/pdf',
        gDriveUrl: `https://drive.google.com/file/d/sample3/view?usp=sharing`,
        uploadedAt: '2026-08-22T09:15:00.000Z',
      },
    ],
    status: 'SUBMITTED',
    submittedAt: '2026-08-22T09:20:00.000Z',
    updatedAt: '2026-08-22T09:20:00.000Z',
  },
];

const INITIAL_DOCUMENTS: DocumentItem[] = [];

const INITIAL_SETTINGS: SystemSettings = {
  schoolName: 'สำนักงานเขตพื้นที่การศึกษา / สถานศึกษาต้นแบบวิชาการ',
  schoolLogoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=150&auto=format&fit=crop&q=80',
  footerText: 'ระบบบริหารจัดการงานวิชาการ มอบหมายงานและส่งงาน © 2026 สงวนลิขสิทธิ์ทุกประการ',
  gDriveFolderId: GDRIVE_FOLDER_ID,
  gasWebhookUrl: GAS_WEBHOOK_URL,
  cloudflareDbId: CLOUDFLARE_DB_ID,
  updatedAt: '2026-08-22T08:00:00.000Z',
};

export class StorageService {
  // --- USERS ---
  static getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    let userList: User[] = [];
    if (!raw) {
      userList = [...INITIAL_USERS];
    } else {
      try {
        userList = JSON.parse(raw);
      } catch {
        userList = [...INITIAL_USERS];
      }
    }

    // Ensure Master Admin always exists with valid credentials & ADMIN role
    const adminIndex = userList.findIndex((u) => u.username.toLowerCase() === 'admin' || u.role === 'ADMIN');
    if (adminIndex === -1) {
      userList.unshift({ ...INITIAL_USERS[0] });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(userList));
    } else {
      // Ensure admin has valid Admin role, Active status, and fallback password
      userList[adminIndex].role = 'ADMIN';
      userList[adminIndex].status = 'ACTIVE';
      if (!userList[adminIndex].password) {
        userList[adminIndex].password = '456789';
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(userList));
    }

    return userList;
  }

  static saveUsers(users: User[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Storage quota or save error for users:', e);
    }
  }

  static getCurrentUser(): User | null {
    // Session-based user persistence (auto-logout on new page session/link open)
    const sessionRaw = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (sessionRaw) {
      try {
        return JSON.parse(sessionRaw);
      } catch {
        // invalid session json
      }
    }
    return null;
  }

  static setCurrentUser(user: User | null): void {
    try {
      if (user) {
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      // Broadcast auth change event to ensure all views immediately re-render
      window.dispatchEvent(new CustomEvent('academic-auth-change', { detail: user }));
    } catch (e) {
      console.error('Storage error for currentUser:', e);
    }
  }

  static getRememberedId(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.REMEMBERED_ID) || 'admin';
    } catch {
      return 'admin';
    }
  }

  static setRememberedId(id: string | null): void {
    try {
      if (id && id.trim()) {
        localStorage.setItem(STORAGE_KEYS.REMEMBERED_ID, id.trim());
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBERED_ID);
      }
    } catch (e) {
      console.error('Storage error for rememberedId:', e);
    }
  }

  static async registerUser(userData: {
    fullName: string;
    username: string;
    password?: string;
    school?: string;
  }): Promise<{ success: boolean; message: string; user?: User }> {
    const users = this.getUsers();
    const cleanUsername = userData.username.trim();
    const existing = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUsername.toLowerCase() ||
        u.id.toLowerCase() === `user-${cleanUsername.toLowerCase()}`
    );
    if (existing) {
      return { success: false, message: 'ชื่อผู้ใช้นี้ (User ID) มีในระบบแล้ว กรุณาใช้ชื่ออื่น' };
    }

    const newUser: User = {
      id: `user-${cleanUsername}`,
      username: cleanUsername,
      password: userData.password || '123456',
      fullName: userData.fullName.trim(),
      school: userData.school || 'โรงเรียนวิชาการวิทยาคาร',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`,
      role: 'MEMBER',
      status: 'PENDING', // Pending approval by Admin
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };

    this.removeDeletedUserId(newUser.id);
    this.removeDeletedUserId(cleanUsername);

    users.push(newUser);
    this.saveUsers(users);
    broadcastLocalChange('USER_REGISTERED', newUser);

    // Non-blocking real-time Cloudflare Sync in background
    CloudflareApiService.syncUser(newUser).catch(() => {});

    return {
      success: true,
      message: 'ลงทะเบียนสำเร็จ! กรุณารอผู้ดูแลระบบ (Admin) อนุมัติการเข้าใช้งาน',
      user: newUser,
    };
  }

  static async login(
    username: string,
    password?: string
  ): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const cleanUser = (username || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      let users = this.getUsers();

      // 1. Master Admin Login (Instant - no blocking network wait needed)
      if (cleanUser === 'admin' || cleanUser === 'administrator') {
        let masterAdmin = users.find((u) => u.username.toLowerCase() === 'admin' || u.role === 'ADMIN');
        const isValidPass = cleanPass === '456789' || (masterAdmin && masterAdmin.password === cleanPass);

        if (isValidPass) {
          if (!masterAdmin) {
            masterAdmin = { ...INITIAL_USERS[0] };
            users.unshift(masterAdmin);
          }
          masterAdmin.role = 'ADMIN';
          masterAdmin.status = 'ACTIVE';
          masterAdmin.password = cleanPass || '456789';
          this.saveUsers(users);
          this.setCurrentUser(masterAdmin);
          // Trigger background sync non-blockingly
          this.syncWithCloudflare().catch(() => {});
          return { success: true, message: 'ยินดีต้อนรับเข้าสู่ระบบในฐานะ Master Admin', user: masterAdmin };
        } else {
          return { success: false, message: 'รหัสผ่านสำหรับ Admin ไม่ถูกต้อง (ค่าเริ่มต้น 456789)' };
        }
      }

      // 2. Normal Member Login
      const findMatchingUser = (list: User[]) =>
        list.find(
          (u) =>
            u.username.toLowerCase() === cleanUser ||
            u.id.toLowerCase() === cleanUser ||
            u.id.toLowerCase() === `user-${cleanUser}` ||
            u.username.toLowerCase() === cleanUser.replace(/^user-/, '') ||
            u.fullName.toLowerCase() === cleanUser
        );

      let user = findMatchingUser(users);

      // If not found in local cache, do a fast background sync or on-demand fetch
      if (!user) {
        try {
          await this.syncWithCloudflare();
          users = this.getUsers();
          user = findMatchingUser(users);
        } catch {}
      }

      if (!user) {
        return { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ กรุณาตรวจสอบ User ID หรือลงทะเบียนใหม่' };
      }

      if (user.status === 'PENDING') {
        return {
          success: false,
          message: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) อนุมัติ โปรดติดต่อเจ้าหน้าที่วิชาการให้กดอนุมัติ',
        };
      }

      const isPasswordValid =
        !cleanPass ||
        !user.password ||
        user.password === cleanPass ||
        (user.password === '123456' && cleanPass === '123456');

      if (!isPasswordValid) {
        return { success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' };
      }

      this.setCurrentUser(user);
      // Trigger non-blocking sync in background
      this.syncWithCloudflare().catch(() => {});
      return { success: true, message: `ยินดีต้อนรับคุณ ${user.fullName}`, user };
    } catch (e) {
      console.error('Login error:', e);
      if ((username || '').trim().toLowerCase() === 'admin' && (password || '').trim() === '456789') {
        const adminUser = { ...INITIAL_USERS[0] };
        this.setCurrentUser(adminUser);
        return { success: true, message: 'ยินดีต้อนรับเข้าสู่ระบบในฐานะ Master Admin', user: adminUser };
      }
      return { success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' };
    }
  }

  static async approveUser(userId: string): Promise<void> {
    // 1. Remove from deleted tombstones if previously present
    this.removeDeletedUserId(userId);

    let targetUser: User | null = null;
    const users = this.getUsers().map((u) => {
      if (u.id === userId || u.username.toLowerCase() === userId.toLowerCase()) {
        targetUser = { ...u, status: 'ACTIVE' as const, updatedAt: getNowISO() };
        return targetUser;
      }
      return u;
    });
    // Immediately save locally for zero-latency UI update
    this.saveUsers(users);
    broadcastLocalChange('USER_APPROVED', targetUser);

    if (targetUser) {
      // Sync to cloud in background without blocking UI
      CloudflareApiService.syncUser(targetUser).catch(() => {});
    }
  }

  static async deleteUser(userId: string): Promise<void> {
    // 1. Mark as permanently deleted tombstone
    this.addDeletedUserId(userId);

    // 2. Remove user from local storage immediately
    const users = this.getUsers().filter(
      (u) => u.id !== userId && u.username.toLowerCase() !== userId.toLowerCase()
    );
    this.saveUsers(users);

    // 3. Request deletion on Cloudflare in background
    CloudflareApiService.deleteUser(userId).catch(() => {});

    // 4. Broadcast deletion to all local tabs
    broadcastLocalChange('USER_DELETED', { id: userId });
  }

  static async updateUser(updatedUser: User): Promise<void> {
    try {
      const users = this.getUsers().map((u) =>
        u.id === updatedUser.id || u.username.toLowerCase() === updatedUser.username.toLowerCase()
          ? { ...updatedUser, updatedAt: getNowISO() }
          : u
      );
      this.saveUsers(users);
      broadcastLocalChange('USER_UPDATED', updatedUser);

      const currentUser = this.getCurrentUser();
      if (
        currentUser &&
        (currentUser.id === updatedUser.id ||
          currentUser.username.toLowerCase() === updatedUser.username.toLowerCase())
      ) {
        this.setCurrentUser({ ...updatedUser, updatedAt: getNowISO() });
      }

      // Sync to cloud in background non-blockingly
      CloudflareApiService.syncUser(updatedUser).catch(() => {});
    } catch (e) {
      console.error('Storage quota or save error for updateUser:', e);
    }
  }

  // --- TASKS ---
  static getTasks(): Task[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    let tasks: Task[] = [];
    if (raw !== null) {
      try {
        tasks = JSON.parse(raw);
        if (!Array.isArray(tasks)) tasks = [];
      } catch {
        tasks = [];
      }
    }
    const deletedTaskIds = this.getDeletedTaskIds();
    return tasks.filter((t) => t && t.id && !deletedTaskIds.has(t.id));
  }

  static saveTasks(tasks: Task[]): void {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  static createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'gDriveFolderId'> & { gDriveFolderId?: string; gDriveFolderUrl?: string }): Task {
    const tasks = this.getTasks();
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}`,
      gDriveFolderId: task.gDriveFolderId,
      gDriveFolderUrl: task.gDriveFolderUrl,
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };
    // Ensure not in deleted tombstones
    this.removeDeletedTaskId(newTask.id);

    tasks.unshift(newTask);
    this.saveTasks(tasks);
    // Real-time Cloudflare Sync & Broadcast
    CloudflareApiService.syncTask(newTask);
    broadcastLocalChange('TASK_CREATED', newTask);
    return newTask;
  }

  static updateTask(task: Task): void {
    const updatedTask = { ...task, updatedAt: getNowISO() };
    const tasks = this.getTasks().map((t) =>
      t.id === task.id ? updatedTask : t
    );
    this.saveTasks(tasks);
    // Real-time Cloudflare Sync & Broadcast
    CloudflareApiService.syncTask(updatedTask);
    broadcastLocalChange('TASK_UPDATED', updatedTask);
  }

  // --- DELETION TOMBSTONES ---
  static getDeletedTaskIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_TASKS);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  static addDeletedTaskId(id: string): void {
    try {
      const set = this.getDeletedTaskIds();
      set.add(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_TASKS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static removeDeletedTaskId(id: string): void {
    try {
      const set = this.getDeletedTaskIds();
      set.delete(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_TASKS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static getDeletedDocIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_DOCUMENTS);
      const set: Set<string> = new Set(raw ? JSON.parse(raw) : []);
      // Permanently blacklist legacy mock/sample document IDs only
      set.add('doc-01');
      set.add('doc-02');
      set.add('doc-03');
      set.add('doc-04');
      set.add('sample_template');
      set.add('sample_research');
      set.add('sample_order_124');
      set.add('sample_order_135');
      return set;
    } catch {
      return new Set(['doc-01', 'doc-02', 'doc-03', 'doc-04', 'sample_template', 'sample_research', 'sample_order_124', 'sample_order_135']);
    }
  }

  static isMockSampleDoc(doc: any): boolean {
    if (!doc || !doc.id) return true;
    const id = String(doc.id).toLowerCase();
    const title = String(doc.title || '').toLowerCase();
    const fileName = String(doc.fileName || '').toLowerCase();
    const desc = String(doc.description || '').toLowerCase();
    const fileUrl = String(doc.fileUrl || '').toLowerCase();

    // STRICT: Filter out mock/unwanted documents requested for removal
    if (
      title.includes('แบบฟอร์มเยี่ยมบ้าน') ||
      title.includes('เยี่ยมบ้าน') ||
      fileName.includes('แบบฟอร์มเยี่ยมบ้าน') ||
      fileName.includes('เยี่ยมบ้าน') ||
      desc.includes('แบบฟอร์มเยี่ยมบ้าน') ||
      desc.includes('เยี่ยมบ้าน') ||
      title.includes('ตารางเวร ทำความสะอาด') ||
      title.includes('ตารางเวร') ||
      title.includes('ทำความสะอาด') ||
      fileName.includes('ตารางเวร') ||
      fileName.includes('ทำความสะอาด') ||
      desc.includes('ตารางเวร') ||
      desc.includes('ทำความสะอาด')
    ) {
      return true;
    }

    // STRICT: Match exact mock/sample IDs or sample URLs
    if (
      id === 'doc-01' ||
      id === 'doc-02' ||
      id === 'doc-03' ||
      id === 'doc-04' ||
      id === 'sample_template' ||
      id === 'sample_research' ||
      id === 'sample_order_124' ||
      id === 'sample_order_135' ||
      fileUrl.includes('sample_template') ||
      fileUrl.includes('sample_research') ||
      fileUrl.includes('sample_order_124') ||
      fileUrl.includes('sample_order_135')
    ) {
      return true;
    }
    return false;
  }

  static addDeletedDocId(id: string): void {
    try {
      const set = this.getDeletedDocIds();
      set.add(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_DOCUMENTS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static removeDeletedDocId(id: string): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_DOCUMENTS);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter((x: string) => x !== id);
        localStorage.setItem(STORAGE_KEYS.DELETED_DOCUMENTS, JSON.stringify(filtered));
      }
    } catch {}
  }

  static getDeletedSubIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_SUBMISSIONS);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  static addDeletedSubId(id: string): void {
    try {
      const set = this.getDeletedSubIds();
      set.add(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_SUBMISSIONS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static getDeletedAnnIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ANNOUNCEMENTS);
      const set: Set<string> = new Set(raw ? JSON.parse(raw) : []);
      // Permanently blacklist legacy sample announcement IDs
      set.add('ann-01');
      set.add('ann-02');
      return set;
    } catch {
      return new Set(['ann-01', 'ann-02']);
    }
  }

  static addDeletedAnnId(id: string): void {
    try {
      const set = this.getDeletedAnnIds();
      set.add(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_ANNOUNCEMENTS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static getDeletedUserIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USERS);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  static addDeletedUserId(id: string): void {
    try {
      const set = this.getDeletedUserIds();
      set.add(id);
      set.add(id.toLowerCase());
      if (id.startsWith('user-')) {
        set.add(id.substring(5).toLowerCase());
      }
      localStorage.setItem(STORAGE_KEYS.DELETED_USERS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static removeDeletedUserId(id: string): void {
    try {
      const set = this.getDeletedUserIds();
      set.delete(id);
      set.delete(id.toLowerCase());
      if (id.startsWith('user-')) {
        set.delete(id.substring(5).toLowerCase());
      }
      localStorage.setItem(STORAGE_KEYS.DELETED_USERS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static deleteTask(taskId: string): void {
    // 1. Get task and associated submissions BEFORE marking as deleted
    const currentTasks = this.getTasks();
    const taskToDelete = currentTasks.find((t) => t.id === taskId);
    const allSubs = this.getSubmissions();
    const deletedSubs = allSubs.filter((s) => s.taskId === taskId);

    // 2. Mark task and its submissions as permanently deleted tombstones
    this.addDeletedTaskId(taskId);
    deletedSubs.forEach((s) => this.addDeletedSubId(s.id));

    // 3. Remove task from local storage
    const tasks = currentTasks.filter((t) => t.id !== taskId);
    this.saveTasks(tasks);

    // 4. Remove all submissions associated with this task
    const subsToKeep = allSubs.filter((s) => s.taskId !== taskId);
    this.saveSubmissions(subsToKeep);

    // 5. Request deletion on Cloudflare D1
    CloudflareApiService.deleteTask(taskId).catch(() => {});
    deletedSubs.forEach((s) => CloudflareApiService.deleteSubmission(s.id).catch(() => {}));

    // 6. Automatic Google Drive File Deletion: ONLY delete submission files (NEVER delete folders)
    deletedSubs.forEach((sub) => {
      if (Array.isArray(sub.files)) {
        sub.files.forEach((f) => {
          deleteGoogleDriveFile(f.gDriveFileId || f.gDriveUrl || f.id, f.name, taskToDelete?.gDriveFolderId).catch(() => {});
        });
      }
    });

    // 7. Broadcast deletion to all local tabs & devices
    broadcastLocalChange('TASK_DELETED', { id: taskId, deletedSubmissions: deletedSubs.map((s) => s.id) });
  }

  static deleteAllTasks(): void {
    // 1. Get all tasks and submissions BEFORE marking as deleted
    const currentTasks = this.getTasks();
    const allSubs = this.getSubmissions();

    // 2. Mark all current tasks and submissions as deleted tombstones
    currentTasks.forEach((t) => this.addDeletedTaskId(t.id));
    allSubs.forEach((s) => this.addDeletedSubId(s.id));

    // 3. Save empty lists
    this.saveTasks([]);
    this.saveSubmissions([]);

    // 4. Request deletion on Cloudflare D1 for all tasks and subs
    currentTasks.forEach((t) => CloudflareApiService.deleteTask(t.id).catch(() => {}));
    allSubs.forEach((s) => CloudflareApiService.deleteSubmission(s.id).catch(() => {}));

    // 5. Automatic Google Drive File Deletion for submission files (Strictly preserve all folders)
    allSubs.forEach((sub) => {
      if (Array.isArray(sub.files)) {
        const relatedTask = currentTasks.find((t) => t.id === sub.taskId);
        sub.files.forEach((f) => {
          deleteGoogleDriveFile(f.gDriveFileId || f.gDriveUrl || f.id, f.name, relatedTask?.gDriveFolderId).catch(() => {});
        });
      }
    });

    // 6. Broadcast deletion to all tabs
    broadcastLocalChange('ALL_TASKS_DELETED', { count: currentTasks.length });
  }

  // --- ANNOUNCEMENTS ---
  static getAnnouncements(): Announcement[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    let anns: Announcement[] = [];
    if (raw !== null) {
      try {
        anns = JSON.parse(raw);
        if (!Array.isArray(anns)) anns = [];
      } catch {
        anns = [];
      }
    }
    const deletedAnnIds = this.getDeletedAnnIds();
    return anns.filter(
      (a) =>
        a &&
        a.id &&
        !deletedAnnIds.has(a.id) &&
        a.id !== 'ann-01' &&
        a.id !== 'ann-02' &&
        !a.title?.includes('ประกาศวันหยุดราชการพิเศษ') &&
        !a.title?.includes('ประชุมวิชาการสัญจร')
    );
  }

  static saveAnnouncements(announcements: Announcement[]): void {
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
  }

  static createAnnouncement(
    ann: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>
  ): Announcement {
    const list = this.getAnnouncements();
    const newAnn: Announcement = {
      ...ann,
      id: `ann-${Date.now()}`,
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };
    list.unshift(newAnn);
    this.saveAnnouncements(list);
    broadcastLocalChange('ANNOUNCEMENT_CREATED', newAnn);

    // Synchronize to Cloudflare D1 non-blockingly so all members immediately see the announcement
    CloudflareApiService.syncAnnouncement(newAnn).catch(() => {});

    return newAnn;
  }

  static updateAnnouncement(ann: Announcement): void {
    const updatedAnn = { ...ann, updatedAt: getNowISO() };
    const list = this.getAnnouncements().map((a) =>
      a.id === ann.id ? updatedAnn : a
    );
    this.saveAnnouncements(list);
    broadcastLocalChange('ANNOUNCEMENT_UPDATED', updatedAnn);

    // Synchronize to Cloudflare D1 non-blockingly
    CloudflareApiService.syncAnnouncement(updatedAnn).catch(() => {});
  }

  static deleteAnnouncement(id: string): void {
    this.addDeletedAnnId(id);
    const list = this.getAnnouncements().filter((a) => a.id !== id);
    this.saveAnnouncements(list);
    CloudflareApiService.deleteAnnouncement(id).catch(() => {});
    broadcastLocalChange('ANNOUNCEMENT_DELETED', { id });
  }

  // --- SUBMISSIONS ---
  static getSubmissions(): Submission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    let subs: Submission[] = [];
    if (raw !== null) {
      try {
        subs = JSON.parse(raw);
        if (!Array.isArray(subs)) subs = [];
      } catch {
        subs = [];
      }
    }
    const deletedSubIds = this.getDeletedSubIds();
    const deletedTaskIds = this.getDeletedTaskIds();
    const validTaskIds = new Set(this.getTasks().map((t) => t.id));

    return subs.filter(
      (s) =>
        s &&
        s.id &&
        !deletedSubIds.has(s.id) &&
        !deletedTaskIds.has(s.taskId) &&
        validTaskIds.has(s.taskId)
    );
  }

  static saveSubmissions(submissions: Submission[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    } catch (e) {
      console.warn('Storage error for submissions:', e);
    }
  }

  static createSubmission(submissionData: {
    taskId: string;
    taskTitle: string;
    memberId: string;
    memberName: string;
    memberSchool: string;
    memberAvatar?: string;
    subject: string;
    description?: string;
    files: SubmissionFile[];
  }): Submission {
    const list = this.getSubmissions();
    // Sanitize files so they can store valid data URLs and preview links safely
    const safeFiles = (submissionData.files || []).map((f) => ({
      ...f,
      previewUrl: f.previewUrl && f.previewUrl.startsWith('data:') && f.previewUrl.length > 500000 ? undefined : f.previewUrl,
    }));

    // Check if user already submitted for this task
    const existingIndex = list.findIndex(
      (s) => s.taskId === submissionData.taskId && s.memberId === submissionData.memberId
    );

    const newSub: Submission = {
      ...submissionData,
      files: safeFiles,
      id: existingIndex >= 0 ? list[existingIndex].id : `sub-${Date.now()}`,
      status: 'SUBMITTED',
      submittedAt: getNowISO(),
      updatedAt: getNowISO(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = newSub;
    } else {
      list.unshift(newSub);
    }

    this.saveSubmissions(list);
    // Real-time Cloudflare Sync & Broadcast
    CloudflareApiService.syncSubmission(newSub);
    broadcastLocalChange('SUBMISSION_CREATED', newSub);
    return newSub;
  }

  static updateSubmission(submission: Submission): void {
    const list = this.getSubmissions();
    const existingSub = list.find((s) => s.id === submission.id);
    const tasks = this.getTasks();
    const relatedTask = tasks.find((t) => t.id === submission.taskId);
    const targetFolderId = relatedTask?.gDriveFolderId;
    
    // Automatic Google Drive Deletion for any files removed during editing
    if (existingSub && Array.isArray(existingSub.files)) {
      const remainingIdentifiers = new Set(
        (submission.files || []).map((f) => f.gDriveFileId || f.gDriveUrl || f.name).filter(Boolean)
      );
      existingSub.files.forEach((f) => {
        const fileKey = f.gDriveFileId || f.gDriveUrl || f.name;
        if (fileKey && !remainingIdentifiers.has(fileKey)) {
          deleteGoogleDriveFile(f.gDriveFileId || f.gDriveUrl || f.id, f.name, targetFolderId).catch(() => {});
        }
      });
    }

    const updatedSub = { ...submission, updatedAt: getNowISO() };
    const updatedList = list.map((s) =>
      s.id === submission.id ? updatedSub : s
    );
    this.saveSubmissions(updatedList);
    // Real-time Cloudflare Sync & Broadcast
    CloudflareApiService.syncSubmission(updatedSub);
    broadcastLocalChange('SUBMISSION_UPDATED', updatedSub);
  }

  static deleteSubmission(submissionId: string): void {
    const list = this.getSubmissions();
    const subToDelete = list.find((s) => s.id === submissionId);
    const tasks = this.getTasks();
    const relatedTask = subToDelete ? tasks.find((t) => t.id === subToDelete.taskId) : null;
    const targetFolderId = relatedTask?.gDriveFolderId;

    this.addDeletedSubId(submissionId);
    const updatedList = list.filter((s) => s.id !== submissionId);
    this.saveSubmissions(updatedList);
    CloudflareApiService.deleteSubmission(submissionId);

    // Automatic Google Drive Deletion for submission files
    if (subToDelete && Array.isArray(subToDelete.files)) {
      subToDelete.files.forEach((f) => {
        deleteGoogleDriveFile(f.gDriveFileId || f.gDriveUrl || f.id, f.name, targetFolderId).catch(() => {});
      });
    }

    broadcastLocalChange('SUBMISSION_DELETED', { id: submissionId });
  }

  // --- DOCUMENTS ---
  static getDocuments(): DocumentItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    let docs: DocumentItem[] = [];
    if (raw !== null) {
      try {
        docs = JSON.parse(raw);
        if (!Array.isArray(docs)) docs = [];
      } catch {
        docs = [];
      }
    }
    const cleanDocs: DocumentItem[] = [];
    for (const d of docs) {
      if (this.isMockSampleDoc(d)) {
        if (d && d.id) {
          this.addDeletedDocId(d.id);
          CloudflareApiService.deleteDocument(d.id).catch(() => {});
        }
      } else {
        cleanDocs.push(d);
      }
    }
    if (cleanDocs.length !== docs.length) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(cleanDocs));
    }
    return cleanDocs;
  }

  static saveDocuments(docs: DocumentItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    } catch (e) {
      console.warn('Storage error for documents:', e);
    }
  }

  static createDocument(
    doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'gDriveFolderId'> & { gDriveFolderId?: string }
  ): DocumentItem {
    const list = this.getDocuments();
    const folderId =
      doc.gDriveFolderId ||
      (doc.category === 'OFFICIAL_ORDER'
        ? GDRIVE_OFFICIAL_ORDERS_FOLDER_ID
        : GDRIVE_SAMPLE_DOCS_FOLDER_ID);

    const newDocId = `doc-${Date.now()}`;
    this.removeDeletedDocId(newDocId);

    const newDoc: DocumentItem = {
      ...doc,
      id: newDocId,
      gDriveFolderId: folderId,
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };
    list.unshift(newDoc);
    this.saveDocuments(list);
    // Real-time Cloudflare Sync & Broadcast
    CloudflareApiService.syncDocument(newDoc);
    broadcastLocalChange('DOCUMENT_CREATED', newDoc);
    return newDoc;
  }

  static updateDocument(doc: DocumentItem): void {
    const list = this.getDocuments();
    const updatedDoc = { ...doc, updatedAt: getNowISO() };
    const updatedList = list.map((d) =>
      d.id === doc.id ? updatedDoc : d
    );
    this.saveDocuments(updatedList);
    // Real-time Cloudflare Sync & Broadcast
    CloudflareApiService.syncDocument(updatedDoc);
    broadcastLocalChange('DOCUMENT_UPDATED', updatedDoc);
  }

  static deleteDocument(id: string): void {
    const list = this.getDocuments();

    this.addDeletedDocId(id);
    const updatedList = list.filter((d) => d.id !== id);
    this.saveDocuments(updatedList);
    CloudflareApiService.deleteDocument(id);

    // Note: Google Drive files and folders are strictly preserved (no deletion) per user requirements.

    broadcastLocalChange('DOCUMENT_DELETED', { id });
  }

  // --- SETTINGS ---
  static getSettings(): SystemSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        ...INITIAL_SETTINGS,
        ...parsed,
        gDriveFolderId: parsed.gDriveFolderId || GDRIVE_FOLDER_ID,
        gasWebhookUrl: parsed.gasWebhookUrl || GAS_WEBHOOK_URL,
      };
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  static saveSettings(settings: SystemSettings): void {
    try {
      const updated = { ...settings, updatedAt: getNowISO() };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      // Real-time Cloudflare Sync & Broadcast
      CloudflareApiService.syncSettings(updated);
      broadcastLocalChange('SETTINGS_UPDATED', updated);
    } catch (e) {
      console.error('Storage quota or save error for settings:', e);
    }
  }

  /**
   * Push all current local data up to Cloudflare D1
   */
  static async pushAllDataToCloudflare(): Promise<{ success: boolean; count: number }> {
    try {
      const tasks = this.getTasks();
      const submissions = this.getSubmissions();
      const docs = this.getDocuments();
      const settings = this.getSettings();
      const users = this.getUsers();

      let count = 0;

      // Sync tasks
      for (const t of tasks) {
        await CloudflareApiService.syncTask(t);
        count++;
      }

      // Sync submissions
      for (const s of submissions) {
        await CloudflareApiService.syncSubmission(s);
        count++;
      }

      // Sync docs
      for (const d of docs) {
        await CloudflareApiService.syncDocument(d);
        count++;
      }

      // Sync settings & users
      await CloudflareApiService.syncSettings(settings);
      for (const u of users) {
        await CloudflareApiService.syncUser(u);
        count++;
      }

      return { success: true, count };
    } catch (err) {
      console.error('Error pushing data to Cloudflare:', err);
      return { success: false, count: 0 };
    }
  }

  private static isSyncing = false;

  /**
   * Background Hydration and Cross-Browser Real-Time Sync from Cloudflare D1
   */
  static async syncWithCloudflare(): Promise<{
    hasChanges: boolean;
    newTasks: Task[];
    newSubmissions: Submission[];
  }> {
    if (this.isSyncing) {
      return { hasChanges: false, newTasks: [], newSubmissions: [] };
    }
    this.isSyncing = true;

    try {
      // Non-blocking auto-restore for protected Google Drive root folders
      restoreProtectedGoogleDriveRootFolders().catch(() => {});

      const data = await CloudflareApiService.fetchAllData();
      if (!data) return { hasChanges: false, newTasks: [], newSubmissions: [] };

      let hasChanges = false;
      const newTasks: Task[] = [];
      const newSubmissions: Submission[] = [];

      // 1. Sync Users (Honor deletion tombstones)
      if (data.users && Array.isArray(data.users) && data.users.length > 0) {
        const deletedUserIds = this.getDeletedUserIds();
        const currentUsers = this.getUsers().filter(
          (u) => !deletedUserIds.has(u.id) && !deletedUserIds.has(u.username) && !deletedUserIds.has(u.username.toLowerCase())
        );
        const mergedUsers: User[] = [...currentUsers];

        for (const rawUser of data.users) {
          const u = rawUser as any;
          if (u.status === 'DELETED' || u._deleted === true) continue;
          if (u.id && deletedUserIds.has(u.id)) continue;
          if (u.username && (deletedUserIds.has(u.username) || deletedUserIds.has(u.username.toLowerCase()))) continue;

          const parts = (u.department || '').split('@@@');
          const school = parts[0] || 'โรงเรียนวิชาการวิทยาคาร';
          const explicitUsername = parts[1];
          const explicitPassword = parts[2];

          let username = u.username || explicitUsername;
          if (!username && u.id && u.id.startsWith('user-')) {
            username = u.id.substring(5);
          }
          if (!username && u.avatarUrl && u.avatarUrl.includes('seed=')) {
            try {
              username = decodeURIComponent(u.avatarUrl.split('seed=')[1].split('&')[0]);
            } catch {}
          }
          if (!username) {
            username = u.fullName || u.id;
          }
          username = (username || '').trim();

          if (deletedUserIds.has(username) || deletedUserIds.has(username.toLowerCase())) continue;

          const password = u.password || explicitPassword || u.passwordHash || '123456';
          const fullName = (u.fullName || username || '').trim();

          const mappedUser: User = {
            id: u.id || `user-${username}`,
            username: username,
            password: password,
            fullName: fullName,
            school: school,
            avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
            role: (u.role === 'ADMIN' ? 'ADMIN' : 'MEMBER') as UserRole,
            status: (u.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING') as UserStatus,
            createdAt: u.createdAt || getNowISO(),
            updatedAt: u.updatedAt || u.createdAt || getNowISO(),
          };

          if (deletedUserIds.has(mappedUser.id) || deletedUserIds.has(mappedUser.username.toLowerCase())) {
            continue;
          }

          const existingIndex = mergedUsers.findIndex(
            (local) =>
              local.id === mappedUser.id ||
              local.username.toLowerCase() === mappedUser.username.toLowerCase() ||
              (local.fullName.toLowerCase() === mappedUser.fullName.toLowerCase() && local.username.toLowerCase() !== 'admin')
          );

          if (existingIndex >= 0) {
            const cur = mergedUsers[existingIndex];
            const hasCustomAvatar = cur.avatarUrl && !cur.avatarUrl.includes('dicebear');
            const avatarUrl = mappedUser.avatarUrl && !mappedUser.avatarUrl.includes('dicebear')
              ? mappedUser.avatarUrl
              : (hasCustomAvatar ? cur.avatarUrl : mappedUser.avatarUrl);

            const hasDiff =
              cur.status !== mappedUser.status ||
              cur.role !== mappedUser.role ||
              cur.password !== mappedUser.password ||
              cur.fullName !== mappedUser.fullName ||
              cur.school !== mappedUser.school ||
              cur.avatarUrl !== avatarUrl;

            if (hasDiff) {
              mergedUsers[existingIndex] = {
                ...cur,
                ...mappedUser,
                avatarUrl,
                password: mappedUser.password !== '123456' ? mappedUser.password : (cur.password || mappedUser.password),
              };
              hasChanges = true;
            }
          } else {
            mergedUsers.push(mappedUser);
            hasChanges = true;
          }
        }

        // Always ensure Master Admin exists
        if (!mergedUsers.some((u) => u.username.toLowerCase() === 'admin' || u.role === 'ADMIN')) {
          mergedUsers.unshift(INITIAL_USERS[0]);
        }

        const finalFilteredUsers = mergedUsers.filter(
          (u) => !deletedUserIds.has(u.id) && !deletedUserIds.has(u.username) && !deletedUserIds.has(u.username.toLowerCase())
        );

        if (hasChanges || finalFilteredUsers.length !== currentUsers.length) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(finalFilteredUsers));
        }
      }

      // 2. Sync Tasks (2-Way Safe Merge)
      if (data.tasks && Array.isArray(data.tasks)) {
        const deletedTaskIds = this.getDeletedTaskIds();
        const currentTasks = this.getTasks();

        const nonDeletedCloudTasks = data.tasks.filter(
          (t: any) =>
            !deletedTaskIds.has(t.id) &&
            t.status !== 'DELETED' &&
            t._deleted !== true &&
            t.type !== 'ANNOUNCEMENT' &&
            t.type !== 'DOCUMENT_ITEM' &&
            !t.id.startsWith('ann-') &&
            !t.id.startsWith('doc-')
        );

        const mappedTasks: Task[] = nonDeletedCloudTasks.map((t: any) => {
          let rawDate = t.deadline || t.dueDate || '';
          let startDate = t.startDate || undefined;
          let dueDate = rawDate;
          if (rawDate.includes('..')) {
            const parts = rawDate.split('..');
            startDate = parts[0];
            dueDate = parts[1];
          } else if (!startDate && t.startDate) {
            startDate = t.startDate;
          }

          return {
            id: t.id,
            title: t.title || '',
            description: t.description || '',
            category: t.type || t.category || 'งานวิชาการ',
            dueDate: dueDate || '',
            startDate: startDate || undefined,
            assignedBy: t.assignedBy || 'Admin วิชาการ',
            gDriveFolderId: t.gDriveFolderId || GDRIVE_FOLDER_ID,
            gDriveFolderUrl: t.gDriveFolderUrl || `https://drive.google.com/drive/folders/${t.gDriveFolderId || GDRIVE_FOLDER_ID}`,
            createdAt: t.createdAt || getNowISO(),
            updatedAt: t.updatedAt || t.createdAt || getNowISO(),
          };
        });

        // 2-Way Task Merge:
        const taskMap = new Map<string, Task>();
        // Keep valid local tasks
        currentTasks.forEach((lt) => {
          if (!deletedTaskIds.has(lt.id)) {
            taskMap.set(lt.id, lt);
          }
        });

        // Merge remote tasks
        for (const remoteTask of mappedTasks) {
          if (!deletedTaskIds.has(remoteTask.id)) {
            const existing = taskMap.get(remoteTask.id);
            if (!existing) {
              taskMap.set(remoteTask.id, remoteTask);
              newTasks.push(remoteTask);
              hasChanges = true;
            } else {
              const remoteTime = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
              const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              if (remoteTime > localTime || (remoteTask.gDriveFolderId && remoteTask.gDriveFolderId !== GDRIVE_FOLDER_ID && existing.gDriveFolderId === GDRIVE_FOLDER_ID)) {
                taskMap.set(remoteTask.id, {
                  ...existing,
                  ...remoteTask,
                  gDriveFolderId: remoteTask.gDriveFolderId || existing.gDriveFolderId,
                  gDriveFolderUrl: remoteTask.gDriveFolderUrl || existing.gDriveFolderUrl,
                });
                hasChanges = true;
              }
            }
          }
        }

        // Push any local tasks not on Cloudflare
        const remoteTaskIdSet = new Set(mappedTasks.map((t) => t.id));
        for (const [id, localTask] of taskMap.entries()) {
          if (!remoteTaskIdSet.has(id)) {
            CloudflareApiService.syncTask(localTask).catch(() => {});
          }
        }

        const freshDeletedTaskIds = this.getDeletedTaskIds();
        const finalTasks = Array.from(taskMap.values()).filter((t) => !freshDeletedTaskIds.has(t.id));

        if (hasChanges || finalTasks.length !== currentTasks.length) {
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(finalTasks));
          hasChanges = true;
        }
      }

      // 3. Sync Submissions (2-Way Safe Merge: Never lose member submissions)
      if (data.submissions && Array.isArray(data.submissions)) {
        const deletedSubIds = this.getDeletedSubIds();
        const deletedTaskIds = this.getDeletedTaskIds();
        const currentSubmissions = this.getSubmissions();

        const nonDeletedCloudSubs = data.submissions.filter(
          (s: any) =>
            !deletedSubIds.has(s.id) &&
            !deletedTaskIds.has(s.taskId) &&
            s.status !== 'DELETED' &&
            s._deleted !== true
        );

        const mappedSubmissions: Submission[] = nonDeletedCloudSubs.map((s: any) => {
          let parsedFiles = [];
          if (typeof s.files === 'string') {
            try {
              parsedFiles = JSON.parse(s.files);
            } catch {
              parsedFiles = [];
            }
          } else if (Array.isArray(s.files)) {
            parsedFiles = s.files;
          }

          return {
            id: s.id,
            taskId: s.taskId,
            taskTitle: s.taskTitle || '',
            memberId: s.memberId,
            memberName: s.memberName,
            memberSchool: s.memberSchool || s.department || '',
            memberAvatar: s.memberAvatar || s.avatarUrl || '',
            subject: s.subject || s.note || '',
            description: s.description || s.note || '',
            files: parsedFiles,
            status: s.status || 'SUBMITTED',
            score: s.score !== null && s.score !== undefined ? s.score : undefined,
            feedback: s.feedback || '',
            submittedAt: s.submittedAt || getNowISO(),
            updatedAt: s.updatedAt || s.submittedAt || getNowISO(),
          };
        });

        // 2-Way Merge: Keep all local submissions that are not deleted
        const subMap = new Map<string, Submission>();
        currentSubmissions.forEach((ls) => {
          if (!deletedSubIds.has(ls.id) && !deletedTaskIds.has(ls.taskId)) {
            subMap.set(ls.id, ls);
          }
        });

        // Merge remote submissions
        for (const remoteSub of mappedSubmissions) {
          if (!deletedSubIds.has(remoteSub.id) && !deletedTaskIds.has(remoteSub.taskId)) {
            const existing = subMap.get(remoteSub.id);
            if (!existing) {
              subMap.set(remoteSub.id, remoteSub);
              newSubmissions.push(remoteSub);
              hasChanges = true;
            } else {
              const remoteTime = new Date(remoteSub.updatedAt || remoteSub.submittedAt || 0).getTime();
              const localTime = new Date(existing.updatedAt || existing.submittedAt || 0).getTime();
              if (remoteTime > localTime || (remoteSub.score !== undefined && existing.score === undefined)) {
                subMap.set(remoteSub.id, {
                  ...existing,
                  ...remoteSub,
                  files: Array.isArray(remoteSub.files) && remoteSub.files.length > 0 ? remoteSub.files : existing.files,
                });
                hasChanges = true;
              }
            }
          }
        }

        // Push any local submissions not on Cloudflare up to Cloudflare
        const remoteSubIdSet = new Set(mappedSubmissions.map((s) => s.id));
        for (const [id, localSub] of subMap.entries()) {
          if (!remoteSubIdSet.has(id)) {
            CloudflareApiService.syncSubmission(localSub).catch(() => {});
          }
        }

        const freshDeletedSubIds = this.getDeletedSubIds();
        const freshDeletedTaskIds = this.getDeletedTaskIds();
        const finalSubs = Array.from(subMap.values()).filter(
          (s) => !freshDeletedSubIds.has(s.id) && !freshDeletedTaskIds.has(s.taskId)
        );

        if (hasChanges || finalSubs.length !== currentSubmissions.length) {
          localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(finalSubs));
          hasChanges = true;
        }
      }

      // 4. Sync Announcements (Cross-device realtime synchronization)
      const rawAnnList = [
        ...(Array.isArray(data.announcements) ? data.announcements : []),
        ...(Array.isArray(data.tasks) ? data.tasks.filter((t: any) => t.type === 'ANNOUNCEMENT' || (t.id && t.id.startsWith('ann-'))) : []),
      ];

      // Mark tombstones for any deleted announcements on the server
      rawAnnList.forEach((a: any) => {
        if (
          !a ||
          !a.id ||
          a.status === 'DELETED' ||
          a._deleted === true ||
          a.type === 'DELETED' ||
          a.title === '[DELETED]' ||
          a.id === 'ann-01' ||
          a.id === 'ann-02' ||
          (a.title && (a.title.includes('ประกาศวันหยุดราชการพิเศษ') || a.title.includes('ประชุมวิชาการสัญจร')))
        ) {
          if (a && a.id) {
            this.addDeletedAnnId(a.id);
          }
        }
      });

      const deletedAnnIds = this.getDeletedAnnIds();
      const currentAnns = this.getAnnouncements();

      const nonDeletedCloudAnns = rawAnnList.filter(
        (a: any) =>
          a &&
          a.id &&
          !deletedAnnIds.has(a.id) &&
          a.status !== 'DELETED' &&
          a.type !== 'DELETED' &&
          a.title !== '[DELETED]' &&
          a._deleted !== true &&
          a.id !== 'ann-01' &&
          a.id !== 'ann-02' &&
          !(a.title && (a.title.includes('ประกาศวันหยุดราชการพิเศษ') || a.title.includes('ประชุมวิชาการสัญจร')))
      );

      const mappedAnnsMap = new Map<string, Announcement>();

      nonDeletedCloudAnns.forEach((a: any) => {
        const rawType = a.type === 'ANNOUNCEMENT' ? (a.gDriveFolderId || 'ACTIVITY') : (a.type || 'ACTIVITY');
        const annType = (['ANNOUNCEMENT', 'HOLIDAY', 'ACTIVITY'].includes(rawType) ? rawType : 'ACTIVITY') as AnnouncementType;
        const createdBy = a.createdBy || (a.type === 'ANNOUNCEMENT' ? a.gDriveFolderUrl : '') || 'ผู้ดูแลระบบวิชาการ';

        let rawDate = a.date || a.deadline || getNowISO().split('T')[0];
        let startDate = rawDate;
        let endDate = a.endDate || undefined;
        if (rawDate.includes('..')) {
          const parts = rawDate.split('..');
          startDate = parts[0];
          endDate = parts[1];
        }

        mappedAnnsMap.set(a.id, {
          id: a.id,
          title: a.title || 'ประกาศแจ้งเพื่อทราบ',
          details: a.details || a.description || '',
          date: startDate,
          endDate: endDate || undefined,
          type: annType,
          createdBy: createdBy,
          createdAt: a.createdAt || getNowISO(),
          updatedAt: a.updatedAt || a.createdAt || getNowISO(),
        });
      });

      // Server is source of truth: If a local announcement was deleted on the server, mark as deleted
      const now = Date.now();
      currentAnns.forEach((localAnn) => {
        if (!mappedAnnsMap.has(localAnn.id)) {
          const annAgeMs = now - new Date(localAnn.createdAt || 0).getTime();
          if (annAgeMs > 15000 || isNaN(annAgeMs)) {
            // Deleted on server (Admin deleted) -> purge from member device
            this.addDeletedAnnId(localAnn.id);
            hasChanges = true;
          } else if (!deletedAnnIds.has(localAnn.id)) {
            // Recently created locally (<15s) -> sync up to cloud
            mappedAnnsMap.set(localAnn.id, localAnn);
            CloudflareApiService.syncAnnouncement(localAnn).catch(() => {});
          }
        }
      });

      const freshDeletedAnnIds = this.getDeletedAnnIds();
      const finalAnns = Array.from(mappedAnnsMap.values()).filter((a) => !freshDeletedAnnIds.has(a.id));

      if (finalAnns.length !== currentAnns.length || hasChanges) {
        localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(finalAnns));
        hasChanges = true;
      }

      // 5. Sync Documents (Cross-device realtime synchronization from both documents table & tasks backup)
      const rawDocTasks = Array.isArray(data.tasks)
        ? data.tasks.filter((t: any) => t && (t.type === 'DOCUMENT_ITEM' || (t.id && t.id.startsWith('doc-'))))
        : [];

      const mappedDocTasks: DocumentItem[] = rawDocTasks.map((t: any) => {
        let meta: any = {};
        if (t.description) {
          try {
            meta = JSON.parse(t.description);
          } catch {
            meta = { description: t.description };
          }
        }
        return {
          id: t.id,
          title: t.title || 'เอกสารวิชาการ',
          category: meta.category || t.deadline || 'SAMPLE_DOC',
          description: meta.description || (typeof meta === 'string' ? meta : ''),
          fileName: meta.fileName || t.startDate || `${t.title || 'document'}.docx`,
          fileType: meta.fileType || 'docx',
          fileSize: meta.fileSize || '1.0 MB',
          fileUrl: meta.fileUrl || t.gDriveFolderUrl || '',
          gDriveFolderId: meta.gDriveFolderId || t.gDriveFolderId || GDRIVE_FOLDER_ID,
          gDriveFileId: meta.gDriveFileId || undefined,
          uploadedBy: meta.uploadedBy || 'ผู้ดูแลระบบวิชาการ',
          createdAt: t.createdAt || getNowISO(),
          updatedAt: t.updatedAt || t.createdAt || getNowISO(),
        };
      });

      const rawDocList = [
        ...(Array.isArray(data.documents) ? data.documents : []),
        ...mappedDocTasks,
      ];

      if (rawDocList.length > 0 || Array.isArray(data.documents)) {
        // Merge documents: Remote docs merged with local documents
        const currentDocs = this.getDocuments();

        // 1. Detect tombstones from remote
        rawDocList.forEach((d: any) => {
          if (
            d &&
            d.id &&
            (d.status === 'DELETED' ||
              d._deleted === true ||
              d.category === 'DELETED' ||
              d.title === '[DELETED]')
          ) {
            this.addDeletedDocId(d.id);
          }
        });

        const deletedDocIds = this.getDeletedDocIds();

        // 2. Map all non-deleted remote docs
        const nonDeletedCloudDocs = rawDocList.filter(
          (d: any) =>
            d &&
            d.id &&
            !deletedDocIds.has(d.id) &&
            !this.isMockSampleDoc(d) &&
            d.status !== 'DELETED' &&
            d.category !== 'DELETED' &&
            d.title !== '[DELETED]' &&
            d._deleted !== true
        );

        const mergedDocsMap = new Map<string, DocumentItem>();

        nonDeletedCloudDocs.forEach((d: any) => {
          const fileId = d.gDriveFileId || (d.fileUrl ? extractDriveFileId(d.fileUrl) : undefined);
          const mappedDoc: DocumentItem = {
            id: d.id,
            title: d.title || 'เอกสารวิชาการ',
            category: d.category || 'SAMPLE_DOC',
            description: d.description || '',
            fileName: d.fileName || `${d.title || 'document'}.docx`,
            fileType: d.fileType || 'docx',
            fileSize: d.fileSize || '1.0 MB',
            fileUrl: d.fileUrl || '',
            gDriveFolderId: d.gDriveFolderId || GDRIVE_FOLDER_ID,
            gDriveFileId: fileId || undefined,
            fileData: d.fileData || undefined,
            uploadedBy: d.uploadedBy || 'ผู้ดูแลระบบวิชาการ',
            createdAt: d.createdAt || getNowISO(),
            updatedAt: d.updatedAt || d.createdAt || getNowISO(),
          };
          mergedDocsMap.set(d.id, mappedDoc);
        });

        // 3. Preserve and merge all valid local user documents, and sync them to Cloudflare if not yet on remote
        currentDocs.forEach((localDoc) => {
          if (this.isMockSampleDoc(localDoc)) {
            this.addDeletedDocId(localDoc.id);
            hasChanges = true;
            return;
          }

          if (!deletedDocIds.has(localDoc.id)) {
            const remoteDoc = mergedDocsMap.get(localDoc.id);
            if (!remoteDoc) {
              // Local document is not yet on remote (e.g. freshly created) -> preserve locally and push to Cloudflare
              mergedDocsMap.set(localDoc.id, localDoc);
              CloudflareApiService.syncDocument(localDoc).catch(() => {});
            } else {
              const remoteTime = new Date(remoteDoc.updatedAt || remoteDoc.createdAt || 0).getTime();
              const localTime = new Date(localDoc.updatedAt || localDoc.createdAt || 0).getTime();
              if (localTime > remoteTime) {
                mergedDocsMap.set(localDoc.id, localDoc);
                CloudflareApiService.syncDocument(localDoc).catch(() => {});
              } else {
                // Keep local high-resolution binary cache & fileId if available
                const mergedDoc: DocumentItem = {
                  ...remoteDoc,
                  fileData: localDoc.fileData || remoteDoc.fileData,
                  gDriveFileId: localDoc.gDriveFileId || remoteDoc.gDriveFileId,
                  fileUrl: remoteDoc.fileUrl || localDoc.fileUrl,
                };
                mergedDocsMap.set(localDoc.id, mergedDoc);
              }
            }
          }
        });

        const freshDeletedDocIds = this.getDeletedDocIds();
        const finalDocs = Array.from(mergedDocsMap.values()).filter(
          (d) => !freshDeletedDocIds.has(d.id) && !this.isMockSampleDoc(d)
        );

        if (finalDocs.length !== currentDocs.length) {
          localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(finalDocs));
          hasChanges = true;
        } else {
          // Check if any document content changed
          const currentDocMap = new Map(currentDocs.map((d) => [d.id, d]));
          let contentChanged = false;
          for (const d of finalDocs) {
            const old = currentDocMap.get(d.id);
            if (
              !old ||
              old.updatedAt !== d.updatedAt ||
              old.title !== d.title ||
              old.fileUrl !== d.fileUrl ||
              old.gDriveFileId !== d.gDriveFileId ||
              old.fileData !== d.fileData
            ) {
              contentChanged = true;
              break;
            }
          }
          if (contentChanged) {
            localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(finalDocs));
            hasChanges = true;
          }
        }
      }

      // 6. Sync Settings
      if (data.settings && Object.keys(data.settings).length > 0) {
        const currentSettings = this.getSettings();
        const mergedSettings = { ...currentSettings, ...data.settings };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
      }

      return { hasChanges, newTasks, newSubmissions };
    } catch (err) {
      console.warn('Background Cloudflare Sync notice:', err);
      return { hasChanges: false, newTasks: [], newSubmissions: [] };
    } finally {
      this.isSyncing = false;
    }
  }
}
