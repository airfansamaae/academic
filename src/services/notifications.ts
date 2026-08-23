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
