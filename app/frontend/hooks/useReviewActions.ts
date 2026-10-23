'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import { useMySession } from '@/context/AuthContext';
import { useRejectionReasons, useReviewDocument } from '@/hooks/queries';
import { apiErrorMessage } from '@/lib/apiError';
import type { Document, ModalState, ReviewAction } from '@/interfaces/StaffInterfaces';

const EMPTY_MODAL: ModalState = { type: null, targetId: null, targetScore: 0, targetStatus: null, targetStudentId: null };

// Вариант А (спек 2д): кафедра решает, руководство контролирует. Зеркало
// students/services._REVIEW_RULES - кнопки строго по таблице, сервер всё равно проверит.
const ACTIONS_BY_STATUS: Record<'department' | 'leadership', Partial<Record<string, ReviewAction[]>>> = {
  department: { pending: ['approve', 'reject'], rejected: ['approve'], approved: ['reject'] },
  leadership: { approved: ['reject', 'return'], rejected: ['return'] },
};

/**
 * Логика решений по заявкам: состояние модалок, причины, мутация решения.
 * Возвращает готовые пропсы для ModalApprove/ModalReject, openModal и actionsFor
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

  const openModal = (type: ReviewAction, doc: Document) => {
    reviewKeyRef.current = crypto.randomUUID();
    setModalState({
      type,
      targetId: doc.id,
      targetScore: doc.score ?? 0,
      targetStatus: doc.status_display,
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
      const { message } = await reviewMutation.mutateAsync({
        documentId: modalState.targetId,
        data: { action: 'approve' },
        idempotencyKey: reviewKeyRef.current,
      });
      toast.success(message);
      closeModal();
      await refreshUser();
    } catch (error) {
      if ((error as AxiosError).response?.status === 409) {
        // Решение уже принято этим же действием (двойной клик) - не ошибка.
        toast.success("Решение по заявке уже принято");
        closeModal();
        return;
      }
      // 403 тут бывает и при живой сессии («за пределами области модерации») - показываем
      // текст сервера, а не сырой AxiosError; погасшую сессию уведёт на вход интерсептор.
      toast.error(apiErrorMessage(error, 'Не удалось сохранить решение по заявке'));
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalState.targetId || (modalState.type !== 'reject' && modalState.type !== 'return')) return;
    const action = modalState.type;

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
      const { message } = await reviewMutation.mutateAsync({
        documentId: modalState.targetId,
        data: { action, reasons: allReasons },
        idempotencyKey: reviewKeyRef.current,
      });
      toast.success(message);
      closeModal();
      await refreshUser();
    } catch (error) {
      if ((error as AxiosError).response?.status === 409) {
        // Решение уже принято этим же действием (двойной клик) - не ошибка.
        toast.success("Решение по заявке уже принято");
        closeModal();
        return;
      }
      // 403 тут бывает и при живой сессии («за пределами области модерации») - показываем
      // текст сервера, а не сырой AxiosError; погасшую сессию уведёт на вход интерсептор.
      toast.error(apiErrorMessage(error, 'Не удалось сохранить решение по заявке'));
    }
  };

  // Роль руководства перекрывает кафедру, как на сервере (User.is_leadership): одобряет только кафедра.
  const canApprove = !user?.roles?.some(r => ['Rectorate', 'Dean'].includes(r));

  const actionsFor = (doc: Document): ReviewAction[] =>
    ACTIONS_BY_STATUS[canApprove ? 'department' : 'leadership'][doc.status_display] ?? [];

  return {
    openModal,
    canApprove,
    actionsFor,
    modalApproveProps: {
      isOpen: modalState.type === 'approve',
      targetScore: modalState.targetScore,
      onClose: closeModal,
      onConfirm: handleApprove,
    },
    modalRejectProps: {
      isOpen: modalState.type === 'reject' || modalState.type === 'return',
      action: modalState.type === 'return' ? 'return' as const : 'reject' as const,
      targetScore: modalState.targetScore,
      debitsScore: modalState.targetStatus === 'approved',
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
