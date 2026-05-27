import ErrorState from '@/components/ErrorState';

type ErrorPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ msg?: string }>;
};

export default async function ErrorCodePage({ params, searchParams }: ErrorPageProps) {
  const { code } = await params;
  // const { msg } = await searchParams;
  
  const statusCode = parseInt(code, 10);
  
  if (isNaN(statusCode) || statusCode < 100 || statusCode >= 600) {
    return (
      <ErrorState
        code={500}
        title="Неизвестная ошибка"
        description="Произошла некорректная ошибка."
      />
    );
  }

  return (
    <ErrorState
      code={statusCode}
      // message={msg}
    />
  );
}