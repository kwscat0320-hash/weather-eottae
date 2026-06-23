const BASE = import.meta.env.VITE_API_BASE ?? "";

export function apiUrl(path) {
  return `${BASE}${path}`;
}
