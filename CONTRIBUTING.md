# Contributing to Syncta SaaS Kit

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+ and npm 9+
- A Supabase project ([supabase.com](https://supabase.com))
- A Stripe account ([stripe.com](https://stripe.com))
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/antoine-lbo/syncta-saas-kit.git
cd syncta-saas-kit

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Stripe keys

# Run database migrations
npx supabase db push

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
src/
  app/           # Next.js App Router pages and API routes
  components/    # Reusable React components (shadcn/ui based)
  lib/           # Utility functions, Supabase client, Stripe helpers
  types/         # TypeScript type definitions
supabase/
  migrations/    # Database migration files
  functions/     # Supabase Edge Functions
emails/          # React Email templates
scripts/         # Database seeding and utility scripts
```

## How to Contribute

### 1. Fork and Branch

```bash
# Fork the repo on GitHub, then:
git checkout -b feature/your-feature-name
```

### 2. Code Standards

- **TypeScript** is required for all new code
- Use **Tailwind CSS** for styling (no custom CSS files)
- Components should use **shadcn/ui** patterns
- All exports should have proper TypeScript types
- Use `async/await` over raw Promises
- Follow the existing file naming conventions (`kebab-case` for files)

### 3. Commit Messages

Follow conventional commits:

```
feat: add stripe webhook retry logic
fix: resolve auth redirect loop on expired sessions
docs: update environment variable reference
refactor: extract billing logic into separate module
test: add integration tests for subscription flow
```

### 4. Testing

```bash
# Run the linter
npm run lint

# Type check
npm run type-check

# Run tests
npm run test

# Build to verify no errors
npm run build
```

### 5. Pull Requests

- Reference any related issues
- Include screenshots for UI changes
- Ensure CI passes before requesting review
- Keep PRs focused on a single concern

## Reporting Issues

Use [GitHub Issues](https://github.com/antoine-lbo/syncta-saas-kit/issues) with:

- Clear description of the problem or feature request
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Environment details (Node version, OS, browser)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
