# Frontend - IMS SEPCUNE

## 📋 Overview

This is the frontend application for the Inventory Management System (IMS SEPCUNE), built with React and Ant Design.

## 🏗️ Structure

The frontend has been professionally organized following React best practices:

```
src/
├── components/     # Reusable UI components (14 files)
├── pages/          # Route/page components (29 files)
├── services/       # API service layer (3 files)
├── hooks/          # Custom React hooks (2 files)
├── contexts/       # React context providers (1 file)
├── utils/          # Utility functions (2 files)
└── styles/         # Global CSS files (2 files)
```

## 📚 Documentation

Comprehensive documentation is available:

- **[STRUCTURE_GUIDE.md](./STRUCTURE_GUIDE.md)** - Quick reference for file locations and import paths
- **[STRUCTURE_VISUAL.md](./STRUCTURE_VISUAL.md)** - Visual diagrams of the architecture
- **[FRONTEND_REORGANIZATION.md](./FRONTEND_REORGANIZATION.md)** - Detailed reorganization documentation
- **[REORGANIZATION_SUMMARY.md](./REORGANIZATION_SUMMARY.md)** - Summary and verification checklist

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 📂 Directory Details

### Components (`/src/components`)

Organized by type:

- **layout/** - Navigation and layout components (Header, Sidebar)
- **forms/** - Form components (InvoiceForm, ItemForm, etc.)
- **common/** - Reusable common components (CurrencySelector, ErrorBoundary, etc.)
- **business/** - Business-specific components (InvoicePreview, POConfirmation, etc.)

### Pages (`/src/pages`)

Organized by feature:

- **auth/** - Authentication pages
- **dashboard/** - Dashboard page
- **entities/** - Entity management (customers, vendors)
- **inventory/** - Inventory management pages
- **purchases/** - Purchase management pages
- **sales/** - Sales management pages
- **reports/** - Report pages
- **settings/** - Settings pages
- **documents/** - Documents page

### Services (`/src/services`)

API service layer:
- **apiService.js** - HTTP client with authentication
- **itemService.js** - Item-specific API calls
- **masterDataService.js** - Master data API calls

### Hooks (`/src/hooks`)

Custom React hooks:
- **useAuth.jsx** - Authentication hook
- **useSessionManager.jsx** - Session management hook

### Contexts (`/src/contexts`)

React context providers:
- **CurrencyContext.jsx** - Global currency state

### Utils (`/src/utils`)

Utility functions:
- **currency.js** - Currency formatting utilities
- **numberFormat.js** - Number formatting utilities

## 🎯 Key Features

- **Authentication** - JWT-based authentication with role-based access control
- **Inventory Management** - Track items, packages, and stock levels
- **Purchase Management** - Manage vendors, purchase orders, and invoices
- **Sales Management** - Manage customers, sales orders, and invoices
- **Reports** - Generate various business reports
- **Multi-currency Support** - Support for multiple currencies
- **Responsive Design** - Mobile-friendly interface
- **Permission System** - Granular permission-based access control

## 🔧 Development

### Adding New Pages

1. Create file in appropriate `pages/` subdirectory
2. Use correct import depth (see STRUCTURE_GUIDE.md)
3. Add route in `App.jsx`

Example:
```javascript
// pages/inventory/NewPage.jsx
import { useAuth } from '../../hooks/useAuth.jsx';
import apiService from '../../services/apiService';

const NewPage = () => {
  // Component logic
};

export default NewPage;
```

### Adding New Components

1. Create file in appropriate `components/` subdirectory
2. Use correct import depth
3. Export and import where needed

Example:
```javascript
// components/common/NewComponent.jsx
import { useAuth } from '../../hooks/useAuth.jsx';

const NewComponent = () => {
  // Component logic
};

export default NewComponent;
```

## 📦 Dependencies

### Core
- React 18.x
- React Router DOM 6.x
- Ant Design 5.x

### State Management
- React Context API

### HTTP Client
- Axios

### Charts
- Recharts

### Utilities
- date-fns
- lodash

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 🏗️ Build

```bash
# Production build
npm run build

# Analyze bundle size
npm run build -- --stats
```

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1366px - 1920px)
- Tablet (768px - 1366px)
- Mobile (320px - 768px)

## 🔐 Security

- JWT token-based authentication
- Role-based access control (RBAC)
- Permission-based component rendering
- Secure API communication
- Session management

## 🎨 Styling

- Ant Design component library
- Custom CSS modules
- Responsive design patterns
- Theme customization support

## 📊 Performance

- Code splitting
- Lazy loading
- Optimized bundle size
- Efficient re-rendering
- Memoization where needed

## 🐛 Debugging

### Common Issues

1. **Import errors**: Check STRUCTURE_GUIDE.md for correct import paths
2. **Route not found**: Verify route is added in App.jsx
3. **API errors**: Check .env configuration and backend connection

### Debug Mode

```bash
# Start with debug logging
REACT_APP_DEBUG=true npm start
```

## 📈 Roadmap

- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Implement PWA features
- [ ] Add offline support
- [ ] Improve accessibility (WCAG 2.1)
- [ ] Add internationalization (i18n)

## 🤝 Contributing

1. Follow the existing structure
2. Use consistent naming conventions
3. Add proper documentation
4. Test your changes
5. Update relevant documentation

## 📄 License

Proprietary - All rights reserved

## 👥 Team

- Frontend Development Team
- Backend Integration Team
- UI/UX Design Team

## 📞 Support

For issues or questions:
- Check documentation first
- Review STRUCTURE_GUIDE.md
- Contact development team

---

**Last Updated**: 2024
**Version**: 1.0.0
**Status**: Production Ready ✅
