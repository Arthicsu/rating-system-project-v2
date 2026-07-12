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

/** Совместим с PendingDocument из OpenAPI-типов (опциональность полей — как в схеме). */
export interface PreviewDocument {
  id: number;
  student_id: number;
  student_name: string;
  record_book: string;
  achievement: string;
  category_display: string;
  doc_type_display: string;
  sub_type_display: string;
  level_display: string | null;
  result_display: string | null;
  date_received?: string;
  uploaded_at: string;
  score?: number;
  files: Array<{ id: number; original_file_name?: string }>;
  rejection_reason?: string | null;
}

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