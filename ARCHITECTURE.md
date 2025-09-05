# Architecture Overview

This document provides a detailed overview of the EPlusTV application's architecture. It is intended for developers who want to understand how the system works, how to add new features, or how to debug existing ones.

## Core Concepts

EPlusTV's primary function is to aggregate content from various providers and present them as standard IPTV channels, complete with M3U playlists and XMLTV electronic program guides (EPG).

### Data flow: Data broker

The data flow for EPlusTV is as follows:

1.  **M3U Playlist Request**: The client requests the channel playlist (`/channels.m3u`) from the EPlusTV server.
2.  **Playlist Generation**: The server generates this M3U file. The URLs for each channel inside this file point *back to the EPlusTV server itself* (e.g., `http://<server_ip>/channels/101.m3u8`).
3.  **Channel Selection**: The user selects a channel in their client. The client then requests the corresponding `.m3u8` URL from the EPlusTV server.
4.  **Stream Launch**: This request hits the EPlusTV server, which identifies the currently scheduled event for that virtual channel.
5.  **Provider Connection**: The server uses the appropriate provider "handler" to fetch the *actual* HLS stream manifest URL from the source (e.g., provider's servers). This involves using the stored authentication artifacts for that provider.
6.  **Manifest Rewriting (Broker)**: The server fetches the provider's HLS manifest. It then rewrites all the URLs for the video segments (`.ts` files) inside the manifest to also point back to the EPlusTV server.
7.  **Client Playback**: The rewritten manifest is sent to the client. The client then requests each video segment from the EPlusTV server, which in turn fetches it from the provider and streams it to the client.

```mermaid
sequenceDiagram
    participant Client as IPTV Client (VLC, etc.)
    participant Server as EPlusTV Server
    participant Provider as Provider API

    Client->>Server: 1. GET /channels.m3u
    Server->>Client: 2. M3U Playlist (URLs point to EPlusTV)

    Client->>Server: 3. GET /channels/101.m3u8
    activate Server
    Server->>Server: 4. launch-channel.ts finds event
    Server->>Provider: 5. Get Event Data (using stored auth)
    Provider-->>Server: 6. Original HLS Manifest URL
    Server->>Provider: 7. GET HLS Manifest
    Provider-->>Server: 8. HLS Manifest Content
    Server->>Server: 9. Rewrite segment URLs to broker
    Server-->>Client: 10. Rewritten HLS Manifest
    deactivate Server

    loop For each video segment
        Client->>Server: 11. GET /chunklist/xyz/abc.ts
        activate Server
        Server->>Provider: 12. GET original video segment
        Provider-->>Server: 13. Video segment data
        Server-->>Client: 14. Video segment data
        deactivate Server
    end
```

## Data and Scheduling Flow

The application periodically fetches event data from all enabled providers, stores it, and then builds a virtual schedule.

```mermaid
graph TD
    subgraph "EPG Fetch (Scheduled Task)"
        A[Timer Trigger] --> B{For each enabled provider}
        B --> C[handler getSchedule]
        C --> D[Provider API]
        D --> E[Raw Event Data]
        E --> F[Parse & Save to entries.db]
        F --> B
    end

    subgraph "Virtual Channel Scheduling"
        G[build-schedule.ts] --> H[Read all from entries.db]
        H --> I[Assign virtual channel number]
        I --> J[Save/Update schedule.db]
    end

    subgraph "Client Request"
        K[Client requests /xmltv.xml] --> L{generate-xmltv.ts}
        L --> M[Read from schedule.db & entries.db]
        M --> N[Generate XMLTV output]
        N --> K
    end

    A --> G
```

## Project Structure

The project is a Node.js application written in TypeScript, using Hono for the web server and JSX for templating the admin UI.

-   `index.tsx`: The main entry point. It sets up the Hono server, defines the primary routes (`/channels.m3u`, `/xmltv.xml`, `/channels/:id.m3u8`), and mounts the provider-specific UI routes.
-   `views/`: Contains the main layout components for the web UI (header, styles, etc.).
-   `services/`: This is the heart of the backend logic.
    -   It contains individual `[provider]-handler.ts` files for each streaming provider.
    -   It also contains core services for scheduling, playlist generation, and the content brokering.
-   `services/providers/`: This directory contains the **frontend UI and backend route handling** for the admin panel's provider configuration cards.
    -   Each subdirectory corresponds to a provider.
    -   `[provider]/index.tsx`: Defines the Hono routes for handling UI interactions (e.g., toggling the provider, submitting login forms).
    -   `[provider]/views/`: Contains the JSX components that render the provider's configuration card in the browser.

## Key Files and Their Roles

### Backend Logic (`services/`)

-   **`services/[provider]-handler.ts`** (e.g., `flo-handler.ts`)
    -   **Role**: Contains all logic for a single provider. This is the primary file to edit when fixing a provider or adding a new one.
    -   **Key Methods**:
        -   `initialize()`: Sets up the provider, loading auth artifacts from the database.
        -   `refreshTokens()`: Logic to refresh expired auth artifacts.
        -   `getSchedule()`: Fetches the schedule of events from the provider's API and stores them in the `entries.db` database.
        -   `getEventData(eventId)`: The most critical method for streaming. Given an event ID, it performs the necessary API calls to get the master HLS manifest URL from the provider.

-   **`services/launch-channel.ts`**
    -   **Role**: Manages the HLS brokering. It's triggered when a client requests a `.m3u8` file.
    -   **Functionality**: It finds the correct provider handler for the current event, calls its `getEventData()` method, and then uses `PlaylistHandler` to fetch and rewrite the manifest.

-   **`services/playlist-handler.ts`**
    -   **Role**: The low-level HLS manifest parser and rewriter. It replaces segment and key URLs with URLs that point back to the EPlusTV server, enabling the data brokering.

-   **`services/generate-m3u.ts` & `services/generate-xmltv.ts`**
    -   **Role**: These files are responsible for generating the M3U playlist and XMLTV guide data based on the scheduled events in the database.

-   **`services/build-schedule.ts`**
    -   **Role**: Contains the logic for the virtual channel scheduler. It takes all the events fetched by the handlers (from `entries.db`) and assigns them to an available virtual channel slot in the `schedule.db`.

-   **`services/database.ts`**
    -   **Role**: Initializes the NeDB databases used for storing provider configurations, schedule data, and event entries.

### Frontend & UI Logic (`services/providers/`)

-   **`services/providers/index.ts`**
    -   **Role**: This file aggregates all the individual provider route handlers and exports them as a single Hono app to be mounted by the main `index.tsx`.

-   **`services/providers/[provider]/index.tsx`** (e.g., `services/providers/bally/index.tsx`)
    -   **Role**: Defines the API routes for a specific provider's UI card. It handles `PUT` and `POST` requests from the frontend, typically triggered by HTMX.
    -   **Functionality**: Handles toggling the provider on/off, processing login forms, and updating settings. It calls the corresponding handler's methods and returns updated JSX components to the browser.

-   **`services/providers/[provider]/views/`** (e.g., `services/providers/bally/views/`)
    -   **Role**: Contains the actual JSX components that make up the UI for a provider's card.
    -   **Key Components**:
        -   `index.tsx`: The main card component.
        -   `Login.tsx`: The login form or activation code display.
        -   `CardBody.tsx`: The content of the card shown after being enabled/authenticated.

## Authentication Architecture Deep Dive

### Token Persistence Strategy
All handlers implement **dual persistence**:
- **Database**: NeDB providers collection for runtime access
- **JSON Files**: Config directory for backup/recovery
- **Why Both**: Database for quick access, JSON for persistence across restarts

### Provider Handler Patterns

#### Standard Handler Lifecycle
```typescript
class ProviderHandler {
  // 1. Initialization - Load existing tokens and configuration
  async initialize(): Promise<void> {
    await this.load();        // Load from database
    this.loadJSON();         // Load from JSON files
  }

  // 2. Token Management - Automatic refresh with validation
  async refreshTokens(): Promise<void> {
    // JWT validation and expiration checking
    // Graceful failure handling
    // Rate limiting and exponential backoff
  }

  // 3. Schedule Fetching - Provider-specific EPG data
  async getSchedule(): Promise<IEntry[]> {
    // Fetch from provider APIs
    // Parse and normalize data
    // Store in entries.db
  }

  // 4. Stream Access - Critical for data brokering
  async getEventData(eventId: string): Promise<TChannelPlaybackInfo> {
    // Choose authentication method
    // Fetch HLS manifest URL
    // Return playback information
  }

  // 5. Persistence - Dual storage strategy
  private async save(): Promise<void> {
    // Save to database
    // Save to JSON files
  }
}
```

#### Authentication Implementation Patterns

**Token Validation**:
```typescript
const isTokenValid = (token?: string): boolean => {
  if (!token) return false;
  try {
    const decoded: IJWToken = jwt_decode(token);
    return new Date().valueOf() / 1000 < decoded.exp;
  } catch (e) {
    return false;
  }
};
```

**Graceful Authentication**:
```typescript
async getEventData(eventId: string) {
  try {
    // Primary authentication method
    return await this.authenticateWithPrimary(eventId);
  } catch (primaryError) {
    console.log('Primary auth failed, trying fallback...');
    try {
      // Fallback authentication method
      return await this.authenticateWithFallback(eventId);
    } catch (fallbackError) {
      // Graceful degradation - return error or basic stream
      throw new Error('All authentication methods failed');
    }
  }
}
```

## Database Schema and Data Flow

### NeDB Collections Structure

#### `providers` Collection
```typescript
interface IProvider<TTokens, TMeta> {
  name: string;           // Unique provider identifier
  enabled: boolean;       // Runtime toggle state
  tokens?: TTokens;       // Provider-specific authentication data
  meta?: TMeta;          // Provider-specific configuration
}

#### `entries` Collection - Raw Event Data
```typescript
interface IEntry {
  id: string;              // Unique event identifier
  name: string;            // Event title
  network: string;         // Source network/provider
  start: string;           // ISO timestamp
  end: string;             // ISO timestamp
  // ... additional metadata
}
```

#### `schedule` Collection - Virtual Channel Assignments  
```typescript
interface ISchedule {
  channel: number;         // Virtual channel number (101, 102, etc.)
  name: string;           // Channel name
  events: IEntry[];       // Scheduled events for this channel
}
```

### Data Flow Architecture

```mermaid
graph TD
    subgraph "Authentication Layer"
        A[Provider Login] --> B[Token Storage]
        B --> C[Token Validation]
        C --> D[Auto Refresh]
        D --> B
    end

    subgraph "Content Discovery"
        E[Handler.getSchedule] --> F[Provider APIs]
        F --> G[Parse Events]
        G --> H[Store in entries.db]
    end

    subgraph "Channel Management" 
        I[build-schedule.ts] --> J[Read entries.db]
        J --> K[Assign Virtual Channels]
        K --> L[Update schedule.db]
    end

    subgraph "Client Serving"
        M[Client Request] --> N{Request Type}
        N -->|M3U| O[generate-m3u.ts]
        N -->|XMLTV| P[generate-xmltv.ts]  
        N -->|Stream| Q[launch-channel.ts]
        
        Q --> R[Find Current Event]
        R --> S[Handler.getEventData]
        S --> T[HLS Broker]
    end

    A --> E
    H --> I
    L --> M
```

## Advanced Debugging and Development

### Debug Infrastructure

The `debug/` directory provides comprehensive testing tools.

### Common Debugging Patterns

#### Global Settings vs Provider-Specific Logic

**Issue Pattern**: Provider features may depend on both global settings and provider-specific configuration.

**Example**: Example Provider premium linear channels require:
1. Global `use_linear` setting OR premium subscription enabled
2. Provider-specific linear channels enabled
3. Individual channel toggles enabled

**Debugging Strategy**:
```typescript
// Check global settings first
const useLinear = await usesLinear();
const premiumEnabled = await isEnabled('premium');

// Check provider-specific settings
const {enabled: providerEnabled, linear_channels} = await db.providers.findOneAsync({name: 'provider'});
const hasEnabledChannels = _.some(linear_channels, c => c.enabled);

// Debug output for complex logic
console.log('Global linear:', useLinear);
console.log('Premium enabled:', premiumEnabled);
console.log('Provider enabled:', providerEnabled);
console.log('Has enabled channels:', hasEnabledChannels);

// Combined logic
const shouldProcess = (useLinear || premiumEnabled) && providerEnabled && hasEnabledChannels;
```

#### Database Entry Investigation

**Issue Pattern**: Events are processed but not appearing with expected attributes.

**Investigation Commands**:
```bash
# Check total vs filtered counts
npx ts-node -r tsconfig-paths/register -e "
import {db} from './services/database';
(async () => {
  const total = await db.entries.countAsync({from: 'provider'});
  const filtered = await db.entries.countAsync({from: 'provider', attribute: true});
  console.log('Total:', total, 'Filtered:', filtered);
  
  if (filtered === 0 && total > 0) {
    console.log('❌ Events processed but none have expected attribute');
    console.log('🔍 Check parsing logic in parseAirings function');
  }
})();
"

# Sample entry inspection
npx ts-node -r tsconfig-paths/register -e "
import {db} from './services/database';
(async () => {
  const sample = await db.entries.findAsync({from: 'provider'}, {limit: 3});
  console.log('Sample entries:', JSON.stringify(sample, null, 2));
})();
"
```

#### Real-Time Processing Verification

**Pattern**: When events appear to be processing but results don't match expectations, add debug logging to the parsing function:

```typescript
// In parseAirings or similar functions
if (isSpecialCase && featureEnabled && !globalSetting) {
  console.log(`Processing via special case: ${event.name} on ${event.network?.name}`);
}
```

### Common Development Patterns

#### Provider Toggle Implementation
```typescript
// UI Route Handler Pattern
provider.put('/toggle-premium', async c => {
  const body = await c.req.parseBody();
  const premium_subscription = body['feature-enabled'] === 'on';
  
  // Update database with new setting
  await db.providers.updateAsync(
    {name: 'example-provider'}, 
    {$set: {'meta.premium_subscription': premium_subscription}}
  );
  
  // Return updated UI component
  const provider = await db.providers.findOneAsync({name: 'example-provider'});
  return c.html(<UpdatedCardBody provider={provider} />);
});
```

## How to Add a New Provider

To add a new provider, "NewSport", you would follow this pattern:

1.  **Create the Handler (`services/newsport-handler.ts`)**:
    -   Create a new class `NewSportHandler`.
    -   Implement the core methods: `initialize`, `refreshTokens`, `getSchedule`, and `getEventData`.
    -   Study an existing handler like `b1g-handler.ts` (simple) or `espn-handler.ts` (complex) as a template.

2.  **Create the UI Directory (`services/providers/newsport/`)**:
    -   Create a new directory for the provider's UI components.

3.  **Create the UI Route Handler (`services/providers/newsport/index.tsx`)**:
    -   Create a Hono app that defines the routes for your UI card (e.g., `/toggle`, `/login`).
    -   These routes will call methods on your `newSportHandler` instance.

4.  **Create the UI View Components (`services/providers/newsport/views/`)**:
    -   Create the JSX components for the `Login` form and the `CardBody` that shows post-login information.

5.  **Register the Provider UI**:
    -   In `services/providers/index.ts`, import and register your new Hono app (`providers.route('/', newSport)`).

6.  **Integrate into the System**:
    -   In `services/launch-channel.ts`, add a `case` for `'newsport'` in the `switch` statement to call `newSportHandler.getEventData()`.
    -   In `index.tsx` (the main one), import your `newSportHandler` and add it to the `initialize` and `schedule` calls so its schedule is fetched automatically.

7.  **Create Debug Scripts**:
    -   Create `debug/newsport-handler/` directory with testing scripts
    -   Follow the other provider handler debug script patterns for comprehensive testing
    -   Test authentication flows, token refresh, and error handling

8.  **Authentication Implementation**:
    -   Implement dual token persistence (database + JSON files)
    -   Add graceful authentication failure handling  
    -   Use JWT validation patterns for token expiration checking
    -   Implement throttled token refresh to avoid rate limiting
