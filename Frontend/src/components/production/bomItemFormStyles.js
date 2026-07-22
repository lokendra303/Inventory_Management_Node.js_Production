/**
 * Manufacturing / workshop visual tokens for BOM list + create/edit form.
 * Distinct from Inventory Items purple (#667eea / #764ba2).
 */

export const BOM_COLORS = {
  accent: '#0f766e',
  accentDeep: '#115e59',
  accentSoft: '#ccfbf1',
  accentMuted: '#5eead4',
  charcoal: '#1e293b',
  slate: '#64748b',
  border: '#e2e8f0',
  pageBg: '#f1f5f4',
  formBg: '#f4f7f6',
  cardBg: '#ffffff',
  rail: '#0f766e',
};

export const BOM_GRADIENT = `linear-gradient(135deg, ${BOM_COLORS.accent} 0%, ${BOM_COLORS.accentDeep} 100%)`;
export const BOM_GRADIENT_SOFT = `linear-gradient(135deg, ${BOM_COLORS.accent}22, ${BOM_COLORS.accentDeep}18)`;

export const sectionStyle = {
  background: BOM_COLORS.cardBg,
  border: `1px solid ${BOM_COLORS.border}`,
  borderLeft: `4px solid ${BOM_COLORS.rail}`,
  borderRadius: 12,
  padding: '18px 20px 10px',
  marginBottom: 16,
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};

export const sectionStyleRecipe = {
  ...sectionStyle,
  borderLeft: `4px solid ${BOM_COLORS.accent}`,
  background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 48px)',
  boxShadow: '0 2px 12px rgba(15, 118, 110, 0.08)',
};

export const sectionStyleQuiet = {
  ...sectionStyle,
  borderLeft: `4px solid #94a3b8`,
  background: '#fafbfc',
};

export const sectionHeader = {
  fontWeight: 700,
  fontSize: 13,
  color: BOM_COLORS.charcoal,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingBottom: 12,
  borderBottom: `1px solid ${BOM_COLORS.border}`,
  letterSpacing: '0.02em',
};

export const sectionIndexBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  height: 22,
  padding: '0 7px',
  borderRadius: 6,
  background: BOM_COLORS.accentSoft,
  color: BOM_COLORS.accentDeep,
  fontSize: 11,
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0.4,
};

/** @deprecated prefer sectionIndexBadge — kept for gradual migration */
export const sectionIconStyle = {
  background: BOM_GRADIENT,
  borderRadius: 8,
  padding: '5px 7px',
  color: '#fff',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const primaryButtonStyle = {
  background: BOM_GRADIENT,
  border: 'none',
  fontWeight: 700,
  color: '#fff',
  boxShadow: '0 2px 10px rgba(15, 118, 110, 0.28)',
};

export const fulfillmentTileBase = {
  flex: 1,
  minWidth: 200,
  cursor: 'pointer',
  borderRadius: 12,
  padding: '14px 16px',
  border: `1.5px solid ${BOM_COLORS.border}`,
  background: '#fff',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
};

export const fulfillmentTileActive = {
  ...fulfillmentTileBase,
  borderColor: BOM_COLORS.accent,
  background: BOM_COLORS.accentSoft,
  boxShadow: `0 0 0 1px ${BOM_COLORS.accent}`,
};

export function sectionIndexLabel(index) {
  return String(index).padStart(2, '0');
}
