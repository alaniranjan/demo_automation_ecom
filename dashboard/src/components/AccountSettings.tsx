'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PhoneIcon, TrashIcon } from './icons';
import { buttonStyles } from './PageHeader';

interface AccountState {
  mobileMasked: string | null;
}

/**
 * Customer mobile number for the signed-in tests. Saved to the framework's git-ignored .env (DEMO_MOBILE);
 * `npm run auth:login` fills it in, so only the OTP has to be typed.
 */
export function AccountSettings() {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'critical'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/account', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<AccountState>) : null))
      .then((state) => setSaved(state ? state.mobileMasked : null))
      .catch(() => setSaved(null));
  }, []);

  async function send(method: 'PUT' | 'DELETE', body?: object) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/settings/account', {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = (await response.json()) as AccountState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the number');
      setSaved(payload.mobileMasked);
      setMobile('');
      setMessage({ tone: 'good', text: payload.mobileMasked ? 'Saved. npm run auth:login will use this number.' : 'Number removed.' });
    } catch (error) {
      setMessage({ tone: 'critical', text: error instanceof Error ? error.message : 'Could not save the number' });
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void send('PUT', { mobile });
  }

  return (
    <div className="space-y-4">
      <dl>
        <div className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:items-center sm:justify-between">
          <dt className="text-sm text-ink-3">Saved mobile number</dt>
          <dd className="flex items-center justify-end gap-2 text-sm text-ink">
            {saved === undefined ? (
              '…'
            ) : saved ? (
              <>
                <span className="font-mono">+91 {saved}</span>
                <button
                  type="button"
                  onClick={() => void send('DELETE')}
                  disabled={busy}
                  className={`${buttonStyles.ghost} h-7 px-2`}
                  aria-label="Remove saved mobile number"
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </>
            ) : (
              <span className="text-ink-3">Not set</span>
            )}
          </dd>
        </div>
      </dl>

      <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Mobile number</span>
          <PhoneIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" width={16} height={16} />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            placeholder={saved ? 'New 10-digit mobile number' : '10-digit mobile number'}
            className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <button type="submit" disabled={busy || mobile.trim() === ''} className={buttonStyles.primary}>
          {saved ? 'Update' : 'Save'}
        </button>
      </form>

      {message && (
        <p role="status" className={`text-sm ${message.tone === 'good' ? 'text-good-text' : 'text-critical-text'}`}>
          {message.text}
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        Stored only on this computer, in the framework&apos;s git-ignored <span className="font-mono">.env</span> as{' '}
        <span className="font-mono">DEMO_MOBILE</span>. Run <span className="font-mono">npm run auth:login</span>: the browser
        fills this number and requests the OTP, and you type only the OTP.
      </p>
    </div>
  );
}
