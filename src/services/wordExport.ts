import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Packer,
  ShadingType,
  convertInchesToTwip,
} from 'docx';

export interface DocumentExportData {
  title: string;
  categoryName: string;
  fileName: string;
  fileSize?: string;
  publishDate: string;
  author: string;
  description?: string;
  guidelines?: string[];
}

export interface SubmissionExportData {
  subject: string;
  fileName: string;
  memberName: string;
  memberSchool?: string;
  submittedAt: string;
  statusText: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  description?: string;
}

/**
 * Creates a 100% genuine OpenXML Microsoft Word (.docx) file for Document Center items
 */
export async function createDocumentCenterDocxBlob(data: DocumentExportData): Promise<Blob> {
  const tableBorderConfig = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
  };

  const createInfoRow = (label: string, value: string, isAlternate: boolean = false) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: isAlternate ? 'F1F5F9' : 'F8FAFC' },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  font: 'TH Sarabun PSK',
                  size: 30, // 15pt
                  color: '1E293B',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: isAlternate ? 'FFFFFF' : 'FAFAFA' },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value || '-',
                  font: 'TH Sarabun PSK',
                  size: 30, // 15pt
                  color: '0F172A',
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: [
          // Header title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'แบบฟอร์มและเอกสารวิชาการสถานศึกษา',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 40, // 20pt
                color: '1E3A8A',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: 'กลุ่มบริหารงานวิชาการ • ศูนย์รวมเอกสารและมาตรฐานการจัดการศึกษา',
                font: 'TH Sarabun PSK',
                size: 28, // 14pt
                color: '64748B',
              }),
            ],
          }),

          // Heading: ข้อมูลเอกสาร
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 120 },
            children: [
              new TextRun({
                text: 'ข้อมูลรายการเอกสาร',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 32, // 16pt
                color: '0284C7',
              }),
            ],
          }),

          // Info Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              createInfoRow('ชื่อรายการเอกสาร', data.title, false),
              createInfoRow('หมวดหมู่เอกสาร', data.categoryName, true),
              createInfoRow('ชื่อไฟล์ต้นฉบับ', data.fileName, false),
              createInfoRow('ขนาดไฟล์เอกสาร', data.fileSize || '1.5 MB', true),
              createInfoRow('วันที่เผยแพร่ / ปรับปรุง', data.publishDate, false),
              createInfoRow('ผู้จัดทำ / เผยแพร่', data.author || 'กลุ่มบริหารงานวิชาการ', true),
            ],
          }),

          // Heading: คำอธิบาย
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: 'คำอธิบายและรายละเอียดการนำไปใช้',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 32, // 16pt
                color: '0284C7',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text:
                  data.description ||
                  'เอกสารนี้จัดทำขึ้นเพื่อใช้เป็นแนวทางมาตรฐานในการปฏิบัติงานวิชาการ การจัดทำหลักฐานร่องรอยการเรียนรู้ และการประเมินผลการจัดการเรียนการสอนตามเกณฑ์มาตรฐานสถานศึกษา',
                font: 'TH Sarabun PSK',
                size: 30, // 15pt
                color: '334155',
              }),
            ],
          }),

          // Heading: โครงสร้างและแนวปฏิบัติ
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: 'โครงสร้างและแนวปฏิบัติมาตรฐานสำหรับการจัดทำ',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 32, // 16pt
                color: '0284C7',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '1. วัตถุประสงค์และเป้าหมาย: เพื่อสนับสนุนการจัดการศึกษาและภาระงานวิชาการให้เกิดประสิทธิภาพสูงสุดแก่นักเรียน',
                font: 'TH Sarabun PSK',
                size: 30,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '2. กลุ่มเป้าหมายผู้ใช้งาน: ข้าราชการครู บุคลากรทางการศึกษา และผู้รับผิดชอบงานวิชาการ',
                font: 'TH Sarabun PSK',
                size: 30,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '3. แนวทางดำเนินการ: ให้นำแบบฟอร์มนี้ไปปรับใช้ให้สอดคล้องกับบริบทของกลุ่มสาระการเรียนรู้และระดับชั้น',
                font: 'TH Sarabun PSK',
                size: 30,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: '4. การจัดเก็บและรายงานผล: ส่งหลักฐานการปฏิบัติงานผ่านระบบบริหารงานวิชาการออนไลน์ตามกำหนดเวลา',
                font: 'TH Sarabun PSK',
                size: 30,
              }),
            ],
          }),

          // Footer note
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: `เอกสารจัดทำและรับรองโดยระบบบริหารงานวิชาการ (Academic Management System) • วันที่ดาวน์โหลด: ${data.publishDate}`,
                font: 'TH Sarabun PSK',
                size: 24, // 12pt
                color: '94A3B8',
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Creates a 100% genuine OpenXML Microsoft Word (.docx) file for Submissions (Tracking & Grading)
 */
export async function createSubmissionDocxBlob(data: SubmissionExportData): Promise<Blob> {
  const tableBorderConfig = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
  };

  const createInfoRow = (label: string, value: string, isAlternate: boolean = false) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: isAlternate ? 'F1F5F9' : 'F8FAFC' },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  font: 'TH Sarabun PSK',
                  size: 30,
                  color: '1E293B',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: isAlternate ? 'FFFFFF' : 'FAFAFA' },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value || '-',
                  font: 'TH Sarabun PSK',
                  size: 30,
                  color: '0F172A',
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'แบบรายงานและหลักฐานการส่งงานทางวิชาการ',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 40,
                color: '1E3A8A',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: 'กลุ่มบริหารงานวิชาการ • ระบบติดตามและประเมินผลการปฏิบัติงาน',
                font: 'TH Sarabun PSK',
                size: 28,
                color: '64748B',
              }),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 120 },
            children: [
              new TextRun({
                text: 'ข้อมูลทั่วไปของการส่งงาน',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 32,
                color: '0284C7',
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              createInfoRow('หัวข้องาน / ภาระงาน', data.subject, false),
              createInfoRow('ชื่อไฟล์เอกสาร', data.fileName, true),
              createInfoRow('ผู้ส่งผลงาน', `${data.memberName} (${data.memberSchool || 'โรงเรียนในสังกัด'})`, false),
              createInfoRow('วันที่และเวลาส่งงาน', data.submittedAt, true),
              createInfoRow('สถานะการตรวจสอบ', data.statusText, false),
              createInfoRow('คะแนนที่ประเมิน', data.score !== undefined ? `${data.score} คะแนน` : 'รอการให้คะแนน', true),
              createInfoRow('ข้อเสนอแนะ / ความเห็น', data.feedback || 'ไม่มีข้อเสนอแนะเพิ่มเติม', false),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: 'รายละเอียดและเนื้อหาเพิ่มเติม',
                bold: true,
                font: 'TH Sarabun PSK',
                size: 32,
                color: '0284C7',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text:
                  data.description ||
                  'ผู้ส่งงานได้แนบไฟล์เอกสารนี้ไว้ในระบบเรียบร้อยแล้ว ท่านสามารถนำเอกสารนี้ไปใช้อ้างอิงในการปฏิบัติงาน ประเมินผล และพัฒนาการจัดการเรียนรู้ได้อย่างสมบูรณ์',
                font: 'TH Sarabun PSK',
                size: 30,
                color: '334155',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: `เอกสารสร้างจากระบบบริหารงานวิชาการ (Academic Work Management System) • วันที่พิมพ์: ${new Date().toLocaleString('th-TH')}`,
                font: 'TH Sarabun PSK',
                size: 24,
                color: '94A3B8',
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
