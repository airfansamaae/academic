import {
  User,
  UserRole,
  UserStatus,
  Task,
  Announcement,
  Submission,
  DocumentItem,
  SystemSettings,
  SubmissionFile,
} from '../types';
import { CloudflareApiService, CLOUDFLARE_WORKER_URL } from './cloudflareApi';
import { deleteGoogleDriveFile, deleteGoogleDriveFolder } from './driveUpload';

export const GDRIVE_FOLDER_ID = '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu';
export const GDRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`;
export const GDRIVE_OFFICIAL_ORDERS_FOLDER_ID = '1hHTRwn9UpW43xgOUp8O4Yvn8AvioOey8'; // โฟลเดอร์หนังสือคำสั่ง
export const GDRIVE_SAMPLE_DOCS_FOLDER_ID = '1zFyOcMUxFzFxDXS0C_x41sA6Sy1E2eZS'; // โฟลเดอร์เอกสารตัวอย่าง
export const GAS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzve6nmcAMloypZThIb5aRyKfLd3NJCeoddYU8NToVMCXKltjG9WWEI6yA-tetESAt26w/exec';
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

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-01',
    title: '📢 แจ้งกำหนดการประชุมวิชาการสัญจรและอบรมเชิงปฏิบัติการ AI ทางการศึกษา',
    details: 'ขอเชิญครูทุกท่านเข้าร่วมการประชุม ณ ห้องประชุมเกียรติยศ เวลา 09.00 - 16.00 น. มีอาหารว่างและเกียรติบัตร',
    date: getRelativeDate(0), // Today
    type: 'ACTIVITY',
    createdBy: 'ผู้ดูแลระบบวิชาการ',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
  },
  {
    id: 'ann-02',
    title: '🏖️ ประกาศวันหยุดราชการพิเศษและการจัดสอนชดเชย',
    details: 'หยุดเรียนเนื่องในวันสำคัญทางวิชาการและวัฒนธรรม ครูผู้สอนสามารถนัดหมายการเรียนการสอนออนไลน์ล่วงหน้าได้',
    date: getRelativeDate(5),
    type: 'HOLIDAY',
    createdBy: 'ผู้ดูแลระบบวิชาการ',
    createdAt: '2026-08-18T09:30:00.000Z',
    updatedAt: '2026-08-18T09:30:00.000Z',
  },
];

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

const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-01',
    title: 'แบบฟอร์มแผนการจัดการเรียนรู้ตามแนวทาง Active Learning (Template 2569)',
    category: 'SAMPLE_DOC',
    description: 'เทมเพลตมาตรฐานสำหรับเขียนแผนการจัดการเรียนรู้ พร้อมตัวอย่างการวัดประเมินผลตามสภาพจริง',
    fileName: 'Template_Active_Learning_Plan_2569.docx',
    fileSize: '1.8 MB',
    fileType: 'DOCX',
    fileUrl: `https://drive.google.com/file/d/sample_template/view`,
    gDriveFolderId: GDRIVE_FOLDER_ID,
    uploadedBy: 'ผู้ดูแลระบบวิชาการ',
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-10T09:00:00.000Z',
  },
  {
    id: 'doc-02',
    title: 'ตัวอย่างแบบรายงานวิจัยปฏิบัติการในชั้นเรียน 5 บท (ฉบับย่อ)',
    category: 'SAMPLE_DOC',
    description: 'แนวทางการเขียนงานวิจัยในชั้นเรียน พร้อมตัวชี้วัดและตัวอย่างการวิเคราะห์สถิติ',
    fileName: 'Example_Classroom_Research_5_Chapters.pdf',
    fileSize: '3.2 MB',
    fileType: 'PDF',
    fileUrl: `https://drive.google.com/file/d/sample_research/view`,
    gDriveFolderId: GDRIVE_FOLDER_ID,
    uploadedBy: 'ผู้ดูแลระบบวิชาการ',
    createdAt: '2026-08-12T10:30:00.000Z',
    updatedAt: '2026-08-12T10:30:00.000Z',
  },
  {
    id: 'doc-03',
    title: 'คำสั่งแต่งตั้งคณะกรรมการบริหารงานวิชาการและประเมินผลการเรียนรู้ ประจำปีการศึกษา 2569',
    category: 'OFFICIAL_ORDER',
    description: 'คำสั่งโรงเรียนที่ 124/2569 เรื่อง แต่งตั้งคณะกรรมการฝ่ายวิชาการและหน้าที่ความรับผิดชอบ',
    fileName: 'Order_Academic_Committee_124_2569.pdf',
    fileSize: '2.4 MB',
    fileType: 'PDF',
    fileUrl: `https://drive.google.com/file/d/sample_order_124/view`,
    gDriveFolderId: GDRIVE_FOLDER_ID,
    uploadedBy: 'ผู้ดูแลระบบวิชาการ',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'doc-04',
    title: 'คำสั่งมอบหมายภาระงานสอนและการปฏิบัติหน้าที่พิเศษ ภาคเรียนที่ 1/2569',
    category: 'OFFICIAL_ORDER',
    description: 'คำสั่งโรงเรียนที่ 135/2569 แจ้งตารางสอนและหน้าที่ครูประจำชั้น/ครูเวรประจำวัน',
    fileName: 'Order_Teaching_Assignment_135_2569.pdf',
    fileSize: '4.1 MB',
    fileType: 'PDF',
    fileUrl: `https://drive.google.com/file/d/sample_order_135/view`,
    gDriveFolderId: GDRIVE_FOLDER_ID,
    uploadedBy: 'ผู้ดูแลระบบวิชาการ',
    createdAt: '2026-08-08T11:00:00.000Z',
    updatedAt: '2026-08-08T11:00:00.000Z',
  },
];

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
      gDriveFolderId: task.gDriveFolderId || GDRIVE_FOLDER_ID,
      gDriveFolderUrl: task.gDriveFolderUrl || `https://drive.google.com/drive/folders/${task.gDriveFolderId || GDRIVE_FOLDER_ID}`,
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
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  static addDeletedDocId(id: string): void {
    try {
      const set = this.getDeletedDocIds();
      set.add(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_DOCUMENTS, JSON.stringify(Array.from(set)));
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
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
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

    // 6. Automatic Google Drive Deletion: Task folder & all submission files
    if (taskToDelete?.gDriveFolderId) {
      deleteGoogleDriveFolder(taskToDelete.gDriveFolderId).catch(() => {});
    }
    if (taskToDelete?.gDriveFolderUrl) {
      deleteGoogleDriveFolder(taskToDelete.gDriveFolderUrl).catch(() => {});
    }
    deletedSubs.forEach((sub) => {
      if (Array.isArray(sub.files)) {
        sub.files.forEach((f) => {
          if (f.gDriveUrl) {
            deleteGoogleDriveFile(f.gDriveUrl).catch(() => {});
          }
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

    // 5. Automatic Google Drive Deletion for all tasks & files
    currentTasks.forEach((t) => {
      if (t.gDriveFolderId) deleteGoogleDriveFolder(t.gDriveFolderId).catch(() => {});
      if (t.gDriveFolderUrl) deleteGoogleDriveFolder(t.gDriveFolderUrl).catch(() => {});
    });
    allSubs.forEach((sub) => {
      if (Array.isArray(sub.files)) {
        sub.files.forEach((f) => {
          if (f.gDriveUrl) deleteGoogleDriveFile(f.gDriveUrl).catch(() => {});
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
    return anns.filter((a) => a && a.id && !deletedAnnIds.has(a.id));
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
    return newAnn;
  }

  static updateAnnouncement(ann: Announcement): void {
    const list = this.getAnnouncements().map((a) =>
      a.id === ann.id ? { ...ann, updatedAt: getNowISO() } : a
    );
    this.saveAnnouncements(list);
    broadcastLocalChange('ANNOUNCEMENT_UPDATED', ann);
  }

  static deleteAnnouncement(id: string): void {
    this.addDeletedAnnId(id);
    const list = this.getAnnouncements().filter((a) => a.id !== id);
    this.saveAnnouncements(list);
    CloudflareApiService.deleteAnnouncement(id);
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
    // Sanitize files so they never store gigantic raw base64 data in localStorage
    const safeFiles = (submissionData.files || []).map((f) => ({
      ...f,
      previewUrl: f.previewUrl && f.previewUrl.startsWith('data:') && f.previewUrl.length > 50000 ? undefined : f.previewUrl,
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
    
    // Automatic Google Drive Deletion for any files removed during editing
    if (existingSub && Array.isArray(existingSub.files)) {
      const remainingUrls = new Set(
        (submission.files || []).map((f) => f.gDriveUrl).filter(Boolean)
      );
      existingSub.files.forEach((f) => {
        if (f.gDriveUrl && !remainingUrls.has(f.gDriveUrl)) {
          deleteGoogleDriveFile(f.gDriveUrl).catch(() => {});
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

    this.addDeletedSubId(submissionId);
    const updatedList = list.filter((s) => s.id !== submissionId);
    this.saveSubmissions(updatedList);
    CloudflareApiService.deleteSubmission(submissionId);

    // Automatic Google Drive Deletion for submission files
    if (subToDelete && Array.isArray(subToDelete.files)) {
      subToDelete.files.forEach((f) => {
        if (f.gDriveUrl) deleteGoogleDriveFile(f.gDriveUrl).catch(() => {});
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
    const deletedDocIds = this.getDeletedDocIds();
    return docs.filter((d) => d && d.id && !deletedDocIds.has(d.id));
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

    const newDoc: DocumentItem = {
      ...doc,
      id: `doc-${Date.now()}`,
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
    const existingDoc = list.find((d) => d.id === doc.id);
    if (existingDoc && existingDoc.fileUrl && doc.fileUrl && existingDoc.fileUrl !== doc.fileUrl) {
      // If document file was replaced, delete old file from Google Drive
      deleteGoogleDriveFile(existingDoc.fileUrl).catch(() => {});
    }

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
    const docToDelete = list.find((d) => d.id === id);

    this.addDeletedDocId(id);
    const updatedList = list.filter((d) => d.id !== id);
    this.saveDocuments(updatedList);
    CloudflareApiService.deleteDocument(id);

    // Automatic Google Drive Deletion for document file (ทั้งเอกสารตัวอย่าง และ หนังสือคำสั่ง)
    if (docToDelete?.fileUrl) {
      deleteGoogleDriveFile(docToDelete.fileUrl).catch(() => {});
    }

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

      // 2. Sync Tasks (Honor deletion tombstones & server-authoritative deletion)
      if (data.tasks && Array.isArray(data.tasks)) {
        const deletedTaskIds = this.getDeletedTaskIds();
        const currentTasks = this.getTasks();
        const currentTaskIds = new Set(currentTasks.map((t) => t.id));

        const nonDeletedCloudTasks = data.tasks.filter(
          (t: any) => !deletedTaskIds.has(t.id) && t.status !== 'DELETED' && t._deleted !== true
        );

        const mappedTasks: Task[] = nonDeletedCloudTasks.map((t: any) => ({
          id: t.id,
          title: t.title || '',
          description: t.description || '',
          category: t.type || t.category || 'งานวิชาการ',
          dueDate: t.deadline || t.dueDate || '',
          assignedBy: t.assignedBy || 'Admin วิชาการ',
          gDriveFolderId: t.gDriveFolderId || GDRIVE_FOLDER_ID,
          gDriveFolderUrl: t.gDriveFolderUrl || `https://drive.google.com/drive/folders/${t.gDriveFolderId || GDRIVE_FOLDER_ID}`,
          createdAt: t.createdAt || getNowISO(),
          updatedAt: t.updatedAt || t.createdAt || getNowISO(),
        }));

        const cloudTaskIdSet = new Set(mappedTasks.map((t) => t.id));

        // Any task previously on device that is not on cloud (and older than 20s) was deleted on the server
        const now = Date.now();
        for (const localTask of currentTasks) {
          if (!cloudTaskIdSet.has(localTask.id)) {
            const taskAgeMs = now - new Date(localTask.createdAt || 0).getTime();
            if (taskAgeMs > 20000 || isNaN(taskAgeMs)) {
              this.addDeletedTaskId(localTask.id);
              hasChanges = true;
            }
          }
        }

        // Detect newly assigned tasks
        for (const t of mappedTasks) {
          if (!currentTaskIds.has(t.id)) {
            newTasks.push(t);
            hasChanges = true;
          }
        }

        const freshDeletedTaskIds = this.getDeletedTaskIds();
        const finalTasks = mappedTasks.filter((t) => !freshDeletedTaskIds.has(t.id));

        if (hasChanges || finalTasks.length !== currentTasks.length) {
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(finalTasks));
          hasChanges = true;
        }
      }

      // 3. Sync Submissions (Honor deletion tombstones and deleted tasks)
      if (data.submissions && Array.isArray(data.submissions)) {
        const deletedSubIds = this.getDeletedSubIds();
        const deletedTaskIds = this.getDeletedTaskIds();
        const currentSubmissions = this.getSubmissions();
        const currentSubIds = new Set(currentSubmissions.map((s) => s.id));
        const validTaskIds = new Set(this.getTasks().map((t) => t.id));

        const nonDeletedCloudSubs = data.submissions.filter(
          (s: any) =>
            !deletedSubIds.has(s.id) &&
            !deletedTaskIds.has(s.taskId) &&
            validTaskIds.has(s.taskId) &&
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

        for (const sub of mappedSubmissions) {
          if (!currentSubIds.has(sub.id)) {
            newSubmissions.push(sub);
            hasChanges = true;
          }
        }

        const freshDeletedSubIds = this.getDeletedSubIds();
        const freshDeletedTaskIds = this.getDeletedTaskIds();
        const finalValidTaskIds = new Set(this.getTasks().map((t) => t.id));

        const finalSubs = mappedSubmissions.filter(
          (s) =>
            !freshDeletedSubIds.has(s.id) &&
            !freshDeletedTaskIds.has(s.taskId) &&
            finalValidTaskIds.has(s.taskId)
        );

        if (hasChanges || finalSubs.length !== currentSubmissions.length) {
          localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(finalSubs));
          hasChanges = true;
        }
      }

      // 4. Sync Announcements
      if (data.announcements && Array.isArray(data.announcements)) {
        const deletedAnnIds = this.getDeletedAnnIds();
        const currentAnns = this.getAnnouncements();

        const nonDeletedCloudAnns = data.announcements.filter(
          (a: any) => !deletedAnnIds.has(a.id) && a.status !== 'DELETED' && a._deleted !== true
        );

        const mappedAnns: Announcement[] = nonDeletedCloudAnns.map((a: any) => ({
          id: a.id,
          title: a.title,
          details: a.details || a.description || '',
          date: a.date || getNowISO().split('T')[0],
          type: a.type || 'ACTIVITY',
          createdBy: a.createdBy || 'ผู้ดูแลระบบวิชาการ',
          createdAt: a.createdAt || getNowISO(),
          updatedAt: a.updatedAt || a.createdAt || getNowISO(),
        }));

        const cloudAnnIdSet = new Set(mappedAnns.map((a) => a.id));
        for (const localAnn of currentAnns) {
          if (!cloudAnnIdSet.has(localAnn.id)) {
            this.addDeletedAnnId(localAnn.id);
            hasChanges = true;
          }
        }

        const freshDeletedAnnIds = this.getDeletedAnnIds();
        const finalAnns = mappedAnns.filter((a) => !freshDeletedAnnIds.has(a.id));

        if (hasChanges || finalAnns.length !== currentAnns.length) {
          localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(finalAnns));
          hasChanges = true;
        }
      }

      // 5. Sync Documents (Honor deletion tombstones)
      if (data.documents && Array.isArray(data.documents)) {
        const deletedDocIds = this.getDeletedDocIds();
        const currentDocs = this.getDocuments();

        const nonDeletedCloudDocs = data.documents.filter(
          (d: any) => !deletedDocIds.has(d.id) && d.status !== 'DELETED' && d._deleted !== true
        );

        const mappedDocs: DocumentItem[] = nonDeletedCloudDocs.map((d: any) => ({
          id: d.id,
          title: d.title,
          category: d.category || 'SAMPLE_DOC',
          description: d.description || '',
          fileName: d.fileName || `${d.title}.docx`,
          fileType: d.fileType || 'docx',
          fileSize: d.fileSize || '1.0 MB',
          fileUrl: d.fileUrl || '',
          gDriveFolderId: d.gDriveFolderId || GDRIVE_FOLDER_ID,
          uploadedBy: d.uploadedBy || 'ผู้ดูแลระบบวิชาการ',
          createdAt: d.createdAt || getNowISO(),
          updatedAt: d.updatedAt || d.createdAt || getNowISO(),
        }));

        const mergedDocsMap = new Map<string, DocumentItem>();
        mappedDocs.forEach((d) => mergedDocsMap.set(d.id, d));
        currentDocs.forEach((d) => {
          if (!deletedDocIds.has(d.id) && !mergedDocsMap.has(d.id)) {
            mergedDocsMap.set(d.id, d);
          }
        });

        const finalDocs = Array.from(mergedDocsMap.values()).filter((d) => !deletedDocIds.has(d.id));
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(finalDocs));
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
