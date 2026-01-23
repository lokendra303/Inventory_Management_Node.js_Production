# IMS SEPCUNE - Production-Ready Multi-Tenant Inventory Management System

A comprehensive, event-sourced, multi-tenant inventory management system built with Node.js, React, MySQL, and Redis. Designed for real SME and enterprise usage with strong consistency guarantees, tenant isolation, and operational safety.

## 🏗️ Architecture Overview

### Core Principles
- **Event Sourcing**: All state changes are captured as immutable events
- **Multi-Tenancy**: Complete tenant isolation at all levels
- **CQRS**: Separate read and write models with projections
- **Concurrency Safety**: Optimistic locking and aggregate-level consistency
- **Audit Trail**: Complete audit log of all operations

### Technology Stack
- **Backend**: Node.js, Express.js
- **Database**: MySQL (primary), Redis (cache)
- **Frontend**: React, Ant Design
- **Authentication**: JWT with tenant context
- **Background Jobs**: Bull Queue (Redis-based)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd PRD_IMS_SEPCUNE
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd frontend
npm install
cd ..
```

4. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your database and Redis credentials
```

5. **Database Setup**
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE ims_sepcune;"

# Run migrations
npm run migrate
```

6. **Start the application**
```bash
# Start backend (development)
npm run dev

# Start frontend (in another terminal)
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## 📋 Features

### Core Inventory Management
- ✅ **Event-Sourced Inventory**: All stock movements tracked as events
- ✅ **Multi-Warehouse Support**: Hierarchical warehouse management
- ✅ **Item Management**: Simple, variant, composite, and service items
- ✅ **Stock Operations**: Receive, Reserve, Ship, Adjust, Transfer
- ✅ **Valuation Methods**: FIFO and Weighted Average costing
- ✅ **Concurrency Control**: Prevents overselling and race conditions

### Multi-Tenancy
- ✅ **Complete Tenant Isolation**: Data, cache, and operations
- ✅ **Tenant Context Enforcement**: All operations tenant-scoped
- ✅ **Subdomain Support**: tenant.yourdomain.com routing
- ✅ **Per-Tenant Configuration**: Settings and feature flags

### Purchase Management
- ✅ **Purchase Orders**: Multi-line POs with partial receipts
- ✅ **GRN Processing**: Goods Receipt Notes with event generation
- ✅ **Multi-Currency Support**: Exchange rate handling
- ✅ **Vendor Management**: Vendor information and lead times

### Sales Management
- ✅ **Sales Orders**: Reservation and shipment workflow
- ✅ **Channel Support**: Online, offline, marketplace tracking
- ✅ **Pre-Orders**: Allow negative available stock tracking
- ✅ **Shipment Processing**: Separate reservation and fulfillment

### Automation & Rules
- ✅ **Rule Engine**: Tenant-configurable business rules
- ✅ **Event Triggers**: React to inventory events
- ✅ **Actions**: Email, Webhook, WhatsApp notifications
- ✅ **Conditional Logic**: IF-THEN rule processing

### Security & Access Control
- ✅ **JWT Authentication**: Secure token-based auth
- ✅ **Role-Based Access Control**: Admin, Manager, User roles
- ✅ **Warehouse-Level Permissions**: Granular access control
- ✅ **Rate Limiting**: Per-tenant API rate limits

### Reporting & Analytics
- ✅ **Real-Time Projections**: Fast read models
- ✅ **Stock Reports**: On-hand, available, reserved quantities
- ✅ **Low Stock Alerts**: Configurable threshold monitoring
- ✅ **Audit Reports**: Complete event history

## 🏢 Multi-Tenant Architecture

### Tenant Isolation Levels
1. **Database Level**: All tables include tenant_id
2. **API Level**: Tenant context in every request
3. **Cache Level**: Tenant-prefixed Redis keys
4. **Background Jobs**: Tenant-scoped processing

### Tenant Context Sources
1. **JWT Token**: Primary method for authenticated requests
2. **Subdomain**: tenant.domain.com routing
3. **Header**: X-Tenant-ID header fallback

## 📊 Event Sourcing Implementation

### Event Store Structure
```sql
event_store (
  id, tenant_id, aggregate_type, aggregate_id, 
  aggregate_version, event_type, event_data, 
  metadata, idempotency_key, created_at
)
```

### Supported Events
- `PurchaseReceived`: Stock receipt from suppliers
- `SaleReserved`: Stock reservation for orders
- `SaleShipped`: Final stock deduction on shipment
- `StockAdjusted`: Manual stock adjustments
- `TransferOut/In`: Inter-warehouse transfers

### Projection Rebuilding
```bash
# Rebuild specific projection
node src/scripts/rebuildProjection.js --tenant=<tenant-id> --item=<item-id> --warehouse=<warehouse-id>
```

## 🔧 Configuration

### Environment Variables
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ims_sepcune
DB_USER=root
DB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=development
```

### Tenant Settings
Each tenant can configure:
- Inventory valuation method (FIFO/Weighted Average)
- Allow negative stock
- Low stock thresholds
- Automation rules
- Notification preferences

## 🔒 Security Features

### Authentication & Authorization
- JWT tokens with tenant context
- Role-based permissions (admin, manager, user)
- Warehouse-level access control
- Session management and token refresh

### Data Protection
- Tenant data isolation
- Audit logging for all operations
- Rate limiting per tenant
- Input validation and sanitization

### API Security
- HTTPS enforcement
- CORS configuration
- Helmet.js security headers
- Request size limits

## 📈 Scalability Considerations

### Database Optimization
- Proper indexing on tenant_id + other fields
- Event store partitioning by tenant
- Read replicas for reporting queries
- Connection pooling

### Caching Strategy
- Redis for projection caching
- Tenant-aware cache keys
- Cache invalidation on events
- Session storage

### Background Processing
- Bull queues for async operations
- Tenant-scoped job processing
- Retry mechanisms
- Dead letter queues

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## 📦 Deployment

### Production Setup
1. **Environment Configuration**
   - Set production environment variables
   - Configure SSL certificates
   - Set up monitoring and logging

2. **Database Setup**
   - Create production database
   - Run migrations
   - Set up backups

3. **Application Deployment**
   - Build frontend: `cd frontend && npm run build`
   - Start backend: `npm start`
   - Configure reverse proxy (nginx)

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🔍 Monitoring & Observability

### Logging
- Structured JSON logging with Winston
- Tenant-aware log entries
- Error tracking and alerting
- Performance monitoring

### Metrics
- Per-tenant usage metrics
- API response times
- Database query performance
- Cache hit rates

### Health Checks
- `/api/health` endpoint
- Database connectivity
- Redis connectivity
- Service dependencies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API documentation at `/api/docs`

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Core inventory management
- ✅ Multi-tenant architecture
- ✅ Event sourcing implementation
- ✅ Basic reporting

### Phase 2 (Next)
- [ ] Advanced forecasting with ML
- [ ] Multi-level approval workflows
- [ ] Advanced analytics dashboard
- [ ] Mobile app (PWA)

### Phase 3 (Future)
- [ ] Marketplace integrations
- [ ] Advanced automation
- [ ] IoT device integration
- [ ] Advanced reporting suite

---

**Built with ❤️ for modern inventory management needs**