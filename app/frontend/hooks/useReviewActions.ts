'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import { useMySession } from '@/context/AuthContext';
import { useRejectionReasons, useReviewDocument } from '@/hooks/queries';
import type { Document, ModalState } from '@/interfaces/StaffInterfaces';

const EMPTY_MODAL: ModalState = { type: null, targetId: null, targetScore: 0, targetStudentId: null };

/**
 * Логика approve/reject заявок: состояние модалок, причины отказа, мутация
 * решения. Возвращает готовые пропсы для ModalApprove/ModalReject и openModal
 * для кнопок в карточках, чтобы шелл кабинета этим не занимался.
 */
export function useReviewActions() {
  const { user, refreshUser } = useMySession();
  const { data: rejectionReasonsList = [] } = useRejectionReasons();
  const reviewMutation = useReviewDocument();

  const [modalState, setModalState] = useState<ModalState>(EMPTY_MODAL);
  const [rejectReasons, setRejectReasons] = useState<number[]>([]);
  const [customReason, setCustomReason] = useState('');

  // Ключ идемпотентности решения: генерируется на открытие модалки, повтор
  // с тем же ключом (двойной клик, ретрай при сбое) получает 409 вместо дубля.
  const reviewKeyRef = useRef('');

  const openModal = (type: string, doc: Document) => {
    reviewKeyRef.current = crypto.randomUUID();
    setModalState({
      type,
      targetId: doc.id,
      targetScore: doc.score ?? 0,
      targetStudentId: doc.student_id,
    });
  };

  const closeModal = () => {
    setModalState(EMPTY_MODAL);
    setRejectReasons([]);
    setCustomReason('');
  };

  const toggleReason = (reasonId: number) => {
    setRejectReasons(prev =>
      prev.includes(reasonId) ? prev.filter(r => r !== reasonId) : [...prev, reasonId]
    );
  };

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      await reviewMutation.mutateAsync({
        documentId: modalState.targetId,
        data: { action: 'approve' },
        idempotencyKey: reviewKeyRef.current,
      });
      toast.success("Заявка одобрена");
      closeModal();
      await refreshUser();
    } catch (error) {
      if ((error as AxiosError).response?.status === 409) {
        // Решение уже принято этим же действием (двойной клик) - не ошибка.
        toast.success("Решение по заявке уже принято");
        closeModal();
        return;
      }
      toast.error("Ошибка: " + error);
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalState.targetId) return;

    const reasonsText = rejectReasons.map(id => {
      const reason = rejectionReasonsList.find(r => r.id === id);
      return reason ? reason.text : '';
    }).filter(Boolean);

    if (reasonsText.length > 0 && customReason.trim() !== '') {
      setCustomReason('');
    }

    const allReasons = customReason.trim()
      ? [customReason.trim()]
      : reasonsText;

    if (allReasons.length === 0) {
      toast.error("Укажите хотя бы одну причину");
      return;
    }

    try {
      await reviewMutation.mutateAsync({
        documentId: modalState.targetId,
        data: { action: 'reject', reasons: allReasons },
        idempotencyKey: reviewKeyRef.current,
      });
      toast.success("Решение по заявке изменено");
      closeModal();
      await refreshUser();
    } catch (error) {
      if ((error as AxiosError).response?.status === 409) {
        // Решение уже принято этим же действием (двойной клик) - не ошибка.
        toast.success("Решение по заявке уже принято");
        closeModal();
        return;
      }
      toast.error("Ошибка: " + error);
    }
  };

  const canApprove = !!(
    user?.roles?.includes('Department') || !user?.roles?.some(r => ['Rectorate', 'Dean'].includes(r))
  );

  return {
    openModal,
    canApprove,
    modalApproveProps: {
      isOpen: modalState.type === 'approve',
      targetScore: modalState.targetScore,
      onClose: closeModal,
      onConfirm: handleApprove,
    },
    modalRejectProps: {
      isOpen: modalState.type === 'reject',
      rejectionReasons: rejectionReasonsList,
      selectedReasons: rejectReasons,
      customReason,
      onToggleReason: toggleReason,
      onCustomReasonChange: setCustomReason,
      onClose: closeModal,
      onSubmit: handleReject,
    },
  };
}
