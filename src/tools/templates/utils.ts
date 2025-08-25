import { z } from "zod";
import YAML from "yaml";

// Define the types for MCP components
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()).optional(),
  handler: z.string().optional()
});

export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string(),
  argsSchema: z.record(z.any()).optional(),
  template: z.string().optional()
});

export const McpResourceSchema = z.object({
  name: z.string(),
  uri: z.string(),
  description: z.string(),
  mimeType: z.string().optional(),
  handler: z.string().optional()
});

export type McpTool = z.infer<typeof McpToolSchema>;
export type McpPrompt = z.infer<typeof McpPromptSchema>;
export type McpResource = z.infer<typeof McpResourceSchema>;

// Smithery YAML structure types
export interface SmitheryYamlConfig {
  runtime: "container" | "typescript";
  build?: {
    dockerfile?: string;
    dockerBuildPath?: string;
  };
  startCommand: {
    type: "http" | "stdio";
    configSchema?: Record<string, any>;
    exampleConfig?: Record<string, any>;
    commandFunction?: string; // For stdio type
  };
  env?: Record<string, string>;
}

export interface SmitheryMigrationParams {
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  serverName: string;
  serverVersion: string;
  includeBackwardCompatibility: boolean;
  smitheryYaml?: string; // Raw YAML content
}

export interface SmitheryYamlParams {
  runtime?: "container" | "typescript";
  startCommandType: "http" | "stdio";
  configSchema?: Record<string, any>;
  exampleConfig?: Record<string, any>;
  env?: Record<string, string>;
  dockerfile?: string;
  dockerBuildPath?: string;
  commandFunction?: string; // For stdio type
  debug?: boolean;
}

/**
 * Shared utility functions for template generation
 */

/**
 * Parse smithery yaml content and extract config schema
 */
export function parseSmitheryYaml(yamlContent: string): SmitheryYamlConfig | null {
  try {
    const parsed = YAML.parse(yamlContent);
    return parsed as SmitheryYamlConfig;
  } catch (error) {
    console.error("Failed to parse smithery.yaml:", error);
    return null;
  }
}

/**
 * Extract config schema from smithery yaml content
 */
export function extractConfigSchemaFromSmitheryYaml(yamlContent: string): Record<string, any> | undefined {
  const parsed = parseSmitheryYaml(yamlContent);
  return parsed?.startCommand?.configSchema;
}

/**
 * Extract example config from smithery yaml content
 */
export function extractExampleConfigFromSmitheryYaml(yamlContent: string): Record<string, any> | undefined {
  const parsed = parseSmitheryYaml(yamlContent);
  return parsed?.startCommand?.exampleConfig;
}

export function sanitizeId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function formatObjectAsYaml(obj: any, indent: number): string {
  const spaces = ' '.repeat(indent);
  let result = '';
  
  if (typeof obj !== 'object' || obj === null) {
    return `${spaces}${JSON.stringify(obj)}\n`;
  }
  
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result += `${spaces}${key}:\n`;
      result += formatObjectAsYaml(value, indent + 2);
    } else if (Array.isArray(value)) {
      result += `${spaces}${key}:\n`;
      value.forEach(item => {
        result += `${spaces}  - ${JSON.stringify(item)}\n`;
      });
    } else {
      result += `${spaces}${key}: ${JSON.stringify(value)}\n`;
    }
  });
  
  return result;
}

/**
 * Generate resources code (shared between CLI and custom container)
 */
export function generateResourcesCode(resources: McpResource[]): string {
  if (resources.length === 0) {
    return `  // No resources to register`;
  }

  // Generate code for the first resource as an example
  const firstResource = resources[0];
  const mimeType = firstResource.mimeType || 'text/plain';
  const isHttpsUrl = firstResource.uri.startsWith('https://');
  
  let resourcesCode = '';
  
  if (isHttpsUrl) {
    resourcesCode = `  // Resource: ${firstResource.name}
  server.registerResource(
    "${sanitizeId(firstResource.name)}",
    "${firstResource.uri}",
    {
      title: "${firstResource.name}",
      description: "${firstResource.description}",
      mimeType: "${mimeType}"
    },
    async (uri) => {
      try {
        const response = await fetch(uri.href);
        if (!response.ok) {
          throw new Error(\`Failed to fetch resource: \${response.status}\`);
        }
        const content = await response.text();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "${mimeType}",
            text: content
          }]
        };
      } catch (error) {
        throw new Error(\`Failed to read resource \${uri.href}: \${error instanceof Error ? error.message : String(error)}\`);
      }
    }
  );`;
  } else {
    resourcesCode = `  // Resource: ${firstResource.name}
  server.registerResource(
    "${sanitizeId(firstResource.name)}",
    "${firstResource.uri}",
    {
      title: "${firstResource.name}",
      description: "${firstResource.description}",
      mimeType: "${mimeType}"
    },
    async (uri) => {
      // TODO: Implement resource handler for ${firstResource.name}
      return {
        contents: [{
          uri: uri.href,
          mimeType: "${mimeType}",
          text: "Resource content here"
        }]
      };
    }
  );`;
  }

  // Add comments for remaining resources
  if (resources.length > 1) {
    const remainingResources = resources.slice(1).map(resource => 
      `  // TODO: Register resource "${resource.name}" - ${resource.description} (${resource.uri})`
    ).join('\n');
    
    resourcesCode += `\n\n  // Additional resources to implement:\n${remainingResources}`;
  }

  return `  // Register resources
${resourcesCode}`;
}

/**
 * Generate prompts code (shared between CLI and custom container)
 */
export function generatePromptsCode(prompts: McpPrompt[]): string {
  if (prompts.length === 0) {
    return `  // No prompts to register`;
  }

  // Generate code for the first prompt as an example
  const firstPrompt = prompts[0];
  const argsSchemaString = firstPrompt.argsSchema ? 
    `      argsSchema: {\n${generateZodSchemaFromJson(firstPrompt.argsSchema, "        ")}\n      }` :
    `      argsSchema: {}`;

  let promptsCode = `  // Prompt: ${firstPrompt.name}
  server.registerPrompt(
    "${firstPrompt.name}",
    {
      title: "${firstPrompt.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}",
      description: "${firstPrompt.description}",
${argsSchemaString}
    },
    async (args) => {
      // TODO: Implement prompt handler for ${firstPrompt.name}
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "${firstPrompt.template || 'Prompt template here'}"
            }
          }
        ]
      };
    }
  );`;

  // Add comments for remaining prompts
  if (prompts.length > 1) {
    const remainingPrompts = prompts.slice(1).map(prompt => 
      `  // TODO: Register prompt "${prompt.name}" - ${prompt.description}`
    ).join('\n');
    
    promptsCode += `\n\n  // Additional prompts to implement:\n${remainingPrompts}`;
  }

  return `  // Register prompts
${promptsCode}`;
}

/**
 * Generate server return statement (shared)
 */
export function generateServerReturn(): string {
  return `  return server.server;`;
}

/**
 * Generate environment variable config parsing code (shared utility)
 */
export function generateEnvConfigParsing(configSchema?: Record<string, any>): string {
  if (!configSchema || !configSchema.properties) {
    return "const config = {};";
  }
  
  const configLines = Object.entries(configSchema.properties).map(([key, prop]: [string, any]) => {
    const envVar = `process.env.${key.toUpperCase()}`;
    
    if (prop.type === "boolean") {
      return `    ${key}: ${envVar} === 'true',`;
    } else if (prop.type === "number" || prop.type === "integer") {
      return `    ${key}: ${envVar} ? Number(${envVar}) : undefined,`;
    } else {
      return `    ${key}: ${envVar},`;
    }
  });
  
  return `const config = configSchema.parse({
${configLines.join('\n')}
  });`;
}

/**
 * Convert JSON schema to Zod schema representation (shared utility)
 */
export function generateZodSchemaFromJson(schema: Record<string, any>, indent: string = "  "): string {
  const properties = schema.properties || {};
  const required = schema.required || [];
  
  return Object.entries(properties).map(([key, prop]: [string, any]) => {
    let zodType = "z.unknown()";
    let description = "";
    
    // Handle different JSON schema types
    if (prop.type === "string") {
      zodType = "z.string()";
    } else if (prop.type === "number") {
      zodType = "z.number()";
    } else if (prop.type === "integer") {
      zodType = "z.number().int()";
    } else if (prop.type === "boolean") {
      zodType = "z.boolean()";
    } else if (prop.type === "array") {
      zodType = "z.array(z.any())";
    } else if (prop.type === "object") {
      zodType = "z.record(z.any())";
    }
    
    // Add default value if present
    if (prop.default !== undefined) {
      const defaultValue = typeof prop.default === "string" ? `"${prop.default}"` : String(prop.default);
      zodType += `.default(${defaultValue})`;
    } else if (!required.includes(key)) {
      zodType += ".optional()";
    }
    
    // Add description if present
    if (prop.description) {
      description = `.describe("${prop.description.replace(/"/g, '\\"')}")`;
      zodType += description;
    }
    
    return `${indent}${key}: ${zodType},`;
  }).join('\n');
}
