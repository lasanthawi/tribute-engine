/**
 * Demo mode lets the Mini App run end-to-end with realistic mock data when
 * no Supabase project is configured yet — useful for previewing/iterating
 * on the UI before the backend is wired up.
 */
export function isDemoMode(): boolean {
  return !process.env.SUPABASE_URL
}
