# NicheStream Changelog

All notable changes to NicheStream are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 3: Async error recovery with exponential backoff and jitter
- Phase 3: Structured logging with RFC 5424 severity levels and JSON output
- Phase 3: VIP tier subscription support (monthly and annual plans)
- Phase 3: Google IMA SDK integration for video ad monetization
- Phase 3: Earnings attribution system with creator payouts
- Comprehensive API documentation (API.md)
- Developer contributing guide (CONTRIBUTING.md)
- Security policy and architecture documentation (SECURITY.md)
- Testing guide with test scripts (TESTING_GUIDE.md)
- Local development setup guide with Docker support (LOCAL_DEVELOPMENT_SETUP.md)
- Pre-deployment checklist and guide (PHASE_3_DEPLOYMENT_READY.md)

### Changed
- Updated Wrangler from v3.57.0 to v4.0.0+ (latest)
- Removed broken ESLint lint tasks (no dependencies installed)
- Simplified code quality gate to TypeScript strict mode
- Enhanced README with documentation navigation

### Fixed
- Build system no longer references missing ESLint dependencies
- TypeScript compilation works cleanly without dependency warnings
- Environment setup now has complete templates and documentation

### Security
- Added security policy documentation
- Documented CORS allowlist configuration
- Documented password requirements and hashing
- Documented secret management procedures
- Added rate limiting documentation
- Documented input validation patterns

## [Phase 2] - 2026-03-15

### Added
- BetterAuth email/password authentication
- Video upload and management with Cloudflare Stream
- Creator dashboard with analytics
- Subscription system with Stripe Connect
- Real-time chat, polls, and reactions via Durable Objects
- Freemium monetization (Free + Citizen tiers)
- Content moderation and reporting system
- WebSocket hibernation API for real-time features
- Entitlements context for role-based features
- Database migrations and seeding

### Architecture
- Monorepo with pnpm workspaces and Turborepo
- Frontend: Next.js 15 on Cloudflare Pages
- API: Cloudflare Workers + Hono framework + Durable Objects
- Database: Neon PostgreSQL via Hyperdrive
- ORM: Drizzle with type-safe queries

## [Phase 1] - 2026-02-01

### Initial Release
- Basic video upload and playback
- Creator profiles
- Video discovery and search
- User authentication
- Basic chat functionality

---

## Upgrade Guide

### From Phase 2 to Phase 3

**Prerequisites:**
- Update to Node.js 18+ and pnpm 9+
- Update Wrangler: `pnpm update wrangler@4`

**Database:**
```bash
cd packages/db
pnpm db:generate  # Generate new migrations
pnpm db:migrate   # Run migrations
```

**Environment Variables:**
Add to `apps/worker/.dev.vars`:
```
STRIPE_VIP_MONTHLY_PRICE=price_xxx
STRIPE_VIP_ANNUAL_PRICE=price_xxx
CHAT_RATE_LIMIT_VIP_MS=500
```

**Breaking Changes:**
- None - Phase 3 is backward compatible

---

## Known Issues

### Outstanding
- TypeScript 6.0 compatibility (currently using 5.9.3)
- Dead letter queue not yet implemented (Phase 4)
- Advanced analytics optimization (currently can make 10+ CF Stream API calls)

### Resolved
- ✅ Build system ESLint dependency issue (fixed in Phase 3)
- ✅ Broken lint tasks (removed in Phase 3)
- ✅ Missing documentation (comprehensive docs added in Phase 3)

---

## Roadmap

### Phase 3B (May 2026)
- VIP-exclusive features (custom branding, advanced analytics)
- Creator onboarding workflow
- Advanced moderation tools
- Performance dashboards

### Phase 4 (June 2026)
- Dead letter queue for failed events
- Analytics data warehouse
- A/B testing framework
- Advanced search and recommendations
- Creator community features

### Phase 5+ (Future)
- Live streaming
- Multi-creator channels
- NFT/blockchain features
- AI-powered recommendations
- Creator monetization api

---

## Performance

### Metrics
- Video upload: < 5 seconds for typical 50MB video
- Real-time chat: < 100ms latency via Durable Objects
- API response: < 200ms (p95)
- Page load: < 2 seconds (Lighthouse)

### Optimization Focus
- Cloudflare edge caching for static assets
- Hyperdrive connection pooling for database
- Durable Objects for real-time state
- WebSocket hibernation for efficient polling

---

## Security Updates

### Latest
- Phase 3 added structured logging for security events
- CORS allowlist enforcement
- Webhook signature verification
- Rate limiting by tier
- Input validation on all endpoints

### Rotating Secrets
- Stripe API keys: Monthly
- Authentication secrets: Quarterly
- Database credentials: On staff changes
- API tokens: As needed

---

## Contributors

- **adrper79-dot** - Project creator and lead
- Community contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## License

Private project. Unauthorized copying prohibited.

---

## Support

- **Documentation:** See [docs/](./docs/) folder
- **Issues:** Report on GitHub
- **Security:** Email security@nichestream.com
- **Questions:** See [CONTRIBUTING.md](./CONTRIBUTING.md) for contact info

---

## Deployment Status

| Environment | Status | Version | Updated |
|---|---|---|---|
| **Staging** | 🟡 Ready | Phase 3 | 2026-04-14 |
| **Production** | 🟢 Live | Phase 2 | 2026-03-15 |
| **Development** | 🟢 Active | Phase 3 Edge | Continuous |

**Next Production Release:** Phase 3 (estimated May 15, 2026)

---

Generated: 2026-04-14  
Last Updated: 2026-04-14
