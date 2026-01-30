# Universal Auth System

🚀 **Complete authentication system for Node.js applications** - Write once, use anywhere!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MySQL-blue.svg)](https://www.mysql.com/)

## ✨ Features

- 🔐 **Complete Authentication** - Login, register, JWT tokens
- 🏢 **Multi-institution Support** - Perfect for SaaS applications
- 🛡️ **Role & Permission Based** - Granular access control
- 🔄 **Auto-Migration** - Works with any existing project
- 📱 **Production Ready** - Security best practices included
- 🎯 **Zero Breaking Changes** - Optional integration

## 🚀 Quick Start

### Option 1: Auto-Migration (Existing Project)
```bash
git clone https://github.com/yourcompany/universal-auth-system.git
cd universal-auth-system
cp config.env .env
# Update .env with your database credentials
node tools/check.js      # Check compatibility
node tools/migrate.js    # Auto-migrate your project
```

### Option 2: New Project
```bash
git clone https://github.com/yourcompany/universal-auth-system.git
cd universal-auth-system
node package/setup-wizard.js
```

## 📁 Project Structure

```
universal-auth-system/
├── 📦 package/                    # Core auth library
│   ├── lib/                       # Auth components
│   ├── docs/                      # Documentation
│   └── examples/                  # Usage examples
├── 🛠️ tools/                      # Migration & testing tools
│   ├── migrate.js                 # Auto-migration script
│   ├── check.js                   # Compatibility checker
│   └── test.js                    # System tests
├── 📝 examples/                   # Usage examples
│   └── app.js                     # Complete application
├── config.env                     # Environment configuration
└── README.md                      # This file
```

## 🛠️ Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourcompany/universal-auth-system.git
cd universal-auth-system
```

### 2. Configure Environment
```bash
cp config.env .env
# Edit .env with your database credentials
```

### 3. Install Dependencies
```bash
npm install bcryptjs jsonwebtoken uuid mysql2 express dotenv
```

### 4. Run Migration
```bash
node tools/migrate.js
```

### 5. Test System
```bash
node tools/test.js
```

## 📚 Documentation

- **[Complete Implementation Guide](package/docs/IMPLEMENTATION-GUIDE.md)** - Full setup guide
- **[API Reference](package/docs/IMPLEMENTATION-GUIDE.md#-complete-api-reference)** - All endpoints
- **[Migration Guide](package/docs/IMPLEMENTATION-GUIDE.md#-auto-migration-for-existing-projects)** - Existing projects

## 🔧 Usage

### Basic Integration
```javascript
const { OptionalAuth } = require('./universal-auth-system/package');

const auth = new OptionalAuth({
  enabled: true,
  jwtSecret: process.env.JWT_SECRET,
  database: db
});

// Add auth routes
app.use('/api/auth', auth.getAuthRoutes());

// Protect routes
app.use('/api/protected', auth.authenticate());
```

### API Endpoints
- `POST /api/auth/register` - Register company
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get profile
- `POST /api/auth/users` - Create user (admin)
- `PUT /api/auth/users/:id/permissions` - Update permissions

## 🧪 Testing

```bash
# Check database compatibility
node tools/check.js

# Run system tests
node tools/test.js

# Start application
node examples/app.js
```

## 🚀 Production Deployment

### Environment Variables
```bash
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=your-database
JWT_SECRET=your-super-secure-secret-min-32-chars
AUTH_ENABLED=true
```

### Security Checklist
- ✅ Strong JWT secret (32+ characters)
- ✅ HTTPS enabled
- ✅ Database credentials secured
- ✅ Rate limiting configured
- ✅ Logging enabled

## 🔄 Migration Scenarios

### Existing Project with Database
```bash
node tools/check.js      # Analyze current structure
node tools/migrate.js    # Auto-add auth tables and fields
```

### Brand New Project
```bash
node package/setup-wizard.js    # Create complete project
```

### Gradual Integration
```javascript
// Start with auth disabled
const auth = new OptionalAuth({ enabled: false });
// Later enable: AUTH_ENABLED=true in .env
```

## 🛡️ Security Features

- 🔐 **JWT Authentication** - Secure token-based auth
- 🏢 **Multi-institution Isolation** - Complete data separation
- 🛡️ **Role-Based Access** - Admin, manager, user roles
- 🎯 **Permission System** - Granular access control
- 🔄 **Session Management** - Automatic token refresh
- 🚫 **Brute Force Protection** - Rate limiting support

## 📊 Database Support

- **Auto-Migration** - Adds auth tables to existing database
- **Multi-institution** - Automatic institution_id isolation
- **Backward Compatible** - Existing queries still work
- **Performance Optimized** - Proper indexing included

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation**: [Implementation Guide](package/docs/IMPLEMENTATION-GUIDE.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourcompany/universal-auth-system/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourcompany/universal-auth-system/discussions)

## 🎯 Why Universal Auth?

- **Save Development Time** - No need to build auth from scratch
- **Production Ready** - Security best practices included
- **Multi-institution** - Perfect for SaaS applications
- **Zero Breaking Changes** - Works with existing projects
- **Comprehensive** - Complete auth solution

---

**Made with ❤️ for the Node.js community**