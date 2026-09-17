import { useState } from 'react';
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
  const [token, setToken] = useState(() => localStorage.getItem('athar_token'));
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [message, setMessage] = useState('');
  const [facilityCount, setFacilityCount] = useState(0);
  const [invitationCount, setInvitationCount] = useState(0);

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

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (mode === 'login') delete payload.organizationName;
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { token?: string; message?: string };
    if (!response.ok || !result.token) {
      setMessage(result.message ?? 'Unable to continue');
      return;
    }
    localStorage.setItem('athar_token', result.token);
    setToken(result.token);
    setMessage('');
  }

  async function createFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/facilities', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        emirate: form.get('emirate'),
        sector: form.get('sector'),
        jurisdictions: ['MOCCAE'],
      }),
    });
    if (response.ok) {
      setFacilityCount((count) => count + 1);
      event.currentTarget.reset();
      setMessage('Facility added');
    }
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/members/invitations', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        displayName: form.get('displayName'),
        role: form.get('role'),
      }),
    });
    if (response.ok) {
      setInvitationCount((count) => count + 1);
      event.currentTarget.reset();
      setMessage('Invitation created');
    }
  }

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

      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-center text-xl">{t('shell.welcome')}</p>
        <p className="mt-4 text-center text-sm text-gray-500">
          {t('shell.apiStatus')}:{' '}
          <span className={health.isError ? 'text-red-600' : 'text-athar-600'}>{statusLabel}</span>
        </p>

        {!token ? (
          <form
            onSubmit={submitAuth}
            className="mx-auto mt-10 max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm"
          >
            <div className="flex gap-2 border-b border-athar-100 pb-3">
              <button
                type="button"
                onClick={() => setMode('register')}
                className={mode === 'register' ? 'font-semibold text-athar-700' : 'text-gray-400'}
              >
                Create organization
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={mode === 'login' ? 'font-semibold text-athar-700' : 'text-gray-400'}
              >
                Sign in
              </button>
            </div>
            {mode === 'register' && (
              <input
                name="organizationName"
                required
                placeholder="Organization name"
                className="w-full rounded border p-2"
              />
            )}
            {mode === 'register' && (
              <input
                name="displayName"
                required
                placeholder="Your name"
                className="w-full rounded border p-2"
              />
            )}
            <input
              name="email"
              required
              type="email"
              placeholder="Email"
              className="w-full rounded border p-2"
            />
            <input
              name="password"
              required
              type="password"
              minLength={12}
              placeholder="Password (12+ characters)"
              className="w-full rounded border p-2"
            />
            {mode === 'register' && (
              <select name="emirate" defaultValue="abu_dhabi" className="w-full rounded border p-2">
                <option value="abu_dhabi">Abu Dhabi</option>
                <option value="dubai">Dubai</option>
                <option value="sharjah">Sharjah</option>
              </select>
            )}
            <button className="w-full rounded bg-athar-600 px-4 py-2 font-medium text-white hover:bg-athar-700">
              {mode === 'register' ? 'Create workspace' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <form onSubmit={createFacility} className="space-y-3 rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-athar-700">Add facility</h2>
              <input
                name="name"
                required
                placeholder="Facility name"
                className="w-full rounded border p-2"
              />
              <select name="emirate" defaultValue="abu_dhabi" className="w-full rounded border p-2">
                <option value="abu_dhabi">Abu Dhabi</option>
                <option value="dubai">Dubai</option>
                <option value="sharjah">Sharjah</option>
              </select>
              <input name="sector" placeholder="Sector" className="w-full rounded border p-2" />
              <button className="rounded bg-athar-600 px-4 py-2 text-white">Add facility</button>
              <p className="text-sm text-gray-500">{facilityCount} added this session</p>
            </form>
            <form onSubmit={inviteMember} className="space-y-3 rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-athar-700">Invite teammate</h2>
              <input
                name="displayName"
                required
                placeholder="Name"
                className="w-full rounded border p-2"
              />
              <input
                name="email"
                required
                type="email"
                placeholder="Email"
                className="w-full rounded border p-2"
              />
              <select
                name="role"
                defaultValue="data_provider"
                className="w-full rounded border p-2"
              >
                <option value="data_provider">Data provider</option>
                <option value="validator">Validator</option>
                <option value="verifier_readonly">Verifier read-only</option>
                <option value="admin">Admin</option>
              </select>
              <button className="rounded bg-athar-600 px-4 py-2 text-white">
                Create invitation
              </button>
              <p className="text-sm text-gray-500">{invitationCount} created this session</p>
            </form>
          </div>
        )}
        {message && <p className="mt-4 text-center text-sm text-athar-700">{message}</p>}
      </main>
    </div>
  );
}
