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
  onToggleReason: (reasonId: number) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}