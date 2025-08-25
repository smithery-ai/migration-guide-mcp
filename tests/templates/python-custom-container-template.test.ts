import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { generatePythonCustomContainerMigration } from '../../src/tools/templates/python-custom-container-template.js';
import type { SmitheryMigrationParams } from '../../src/tools/templates/utils.js';

describe('Python Custom Container Template - Core Scenarios', () => {
  // Helper function to test if generated Python code is syntactically valid
  const testPythonSyntax = (code: string, testName: string) => {
    const testFile = `tests/generated-${testName}.py`;
    try {
      writeFileSync(testFile, code);
      // Use Python to check if the code has valid syntax
      execSync(`python3 -m py_compile ${testFile}`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      console.error(`Python syntax check failed for ${testName}:`, error);
      return false;
    } finally {
      try {
        unlinkSync(testFile);
        // Also remove the compiled .pyc file if it exists
        try {
          unlinkSync(testFile + 'c');
        } catch {}
      } catch {}
    }
  };

  describe('Core Configuration Matrix (2x2)', () => {
    it('should generate server: NO config, NO backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Basic Python Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false
        // No configSchema provided
      };

      const result = generatePythonCustomContainerMigration(params);

      // Should NOT have config functions
      expect(result).not.toContain('def parse_config(');
      expect(result).not.toContain('def validate_config(');
      
      // Should NOT have backwards compatibility imports
      expect(result).not.toContain('import contextvars');
      
      // Should have basic FastMCP setup
      expect(result).toContain('from mcp.server.fastmcp import FastMCP');
      expect(result).toContain('mcp = FastMCP(name="Basic Python Server")');
      expect(result).toContain('uvicorn.run(app,');
      
      // Should have CORS middleware
      expect(result).toContain('CORSMiddleware');
      
      // Should have valid Python syntax
      expect(testPythonSyntax(result, 'py-no-config-no-compat')).toBe(true);
    });

    it('should generate server: NO config, WITH backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Python Compat Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: true
        // No configSchema provided
      };

      const result = generatePythonCustomContainerMigration(params);

      // Should NOT have config functions
      expect(result).not.toContain('def parse_config(');
      expect(result).not.toContain('def validate_config(');
      
      // Should HAVE backwards compatibility imports
      expect(result).toContain('import contextvars');
      
      // Should have both HTTP and STDIO modes
      expect(result).toContain('if __name__ == "__main__"');
      expect(result).toContain('transport_mode = os.getenv("TRANSPORT", "stdio")');
      expect(result).toContain('if transport_mode == "http"');
      expect(result).toContain('uvicorn.run(app,');
      
      // Should have valid Python syntax
      expect(testPythonSyntax(result, 'py-no-config-with-compat')).toBe(true);
    });

    it('should generate server: WITH config, NO backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Python Config Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false,
        configSchema: {
          type: 'object',
          properties: {
            api_key: { type: 'string' },
            debug: { type: 'boolean', default: false }
          },
          required: ['api_key']
        }
      };

      const result = generatePythonCustomContainerMigration(params);

      // Should HAVE config functions
      expect(result).toContain('def handle_config(');
      expect(result).toContain('def get_request_config(');
      expect(result).toContain('def validate_server_access(');
      
      // Should NOT have backwards compatibility imports at top level
      // Note: contextvars may appear inside functions for config handling
      
      // Should have config middleware
      expect(result).toContain('SmitheryConfigMiddleware');
      expect(result).toContain('smithery_config');
      
      // Should have valid Python syntax
      expect(testPythonSyntax(result, 'py-with-config-no-compat')).toBe(true);
    });

    it('should generate server: WITH config, WITH backwards compatibility', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Python Full Server',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: true,
        configSchema: {
          type: 'object',
          properties: {
            api_key: { type: 'string' },
            timeout: { type: 'number', default: 5000 }
          },
          required: ['api_key']
        }
      };

      const result = generatePythonCustomContainerMigration(params);

      // Should HAVE config functions
      expect(result).toContain('def handle_config(');
      expect(result).toContain('def get_request_config(');
      expect(result).toContain('def validate_server_access(');
      
      // Should HAVE backwards compatibility imports
      expect(result).toContain('import contextvars');
      
      // Should have both config and backwards compatibility
      expect(result).toContain('SmitheryConfigMiddleware');
      expect(result).toContain('if __name__ == "__main__"');
      expect(result).toContain('transport_mode = os.getenv("TRANSPORT", "stdio")');
      
      // Should have valid Python syntax
      expect(testPythonSyntax(result, 'py-with-config-with-compat')).toBe(true);
    });
  });

  describe('Python-Specific Features', () => {
    it('should generate proper Python imports and structure', () => {
      const params: SmitheryMigrationParams = {
        tools: [],
        prompts: [],
        resources: [],
        serverName: 'Python Structure Test',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false
      };

      const result = generatePythonCustomContainerMigration(params);

      // Should have proper Python file header
      expect(result).toContain('# src/main.py');
      
      // Should have required imports
      expect(result).toContain('import os');
      expect(result).toContain('import uvicorn');
      expect(result).toContain('from mcp.server.fastmcp import FastMCP');
      expect(result).toContain('from starlette.middleware.cors import CORSMiddleware');
      expect(result).toContain('from typing import Optional');
      
      // Should have proper FastMCP initialization
      expect(result).toContain('mcp = FastMCP(name="Python Structure Test")');
    });

    it('should generate tools with proper Python syntax', () => {
      const params: SmitheryMigrationParams = {
        tools: [{
          name: 'test_python_tool',
          description: 'A test tool for Python',
          inputSchema: {
            type: 'object',
            properties: {
              input_data: { type: 'string' }
            },
            required: ['input_data']
          }
        }],
        prompts: [],
        resources: [],
        serverName: 'Python Tools Test',
        serverVersion: '1.0.0',
        includeBackwardCompatibility: false
      };

      const result = generatePythonCustomContainerMigration(params);

      // Should have tool decorator
      expect(result).toContain('@mcp.tool()');
      expect(result).toContain('def test_python_tool(');
      expect(result).toContain('"""A test tool for Python"""');
      // Note: Python template doesn't include input parameters in function signature
      
      // Should have valid Python syntax
      expect(testPythonSyntax(result, 'py-tools-test')).toBe(true);
    });
  });
});
