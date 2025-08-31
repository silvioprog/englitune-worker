# englitune-worker

A Cloudflare Worker API for retrieving random transcripts with speaker data from the VCTK corpus, with support for excluding specific speaker/transcript combinations.

## Features

- 🎯 **Random Transcript Retrieval**: Get random transcripts with speaker metadata
- 🚫 **Flexible Exclusions**: Exclude specific speaker/transcript combinations using advanced filtering
- 📊 **Rich Speaker Data**: Returns transcript text, sequences, speaker demographics (age, gender, accent, region)
- ⚡ **Fast Performance**: Built on Cloudflare Workers with D1 database
- 🛡️ **Robust Validation**: Comprehensive parameter validation and error handling
- 🧪 **Comprehensive Testing**: Extensive test suite covering all functionality

## API Reference

### Base URL

```raw
https://your-worker.your-subdomain.workers.dev
```

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

- Node.js 18+
- Cloudflare account with Workers and D1 access

### Setup

```bash
# Clone the repository
git clone https://github.com/silvioprog/englitune-worker.git
cd englitune-worker

# Install dependencies
npm install

# Set up D1 database (update wrangler.jsonc with your database details)
wrangler d1 create vctk-corpus
```

### Scripts

```bash
# Development server
npm run dev

# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Deploy to Cloudflare
npm run deploy

# Generate TypeScript types
npm run cf-typegen
```

### Configuration

Update `wrangler.jsonc` with your D1 database configuration:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-database-name",
      "database_id": "your-database-id"
    }
  ]
}
```

## Testing

The project includes comprehensive test coverage:

- **Complete test suite** Across multiple test files
- **Parameter validation tests**: HTTP methods, paths, limits, exclusions
- **Query generation tests**: SQL generation and parameter binding
- **Integration tests**: End-to-end worker functionality
- **Error handling tests**: Database errors and malformed requests

```bash
# Run all tests
npm test

# Run specific test file
npm test test/params.spec.ts
npm test test/queries.spec.ts
npm test test/index.spec.ts
```

## Architecture

### Core Components

- **`src/index.ts`**: Main worker entry point and request handling
- **`src/params.ts`**: Parameter validation and parsing
- **`src/queries.ts`**: Database query generation and execution

### Key Features

- **Type Safety**: Full TypeScript support with proper type definitions
- **Efficient Exclusions**: Uses `Map<string, Set<string>>` for automatic deduplication
- **SQL Generation**: Dynamic WHERE clause generation for complex exclusions
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
- **Performance**: Optimized SQL queries with proper indexing support

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
