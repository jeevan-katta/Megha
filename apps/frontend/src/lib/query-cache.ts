import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
// Only mounted browser providers subscribe; no process-global private data cache.
const listeners = new Set<(path: string) => void>();
export function onMutation(listener: (path: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifyMutation(path: string) {
  listeners.forEach((listener) => listener(path));
}
