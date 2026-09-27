// Vite supplies BASE_URL in dev and production; fallback supports Node checks.
export const assetUrl = (path) =>
  `${import.meta.env?.BASE_URL ?? "/"}${path.replace(/^\/+/, "")}`;
