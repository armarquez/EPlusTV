# Debug Scripts for EPlusTV Handlers

This directory contains debugging utilities for testing and developing individual handler components.

## Available Scripts

## ESPN Handler Testing Scripts

All ESPN-specific testing scripts are located in the `debug/espn-handler/` directory:

### test-espn-handler.ts
Comprehensive testing script for ESPN handler with multiple commands:

```bash
# Show available commands
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts help

# Initialize the ESPN handler
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts initialize

# Test schedule fetching
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts getSchedule

# Test token refresh
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts refreshTokens
```

### quick-test.ts
Rapid prototyping script for testing specific functionality:

```bash
# Run quick tests (modify the script directly for your needs)
npx ts-node -r tsconfig-paths/register debug/quick-test.ts
```

## Creating Handler Debug Scripts

**📖 For complete provider development guide, see [ARCHITECTURE.md](./ARCHITECTURE.md#how-to-add-a-new-provider)**

To create debug scripts for other handlers, follow this pattern:

```typescript
import {handlerName} from '../../services/handler-name';

async function testFunction() {
  await handlerName.initialize();
  await handlerName.someMethod();
}

if (require.main === module) {
  testFunction().catch(console.error);
}
```

**Recommended Structure:**
- Create `debug/[provider]-handler/` directory for each provider
- Follow other provider handler debug script patterns
- Test authentication flows, token refresh, and error handling

## Tips for Handler Development

1. **Always initialize first**: Most handlers require `initialize()` to be called before other methods
2. **Use the debug scripts**: They provide better error handling and context than running handlers directly
3. **Check database state**: Many handlers rely on database configuration stored in NeDB
4. **Mock data when needed**: Use the quick-test.ts script to test with mock data during development
