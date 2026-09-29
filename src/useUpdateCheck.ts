import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Detects when a new production build has been deployed while this tab is
 * still running the old one. Vite emits content-hashed asset names and
 * rewrites index.html on every build, so comparing the entry script name in
 * the freshly fetched index.html against the loaded one is enough.
 */
export function useUpdateCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const currentScript =
      document.querySelector('script[src*="index-"]')?.getAttribute('src') ?? '';

    const check = async () => {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'index.html', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/src="([^"]*index-[^"]*\.js)"/);
        if (match && match[1] !== currentScript) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or transient error — skip this check.
      }
    };

    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return updateAvailable;
}
