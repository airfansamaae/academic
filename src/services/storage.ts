import {
  User,
  Task,
  Announcement,
  Submission,
  DocumentItem,
  SystemSettings,
  SubmissionFile,
} from '../types';

export const GDRIVE_FOLDER_ID = '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu';
export const GDRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`;
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
};

const getNowISO = () => new Date().toISOString();

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
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  static getCurrentUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  static registerUser(userData: {
    fullName: string;
    username: string;
    password?: string;
    school?: string;
  }): { success: boolean; message: string; user?: User } {
    const users = this.getUsers();
    const existing = users.find((u) => u.username.toLowerCase() === userData.username.toLowerCase());
    if (existing) {
      return { success: false, message: 'ชื่อผู้ใช้นี้ (User ID) มีในระบบแล้ว กรุณาใช้ชื่ออื่น' };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      username: userData.username,
      password: userData.password || '123456',
      fullName: userData.fullName,
      school: userData.school || 'โรงเรียนวิชาการวิทยาคาร',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.username)}`,
      role: 'MEMBER',
      status: 'PENDING', // Pending approval by Admin
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };

    users.push(newUser);
    this.saveUsers(users);
    return {
      success: true,
      message: 'ลงทะเบียนสำเร็จ! กรุณารอผู้ดูแลระบบ (Admin) อนุมัติการเข้าใช้งาน',
      user: newUser,
    };
  }

  static login(
    username: string,
    password?: string
  ): { success: boolean; message: string; user?: User } {
    try {
      const cleanUser = (username || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();
      const users = this.getUsers();

      // 1. Master Admin Login (case-insensitive for 'admin', 'administrator', or matches Admin role)
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
          return { success: true, message: 'ยินดีต้อนรับเข้าสู่ระบบในฐานะ Master Admin', user: masterAdmin };
        } else {
          return { success: false, message: 'รหัสผ่านสำหรับ Admin ไม่ถูกต้อง' };
        }
      }

      // 2. Normal Member Login
      const user = users.find(
        (u) => u.username.toLowerCase() === cleanUser
      );

      if (!user) {
        return { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' };
      }

      if (cleanPass && user.password && user.password !== cleanPass) {
        return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
      }

      if (user.status === 'PENDING') {
        return {
          success: false,
          message: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) อนุมัติ โปรดติดต่อเจ้าหน้าที่',
        };
      }

      this.setCurrentUser(user);
      return { success: true, message: `ยินดีต้อนรับคุณ ${user.fullName}`, user };
    } catch (e) {
      console.error('Login error:', e);
      // Fallback emergency admin login
      if ((username || '').trim().toLowerCase() === 'admin' && (password || '').trim() === '456789') {
        const adminUser = { ...INITIAL_USERS[0] };
        this.setCurrentUser(adminUser);
        return { success: true, message: 'ยินดีต้อนรับเข้าสู่ระบบในฐานะ Master Admin', user: adminUser };
      }
      return { success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' };
    }
  }

  static approveUser(userId: string): void {
    const users = this.getUsers().map((u) => {
      if (u.id === userId) {
        return { ...u, status: 'ACTIVE' as const, updatedAt: getNowISO() };
      }
      return u;
    });
    this.saveUsers(users);
  }

  static deleteUser(userId: string): void {
    const users = this.getUsers().filter((u) => u.id !== userId);
    this.saveUsers(users);
  }

  static updateUser(updatedUser: User): void {
    const users = this.getUsers().map((u) =>
      u.id === updatedUser.id ? { ...updatedUser, updatedAt: getNowISO() } : u
    );
    this.saveUsers(users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === updatedUser.id) {
      this.setCurrentUser({ ...updatedUser, updatedAt: getNowISO() });
    }
  }

  // --- TASKS ---
  static getTasks(): Task[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_TASKS;
    }
  }

  static saveTasks(tasks: Task[]): void {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  static createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'gDriveFolderId'>): Task {
    const tasks = this.getTasks();
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}`,
      gDriveFolderId: GDRIVE_FOLDER_ID,
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    return newTask;
  }

  static updateTask(task: Task): void {
    const tasks = this.getTasks().map((t) =>
      t.id === task.id ? { ...task, updatedAt: getNowISO() } : t
    );
    this.saveTasks(tasks);
  }

  static deleteTask(taskId: string): void {
    const tasks = this.getTasks().filter((t) => t.id !== taskId);
    this.saveTasks(tasks);
  }

  // --- ANNOUNCEMENTS ---
  static getAnnouncements(): Announcement[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
      return INITIAL_ANNOUNCEMENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_ANNOUNCEMENTS;
    }
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
    return newAnn;
  }

  static deleteAnnouncement(id: string): void {
    const list = this.getAnnouncements().filter((a) => a.id !== id);
    this.saveAnnouncements(list);
  }

  // --- SUBMISSIONS ---
  static getSubmissions(): Submission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
      return INITIAL_SUBMISSIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SUBMISSIONS;
    }
  }

  static saveSubmissions(submissions: Submission[]): void {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
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
    // Check if user already submitted for this task
    const existingIndex = list.findIndex(
      (s) => s.taskId === submissionData.taskId && s.memberId === submissionData.memberId
    );

    const newSub: Submission = {
      ...submissionData,
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
    return newSub;
  }

  static updateSubmission(submission: Submission): void {
    const list = this.getSubmissions().map((s) =>
      s.id === submission.id ? { ...submission, updatedAt: getNowISO() } : s
    );
    this.saveSubmissions(list);
  }

  static deleteSubmission(submissionId: string): void {
    const list = this.getSubmissions().filter((s) => s.id !== submissionId);
    this.saveSubmissions(list);
  }

  // --- DOCUMENTS ---
  static getDocuments(): DocumentItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
      return INITIAL_DOCUMENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_DOCUMENTS;
    }
  }

  static saveDocuments(docs: DocumentItem[]): void {
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  }

  static createDocument(
    doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'gDriveFolderId'>
  ): DocumentItem {
    const list = this.getDocuments();
    const newDoc: DocumentItem = {
      ...doc,
      id: `doc-${Date.now()}`,
      gDriveFolderId: GDRIVE_FOLDER_ID,
      createdAt: getNowISO(),
      updatedAt: getNowISO(),
    };
    list.unshift(newDoc);
    this.saveDocuments(list);
    return newDoc;
  }

  static updateDocument(doc: DocumentItem): void {
    const list = this.getDocuments().map((d) =>
      d.id === doc.id ? { ...doc, updatedAt: getNowISO() } : d
    );
    this.saveDocuments(list);
  }

  static deleteDocument(id: string): void {
    const list = this.getDocuments().filter((d) => d.id !== id);
    this.saveDocuments(list);
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
    const updated = { ...settings, updatedAt: getNowISO() };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  }
}
