import type { PendingDocumentDto } from '@/lib/api';

export interface ModalApproveProps {
  isOpen: boolean;
  targetScore: number;
  onClose: () => void;
  onConfirm: () => void;
}

export interface RejectionReason {
  id: number;
  text: string;
}

export interface ModalRejectProps {
  isOpen: boolean;
  rejectionReasons: RejectionReason[];
  selectedReasons: number[];
  customReason: string;
  onToggleReason: (reasonId: number) => void;
  onCustomReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/** Серверный DTO заявки на рассмотрении — генерат OpenAPI (lib/api.ts). */
export type PreviewDocument = PendingDocumentDto;

export interface ModalPreviewProps {
  isOpen: boolean;
  doc: PreviewDocument | null;
  onClose: () => void;
  onDownload: (fileId: number, fileName: string) => void;
}

export interface ModalConfirmProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export interface ModalEditAchievementProps {
  isOpen: boolean;
  doc: import('./AchievementInterfaces').Achievement | null;
  onClose: () => void;
}