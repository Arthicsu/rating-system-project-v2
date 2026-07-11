'use client';

/**
 * Последний рубеж: ошибка рендера в самом корневом layout.
 * Здесь недоступны глобальные стили (global-error заменяет layout целиком),
 * поэтому разметка — на инлайн-стилях, визуально повторяет ErrorState.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('Global error boundary triggered:', error);

  return (
    <html lang="ru">
      <body style={{ margin: 0, background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 640, width: '100%', textAlign: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 72, fontWeight: 700, color: '#0369a1', margin: 0 }}>500</p>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1e293b', margin: '12px 0 8px' }}>
              Ошибка приложения
            </h1>
            <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
              Произошла непредвиденная ошибка. Попробуйте обновить страницу.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 24,
                background: '#0369a1',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
