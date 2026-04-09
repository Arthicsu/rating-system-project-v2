import ErrorState from '@/components/ErrorState';

export default function NotFound() {
  return (
    <ErrorState
      code={404}
      title="Страница не найдена"
      description="Похоже, такой страницы не существует или она была перемещена."
    />
  );
}
