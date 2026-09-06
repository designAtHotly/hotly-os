import { toast } from "sonner";

export function toastError(title: string, props?: { message?: string }) {
    toast.error(title, { description: props?.message, icon: "❗" });
}

export function toastSuccess(message: string) {
    toast.success(message, { position: "top-center" });
}