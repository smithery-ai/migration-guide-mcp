/**
 * Tools index - exports all available tools for the MCP Migration Agent
 */

export { validateSmitheryYaml, YamlValidationToolSchema, type SmitheryYamlValidationParams } from "./yaml-validation.js";
export { validatePackageJson, PackageJsonValidationToolSchema, type PackageJsonValidationParams } from "./package-json-validation.js";

// Migration overview
export { 
  generateMigrationOverview,
  formatMigrationOverview,
  analyzeSmitheryYamlForSessionConfig,
  MigrationOverviewToolSchema,
  type MigrationPath,
  type MigrationOverviewParams,
  type MigrationOverview
} from "./migration-overview.js";

// Unified migration template
export { 
  generateMigrationTemplate,
  UnifiedMigrationTemplateToolSchema,
  getFileExtension,
  getMigrationModeDescription,
  type MigrationMode,
  type UnifiedMigrationParams
} from "./templates/index.js";

// Individual migration templates (for internal use)
export { 
  generateSmitheryCliMigration, 
  SmitheryCliMigrationToolSchema
} from "./templates/smithery-cli-template.js";

export { 
  generateCustomContainerMigration,
  CustomContainerMigrationToolSchema
} from "./templates/custom-container-template.js";

export { 
  generatePythonCustomContainerMigration,
  PythonCustomContainerMigrationToolSchema
} from "./templates/python-custom-container-template.js";

// YAML generation
export { 
  generateSmitheryYaml,
  SmitheryYamlGeneratorToolSchema
} from "./smithery-yaml-generator.js";

// Shared types and utilities
export { 
  type SmitheryMigrationParams,
  type SmitheryYamlParams,
  type McpTool,
  type McpPrompt,
  type McpResource
} from "./templates/utils.js";