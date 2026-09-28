import { toast } from "sonner";

interface ToastOptions {
  description?: string;
  duration?: number;
}

export const showToast = {
  success: (title: string, options?: ToastOptions) => {
    toast.success(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    });
  },

  error: (title: string, options?: ToastOptions) => {
    toast.error(title, {
      description: options?.description,
      duration: options?.duration ?? 6000,
    });
  },

  warning: (title: string, options?: ToastOptions) => {
    toast.warning(title, {
      description: options?.description,
      duration: options?.duration ?? 5000,
    });
  },

  info: (title: string, options?: ToastOptions) => {
    toast.info(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    });
  },

  loading: (title: string, options?: ToastOptions) => {
    return toast.loading(title, {
      description: options?.description,
    });
  },

  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
      successDescription?: string;
      errorDescription?: string;
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: () => messages.success,
      error: (err: unknown) =>
        messages.errorDescription ||
        (err instanceof Error ? err.message : messages.error),
    });
  },
};
