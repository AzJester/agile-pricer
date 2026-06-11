import { useEffect, useState } from 'react';

function read(fallback: string): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h || fallback;
}

/** Minimal hash router so each section is deep-linkable (#/backlog). */
export function useHashRoute(fallback: string): [string, (id: string) => void] {
  const [route, setRoute] = useState(() => read(fallback));
  useEffect(() => {
    const onHash = () => setRoute(read(fallback));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [fallback]);
  const navigate = (id: string) => {
    window.location.hash = '#/' + id;
    window.scrollTo(0, 0);
  };
  return [route, navigate];
}
