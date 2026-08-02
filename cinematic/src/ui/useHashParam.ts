import { useEffect, useState } from 'react';

/* Deep-link convention: #platform=seating, #scenarios=marco, #coordinator=import.
   Returns the param for a section and keeps it fresh on hashchange, so tabbed
   sections preselect a pane and scroll into view. Plain #section anchors keep
   working with no JS involvement. */
export function useHashParam(sectionId: string): string | null {
  const read = () => {
    const raw = window.location.hash.slice(1);
    if (!raw.startsWith(`${sectionId}=`)) return null;
    return decodeURIComponent(raw.slice(sectionId.length + 1)) || null;
  };
  const [param, setParam] = useState<string | null>(read);

  useEffect(() => {
    const onHash = () => {
      const next = read();
      setParam(next);
      if (next) document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
    };
    window.addEventListener('hashchange', onHash);
    /* Handle a deep link present on first load. */
    if (read()) requestAnimationFrame(onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  return param;
}
