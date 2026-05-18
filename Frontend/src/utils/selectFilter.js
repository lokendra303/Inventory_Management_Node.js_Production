/**
 * Build searchable text for Ant Design Select options (children may be React nodes or arrays).
 */
export function getSelectOptionFilterText(option) {
  if (option == null) return '';
  const { label, value, children } = option;
  if (label != null && label !== '') return String(label);
  if (children == null || children === false) {
    return value != null ? String(value) : '';
  }
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children
      .map((part) => {
        if (part == null || part === false) return '';
        if (typeof part === 'string' || typeof part === 'number') return String(part);
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return String(children);
}

export function filterSelectOption(input, option) {
  const haystack = getSelectOptionFilterText(option).toLowerCase();
  const needle = String(input ?? '').toLowerCase();
  return haystack.includes(needle);
}
