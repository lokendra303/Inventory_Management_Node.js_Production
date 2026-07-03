export const APP_VERSION = '3.0.0';

export function semverGte(current, required) {
  const a = String(current).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(required).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}
