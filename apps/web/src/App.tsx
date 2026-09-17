import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { applyDirection, type Lang } from './i18n';

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('api unreachable');
      return (await res.json()) as { status: string; version: string };
    },
    retry: 1,
    refetchInterval: 30_000,
  });
}

export default function App() {
  const { t, i18n } = useTranslation();
  const health = useHealth();

  const toggleLang = () => {
    const next: Lang = i18n.language === 'ar' ? 'en' : 'ar';
    void i18n.changeLanguage(next);
    applyDirection(next);
  };

  const statusLabel = health.isLoading
    ? t('shell.checking')
    : health.isError
      ? t('shell.disconnected')
      : t('shell.connected');

  return (
    <div className="min-h-screen bg-athar-50 text-athar-900">
      <header className="flex items-center justify-between border-b border-athar-100 bg-white px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-athar-700">{t('app.name')}</h1>
          <span className="text-sm text-gray-500">{t('app.tagline')}</span>
        </div>
        <button
          onClick={toggleLang}
          className="rounded-md border border-athar-500 px-3 py-1 text-sm text-athar-700 hover:bg-athar-100"
        >
          {t('nav.language')}
        </button>
      </header>

      <nav className="flex gap-4 border-b border-athar-100 bg-white px-6 py-2 text-sm">
        {(['dashboard', 'evidence', 'sources', 'ledger', 'exports'] as const).map((key) => (
          <span
            key={key}
            className="cursor-not-allowed text-gray-400"
            title={t('shell.comingSoon')}
          >
            {t(`nav.${key}`)}
          </span>
        ))}
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xl">{t('shell.welcome')}</p>
        <p className="mt-8 text-sm text-gray-500">
          {t('shell.apiStatus')}:{' '}
          <span className={health.isError ? 'text-red-600' : 'text-athar-600'}>{statusLabel}</span>
        </p>
      </main>
    </div>
  );
}
