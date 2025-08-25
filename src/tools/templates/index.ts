import { z } from "zod";
import { 
  SmitheryMigrationParams,
  McpToolSchema,
  McpPromptSchema,
  McpResourceSchema
} from "./utils.js";
import { generateSmitheryCliMigration } from "./smithery-cli-template.js";
import { generateCustomContainerMigration } from "./custom-container-template.js";
import { generatePythonCustomContainerMigration } from "./python-custom-container-template.js";

// Define migration mode enum
export type MigrationMode = "ts-smithery-cli" | "ts-custom-container" | "py-custom-container";

export interface UnifiedMigrationParams extends Omit<SmitheryMigrationParams, 'debug'> {
  migrationMode: MigrationMode;
  debug?: boolean;
}

/**
 * Generate migration template based on the specified mode
 */
export function generateMigrationTemplate(params: UnifiedMigrationParams): string {
  const { migrationMode, tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility } = params;

  const migrationParams: SmitheryMigrationParams = {
    tools,
    prompts,
    resources,
    serverName,
    serverVersion,
    includeBackwardCompatibility,
    smitheryYaml: params.smitheryYaml,
  };

  switch (migrationMode) {
    case "ts-smithery-cli":
      return generateSmitheryCliMigration(migrationParams);
    
    case "ts-custom-container":
      return generateCustomContainerMigration(migrationParams);
    
    case "py-custom-container":
      return generatePythonCustomContainerMigration(migrationParams);
    
    default:
      throw new Error(`Unsupported migration mode: ${migrationMode}`);
  }
}

/**
 * Get the file extension based on migration mode
 */
export function getFileExtension(migrationMode: MigrationMode): string {
  switch (migrationMode) {
    case "ts-smithery-cli":
    case "ts-custom-container":
      return "ts";
    case "py-custom-container":
      return "py";
    default:
      return "txt";
  }
}

/**
 * Get a human-readable description of the migration mode
 */
export function getMigrationModeDescription(migrationMode: MigrationMode): string {
  switch (migrationMode) {
    case "ts-smithery-cli":
      return "TypeScript with Smithery CLI - Automatic deployment with STDIO backward compatibility";
    case "ts-custom-container":
      return "TypeScript Custom Container - Full Docker control with Express HTTP server";
    case "py-custom-container":
      return "Python Custom Container - FastMCP with custom middleware and Docker control";
    default:
      return "Unknown migration mode";
  }
}

// Export the unified tool schema
export const UnifiedMigrationTemplateToolSchema = {
  name: "create_migration_template",
  description: "Generate migration templates for different MCP server deployment modes (TypeScript Smithery CLI, TypeScript Custom Container, or Python Custom Container)",
  inputSchema: {
    migrationMode: z.enum(["ts-smithery-cli", "ts-custom-container", "py-custom-container"])
      .describe("Migration mode: 'ts-smithery-cli' for TypeScript with Smithery CLI, 'ts-custom-container' for TypeScript custom container, 'py-custom-container' for Python custom container"),
    tools: z.array(McpToolSchema).default([]).describe("MCP tools to migrate"),
    prompts: z.array(McpPromptSchema).default([]).describe("MCP prompts to migrate"),
    resources: z.array(McpResourceSchema).default([]).describe("MCP resources to migrate"),
    serverName: z.string().default("My MCP Server").describe("Name of the server"),
    serverVersion: z.string().default("1.0.0").describe("Version of the server"),
    includeBackwardCompatibility: z.boolean().default(false).describe("Whether to include backward compatibility code for STDIO transport"),
    smitheryYaml: z.string().optional().describe("Optional smithery.yaml content to extract configuration schema from"),
  }
};
