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
} from 'lucide-react';
import { User, DocumentItem, DocumentCategory } from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_URL,
} from '../services/storage';
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

  const handleFileSelect = (files: FileList | null) => {
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

    const reader = new FileReader();
    reader.onload = (e) => {
      setDocFileUrl(e.target?.result as string);
      setIsUploading(false);
      notifySuccess(`แนบไฟล์ ${file.name} เรียบร้อยแล้ว`);
    };
    reader.onerror = () => {
      setIsUploading(false);
      notifyError('เกิดข้อผิดพลาดในการอ่านไฟล์');
    };
    reader.readAsDataURL(file);
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
      });
      notifySuccess('อัปเดตข้อมูลเอกสารสำเร็จ');
    } else {
      StorageService.createDocument({
        title: docTitle.trim(),
        category: docCategory,
        description: docDescription.trim(),
        fileName: docFileName.trim(),
        fileType: docFileType,
        fileSize: docFileSize || '1.0 MB',
        fileUrl: docFileUrl || `https://drive.google.com/file/d/doc_${Date.now()}/view`,
        uploadedBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
      });
      notifySuccess('เพิ่มเอกสารใหม่เข้าสู่ระบบสำเร็จ');
    }

    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDeleteDoc = async (docId: string) => {
    const ok = await confirmDialog(
      'ยืนยันการลบเอกสารนี้?',
      'เอกสารจะถูกนำออกจากศูนย์เอกสารวิชาการ'
    );
    if (ok) {
      StorageService.deleteDocument(docId);
      notifySuccess('ลบเอกสารเรียบร้อยแล้ว');
      onRefreshData();
    }
  };

  const handleDownload = (doc: DocumentItem) => {
    notifyInfo(`กำลังดึงไฟล์ ${doc.fileName}...`);
    setTimeout(() => {
      if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = doc.fileUrl;
        a.download = doc.fileName;
        a.click();
      } else {
        window.open(GDRIVE_FOLDER_URL, '_blank');
      }
      notifySuccess(`ดาวน์โหลด ${doc.fileName} สำเร็จ`);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Academic Document Repository
              </h2>
              <p className="text-xs text-slate-400">
                ศูนย์รวบรวมเอกสารวิชาการ แบบฟอร์ม คู่มือ และหนังสือคำสั่งราชการ
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin && (
              <button
                onClick={handleOpenAdd}
                className="btn-glow-amber inline-flex items-center space-x-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap"
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
            <span>เลือกหมวดหมู่:</span>
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
            <span>1. เอกสารตัวอย่าง</span>
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
            <span>2. หนังสือคำสั่ง</span>
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
          <div className="text-xs text-slate-500 font-medium">
            แสดงเอกสาร: <span className="font-bold text-slate-800">{filteredDocuments.length}</span> รายการ
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDocuments.map((doc) => {
          const isSampleDoc = doc.category === 'SAMPLE_DOC';
          return (
            <div
              key={doc.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs card-hover-effect flex flex-col justify-between"
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
                <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
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
                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">
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
