/** Map DB institution.status to platform-admin UI labels */
export function institutionStatusLabel(dbStatus) {
  if (dbStatus === 'inactive') return 'Suspended';
  if (dbStatus === 'active') return 'Active';
  return dbStatus || '—';
}
