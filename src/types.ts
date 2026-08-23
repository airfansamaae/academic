export type UserRole = 'ADMIN' | 'MEMBER';
export type UserStatus = 'ACTIVE' | 'PENDING';

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  school: string;
  avatarUrl: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  dueDate: string; // YYYY-MM-DD
  assignedBy: string;
  gDriveFolderId: string;
  gDriveFolderUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type AnnouncementType = 'ANNOUNCEMENT' | 'HOLIDAY' | 'ACTIVITY';

export interface Announcement {
  id: string;
  title: string;
  details: string;
  date: string; // YYYY-MM-DD
  type: AnnouncementType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionFile {
  id: string;
  name: string;
  size: number;
  type: string;
  gDriveUrl: string;
  uploadedAt: string;
  previewUrl?: string;
}

export type SubmissionStatus = 'SUBMITTED' | 'REVIEWED' | 'NEEDS_REVISION';

export interface Submission {
  id: string;
  taskId: string;
  taskTitle: string;
  memberId: string;
  memberName: string;
  memberSchool: string;
  memberAvatar?: string;
  subject: string;
  description?: string;
  files: SubmissionFile[];
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  feedback?: string;
  feedbackEmoji?: string;
  score?: number;
  checkedBy?: string;
}

export type DocumentCategory = 'SAMPLE_DOC' | 'OFFICIAL_ORDER'; // 1. เอกสารตัวอย่าง 2. หนังสือคำสั่ง

export interface DocumentItem {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  gDriveFolderId: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  schoolName: string;
  schoolLogoUrl: string;
  footerText: string;
  gDriveFolderId: string;
  gasWebhookUrl?: string;
  cloudflareDbId: string;
  updatedAt: string;
}

export type NavigationTab = 'DASHBOARD' | 'ASSIGN_SUBMIT' | 'TRACKING_REVIEW' | 'DOCUMENT_CENTER';
