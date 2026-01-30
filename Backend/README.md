# IMS SEPCUNE - Production-Ready Multi-institution Inventory Management System

A comprehensive, event-sourced, multi-institution inventory management system built with Node.js, React, MySQL, and Redis. Designed for real SME and enterprise usage with strong consistency guarantees, institution isolation, and operational safety.

## 🏗️ Architecture Overview

### Core Principles
- **Event Sourcing**: All state changes are captured as immutable events
- **Multi-Tenancy**: Complete institution isolation at all levels
- **CQRS**: Separate read and write models with projections
- **Concurrency Safety**: Optimistic locking and aggregate-level consistency
- **Audit Trail**: Complete audit log of all operations

### Technology Stack
- **Backend**: Node.js, Express.js
- **Database**: MySQL (primary), Redis (cache)
- **Frontend**: React, Ant Design
- **Authentication**: JWT with institution context
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
- ✅ **Complete institution Isolation**: Data, cache, and operations
- ✅ **institution Context Enforcement**: All operations institution-scoped
- ✅ **Subdomain Support**: institution.yourdomain.com routing
- ✅ **Per-institution Configuration**: Settings and feature flags

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
- ✅ **Rule Engine**: institution-configurable business rules
- ✅ **Event Triggers**: React to inventory events
- ✅ **Actions**: Email, Webhook, WhatsApp notifications
- ✅ **Conditional Logic**: IF-THEN rule processing

### Security & Access Control
- ✅ **JWT Authentication**: Secure token-based auth
- ✅ **Role-Based Access Control**: Admin, Manager, User roles
- ✅ **Warehouse-Level Permissions**: Granular access control
- ✅ **Rate Limiting**: Per-institution API rate limits

### Reporting & Analytics
- ✅ **Real-Time Projections**: Fast read models
- ✅ **Stock Reports**: On-hand, available, reserved quantities
- ✅ **Low Stock Alerts**: Configurable threshold monitoring
- ✅ **Audit Reports**: Complete event history

## 🏢 Multi-institution Architecture

### institution Isolation Levels
1. **Database Level**: All tables include institution_id
2. **API Level**: institution context in every request
3. **Cache Level**: institution-prefixed Redis keys
4. **Background Jobs**: institution-scoped processing

### institution Context Sources
1. **JWT Token**: Primary method for authenticated requests
2. **Subdomain**: institution.domain.com routing
3. **Header**: X-institution-ID header fallback

## 📊 Event Sourcing Implementation

### Event Store Structure
```sql
event_store (
  id, institution_id, aggregate_type, aggregate_id, 
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
node src/scripts/rebuildProjection.js --institution=<institution-id> --item=<item-id> --warehouse=<warehouse-id>
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

### institution Settings
Each institution can configure:
- Inventory valuation method (FIFO/Weighted Average)
- Allow negative stock
- Low stock thresholds
- Automation rules
- Notification preferences

## 🔒 Security Features

### Authentication & Authorization
- JWT tokens with institution context
- Role-based permissions (admin, manager, user)
- Warehouse-level access control
- Session management and token refresh

### Data Protection
- institution data isolation
- Audit logging for all operations
- Rate limiting per institution
- Input validation and sanitization

### API Security
- HTTPS enforcement
- CORS configuration
- Helmet.js security headers
- Request size limits

## 📈 Scalability Considerations

### Database Optimization
- Proper indexing on institution_id + other fields
- Event store partitioning by institution
- Read replicas for reporting queries
- Connection pooling

### Caching Strategy
- Redis for projection caching
- institution-aware cache keys
- Cache invalidation on events
- Session storage

### Background Processing
- Bull queues for async operations
- institution-scoped job processing
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
- institution-aware log entries
- Error tracking and alerting
- Performance monitoring

### Metrics
- Per-institution usage metrics
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
- ✅ Multi-institution architecture
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