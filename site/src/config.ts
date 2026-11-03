/**
 * Where ECCC's own PDF, PNG and text files are hosted. They are about 770 MB, so they live outside git;
 * `node scripts/publish-official-files.mjs` unpacks a release and deploys it. Override at build time with
 * VITE_OFFICIAL_FILES_BASE (for example to point at a custom domain).
 */
export const OFFICIAL_FILES_BASE: string
  = (import.meta.env['VITE_OFFICIAL_FILES_BASE'] as string | undefined) ?? 'https://eccc-idf-files.andreschardong.workers.dev';
