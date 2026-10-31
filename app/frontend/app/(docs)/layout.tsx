import PageContainer from '@/components/layout/PageContainer';

/** Каркас страниц-документов (политики и согласие): колонка для чтения. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <PageContainer width="text">{children}</PageContainer>;
}
