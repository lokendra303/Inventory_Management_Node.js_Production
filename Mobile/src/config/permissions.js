export function hasPermission(user, permission) {
  if (!user?.permissions) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  return Boolean(user.permissions.all || user.permissions[permission]);
}

export function hasAnyPermission(user, permissions = []) {
  return permissions.some((p) => hasPermission(user, p));
}

export function hasRole(user, roles) {
  if (!roles?.length) return true;
  if (user?.role === 'admin' || user?.role === 'super_admin') return true;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.includes(user?.role);
}
