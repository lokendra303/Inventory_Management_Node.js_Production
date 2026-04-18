import React from 'react';
import { Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import '../../styles/Settings.css';

const Settings = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Organization Settings',
      items: [
        { label: 'Profile', path: '/settings/profile' },
        { label: 'Branding', path: '/settings/branding' },
        { label: 'Locations', path: '/settings/locations' },
        { label: 'Manage Subscription', path: '/settings/subscription' }
      ],
      type: 'green'
    },
    {
      title: 'Users & Roles',
      items: [
        { label: 'Users', path: '/users' },
        { label: 'Roles', path: '/roles' },
        { label: 'Account Settings', path: '/account-settings' },
        { label: 'User Preferences', path: '/settings/user-preferences' }
      ],
      type: 'red'
    },
    {
      title: 'Setup & Configurations',
      items: [
        { label: 'General', path: '/settings/general' },
        { label: 'Currencies', path: '/settings/currencies' },
        { label: 'Reminders', path: '/settings/reminders' },
        { label: 'Customer Portal', path: '/settings/customer-portal' }
      ],
      type: 'orange'
    },
    {
      title: 'Taxes & Compliance',
      items: [
        { label: 'Taxes', path: '/settings/taxes' },
        { label: 'Direct Taxes', path: '/settings/direct-taxes' },
        { label: 'MSME Settings', path: '/settings/msme' }
      ],
      type: 'blue'
    },
    {
      title: 'Customization',
      items: [
        { label: 'Transaction Number Series', path: '/settings/transaction-series' },
        { label: 'PDF Templates', path: '/settings/pdf-templates' },
        { label: 'Email Notifications', path: '/settings/email-notifications' },
        { label: 'SMS Notifications', path: '/settings/sms-notifications' },
        { label: 'Reporting Tags', path: '/settings/reporting-tags' },
        { label: 'Web Tabs', path: '/settings/web-tabs' }
      ],
      type: 'peach'
    },
    {
      title: 'Automation',
      items: [
        { label: 'Workflow Rules', path: '/settings/workflow-rules' },
        { label: 'Workflow Actions', path: '/settings/workflow-actions' },
        { label: 'Workflow Logs', path: '/settings/workflow-logs' }
      ],
      type: 'pink'
    },
    {
      title: 'Module Settings',
      items: [
        { label: 'Customers and Vendors', path: '/settings/customers-vendors' },
        { label: 'Items', path: '/items' },
        { label: 'Inventory Adjustments', path: '/inventory/adjustments' },
        { label: 'Packages', path: '/inventory/packages' },
        { label: 'Shipments', path: '/inventory/shipments' }
      ],
      type: 'mint'
    },
    {
      title: 'Extension & Developer Data',
      items: [
        { label: 'Widgets', path: '/settings/widgets' },
        { label: 'Incoming Webhooks', path: '/settings/webhooks' },
        { label: 'API Usage', path: '/settings/api-usage' }
      ],
      type: 'teal'
    }
  ];

  return (
    <div className="settings-page">
      <h1>All Settings</h1>

      <div className="settings-grid">
        {sections.map((section) => (
          <Card key={section.title} className="settings-card">
            <div className={`card-header ${section.type}`}>{section.title}</div>
            <div className="card-list">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="card-item"
                  onClick={() => item.path && navigate(item.path)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

    </div>
  );
};

export default Settings;