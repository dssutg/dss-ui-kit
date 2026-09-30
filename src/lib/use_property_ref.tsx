import { useEffect, useRef } from 'react';

export function usePropertyRef<T>(property: T) {
  const ref = useRef(property);

  useEffect(() => {
    ref.current = property;
  }, [property]);

  return ref;
}
