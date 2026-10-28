import type { PendingDocumentDto } from '@/lib/api';

export interface ModalApproveProps {
  isOpen: boolean;
  /** Одобряемая заявка: окно показывает, что именно одобряется. */
  doc: PendingDocumentDto | null;
  /** Решение сохраняется: кнопки неактивны, окно не закрывается. */
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export interface RejectionReason {
  id: number;
  text: string;
}

export interface ModalRejectProps {
  isOpen: boolean;
  /** reject — студенту на исправление; return — руководство возвращает кафедре. */
  action: 'reject' | 'return';
  targetScore: number;
  /** Заявка подтверждена: решение спишет её баллы. */
  debitsScore: boolean;
  saving: boolean;
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
  onDownload: (fileId: string, fileName: string) => void;
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

export interface ModalChangePasswordProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ModalEditAchievementProps {
  isOpen: boolean;
  doc: import('./AchievementInterfaces').Achievement | null;
  onClose: () => void;
}