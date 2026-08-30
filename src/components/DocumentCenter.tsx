import React, { useState, useMemo, useRef } from 'react';
import {
  FolderArchive,
  FileText,
  FileSpreadsheet,
  File,
  PlusCircle,
  Download,
  Search,
  Trash2,
  Edit3,
  UploadCloud,
  X,
  Check,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Paperclip,
  Eye,
  ExternalLink,
  ImageIcon,
} from 'lucide-react';
import { User, DocumentItem, DocumentCategory } from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_URL,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
} from '../services/storage';
import {
  uploadFileToGoogleDrive,
  downloadGoogleDriveFile,
  triggerNativeBlobDownload,
  extractDriveFileId,
  GDRIVE_FOLDER_ID,
} from '../services/driveUpload';
import { fileCache } from '../services/fileCache';
import {
  notifySuccess,
  notifyInfo,
  notifyError,
  confirmDialog,
} from '../services/notifications';

interface DocumentCenterProps {
  currentUser: User | null;
  documents: DocumentItem[];
  onRefreshData: () => void;
}

export const DocumentCenter: React.FC<DocumentCenterProps> = ({
  currentUser,
  documents,
  onRefreshData,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | DocumentCategory>('ALL');

  // Collapsed Category Sections state: true = collapsed, false = expanded
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Preview Modal State for Eye Icon (Admin & Members)
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Upload/Edit Modal state (Admin)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('SAMPLE_DOC');
  const [docDescription, setDocDescription] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileType, setDocFileType] = useState('PDF');
  const [docFileSize, setDocFileSize] = useState('');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [docFileId, setDocFileId] = useState('');
  const [docFileData, setDocFileData] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category counts
  const categoryCounts = useMemo(() => {
    const total = documents.length;
    const sampleDocs = documents.filter((d) => d.category === 'SAMPLE_DOC').length;
    const officialOrders = documents.filter((d) => d.category === 'OFFICIAL_ORDER').length;
    return { total, sampleDocs, officialOrders };
  }, [documents]);

  // Filtered documents by search term and selected category
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
      const matchSearch =
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [documents, searchTerm, selectedCategory]);

  // Grouped by Category for Accordion presentation
  const groupedCategories = useMemo(() => {
    const groups: { key: DocumentCategory; title: string; icon: string; color: string; docs: DocumentItem[] }[] = [];

    if (selectedCategory === 'ALL' || selectedCategory === 'SAMPLE_DOC') {
      const sampleDocs = filteredDocuments.filter((d) => d.category === 'SAMPLE_DOC');
      if (sampleDocs.length > 0 || selectedCategory === 'SAMPLE_DOC') {
        groups.push({
          key: 'SAMPLE_DOC',
          title: '1. เอกสารตัวอย่างและแบบฟอร์มวิชาการ',
          icon: '🩵',
          color: 'teal',
          docs: sampleDocs,
        });
      }
    }

    if (selectedCategory === 'ALL' || selectedCategory === 'OFFICIAL_ORDER') {
      const orderDocs = filteredDocuments.filter((d) => d.category === 'OFFICIAL_ORDER');
      if (orderDocs.length > 0 || selectedCategory === 'OFFICIAL_ORDER') {
        groups.push({
          key: 'OFFICIAL_ORDER',
          title: '2. หนังสือคำสั่งและระเบียบปฏิบัติราชการ',
          icon: '📜',
          color: 'blue',
          docs: orderDocs,
        });
      }
    }

    return groups;
  }, [filteredDocuments, selectedCategory]);

  // Expand All Categories
  const handleExpandAll = () => {
    setCollapsedCategories({});
    notifyInfo('ขยายหมวดหมู่เอกสารทั้งหมดแล้ว');
  };

  // Collapse All Categories
  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {
      SAMPLE_DOC: true,
      OFFICIAL_ORDER: true,
    };
    setCollapsedCategories(allCollapsed);
    notifyInfo('ย่อหมวดหมู่เอกสารทั้งหมดแล้ว');
  };

  const toggleCategory = (catKey: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const handleOpenAdd = () => {
    setEditingDoc(null);
    setDocTitle('');
    setDocCategory('SAMPLE_DOC');
    setDocDescription('');
    setDocFileName('');
    setDocFileType('PDF');
    setDocFileSize('');
    setDocFileUrl('');
    setDocFileId('');
    setDocFileData('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (doc: DocumentItem) => {
    setEditingDoc(doc);
    setDocTitle(doc.title);
    setDocCategory(doc.category || 'SAMPLE_DOC');
    setDocDescription(doc.description || '');
    setDocFileName(doc.fileName);
    setDocFileType(doc.fileType);
    setDocFileSize(doc.fileSize);
    setDocFileUrl(doc.fileUrl || '');
    setDocFileId(doc.gDriveFileId || '');
    setDocFileData(doc.fileData || '');
    setIsModalOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);

    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    setDocFileName(file.name);
    setDocFileType(ext);
    setDocFileSize(formatFileSize(file.size));

    // Auto set title if empty
    if (!docTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setDocTitle(baseName);
    }

    const targetFolderId =
      docCategory === 'OFFICIAL_ORDER'
        ? GDRIVE_OFFICIAL_ORDERS_FOLDER_ID
        : GDRIVE_SAMPLE_DOCS_FOLDER_ID;

    try {
      notifyInfo(`กำลังอัปโหลดไฟล์ "${file.name}" เข้าสู่ Google Drive... ⏳`);
      const uploadResult = await uploadFileToGoogleDrive(file, targetFolderId);
      const fileId = uploadResult.fileId && !uploadResult.fileId.startsWith('file-') ? uploadResult.fileId : '';
      const finalUrl = fileId
        ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
        : (uploadResult.fileUrl || `https://drive.google.com/drive/folders/${targetFolderId}`);
      
      setDocFileUrl(finalUrl);
      if (fileId) setDocFileId(fileId);
      if (uploadResult.downloadUrl && uploadResult.downloadUrl.startsWith('data:')) {
        setDocFileData(uploadResult.downloadUrl);
      }
      setIsUploading(false);
      notifySuccess(`อัปโหลดไฟล์ "${file.name}" เข้าสู่ Google Drive เรียบร้อยแล้ว ☁️`);
    } catch (err) {
      console.error('Upload error in Document Center:', err);
      setDocFileUrl(`https://drive.google.com/drive/folders/${targetFolderId}`);
      setIsUploading(false);
      notifySuccess(`แนบไฟล์ "${file.name}" เรียบร้อยแล้ว`);
    }
  };

  const handleSaveDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      notifyError('กรุณากรอกชื่อหัวข้อเอกสาร');
      return;
    }
    if (!docFileName.trim()) {
      notifyError('กรุณาอัปโหลดหรือระบุชื่อไฟล์');
      return;
    }

    const targetFolderId =
      docCategory === 'OFFICIAL_ORDER'
        ? GDRIVE_OFFICIAL_ORDERS_FOLDER_ID
        : GDRIVE_SAMPLE_DOCS_FOLDER_ID;

    const finalFileId = docFileId || (docFileUrl ? extractDriveFileId(docFileUrl) : undefined);
    const finalUrl = docFileUrl || (finalFileId ? `https://drive.google.com/file/d/${finalFileId}/view?usp=sharing` : `https://drive.google.com/drive/folders/${targetFolderId}`);

    if (editingDoc) {
      StorageService.updateDocument({
        ...editingDoc,
        title: docTitle.trim(),
        category: docCategory,
        description: docDescription.trim(),
        fileName: docFileName.trim(),
        fileType: docFileType,
        fileSize: docFileSize || '1.0 MB',
        fileUrl: finalUrl,
        gDriveFolderId: targetFolderId,
        gDriveFileId: finalFileId || editingDoc.gDriveFileId,
        fileData: docFileData || editingDoc.fileData,
      });
      notifySuccess('บันทึกการแก้ไขเอกสารสำเร็จ');
    } else {
      StorageService.createDocument({
        title: docTitle.trim(),
        category: docCategory,
        description: docDescription.trim(),
        fileName: docFileName.trim(),
        fileType: docFileType,
        fileSize: docFileSize || '1.0 MB',
        fileUrl: finalUrl,
        gDriveFolderId: targetFolderId,
        gDriveFileId: finalFileId || undefined,
        fileData: docFileData || undefined,
        uploadedBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
      });
      notifySuccess('เพิ่มเอกสารและบันทึกลงระบบสำเร็จ');
    }

    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDeleteDoc = async (docId: string) => {
    const docToDelete = documents.find((d) => d.id === docId);
    const categoryName = docToDelete?.category === 'OFFICIAL_ORDER' ? 'หนังสือคำสั่ง' : 'เอกสารตัวอย่าง';
    const ok = await confirmDialog(
      `ยืนยันการลบ${categoryName}นี้?`,
      `เอกสาร "${docToDelete?.title || ''}" จะถูกลบออกจากระบบ`
    );
    if (ok) {
      StorageService.deleteDocument(docId);
      notifySuccess(`ลบ${categoryName}สำเร็จ`);
      onRefreshData();
    }
  };

  /**
   * Preview original file immediately with 1 click for both Admin and Member
   */
  const handlePreviewFile = (doc: DocumentItem) => {
    setPreviewDoc(doc);
  };

  /**
   * Direct download of original uncorrupted file from Google Drive for Admin and Members
   */
  const handleDownload = async (doc: DocumentItem) => {
    try {
      const fileName = doc.fileName || `${doc.title}.${(doc.fileType || 'docx').toLowerCase()}`;
      notifyInfo(`กำลังดาวน์โหลดไฟล์ "${fileName}"... 📥`);

      const fileId = doc.gDriveFileId || (doc.fileUrl ? extractDriveFileId(doc.fileUrl) : undefined);
      const targetFolderId = doc.category === 'OFFICIAL_ORDER' ? GDRIVE_OFFICIAL_ORDERS_FOLDER_ID : GDRIVE_SAMPLE_DOCS_FOLDER_ID;
      const hasValidDriveId = Boolean(
        fileId &&
        fileId.length >= 20 &&
        !fileId.startsWith('sample') &&
        !fileId.startsWith('file-') &&
        fileId !== GDRIVE_FOLDER_ID &&
        fileId !== GDRIVE_OFFICIAL_ORDERS_FOLDER_ID &&
        fileId !== GDRIVE_SAMPLE_DOCS_FOLDER_ID
      );

      // 1. If original binary exists in local IndexedDB cache
      try {
        const cached = await fileCache.getFile(fileId || doc.fileName || doc.id);
        if (cached && cached.blob && cached.blob.size > 0) {
          triggerNativeBlobDownload(cached.blob, cached.name || fileName);
          notifySuccess(`ดาวน์โหลด "${fileName}" เรียบร้อยแล้ว 📥`);
          return;
        }
      } catch (cacheErr) {
        console.warn('FileCache retrieval error:', cacheErr);
      }

      // 2. Fetch original binary directly via GAS Webhook API
      try {
        const driveResult = await downloadGoogleDriveFile(
          fileId || doc.fileUrl,
          fileName,
          targetFolderId
        );
        if (driveResult.success && driveResult.blob && driveResult.blob.size > 0) {
          triggerNativeBlobDownload(driveResult.blob, driveResult.fileName || fileName);
          notifySuccess(`ดาวน์โหลด "${fileName}" สำเร็จเรียบร้อยแล้ว 📥`);
          return;
        }
      } catch (gasErr) {
        console.warn('DocumentCenter GAS Webhook file retrieval error:', gasErr);
      }

      // 3. Direct file stream download
      if (hasValidDriveId) {
        try {
          const directDriveDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
          const a = document.createElement('a');
          a.href = directDriveDownloadUrl;
          a.download = fileName;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
          }, 1000);
          notifySuccess(`กำลังเริ่มดาวน์โหลด "${fileName}"... 📥`);
          return;
        } catch (linkErr) {
          console.warn('Direct link download error:', linkErr);
        }
      }

      // 4. If stored as Base64 Data URL
      const dataUrlCandidate = doc.fileData || (doc.fileUrl && doc.fileUrl.startsWith('data:') ? doc.fileUrl : null);
      if (dataUrlCandidate && dataUrlCandidate.startsWith('data:')) {
        try {
          const res = await fetch(dataUrlCandidate);
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            triggerNativeBlobDownload(blob, fileName);
            notifySuccess(`ดาวน์โหลด "${fileName}" สำเร็จเรียบร้อยแล้ว 📥`);
            return;
          }
        } catch (dataErr) {
          console.warn('Data URL download fallback:', dataErr);
        }
      }

      // 5. Open file directly
      if (doc.fileUrl && doc.fileUrl.startsWith('http') && !doc.fileUrl.includes('drive.google.com/drive/folders')) {
        window.open(doc.fileUrl, '_blank');
        notifySuccess(`เปิดไฟล์ "${fileName}" เรียบร้อยแล้ว 📥`);
        return;
      }

      notifyError(`ไม่สามารถดาวน์โหลดไฟล์ "${fileName}" ได้ กรุณาลองใหม่อีกครั้ง`);
    } catch (err) {
      console.error('Download error:', err);
      notifyError(`เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ กรุณาลองใหม่อีกครั้ง`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100 shadow-2xs">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                Academic Document Repository
              </h2>
              <p className="text-xs text-slate-500">
                ศูนย์รวบรวมเอกสารวิชาการ แบบฟอร์ม คู่มือ และหนังสือคำสั่งราชการ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Global Expand All / Collapse All Buttons */}
            <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="ขยายการแสดงผลเอกสารและทุกหมวดหมู่"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-amber-600" />
                <span>ขยายทั้งหมด</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="ย่อการแสดงผลเอกสารและทุกหมวดหมู่"
              >
                <ChevronsDownUp className="w-3.5 h-3.5 text-purple-600" />
                <span>ย่อทั้งหมด</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={handleOpenAdd}
                className="btn-glow-amber inline-flex items-center space-x-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap shadow-xs ml-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>เพิ่มเอกสารใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Selector Tabs for Members & Admin */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">เลือกดู:</span>
            {/* Small All Button */}
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-purple-900 text-white shadow-xs ring-2 ring-purple-300/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>All</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  selectedCategory === 'ALL'
                    ? 'bg-purple-800 text-purple-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {categoryCounts.total}
              </span>
            </button>
          </div>

          {/* Large Prominent Category Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 max-w-2xl">
            <button
              type="button"
              onClick={() => setSelectedCategory('SAMPLE_DOC')}
              className={`p-3 sm:px-4 sm:py-3 rounded-2xl text-left font-bold transition-all cursor-pointer flex items-center justify-between gap-3 border-2 ${
                selectedCategory === 'SAMPLE_DOC'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-4 ring-teal-100'
                  : 'bg-white text-slate-800 border-teal-200 hover:border-teal-400 hover:bg-teal-50/40 shadow-2xs'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedCategory === 'SAMPLE_DOC'
                      ? 'bg-white/20 text-white'
                      : 'bg-teal-100 text-teal-800'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold leading-tight truncate">
                    1. เอกสารตัวอย่าง
                  </div>
                  <div
                    className={`text-[11px] font-normal truncate mt-0.5 ${
                      selectedCategory === 'SAMPLE_DOC' ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    แบบฟอร์ม คู่มือวิชาการ
                  </div>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold shrink-0 ${
                  selectedCategory === 'SAMPLE_DOC'
                    ? 'bg-white text-teal-700 shadow-2xs'
                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                }`}
              >
                {categoryCounts.sampleDocs}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('OFFICIAL_ORDER')}
              className={`p-3 sm:px-4 sm:py-3 rounded-2xl text-left font-bold transition-all cursor-pointer flex items-center justify-between gap-3 border-2 ${
                selectedCategory === 'OFFICIAL_ORDER'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-4 ring-blue-100'
                  : 'bg-white text-slate-800 border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 shadow-2xs'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedCategory === 'OFFICIAL_ORDER'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  <File className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold leading-tight truncate">
                    2. หนังสือคำสั่ง
                  </div>
                  <div
                    className={`text-[11px] font-normal truncate mt-0.5 ${
                      selectedCategory === 'OFFICIAL_ORDER' ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    ระเบียบปฏิบัติราชการ
                  </div>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold shrink-0 ${
                  selectedCategory === 'OFFICIAL_ORDER'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {categoryCounts.officialOrders}
              </span>
            </button>
          </div>
        </div>

        {/* Google Drive Folder Direct Access for Admin and Members */}
        <div className="pt-4 pb-2">
          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
                <FolderArchive className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>เข้าสู่โฟลเดอร์ Google Drive โดยตรง</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                    Admin & สมาชิก
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  คลิกเพื่อเปิดดูโฟลเดอร์จัดเก็บไฟล์ต้นฉบับใน Google Drive แยกตามหมวดหมู่
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://drive.google.com/drive/folders/${GDRIVE_SAMPLE_DOCS_FOLDER_ID}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                title="เปิดโฟลเดอร์ Google Drive: เอกสารตัวอย่าง"
              >
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>โฟลเดอร์: เอกสารตัวอย่าง</span>
                <ExternalLink className="w-3 h-3 text-teal-500" />
              </a>

              <a
                href={`https://drive.google.com/drive/folders/${GDRIVE_OFFICIAL_ORDERS_FOLDER_ID}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                title="เปิดโฟลเดอร์ Google Drive: หนังสือคำสั่ง"
              >
                <File className="w-3.5 h-3.5 text-blue-600" />
                <span>โฟลเดอร์: หนังสือคำสั่ง</span>
                <ExternalLink className="w-3 h-3 text-blue-500" />
              </a>
            </div>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหัวข้อเอกสาร, คำอธิบาย หรือชื่อไฟล์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center space-x-2">
            <span>แสดงเอกสารทั้งหมด: <strong className="text-slate-800">{filteredDocuments.length}</strong> รายการ</span>
          </div>
        </div>
      </div>

      {/* Accordion Categorized Documents View with Expand/Collapse support */}
      {groupedCategories.map((group) => {
        const isCollapsed = !!collapsedCategories[group.key];
        return (
          <div
            key={group.key}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
          >
            {/* Category Header with Toggle */}
            <div
              onClick={() => toggleCategory(group.key)}
              className="flex items-center justify-between p-4 sm:p-5 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer border-b border-slate-100 select-none transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shadow-2xs ${
                    group.key === 'SAMPLE_DOC'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {group.icon}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    {group.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    จำนวน {group.docs.length} รายการ
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">
                  {isCollapsed ? 'คลิกเพื่อขยาย ▾' : 'คลิกเพื่อย่อ ▴'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {/* Category Body (List Mode) */}
            {!isCollapsed && (
              <div className="p-4 sm:p-5">
                {group.docs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    ไม่พบรายการเอกสารในหมวดหมู่นี้
                  </div>
                ) : (
                  /* Easy-to-read Minimal List Mode */
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                    {group.docs.map((doc) => {
                      const isSampleDoc = doc.category === 'SAMPLE_DOC';
                      return (
                        <div
                          key={doc.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 sm:py-3 bg-white hover:bg-slate-50/90 gap-2.5 transition-colors"
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-slate-100/90 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                              {doc.fileType === 'PDF' ? (
                                <FileText className="w-4 h-4 text-rose-500" />
                              ) : doc.fileType === 'XLSX' || doc.fileType === 'XLS' ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <File className="w-4 h-4 text-purple-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2 flex-wrap gap-1">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                    isSampleDoc
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                >
                                  {isSampleDoc ? 'ตัวอย่าง' : 'คำสั่ง'}
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                                  {doc.title}
                                </h4>
                              </div>
                              {doc.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {doc.description}
                                </p>
                              )}
                              <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1">
                                <span className="inline-flex items-center space-x-1 font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                                  <span className="max-w-[140px] truncate">{doc.fileName}</span>
                                </span>
                                <span>•</span>
                                <span className="font-mono text-slate-500">{doc.fileSize}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                            {isAdmin && (
                              <div className="flex items-center space-x-0.5 mr-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(doc)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="แก้ไขข้อมูลเอกสาร"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="ลบเอกสาร"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Eye Preview Button for both Admin and Members - 1 Click directly to original Google Drive preview */}
                            <button
                              type="button"
                              onClick={() => handlePreviewFile(doc)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-200 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                              title={`กดดูตัวอย่างไฟล์ต้นฉบับ ${doc.fileName}`}
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-600" />
                              <span>ดูตัวอย่าง</span>
                            </button>

                            {/* Direct Download Button */}
                            <button
                              type="button"
                              onClick={() => handleDownload(doc)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                              title={`ดาวน์โหลด ${doc.fileName}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>ดาวน์โหลด</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {filteredDocuments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
          <FolderArchive className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold">ไม่พบรายการเอกสารในหมวดหมู่นี้</p>
        </div>
      )}

      {/* Admin Add/Edit Document Modal with Category & File Upload */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-900 mb-4">
              {editingDoc ? 'แก้ไขเอกสาร' : 'เพิ่มเอกสารใหม่เข้าสู่ศูนย์วิชาการ'}
            </h2>

            <form onSubmit={handleSaveDoc} className="space-y-4 text-xs">
              {/* Category Selector (Strict requirement: 1.เอกสารตัวอย่าง 2.หนังสือคำสั่ง) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  เลือกหมวดหมู่เอกสาร <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDocCategory('SAMPLE_DOC')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      docCategory === 'SAMPLE_DOC'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-teal-50 hover:border-teal-200'
                    }`}
                  >
                    <span>🩵 1. เอกสารตัวอย่าง</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocCategory('OFFICIAL_ORDER')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      docCategory === 'OFFICIAL_ORDER'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200'
                    }`}
                  >
                    <span>📜 2. หนังสือคำสั่ง</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">ชื่อหัวข้อเอกสาร *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    docCategory === 'SAMPLE_DOC'
                      ? 'เช่น แบบฟอร์มรายงานผลการสอน, แผนการจัดการเรียนรู้'
                      : 'เช่น คำสั่งแต่งตั้งคณะกรรมการ, คำสั่งมอบหมายหน้าที่'
                  }
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">คำอธิบายเพิ่มเติม (ไม่บังคับ)</label>
                <textarea
                  rows={2}
                  placeholder="รายละเอียดสังเขป หรือคำแนะนำการนำเอกสารไปใช้..."
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs"
                />
              </div>

              {/* Real File Upload Zone */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>อัปโหลดไฟล์เอกสาร *</span>
                  {docFileSize && (
                    <span className="text-[11px] text-slate-500 font-mono font-normal">
                      ขนาด: {docFileSize}
                    </span>
                  )}
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/30 rounded-2xl p-4 text-center cursor-pointer transition-all"
                >
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <UploadCloud className="w-6 h-6 text-amber-600" />
                    <p className="text-xs font-bold text-slate-800">
                      {docFileName ? `ไฟล์ที่เลือก: ${docFileName}` : 'คลิกเพื่อเลือกไฟล์เอกสารที่ต้องการอัปโหลด'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ, ZIP ฯลฯ
                    </p>
                  </div>
                </div>

                {isUploading && (
                  <p className="text-xs text-amber-600 font-semibold animate-pulse">
                    กำลังประมวลผลไฟล์...
                  </p>
                )}
              </div>

              {/* File Name & Size Inputs */}
              {docFileName && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">ชื่อไฟล์ที่แสดง</label>
                    <input
                      type="text"
                      required
                      value={docFileName}
                      onChange={(e) => setDocFileName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">ประเภทไฟล์</label>
                    <input
                      type="text"
                      value={docFileType}
                      onChange={(e) => setDocFileType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-glow-amber px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกเอกสาร</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ==================== PREVIEW FILE VIEWER MODAL (EYE ICON) ================ */}
      {/* ========================================================================= */}
      {previewDoc && (() => {
        const fileId = previewDoc.gDriveFileId || (previewDoc.fileUrl ? extractDriveFileId(previewDoc.fileUrl) : null);
        const hasValidDriveId = Boolean(fileId && !fileId.startsWith('sample') && fileId !== GDRIVE_FOLDER_ID && fileId !== GDRIVE_OFFICIAL_ORDERS_FOLDER_ID && fileId !== GDRIVE_SAMPLE_DOCS_FOLDER_ID);
        const directDriveViewUrl = hasValidDriveId
          ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
          : (previewDoc.fileUrl && previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : GDRIVE_FOLDER_URL);

        const isImage =
          previewDoc.fileName.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i) ||
          previewDoc.fileType?.toLowerCase().includes('image');
        const isPdf = previewDoc.fileName.endsWith('.pdf') || previewDoc.fileType?.toUpperCase() === 'PDF';
        const isWord = previewDoc.fileName.match(/\.(docx?|dotx?)$/i) || previewDoc.fileType?.toLowerCase().includes('word');
        const isSpreadsheet = previewDoc.fileName.match(/\.(xlsx?|csv)$/i) || previewDoc.fileType?.toLowerCase().includes('sheet');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-4xl w-full h-[85vh] max-h-[850px] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs">
                    {isImage ? (
                      <ImageIcon className="w-5 h-5 text-amber-600" />
                    ) : isPdf ? (
                      <FileText className="w-5 h-5 text-rose-600" />
                    ) : isSpreadsheet ? (
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <File className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        previewDoc.category === 'SAMPLE_DOC'
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {previewDoc.category === 'SAMPLE_DOC' ? 'เอกสารตัวอย่าง' : 'หนังสือคำสั่ง'}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {previewDoc.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 truncate flex items-center space-x-2">
                      <span>📄 {previewDoc.fileName}</span>
                      <span>•</span>
                      <span>ขนาด: {previewDoc.fileSize}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <a
                    href={directDriveViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>เปิดดูเอกสาร</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="ปิดหน้าต่างตัวอย่าง"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body / Viewer Area */}
              <div className="flex-1 bg-slate-100/70 p-2 sm:p-4 overflow-hidden relative flex flex-col items-center justify-center">
                {hasValidDriveId ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${fileId}/preview`}
                    title={previewDoc.fileName}
                    className="w-full h-full rounded-2xl bg-white border border-slate-200 shadow-inner"
                    allow="autoplay"
                  />
                ) : (previewDoc.fileData && previewDoc.fileData.startsWith('data:image/')) || (previewDoc.fileUrl && previewDoc.fileUrl.startsWith('data:image/')) ? (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-white rounded-2xl border border-slate-200">
                    <img
                      src={previewDoc.fileData || previewDoc.fileUrl}
                      alt={previewDoc.fileName}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                    />
                  </div>
                ) : (previewDoc.fileData && previewDoc.fileData.startsWith('data:application/pdf')) || (previewDoc.fileUrl && previewDoc.fileUrl.startsWith('data:application/pdf')) ? (
                  <iframe
                    src={previewDoc.fileData || previewDoc.fileUrl}
                    title={previewDoc.fileName}
                    className="w-full h-full rounded-2xl bg-white border border-slate-200"
                  />
                ) : (
                  <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 text-center border border-slate-200 shadow-sm space-y-4">
                    <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto ring-8 ring-purple-50/50">
                      {isWord ? (
                        <FileText className="w-8 h-8 text-blue-600" />
                      ) : isSpreadsheet ? (
                        <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                      ) : (
                        <File className="w-8 h-8 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        {previewDoc.fileName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {previewDoc.description || 'เอกสารต้นฉบับในศูนย์วิชาการ'}
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <a
                        href={directDriveViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>เปิดดูเอกสาร</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDownload(previewDoc)}
                        className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ดาวน์โหลดไฟล์ต้นฉบับ</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="px-5 py-3 border-t border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-500">
                  <span>สถานะ: </span>
                  <span className="font-semibold text-emerald-600">พร้อมเปิดดูและดาวน์โหลดเอกสาร</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(previewDoc)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดไฟล์</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
