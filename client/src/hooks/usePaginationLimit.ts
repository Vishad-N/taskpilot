import { useState, useEffect } from 'react';

export function usePaginationLimit() {
  const [limit, setLimit] = useState(15);

  useEffect(() => {
    const checkLimit = () => {
      setLimit(window.innerWidth < 768 ? 10 : 15);
    };
    
    checkLimit();
    window.addEventListener('resize', checkLimit);
    return () => window.removeEventListener('resize', checkLimit);
  }, []);

  return limit;
}
