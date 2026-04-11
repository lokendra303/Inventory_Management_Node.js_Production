import { useCallback } from 'react';
import itemService from '../services/itemService';

const useFormDraft = () => {
  const saveDraft = useCallback(async (data) => {
    await itemService.saveDraft(data);
  }, []);

  const loadDraft = useCallback(async () => {
    const res = await itemService.getDraft();
    return res?.data || null;
  }, []);

  const clearDraft = useCallback(async () => {
    await itemService.deleteDraft();
  }, []);

  return { saveDraft, loadDraft, clearDraft };
};

export default useFormDraft;
