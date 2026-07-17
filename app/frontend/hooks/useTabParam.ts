'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Состояние активной вкладки, синхронизированное с ?tab= в URL.
 *
 * Чтение ?tab= сделано в эффекте на маунте, а не ленивой инициализацией useState:
 * иначе сервер и клиент разошлись бы на первой отрисовке (hydration mismatch).
 * useSearchParams не берём намеренно - он навязал бы Suspense-обёртку всей странице.
 */
export function useTabParam(validTabs: readonly string[], defaultTab: string, basePath: string) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && validTabs.includes(tab)) {
      // Синхронизация состояния с ?tab= после гидрации.
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только на маунте
  }, []);

  const changeTab = (id: string) => {
    setActiveTab(id);
    router.replace(`${basePath}?tab=${id}`);
  };

  return { activeTab, changeTab };
}
