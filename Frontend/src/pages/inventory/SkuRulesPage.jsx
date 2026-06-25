import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '../../routes/lazyPages';

/** Legacy/deep link route — opens SKU rules modal on the Items page. */
export default function SkuRulesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/items', { replace: true, state: { openSkuRules: true } });
  }, [navigate]);

  return <PageLoader />;
}
