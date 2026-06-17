import { useEffect } from 'react';

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | PSU e-Iskolar` : 'PSU e-Iskolar';
  }, [title]);
}
