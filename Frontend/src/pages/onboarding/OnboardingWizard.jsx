import React, { useState, useEffect, useCallback } from 'react';
import { Progress, Tooltip, message } from 'antd';
import {
  CheckCircleFilled, CloseOutlined, RocketOutlined,
  CaretDownOutlined, CaretUpOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/apiService';

const CSS = `
  .ob-wrap {
    position: fixed; bottom: 24px; right: 24px; z-index: 1200;
    width: 320px; font-family: 'Inter', sans-serif;
  }
  .ob-card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    border: 1px solid #ebebf5;
    overflow: hidden;
  }
  .ob-header {
    background: linear-gradient(135deg,#667eea,#764ba2);
    padding: 14px 16px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer;
  }
  .ob-header-left { display:flex; align-items:center; gap:10px; }
  .ob-header-title { color:#fff; font-weight:700; font-size:14px; }
  .ob-header-sub { color:rgba(255,255,255,0.8); font-size:11px; margin-top:1px; }
  .ob-header-right { display:flex; align-items:center; gap:8px; }
  .ob-icon-wrap {
    background:rgba(255,255,255,0.2); border-radius:8px;
    width:32px; height:32px; display:flex; align-items:center;
    justify-content:center; font-size:16px; color:#fff;
  }
  .ob-body { padding: 12px 14px 14px; }
  .ob-step {
    display:flex; align-items:center; gap:10px;
    padding: 8px 10px; border-radius:10px;
    cursor:pointer; transition:background 0.15s; margin-bottom:4px;
  }
  .ob-step:hover { background:#f5f5ff; }
  .ob-step.done { opacity:0.6; }
  .ob-step-icon {
    width:22px; height:22px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center; font-size:13px;
  }
  .ob-step-icon.done { color:#52c41a; }
  .ob-step-icon.pending {
    border:2px solid #d9d9d9; background:#fafafa; color:#bbb; font-size:10px;
  }
  .ob-step-label { font-size:13px; color:#374151; flex:1; }
  .ob-step.done .ob-step-label { text-decoration:line-through; color:#9ca3af; }
  .ob-step-arrow { font-size:11px; color:#bbb; }
  .ob-footer {
    padding: 8px 14px 12px;
    display:flex; justify-content:space-between; align-items:center;
    border-top:1px solid #f0f0f0;
  }
  .ob-dismiss {
    background:none; border:none; font-size:12px; color:#9ca3af;
    cursor:pointer; padding:0; transition:color 0.2s;
  }
  .ob-dismiss:hover { color:#ef4444; }
  .ob-close-btn {
    background:rgba(255,255,255,0.2); border:none; border-radius:6px;
    width:24px; height:24px; display:flex; align-items:center;
    justify-content:center; cursor:pointer; color:#fff; font-size:12px;
    transition:background 0.2s;
  }
  .ob-close-btn:hover { background:rgba(255,255,255,0.35); }
  .ob-complete-banner {
    padding:16px; text-align:center;
    background:linear-gradient(135deg,#f6ffed,#d9f7be);
    border-top:1px solid #b7eb8f;
  }
  .ob-complete-banner .icon { font-size:28px; color:#52c41a; }
  .ob-complete-banner p { margin:6px 0 0; font-size:13px; color:#389e0d; font-weight:600; }
`;

export default function OnboardingWizard() {
  const [data, setData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await apiService.get('/onboarding');
      if (res.success && !res.data.dismissed) {
        setData(res.data);
        setVisible(true);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStepClick = async (step) => {
    if (!step.completed) {
      try {
        const res = await apiService.post('/onboarding/complete', { stepId: step.id });
        // Use server response to update state accurately
        if (res.success) {
          setData(res.data);
        } else {
          // Fallback: optimistic local update
          setData(prev => {
            const newCompleted = prev.completedCount + 1;
            return {
              ...prev,
              steps: prev.steps.map(s => s.id === step.id ? { ...s, completed: true } : s),
              completedCount: newCompleted,
              percentComplete: Math.round((newCompleted / prev.totalCount) * 100),
              isCompleted: newCompleted >= prev.totalCount,
            };
          });
        }
      } catch {
        // Optimistic update on error
        setData(prev => {
          const newCompleted = prev.completedCount + 1;
          return {
            ...prev,
            steps: prev.steps.map(s => s.id === step.id ? { ...s, completed: true } : s),
            completedCount: newCompleted,
            percentComplete: Math.round((newCompleted / prev.totalCount) * 100),
            isCompleted: newCompleted >= prev.totalCount,
          };
        });
      }
    }
    navigate(step.path);
  };

  const handleDismiss = async () => {
    try { await apiService.post('/onboarding/dismiss'); } catch { /* silent */ }
    setVisible(false);
    message.success('Onboarding checklist dismissed. You can find it in Settings anytime.');
  };

  if (!visible || !data) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="ob-wrap">
        <div className="ob-card">
          {/* Header */}
          <div className="ob-header" onClick={() => setCollapsed(c => !c)}>
            <div className="ob-header-left">
              <div className="ob-icon-wrap"><RocketOutlined /></div>
              <div>
                <div className="ob-header-title">Getting Started</div>
                <div className="ob-header-sub">
                  {data.completedCount}/{data.totalCount} steps complete
                </div>
              </div>
            </div>
            <div className="ob-header-right">
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {data.percentComplete}%
              </span>
              {collapsed ? (
                <CaretUpOutlined style={{ color: '#fff', fontSize: 12 }} />
              ) : (
                <CaretDownOutlined style={{ color: '#fff', fontSize: 12 }} />
              )}
              <Tooltip title="Dismiss">
                <button className="ob-close-btn" onClick={e => { e.stopPropagation(); handleDismiss(); }}>
                  <CloseOutlined />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Progress bar */}
          <Progress
            percent={data.percentComplete}
            showInfo={false}
            strokeColor={{ from: '#667eea', to: '#764ba2' }}
            trailColor="#f0f0f0"
            style={{ margin: 0 }}
            strokeLinecap="square"
          />

          {/* Steps */}
          {!collapsed && (
            <>
              {data.isCompleted ? (
                <div className="ob-complete-banner">
                  <div className="icon">🎉</div>
                  <p>All steps complete! Your workspace is ready.</p>
                </div>
              ) : (
                <div className="ob-body">
                  {data.steps.map((step, i) => (
                    <div
                      key={step.id}
                      className={`ob-step${step.completed ? ' done' : ''}`}
                      onClick={() => handleStepClick(step)}
                    >
                      <div className={`ob-step-icon${step.completed ? ' done' : ' pending'}`}>
                        {step.completed
                          ? <CheckCircleFilled />
                          : <span>{i + 1}</span>
                        }
                      </div>
                      <span className="ob-step-label">{step.label}</span>
                      {!step.completed && <span className="ob-step-arrow">→</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="ob-footer">
                <button className="ob-dismiss" onClick={handleDismiss}>
                  Dismiss checklist
                </button>
                <span style={{ fontSize: 11, color: '#bbb' }}>
                  {data.totalCount - data.completedCount} remaining
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
