import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  token: 'ims_token',
  user: 'ims_user',
  institutionId: 'ims_institution_id',
  creds: 'ims_saved_creds',
};

const web = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, val) => {
    try {
      if (val == null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch {}
  },
  del: (key) => { try { localStorage.removeItem(key); } catch {} },
};

export async function getItem(key) {
  return Platform.OS === 'web' ? web.get(key) : SecureStore.getItemAsync(key);
}
export async function setItem(key, val) {
  return Platform.OS === 'web' ? web.set(key, val) : SecureStore.setItemAsync(key, val);
}
export async function deleteItem(key) {
  return Platform.OS === 'web' ? web.del(key) : SecureStore.deleteItemAsync(key);
}
