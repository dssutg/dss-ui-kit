import { useEffect, useState } from 'react';

/**
 * The width below which a screen counts as a mobile one.
 *
 * A single number rather than a user-agent test: what callers need is room to lay out a panel in one
 * column, and a wide window in a phone browser is a narrow window. Exported so a caller lays its own
 * breakpoints out on the same line.
 */
export const minDesktopWidth = 900;

/**
 * Whether the window is narrower than {@link minDesktopWidth}, kept up to date on resize.
 *
 * A layout decision, not a device guess. A caller that needs a different threshold does the same
 * comparison in its own hook, because "mobile" means something different per panel.
 */
export function useIsMobileScreen(): boolean {
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < minDesktopWidth);

  useEffect(() => {
    function handleResize() {
      setIsMobileScreen(window.innerWidth < minDesktopWidth);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobileScreen;
}
