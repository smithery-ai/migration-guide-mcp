import { z } from "zod";

export interface PackageJsonValidationParams {
  packageJsonContent: string;
  migrationPath: "ts-smithery-cli" | "ts-custom-container" | "py-custom-container";
  filePath?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  requiredChanges: Array<{
    field: string;
    expected: any;
    current: any;
    action: "add" | "modify" | "remove";
  }>;
}

/**
 * Validate package.json for different migration paths
 */
export async function validatePackageJson(params: PackageJsonValidationParams): Promise<string> {
  const { packageJsonContent, migrationPath, filePath } = params;

  try {
    const packageJson = JSON.parse(packageJsonContent);
    const result = performValidation(packageJson, migrationPath);
    
    return formatValidationResult(result, filePath);
  } catch (error) {
    return `**Invalid JSON Format**

${filePath ? `File: \`${filePath}\`` : ""}

The package.json file contains invalid JSON syntax:
\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

Please fix the JSON syntax errors before proceeding with migration.`;
  }
}

function performValidation(packageJson: any, migrationPath: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    requiredChanges: []
  };

  switch (migrationPath) {
    case "ts-smithery-cli":
      validateSmitheryCliPackageJson(packageJson, result);
      break;
    case "ts-custom-container":
      validateCustomContainerPackageJson(packageJson, result);
      break;
    case "py-custom-container":
      // For Python projects, we mainly validate structure
      validatePythonContainerPackageJson(packageJson, result);
      break;
  }

  result.isValid = result.errors.length === 0;
  return result;
}

function validateSmitheryCliPackageJson(packageJson: any, result: ValidationResult) {
  // Check for required fields
  if (!packageJson.name) {
    result.errors.push("Missing required field: 'name'");
    result.requiredChanges.push({
      field: "name",
      expected: "your-server-name",
      current: undefined,
      action: "add"
    });
  }

  if (!packageJson.version) {
    result.errors.push("Missing required field: 'version'");
    result.requiredChanges.push({
      field: "version",
      expected: "1.0.0",
      current: undefined,
      action: "add"
    });
  }

  // Check module field for Smithery CLI
  if (!packageJson.module) {
    result.errors.push("Missing 'module' field required for Smithery CLI");
    result.requiredChanges.push({
      field: "module",
      expected: "./src/index.ts",
      current: undefined,
      action: "add"
    });
  } else if (!packageJson.module.endsWith('.ts') && !packageJson.module.endsWith('.js')) {
    result.warnings.push("Module field should point to your main TypeScript or JavaScript file");
  }

  // Check for type: module
  if (packageJson.type !== "module") {
    result.warnings.push("Consider setting 'type': 'module' for ES modules support");
    result.suggestions.push("Add '\"type\": \"module\"' to package.json for better ES modules support");
  }

  // Check scripts
  validateSmitheryCliScripts(packageJson.scripts || {}, result);

  // Check dependencies
  validateSmitheryCliDependencies(packageJson.dependencies || {}, packageJson.devDependencies || {}, result);
}

function validateSmitheryCliScripts(scripts: any, result: ValidationResult) {
  const requiredScripts = {
    "build": "npx @smithery/cli build",
    "dev": "npx @smithery/cli dev"
  };

  for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
    if (!scripts[scriptName]) {
      result.errors.push(`Missing required script: '${scriptName}'`);
      result.requiredChanges.push({
        field: `scripts.${scriptName}`,
        expected: expectedCommand,
        current: undefined,
        action: "add"
      });
    } else if (scripts[scriptName] !== expectedCommand) {
      result.errors.push(`Incorrect script for '${scriptName}' - expected: '${expectedCommand}', got: '${scripts[scriptName]}'`);
      result.requiredChanges.push({
        field: `scripts.${scriptName}`,
        expected: expectedCommand,
        current: scripts[scriptName],
        action: "modify"
      });
    }
  }

  // Check for common issues
  if (scripts.start && scripts.start.includes('stdio')) {
    result.warnings.push("Start script appears to use STDIO transport - consider updating for HTTP transport");
  }
}

function validateSmitheryCliDependencies(deps: any, devDeps: any, result: ValidationResult) {
  // Check for Smithery CLI in devDependencies
  if (!devDeps['@smithery/cli']) {
    result.errors.push("Missing required devDependency: @smithery/cli");
    result.requiredChanges.push({
      field: "devDependencies.@smithery/cli",
      expected: "^1.0.0 (or your preferred version)",
      current: undefined,
      action: "add"
    });
  }

  // Check for tsx in devDependencies (required for TypeScript execution)
  if (!devDeps['tsx']) {
    result.errors.push("Missing required devDependency: tsx");
    result.requiredChanges.push({
      field: "devDependencies.tsx",
      expected: "^4.0.0 (or your preferred version)",
      current: undefined,
      action: "add"
    });
  }
}

function validateCustomContainerPackageJson(packageJson: any, result: ValidationResult) {
  // No specific validations for custom container - users have full control
  result.suggestions.push("Custom container migration allows full flexibility - configure dependencies and scripts as needed for your specific setup");
}

function validatePythonContainerPackageJson(packageJson: any, result: ValidationResult) {
  // For Python projects, package.json is mainly for container orchestration
  if (!packageJson.name) {
    result.warnings.push("Consider adding 'name' field for better project identification");
  }

  if (!packageJson.version) {
    result.warnings.push("Consider adding 'version' field for better project versioning");
  }

  result.suggestions.push("For Python projects, ensure requirements.txt or pyproject.toml contains your Python dependencies");
}

function formatValidationResult(result: ValidationResult, filePath?: string): string {
  const sections: string[] = [];

  // Header
  const status = result.isValid ? "✅ **Valid**" : "❌ **Invalid**";
  sections.push(`${status} package.json validation${filePath ? ` for \`${filePath}\`` : ""}`);

  // Errors
  if (result.errors.length > 0) {
    sections.push("## ❌ Errors (Must Fix)");
    result.errors.forEach(error => {
      sections.push(`- ${error}`);
    });
  }

  // Required Changes
  if (result.requiredChanges.length > 0) {
    sections.push("## 🔧 Required Changes");
    result.requiredChanges.forEach(change => {
      const action = change.action === "add" ? "Add" : change.action === "modify" ? "Update" : "Remove";
      sections.push(`- **${action}** \`${change.field}\`: ${JSON.stringify(change.expected)}`);
    });
  }

  // Warnings
  if (result.warnings.length > 0) {
    sections.push("## ⚠️ Warnings (Recommended)");
    result.warnings.forEach(warning => {
      sections.push(`- ${warning}`);
    });
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    sections.push("## 💡 Suggestions");
    result.suggestions.forEach(suggestion => {
      sections.push(`- ${suggestion}`);
    });
  }

  // Summary
  if (result.isValid) {
    sections.push("## ✨ Summary");
    sections.push("Your package.json is ready for migration! Address any warnings above for optimal setup.");
  } else {
    sections.push("## 🚨 Next Steps");
    sections.push("Fix the errors above before proceeding with migration. The required changes section shows exactly what needs to be updated.");
  }

  return sections.join("\n\n");
}

// Tool schema for MCP
export const PackageJsonValidationToolSchema = {
  name: "validate_package_json",
  description: "Validate package.json file for MCP server migration compatibility and provide specific guidance",
  inputSchema: {
    packageJsonContent: z.string().describe("Content of the package.json file to validate"),
    migrationPath: z.enum(["ts-smithery-cli", "ts-custom-container", "py-custom-container"]).describe("Target migration path to validate against"),
    filePath: z.string().optional().describe("Optional file path for better error reporting")
  }
};
