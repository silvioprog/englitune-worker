# englitune-worker

[![Test](https://github.com/silvioprog/englitune-worker/actions/workflows/test.yml/badge.svg)](https://github.com/silvioprog/englitune-worker/actions/workflows/test.yml)

A Cloudflare Worker API for retrieving random transcripts with speaker data from the VCTK corpus, with support for excluding specific speaker/transcript combinations. Built with [Hono](https://hono.dev) framework for fast, type-safe API development.

## Features

- 🎯 **Random Transcript Retrieval**: Get random transcripts with speaker metadata
- 🚫 **Flexible Exclusions**: Exclude specific speaker/transcript combinations using advanced filtering
- 📊 **Rich Speaker Data**: Returns transcript text, sequences, speaker demographics (age, gender, accent, region)
- ⚡ **Fast Performance**: Built on Cloudflare Workers with D1 database
- 🛡️ **Robust Validation**: Comprehensive parameter validation and error handling using Hono validators
- 🌐 **CORS Support**: Configurable CORS with environment-based origin control
- 🧪 **Comprehensive Testing**: Extensive test suite covering all functionality

## API Reference

### Base URL

```raw
https://englitune-worker.silvioprog.dev
```

Or your custom domain configured in Cloudflare.

### Endpoints

#### `GET /`

Retrieve random transcripts with speaker data.

**Query Parameters:**

- `limit` (optional): Number of transcripts to return (1-100, default: 1)
- `excluded` (optional): Speaker/transcript combinations to exclude

**Responses:**

```json
[
  {
    "transcript": "You feel the pride.",
    "sequence": "322",
    "speaker": "p257",
    "age": 24,
    "gender": "F",
    "accent": "English",
    "region": "Southern"
  }
]
```

```json
[
  {
    "transcript": "But it was to no avail.",
    "sequence": "070",
    "speaker": "p302",
    "age": 20,
    "gender": "M",
    "accent": "Canadian",
    "region": "Montreal"
  }
]
```

#### `GET /favicon.ico`

Returns a 204 response with caching headers for favicon requests.

### Exclusion Format

The `excluded` parameter supports a flexible format for excluding specific speaker/transcript combinations:

```raw
excluded=p225=001,002,003;p226=004,005;p227=006
```

**Format Breakdown:**

- Multiple speakers separated by semicolons (`;`)
- Each speaker followed by equals sign (`=`) and comma-separated transcript sequences
- Automatic deduplication (duplicate sequences are ignored)

**Examples:**

```bash
# Exclude specific transcripts for speaker p225
GET /?limit=5&excluded=p225=001,002,003

# Exclude transcripts for multiple speakers
GET /?limit=10&excluded=p225=001,002;p226=003,004;p227=005

# Complex exclusions with duplicates (automatically deduplicated)
GET /?excluded=p225=001,002,001,003,002
```

## Error Responses

### 400 Bad Request

Parameter validation errors:

```json
{
  "error": "Limit must be a number: abc"
}
```

```json
{
  "error": "Excluded must be in format id=sequence1,sequence2;id2=sequence3,sequence4: invalid"
}
```

### 500 Internal Server Error

Database or server errors:

```json
{
  "error": "Internal server error"
}
```

## Development

### Prerequisites

- Node.js 18.17.1 or higher (required by Wrangler 4.x)
- Cloudflare account with Workers and D1 access

**Note:** The project includes a `.nvmrc` file specifying Node.js 24.12.0 for development consistency, but the project is compatible with Node.js 18.17.1+.

### Setup

```bash
# Clone the repository
git clone https://github.com/silvioprog/englitune-worker.git
cd englitune-worker

# Use the Node version specified in .nvmrc (optional, but recommended)
nvm use

# Install dependencies
npm install

# Set up D1 database (update wrangler.jsonc with your database details)
wrangler d1 create vctk-corpus
```

### Scripts

```bash
# Development server (with CORS set to * for local testing)
npm run dev

# Run tests
npm test

# Deploy to Cloudflare
npm run deploy

# Generate TypeScript types from Wrangler config
npm run cf-typegen
```

### Configuration

Update `wrangler.jsonc` with your D1 database configuration and CORS settings:

```jsonc
{
  "vars": {
    "CORS_ORIGIN": "https://your-domain.com"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-database-name",
      "database_id": "your-database-id"
    }
  ]
}
```

**CORS Configuration:**

- **Development**: Uses `--var CORS_ORIGIN:"*"` in the dev script to allow all origins locally
- **Production**: Set `CORS_ORIGIN` in `wrangler.jsonc` to restrict to your domain

## Testing

The project includes comprehensive test coverage with tests co-located with source files:

- **Complete test suite**: Tests located alongside source files in `src/`
- **Parameter validation tests**: HTTP methods, paths, limits, exclusions (`src/validators.test.ts`)
- **Query generation tests**: SQL generation and parameter binding (`src/queries.test.ts`)
- **Integration tests**: End-to-end worker functionality including CORS (`src/index.test.ts`)
- **Error handling tests**: Database errors and malformed requests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/validators.test.ts
npm test src/queries.test.ts
npm test src/index.test.ts
```

## Architecture

### Core Components

- **`src/index.ts`**: Main Hono app entry point with CORS middleware, routing, and error handling
- **`src/validators.ts`**: Parameter validation and parsing using Hono validators
- **`src/queries.ts`**: Database query generation and execution

### Key Features

- **Hono Framework**: Fast, lightweight web framework optimized for Cloudflare Workers
- **Type Safety**: Full TypeScript support with generated types from Wrangler config
- **CORS Middleware**: Environment-based CORS configuration (dev: `*`, production: specific domain)
- **Efficient Exclusions**: Uses `Map<string, Set<string>>` for automatic deduplication
- **SQL Generation**: Dynamic WHERE clause generation for complex exclusions
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes via Hono
- **Performance**: Optimized SQL queries with proper indexing support

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
