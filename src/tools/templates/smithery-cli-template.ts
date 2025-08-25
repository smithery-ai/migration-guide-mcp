import { z } from "zod";
import { 
  McpTool, 
  McpPrompt, 
  McpResource, 
  SmitheryMigrationParams,
  generateResourcesCode,
  generatePromptsCode,
  generateServerReturn,
  generateZodSchemaFromJson,
  generateEnvConfigParsing,
  extractConfigSchemaFromSmitheryYaml
} from "./utils.js";

/**
 * Generate TypeScript code for Smithery CLI migration using templates
 */
export function generateSmitheryCliMigration(params: SmitheryMigrationParams): string {
  const { tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, smitheryYaml } = params;

  // Extract config schema from smithery yaml
  const extractedConfigSchema = smitheryYaml 
    ? extractConfigSchemaFromSmitheryYaml(smitheryYaml)
    : undefined;

  // Generate the complete TypeScript file
  return generateIndexTsTemplate({
    tools,
    prompts,
    resources,
    serverName,
    serverVersion,
    includeBackwardCompatibility,
    configSchema: extractedConfigSchema
  });
}

function generateIndexTsTemplate(params: {
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  serverName: string;
  serverVersion: string;
  includeBackwardCompatibility: boolean;
  configSchema?: Record<string, any>;
}): string {
  const { tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, configSchema } = params;

  // Generate imports
  const imports = generateImports(includeBackwardCompatibility);
  
  // Generate config schema (only if provided)
  const configSchemaCode = configSchema && Object.keys(configSchema).length > 0 ? generateConfigSchema(configSchema) : '';
  
  // Generate server creation
  const serverCreation = generateServerCreation(serverName, serverVersion);
  
  // Generate resources
  const resourcesCode = generateResourcesCode(resources);
  
  // Generate tools
  const toolsCode = generateToolsCode(tools, configSchema && Object.keys(configSchema).length > 0);
  
  // Generate prompts
  const promptsCode = generatePromptsCode(prompts);
  
  // Generate server return
  const serverReturn = generateServerReturn();
  
  // Generate backwards compatibility code if requested
  const backwardsCompatibilityCode = includeBackwardCompatibility ? generateBackwardsCompatibilityCode(configSchema) : '';

  return `${imports}
${configSchemaCode ? `\n${configSchemaCode}\n` : `
// Configuration schema for smithery.yaml
export const configSchema = z.object({});
`}
export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
${serverCreation}

${resourcesCode}

${toolsCode}

${promptsCode}

${serverReturn}
}${backwardsCompatibilityCode}
`;
}

function generateImports(includeBackwardCompatibility: boolean = false): string {
  let imports = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";`;
  
  if (includeBackwardCompatibility) {
    imports += `
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";`;
  }
  
  return imports;
}

function generateConfigSchema(actualConfigSchema?: Record<string, any>): string {
  if (actualConfigSchema && Object.keys(actualConfigSchema).length > 0) {
    // Convert JSON schema to Zod schema representation
    const schemaString = generateZodSchemaFromJson(actualConfigSchema);
    return `// Configuration schema extracted from your existing server
export const configSchema = z.object({
${schemaString}
});`;
  } else {
    return `// Configuration schema for smithery.yaml
export const configSchema = z.object({});`;
  }
}



function generateServerCreation(serverName: string, serverVersion: string): string {
  return `  const server = new McpServer({
    name: "${serverName}",
    version: "${serverVersion}",
  });`;
}

function generateToolsCode(tools: McpTool[], hasConfig: boolean = false): string {
  if (tools.length === 0) {
    return `  // No tools to register`;
  }

  // Generate code for the first tool as an example
  const firstTool = tools[0];
  const inputSchemaString = firstTool.inputSchema ? 
    `      inputSchema: {\n${generateZodSchemaFromJson(firstTool.inputSchema, "        ")}\n      }` :
    `      inputSchema: {}`;

  // Generate config-related comments and logs only if config exists
  const configComment = hasConfig ? `
      // TODO: Use the config parameter for API calls, timeout settings, etc.` : '';
  const configLog = hasConfig ? `
      console.log('Available config:', config);` : '';

  let toolsCode = `  // Tool: ${firstTool.name}
  server.registerTool(
    "${firstTool.name}",
    {
      title: "${firstTool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}",
      description: "${firstTool.description}",
${inputSchemaString}
    },
    async (request) => {
      // TODO: Implement tool handler for ${firstTool.name}${configComment}
      console.log('Tool ${firstTool.name} called with args:', request);${configLog}
      return {
        content: [{
          type: "text" as const,
          text: "Tool ${firstTool.name} executed successfully"
        }]
      };
    }
  );`;

  // Add comments for remaining tools
  if (tools.length > 1) {
    const remainingTools = tools.slice(1).map(tool => 
      `  // TODO: Register tool "${tool.name}" - ${tool.description}`
    ).join('\n');
    
    toolsCode += `\n\n  // Additional tools to implement:\n${remainingTools}`;
  }

  return `  // Register tools
${toolsCode}`;
}

function generateBackwardsCompatibilityCode(configSchema?: Record<string, any>): string {
  const configParsing = generateEnvConfigParsing(configSchema);
  const hasConfig = configSchema && Object.keys(configSchema).length > 0;
  
  const serverCall = hasConfig 
    ? `const server = createServer({
    config
  });`
    : `const server = createServer({
    config
  });`;
  
  return `

// STDIO backwards compatibility - only runs when executed directly
async function main() {
  // Get configuration from environment variables
  ${configParsing}
  
  // Create server with configuration
  ${serverCall}

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running in stdio mode");
}

// By default run the server with stdio transport
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});`;
}

// Export the tool schema
export const SmitheryCliMigrationToolSchema = {
  name: "generate_smithery_cli_migration",
  description: "Generate TypeScript code for migrating an MCP server to Smithery CLI format using templates",
  inputSchema: {
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.any()).optional(),
      handler: z.string().optional()
    })).default([]).describe("MCP tools to migrate"),
    prompts: z.array(z.object({
      name: z.string(),
      description: z.string(),
      argsSchema: z.record(z.any()).optional(),
      template: z.string().optional()
    })).default([]).describe("MCP prompts to migrate"),
    resources: z.array(z.object({
      name: z.string(),
      uri: z.string(),
      description: z.string(),
      mimeType: z.string().optional(),
      handler: z.string().optional()
    })).default([]).describe("MCP resources to migrate"),
    serverName: z.string().default("My MCP Server").describe("Name of the server"),
    serverVersion: z.string().default("1.0.0").describe("Version of the server"),
    includeBackwardCompatibility: z.boolean().default(false).describe("Whether to include backward compatibility code"),
    configSchema: z.record(z.any()).optional().describe("JSON schema for server configuration (will be converted to Zod schema)"),
  }
};
