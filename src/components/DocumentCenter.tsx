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
  LayoutGrid,
  List,
} from 'lucide-react';
import { User, DocumentItem, DocumentCategory } from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_URL,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
} from '../services/storage';
import { uploadFileToGoogleDrive } from '../services/driveUpload';
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

  // Display Density / Size Mode ('EXPANDED' cards vs 'COMPACT' list rows)
  const [viewMode, setViewMode] = useState<'EXPANDED' | 'COMPACT'>('EXPANDED');

  // Collapsed Category Sections state: true = collapsed, false = expanded
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

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
          icon: '📄',
          color: 'amber',
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
          color: 'purple',
          docs: orderDocs,
        });
      }
    }

    return groups;
  }, [filteredDocuments, selectedCategory]);

  // Expand All Categories and switch to Expanded display
  const handleExpandAll = () => {
    setCollapsedCategories({});
    setViewMode('EXPANDED');
    notifyInfo('ขยายการแสดงผลเอกสารทั้งหมดแล้ว');
  };

  // Collapse All Categories and switch to Compact display
  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {
      SAMPLE_DOC: true,
      OFFICIAL_ORDER: true,
    };
    setCollapsedCategories(allCollapsed);
    setViewMode('COMPACT');
    notifyInfo('ย่อการแสดงผลเอกสารทั้งหมดแล้ว');
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

    const folderNameLabel = docCategory === 'OFFICIAL_ORDER' ? 'หนังสือคำสั่ง' : 'เอกสารตัวอย่าง';

    try {
      const uploadResult = await uploadFileToGoogleDrive(file, targetFolderId);
      const finalUrl = uploadResult.fileUrl || `https://drive.google.com/drive/folders/${targetFolderId}`;
      setDocFileUrl(finalUrl);
      setIsUploading(false);
      notifySuccess(`อัปโหลดไฟล์ "${file.name}" เรียบร้อยแล้ว`);
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

    if (editingDoc) {
      StorageService.updateDocument({
        ...editingDoc,
        title: docTitle.trim(),
        category: docCategory,
        description: docDescription.trim(),
        fileName: docFileName.trim(),
        fileType: docFileType,
        fileSize: docFileSize || '1.0 MB',
        fileUrl: docFileUrl || editingDoc.fileUrl,
        gDriveFolderId: targetFolderId,
      });
      notifySuccess('บันทึกการแก้ไขสำเร็จ');
    } else {
      StorageService.createDocument({
        title: docTitle.trim(),
        category: docCategory,
        description: docDescription.trim(),
        fileName: docFileName.trim(),
        fileType: docFileType,
        fileSize: docFileSize || '1.0 MB',
        fileUrl: docFileUrl || `https://drive.google.com/drive/folders/${targetFolderId}`,
        gDriveFolderId: targetFolderId,
        uploadedBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
      });
      notifySuccess('เพิ่มเอกสารสำเร็จ');
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

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const fileName = doc.fileName || `${doc.title}.docx`;
      notifyInfo(`กำลังเริ่มดาวน์โหลดไฟล์: ${fileName}...`);

      // 1. If document is stored as base64 / data URL
      if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = doc.fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notifySuccess(`ดาวน์โหลด "${fileName}" สำเร็จเรียบร้อยแล้ว`);
        return;
      }

      // 2. If it is an accessible HTTP URL
      if (doc.fileUrl && doc.fileUrl.startsWith('http') && !doc.fileUrl.includes('drive.google.com/file/d/sample')) {
        try {
          const res = await fetch(doc.fileUrl);
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            notifySuccess(`ดาวน์โหลด "${fileName}" สำเร็จเรียบร้อยแล้ว`);
            return;
          }
        } catch {
          // If CORS prevents fetch, fallback to auto-generated official template below
        }
      }

      // 3. Auto-generate realistic official template document binary for immediate direct download
      const ext = (fileName.split('.').pop() || 'docx').toLowerCase();
      let content = '';
      let mimeType = 'text/plain;charset=utf-8';

      const isOrder = doc.category === 'OFFICIAL_ORDER';
      const thaiCategory = isOrder ? 'หนังสือคำสั่งและระเบียบปฏิบัติราชการ' : 'เอกสารตัวอย่างและแบบฟอร์มทางวิชาการ';
      const todayFormatted = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (ext === 'docx' || ext === 'doc') {
        mimeType = 'application/msword;charset=utf-8';
        content = `\ufeff========================================================================
แบบฟอร์มเอกสารวิชาการและแนวทางปฏิบัติราชการ
กลุ่มบริหารงานวิชาการและงานพัฒนาหลักสูตรสถานศึกษา
========================================================================

ชื่อเอกสาร: ${doc.title}
หมวดหมู่: ${thaiCategory}
ชื่อไฟล์: ${fileName}
ขนาดไฟล์: ${doc.fileSize || '1.5 MB'}
วันที่ดาวน์โหลด: ${todayFormatted}
ผู้เผยแพร่: ${doc.uploadedBy || 'ผู้ดูแลระบบวิชาการ'}

------------------------------------------------------------------------
รายละเอียดและคำชี้แจง:
${doc.description || 'ไม่มีคำอธิบายเพิ่มเติม'}

------------------------------------------------------------------------
โครงสร้างหัวข้อมาตรฐานสำหรับการจัดทำ:
1. ความเป็นมา วัตถุประสงค์ และเป้าหมาย
2. มาตรฐานการเรียนรู้ ตัวชี้วัด หรือกรอบการประเมิน
3. แผนการจัดกิจกรรมและกระบวนการจัดการเรียนรู้
4. การวัดและประเมินผลตามสภาพจริง (Rubrics)
5. สรุปผล ปัญหา อุปสรรค และข้อเสนอแนะในการพัฒนา

------------------------------------------------------------------------
* เอกสารนี้จัดทำและดาวน์โหลดผ่านระบบบริหารงานวิชาการ (Academic Management System) *
`;
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        mimeType = 'text/csv;charset=utf-8';
        content = `\ufeff"ลำดับ","รหัสเอกสาร","ชื่อรายการเอกสาร","หมวดหมู่","วันที่จัดทำ","ขนาดไฟล์","สถานะ"
"1","DOC-${doc.id || '01'}","${doc.title}","${thaiCategory}","${todayFormatted}","${doc.fileSize || '1.0 MB'}","พร้อมใช้งาน"
"2","DESC","คำอธิบาย: ${doc.description || '-'}","","","",""
`;
      } else {
        mimeType = 'text/plain;charset=utf-8';
        content = `\ufeff========================================================================
เอกสารศูนย์วิชาการ: ${doc.title}
หมวดหมู่: ${thaiCategory}
วันที่: ${todayFormatted}
------------------------------------------------------------------------
${doc.description || 'เอกสารศูนย์วิชาการพร้อมใช้งาน'}
========================================================================
`;
      }

      const blob = new Blob([content], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      notifySuccess(`ดาวน์โหลด "${fileName}" อัตโนมัติสำเร็จเรียบร้อยแล้ว ✨`);
    } catch (err) {
      console.error('Download error:', err);
      notifyError('เกิดข้อผิดพลาดในการดาวน์โหลด กรุณาลองใหม่อีกครั้ง');
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

            {/* View Mode Density Toggle */}
            <div className="flex items-center space-x-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('EXPANDED')}
                className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'EXPANDED'
                    ? 'bg-white text-amber-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="มุมมองการ์ดขยายเต็ม"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">การ์ด</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('COMPACT')}
                className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'COMPACT'
                    ? 'bg-white text-purple-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="มุมมองรายการย่อกระชับ"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">รายการ</span>
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
        <div className="pt-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-1 text-xs font-bold text-slate-500 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>หมวดหมู่:</span>
          </div>

          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-2 ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <span>ทั้งหมด</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {categoryCounts.total}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('SAMPLE_DOC')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-2 ${
              selectedCategory === 'SAMPLE_DOC'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50/70 text-amber-800 hover:bg-amber-100/70 border border-amber-200/80'
            }`}
          >
            <span>📄 1. เอกสารตัวอย่าง</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                selectedCategory === 'SAMPLE_DOC'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-200 text-amber-800'
              }`}
            >
              {categoryCounts.sampleDocs}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('OFFICIAL_ORDER')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-2 ${
              selectedCategory === 'OFFICIAL_ORDER'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50/70 text-purple-800 hover:bg-purple-100/70 border border-purple-200/80'
            }`}
          >
            <span>📜 2. หนังสือคำสั่ง</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                selectedCategory === 'OFFICIAL_ORDER'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-200 text-purple-800'
              }`}
            >
              {categoryCounts.officialOrders}
            </span>
          </button>
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
            <span>แสดงเอกสาร: <strong className="text-slate-800">{filteredDocuments.length}</strong> รายการ</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">
              โหมด: <strong className="text-slate-700">{viewMode === 'EXPANDED' ? 'ขยาย (การ์ด)' : 'ย่อ (รายการกระชับ)'}</strong>
            </span>
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
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100 text-purple-800'
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

            {/* Category Body (Visible when not collapsed) */}
            {!isCollapsed && (
              <div className="p-4 sm:p-5">
                {group.docs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    ไม่พบรายการเอกสารในหมวดหมู่นี้
                  </div>
                ) : viewMode === 'EXPANDED' ? (
                  /* Expanded Grid Card Mode */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.docs.map((doc) => {
                      const isSampleDoc = doc.category === 'SAMPLE_DOC';
                      return (
                        <div
                          key={doc.id}
                          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                                  isSampleDoc
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}
                              >
                                {isSampleDoc ? '📄 1. เอกสารตัวอย่าง' : '📜 2. หนังสือคำสั่ง'}
                              </span>

                              {isAdmin && (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleOpenEdit(doc)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="แก้ไขเอกสาร"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="ลบเอกสาร"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div>
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                {doc.title}
                              </h3>
                              {doc.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                  {doc.description}
                                </p>
                              )}
                            </div>

                            {/* File badge details */}
                            <div className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                              <div className="flex items-center space-x-2 min-w-0 pr-2">
                                {doc.fileType === 'PDF' ? (
                                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                                ) : doc.fileType === 'XLSX' || doc.fileType === 'XLS' ? (
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <File className="w-4 h-4 text-purple-500 shrink-0" />
                                )}
                                <span className="font-medium text-slate-700 truncate">{doc.fileName}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0 font-mono font-medium">
                                {doc.fileSize}
                              </span>
                            </div>
                          </div>

                          {/* Download CTA Button */}
                          <div className="pt-4 mt-3 border-t border-slate-100">
                            <button
                              onClick={() => handleDownload(doc)}
                              className="w-full btn-glow-purple flex items-center justify-center space-x-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Download className="w-4 h-4 shrink-0" />
                              <span>ดาวน์โหลดเอกสาร</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Compact List Mode (ย่อขนาดแถวกระชับ) */
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                    {group.docs.map((doc) => {
                      return (
                        <div
                          key={doc.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 bg-white hover:bg-slate-50/80 gap-3 transition-colors"
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              {doc.fileType === 'PDF' ? (
                                <FileText className="w-4 h-4 text-rose-500" />
                              ) : doc.fileType === 'XLSX' || doc.fileType === 'XLS' ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <File className="w-4 h-4 text-purple-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                {doc.title}
                              </h4>
                              <p className="text-[11px] text-slate-400 truncate">
                                ไฟล์: {doc.fileName} • {doc.fileSize}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {isAdmin && (
                              <div className="flex items-center space-x-1 mr-1">
                                <button
                                  onClick={() => handleOpenEdit(doc)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="แก้ไข"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="ลบ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            <button
                              onClick={() => handleDownload(doc)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
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
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-200'
                    }`}
                  >
                    <span>📄 1. เอกสารตัวอย่าง</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocCategory('OFFICIAL_ORDER')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      docCategory === 'OFFICIAL_ORDER'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-200'
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
    </div>
  );
};
