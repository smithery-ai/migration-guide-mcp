import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  YamlValidationToolSchema, 
  validateSmitheryYaml,
  MigrationOverviewToolSchema,
  generateMigrationOverview,
  formatMigrationOverview,
  UnifiedMigrationTemplateToolSchema,
  generateMigrationTemplate,
  getFileExtension,
  getMigrationModeDescription,
  SmitheryYamlGeneratorToolSchema,
  generateSmitheryYaml,
} from "./tools/index.js";

export default function createServer(
  config
) {
  const server = new McpServer({
    name: "Smithery Migration Guide",
    version: "1.0.0",
  });

  server.registerResource(
    "smithery-typescript-migration",
    "https://smithery.ai/docs/migrations/typescript-with-smithery-cli",
    {
      title: "TypeScript with Smithery CLI Migration",
      description: "Step-by-step guide for migrating TypeScript MCP servers using Smithery CLI",
      mimeType: "text/markdown"
    },
    async (uri) => {
      try {
        const response = await fetch(uri.href);
        if (!response.ok) {
          throw new Error(`Failed to fetch resource: ${response.status}`);
        }
        const content = await response.text();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/markdown",
            text: content
          }]
        };
      } catch (error) {
        throw new Error(`Failed to read resource ${uri.href}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerResource(
    "smithery-custom-container-ts",
    "https://smithery.ai/docs/migrations/typescript-custom-container",
    {
      title: "TypeScript Custom Container Migration",
      description: "Guide for migrating TypeScript servers to custom containers",
      mimeType: "text/markdown"
    },
    async (uri) => {
      try {
        const response = await fetch(uri.href);
        if (!response.ok) {
          throw new Error(`Failed to fetch resource: ${response.status}`);
        }
        const content = await response.text();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/markdown",
            text: content
          }]
        };
      } catch (error) {
        throw new Error(`Failed to read resource ${uri.href}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerResource(
    "smithery-custom-container-py",
    "https://smithery.ai/docs/migrations/python-custom-container",
    {
      title: "Python Custom Container Migration",
      description: "Guide for migrating Python servers to custom containers",
      mimeType: "text/markdown"
    },
    async (uri) => {
      try {
        const response = await fetch(uri.href);
        if (!response.ok) {
          throw new Error(`Failed to fetch resource: ${response.status}`);
        }
        const content = await response.text();
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/markdown",
            text: content
          }]
        };
      } catch (error) {
        throw new Error(`Failed to read resource ${uri.href}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Migration Overview Tool
  server.registerTool(
    MigrationOverviewToolSchema.name,
    {
      title: "Migration Overview & Planning",
      description: MigrationOverviewToolSchema.description,
      inputSchema: MigrationOverviewToolSchema.inputSchema
    },
    async ({ migrationPath, includeBackwardCompatibility, needsFileSystemAccess, needsLocalApps, existingSmitheryYaml }) => {
      try {
        const overview = generateMigrationOverview({
          migrationPath, // ts with smithery cli, py custom container etc.
          includeBackwardCompatibility, // with STDIO transport
          needsFileSystemAccess, // to detect local servers
          needsLocalApps, // to detect local servers
          existingSmitheryYaml // existing smithery.yaml content to get config schema
        });

        const formattedOverview = formatMigrationOverview(overview);
        
        return {
          content: [{
            type: "text",
            text: formattedOverview
          }]
        };

      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error generating migration overview: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Smithery YAML Validation Tool
  server.registerTool(
    YamlValidationToolSchema.name,
    {
      title: "Smithery YAML Validator",
      description: YamlValidationToolSchema.description,
      inputSchema: YamlValidationToolSchema.inputSchema
    },
    async ({ yamlContent, filePath }) => {
      try {
        const validation = await validateSmitheryYaml({
          yamlContent,
          filePath,
        });

        return {
          content: [{
            type: "text",
            text: validation
          }]
        };

      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error validating smithery.yaml: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Migration Template Tool
  // Generated migration template from given parameters
  server.registerTool(
    UnifiedMigrationTemplateToolSchema.name,
    {
      title: "Migration Template Generator",
      description: UnifiedMigrationTemplateToolSchema.description,
      inputSchema: UnifiedMigrationTemplateToolSchema.inputSchema
    },
    async ({ migrationMode, tools, prompts, resources, serverName, serverVersion, includeBackwardCompatibility, smitheryYaml }) => {
      try {
        const migrationCode = generateMigrationTemplate({
          migrationMode, // smithery cli, custom container etc.
          tools,
          prompts,
          resources,
          serverName,
          serverVersion,
          includeBackwardCompatibility, // for stdio backwards compatibility
          smitheryYaml, // smithery.yaml content to extract config from
        });

        const fileExtension = getFileExtension(migrationMode);
        const modeDescription = getMigrationModeDescription(migrationMode);
        
        return {
          content: [{
            type: "text",
            text: `Generated ${modeDescription} migration code:\n\n\`\`\`${fileExtension}\n${migrationCode}\n\`\`\``
          }]
        };

      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error generating migration template: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Smithery YAML Generator Tool
  server.registerTool(
    SmitheryYamlGeneratorToolSchema.name,
    {
      title: "Smithery YAML Configuration Generator",
      description: SmitheryYamlGeneratorToolSchema.description,
      inputSchema: SmitheryYamlGeneratorToolSchema.inputSchema
    },
    async ({ runtime, startCommandType, configSchema, exampleConfig, env, dockerfile, dockerBuildPath, commandFunction }) => {
      try {
        const yamlContent = generateSmitheryYaml({
          runtime,
          startCommandType,
          configSchema,
          exampleConfig,
          env,
          dockerfile,
          dockerBuildPath,
          commandFunction,
          debug: config.debug
        });

        return {
          content: [{
            type: "text",
            text: `Generated smithery.yaml configuration:\n\n\`\`\`yaml\n${yamlContent}\`\`\``
          }]
        };

      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error generating smithery.yaml: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  return server.server;
}
