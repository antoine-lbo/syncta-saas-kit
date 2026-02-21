# Security Policy

## Reporting a Vulnerability

We take the security of Syncta SaaS Kit seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Email**: Send a detailed report to security@syncta.ai
2. **Do NOT** open a public GitHub issue for security vulnerabilities
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Resolution Target**: Within 30 days for critical issues

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
| < 1.0   | No        |

## Security Measures

This project implements the following security practices:

- **Authentication**: NextAuth.js with secure session management
- **Authorization**: Role-based access control (RBAC) for multi-tenant isolation
- **Input Validation**: Server-side validation on all API routes
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM
- **XSS Protection**: React auto-escaping and Content Security Policy headers
- **CSRF Protection**: Built-in Next.js CSRF tokens
- **Rate Limiting**: API rate limiting on authentication endpoints
- **Dependency Scanning**: Automated npm audit in CI/CD pipeline
- **Secret Detection**: TruffleHog integration to prevent credential leaks
- **HTTPS Enforcement**: Strict Transport Security headers in production

## Security-Related Configuration

### Environment Variables

Never commit sensitive environment variables. Use `.env.local` for development and secure secret management in production.

Required security-related environment variables:

```
NEXTAUTH_SECRET=     # Strong random secret for session signing
NEXTAUTH_URL=        # Canonical URL of the application
DATABASE_URL=        # Database connection string (use SSL in production)
STRIPE_SECRET_KEY=   # Stripe API secret key
STRIPE_WEBHOOK_SECRET= # Stripe webhook signing secret
```

### Best Practices for Contributors

- Never hardcode secrets or API keys
- Use parameterized queries (Prisma handles this automatically)
- Keep dependencies updated (`npm audit` regularly)
- Validate and sanitize all user inputs server-side
- Use HTTPS for all external API calls
- Follow the principle of least privilege for database roles
- Write tests for authentication and authorization logic

## Disclosure Policy

We follow a coordinated disclosure process. We ask that you give us reasonable time to address vulnerabilities before public disclosure.
