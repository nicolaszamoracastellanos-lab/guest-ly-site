/* WebGL capability gate (Part 7.1). The cinematic canvas is a luxury, not
   a requirement: low-memory devices, data-saver users, reduced-motion users
   and machines that cannot create a context get the static themed gradient
   instead of a render loop. */

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function webglAllowed(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const nav = navigator as NavigatorWithHints;
    if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) return false;
    if (nav.connection?.saveData) return false;
    const probe = document.createElement('canvas');
    const ctx = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!ctx) return false;
    return true;
  } catch {
    return false;
  }
}
