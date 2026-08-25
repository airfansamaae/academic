import Swal from 'sweetalert2';

// Toast Notification setup using SweetAlert2
export const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export const notifySuccess = (title: string, message?: string) => {
  Toast.fire({
    icon: 'success',
    title: title,
    text: message,
    background: '#ffffff',
    color: '#0f172a',
    iconColor: '#10b981',
  });
};

export const notifyError = (title: string, message?: string) => {
  Toast.fire({
    icon: 'error',
    title: title,
    text: message,
    background: '#ffffff',
    color: '#0f172a',
    iconColor: '#ef4444',
  });
};

export const notifyWarning = (title: string, message?: string) => {
  Toast.fire({
    icon: 'warning',
    title: title,
    text: message,
    background: '#ffffff',
    color: '#0f172a',
    iconColor: '#f59e0b',
  });
};

export const notifyInfo = (title: string, message?: string) => {
  Toast.fire({
    icon: 'info',
    title: title,
    text: message,
    background: '#ffffff',
    color: '#0f172a',
    iconColor: '#7c3aed',
  });
};

/**
 * Play a pleasant Web Audio notification chime (no external audio files needed)
 */
export const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First tone (E5 ~ 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second higher tone (A5 ~ 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch {
    // AudioContext blocked by user autoplay policy, silent ignore
  }
};

export const notifyNewTaskAlert = async (
  taskTitle: string,
  dueDate?: string,
  onGoToSubmit?: () => void
) => {
  playNotificationChime();
  const res = await Swal.fire({
    title: '🔔 มีงานมอบหมายใหม่จากฝ่ายวิชาการ!',
    html: `
      <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
        <div style="background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 14px; padding: 14px; margin-bottom: 12px;">
          <p style="font-weight: 700; color: #6b21a8; font-size: 16px; margin: 0 0 4px 0;">${taskTitle}</p>
          <p style="margin: 0; color: #7e22ce; font-size: 13px;">📅 <b>กำหนดส่ง:</b> ${dueDate || 'ตามที่กำหนด'}</p>
        </div>
        <p style="color: #64748b; font-size: 13px; margin: 0;">ฝ่ายวิชาการได้มอบหมายงานใหม่เข้าระบบ คุณครูสามารถกด <b>"ส่งงานทันที"</b> เพื่อเปิดฟอร์มส่งงานได้เลย</p>
      </div>
    `,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: '🚀 ส่งงานทันที',
    cancelButtonText: 'รับทราบ',
    confirmButtonColor: '#7c3aed',
    cancelButtonColor: '#94a3b8',
    reverseButtons: true,
    customClass: {
      popup: 'rounded-3xl shadow-2xl border border-purple-100',
      confirmButton: 'px-6 py-3 rounded-2xl font-bold shadow-md hover:bg-purple-700 cursor-pointer',
      cancelButton: 'px-5 py-3 rounded-2xl font-medium cursor-pointer',
    },
  });

  if (res.isConfirmed && onGoToSubmit) {
    onGoToSubmit();
  }
};

export const confirmDialog = async (
  title: string,
  text: string,
  confirmButtonText = 'ยืนยัน',
  cancelButtonText = 'ยกเลิก'
): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#7c3aed',
    cancelButtonColor: '#94a3b8',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    customClass: {
      popup: 'rounded-2xl shadow-2xl border border-slate-100',
      confirmButton: 'px-5 py-2.5 rounded-xl font-medium shadow-md hover:shadow-lg',
      cancelButton: 'px-5 py-2.5 rounded-xl font-medium',
    },
  });
  return result.isConfirmed;
};
