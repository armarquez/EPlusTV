# ESPN Handler Debug Scripts

This directory contains all testing and debugging scripts specific to the ESPN handler functionality.

## Available Scripts

### test-espn-handler.ts
Main ESPN handler testing script with multiple commands:

```bash
# Show all available commands
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts help

# Initialize the ESPN handler
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts initialize

# Test schedule fetching
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts getSchedule

# Test token refresh
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts refreshTokens

# Test in-market teams refresh
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts refreshInMarketTeams

# Test ISP access
npx ts-node -r tsconfig-paths/register debug/espn-handler/test-espn-handler.ts testIspAccess
```
