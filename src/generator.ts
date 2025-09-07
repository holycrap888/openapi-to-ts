import * as fs from "fs";
import * as yaml from "js-yaml";

export interface Schema {
  type?: string;
  enum?: string[];
  properties?: Record<string, Schema>;
  required?: string[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  $ref?: string;
  items?: Schema;
}

/** options for generate
 * interfacePrefix: prefix for interface example 'I' or ''
 * inlineRef: resolve inline ref
 */
export interface GeneratorOptions {
  interfacePrefix?: string;
  inlineRef?: boolean;
}

/**
 * Transform string to valid enum key in UPPER_SNAKE_CASE
 * @param key string
 * @returns string
 */
function safeEnumKey(key: string): string {
  // Trim, replace - and space with _
  let safeKey = key.trim().replace(/[-\s]+/g, "_");

  // Convert camelCase / PascalCase to snake_case
  safeKey = safeKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2");

  // If starts with number, add _
  if (/^\d/.test(safeKey)) safeKey = "_" + safeKey;

  return safeKey.toUpperCase();
}

/**
 * Transform string to valid object key
 * @param key string
 * @returns string
 */
function safeKey(key: string): string {
  if (/^[a-zA-Z_]\w*$/.test(key)) return key;
  return `'${key}'`;
}

/**
 * Transform $ref to type/interface name
 * @param $ref string
 * @param options GeneratorOptions
 * @returns string
 */
function refName($ref: string, options: GeneratorOptions): string {
  const name = $ref.replace("#/components/schemas/", "");
  return (options.interfacePrefix ?? "I") + name;
}

/**
 * Transform schema to TypeScript type
 * @param schema schema 
 * @param allSchemas all schemas for $ref resolution
 * @param options GeneratorOptions
 * @returns string
 */
function mapType(schema: Schema, allSchemas: Record<string, Schema>, options: GeneratorOptions = {}): string {
  if (!schema) return "any";

  if (schema.$ref) {
    if (options.inlineRef) {
      const refSchema = allSchemas[schema.$ref.replace("#/components/schemas/", "")];
      return inlineObject(refSchema, allSchemas, true, options);
    }
    return refName(schema.$ref, options);
  }

  if (schema.oneOf) return schema.oneOf.map(s => mapType(s, allSchemas, options)).join(" | ");
  if (schema.anyOf) return schema.anyOf.map(s => mapType(s, allSchemas, options)).join(" | ");
  if (schema.allOf) return schema.allOf.map(s => mapType(s, allSchemas, options)).join(" & ");

  switch (schema.type) {
    case "integer":
    case "number": return "number";
    case "string":
      if (schema.enum?.length) {
        return schema.enum.map(v => `"${v}"`).join(" | ");
      }
      return "string";
    case "boolean": return "boolean";
    case "array": return schema.items ? `${mapType(schema.items, allSchemas, options)}[]` : "any[]";
    case "object": return schema.properties ? inlineObject(schema, allSchemas, true, options) : "{ [key: string]: any }";
    default: return "any";
  }
}

/**
 * Transform object schema to inline TypeScript type
 * @param schema schema
 * @param allSchemas all schemas for $ref resolution
 * @param withBraces include braces {}
 * @param options GeneratorOptions
 * @returns string
 */
function inlineObject(schema: Schema, allSchemas: Record<string, Schema>, withBraces = false, options: GeneratorOptions = {}): string {
  if (!schema.properties) return "{}";

  const lines = Object.entries(schema.properties).map(([prop, propSchema]) => {
    const required = schema.required?.includes(prop);
    const typeStr = mapType(propSchema, allSchemas, options);
    return `  ${safeKey(prop)}${required ? "" : "?"}: ${typeStr};`;
  });

  return `{\n${lines.join("\n")}\n}`;
}

/**
 * Transform schema to TypeScript type/interface
 * @param name name of the type/interface
 * @param schema schema
 * @param allSchemas all schemas for $ref resolution
 * @param options GeneratorOptions
 * @returns string
 */
export function generateType(name: string, schema: Schema, allSchemas: Record<string, Schema>, options: GeneratorOptions = {}): string {
  const interfacePrefix = options.interfacePrefix ?? "I";

  // enum → TS enum หรือ literal union
  if (schema.enum) {
    return `export enum ${interfacePrefix}${name} {\n${schema.enum.map(v => `  ${safeEnumKey(v)} = "${v}",`).join("\n")}\n}`;
  }


  // oneOf / anyOf → union type
  if (schema.oneOf || schema.anyOf) {
    const variants = (schema.oneOf || schema.anyOf || []).map(s =>
      s.$ref ? refName(s.$ref, options) : inlineObject(s, allSchemas, true, options)
    );
    return `export type ${interfacePrefix}${name} = ${variants.join(" | ")};`;
  }

  // allOf → intersection type
  if (schema.allOf) {
    const parts = schema.allOf.map(s => s.$ref ? refName(s.$ref, options) : inlineObject(s, allSchemas, true, options));
    return `export type ${interfacePrefix}${name} = ${parts.join(" & ")};`;
  }

  // object → interface
  if (schema.type === "object" || schema.properties) {
    const objStr = inlineObject(schema, allSchemas, true, options);
    return `export interface ${interfacePrefix}${name} ${objStr}`;
  }

  return `export type ${interfacePrefix}${name} = any;`;
}

/** Generate TypeScript types/interfaces from OpenAPI YAML file
 * @param filePath path to the OpenAPI YAML file
 * @param options GeneratorOptions
 * @returns string
 */
export function generateFromYamlFile(filePath: string, options: GeneratorOptions = {}): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`YAML file not found: ${filePath}`);
  }

  const yamlText = fs.readFileSync(filePath, "utf8");
  const doc: any = yaml.load(yamlText);

  const schemas: Record<string, Schema> = doc.components?.schemas || {};
  return Object.entries(schemas)
    .map(([name, schema]) => generateType(name, schema, schemas, options))
    .join("\n\n");
}
