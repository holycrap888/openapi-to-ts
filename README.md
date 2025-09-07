# swagger-transformer

`swagger-transformer` is a TypeScript library for generating and transforming Swagger (OpenAPI) specifications. It helps automate the creation and management of API documentation for your projects.

## Features

- Generate Swagger/OpenAPI specs from code or templates
- Transform and update existing Swagger files
- Programmatic usage

## Installation

Install from npm:

```bash
npm install swagger-transformer
```

## Usage

Import and use in your TypeScript or JavaScript project:

```typescript
import { generateSwagger } from 'swagger-transformer';

/**
 * options {
 *  interfacePrefix?: string; prefix for interface example 'I' or ''
 *  inlineRef?: boolean; resolve inline ref
 * }
 */
generateSwagger(/* filePath */ , { /* options */ });
```

### Example: Generate TypeScript files from Swagger YAML

```typescript
import { generateFromYamlFile } from 'swagger-transformer';
import fs from 'fs';

const openApiType = generateFromYamlFile('./open-api.yaml');

fs.writeFileSync('./open-api.ts', openApiType);
```

## API

- `generateSwagger(options)` – Generates a Swagger specification based on provided options.

## File Structure

- `src/generator.ts` – Core logic for generating Swagger specs
- `src/index.ts` – Library entry point

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
