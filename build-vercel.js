import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to resolve TypeScript path aliases and ensure local files are bundled
const aliasPlugin = {
  name: 'alias',
  setup(build) {
    // Handle @shared/* imports
    build.onResolve({ filter: /^@shared/ }, (args) => {
      const relativePath = args.path.replace('@shared/', '');
      let resolvedPath = path.resolve(__dirname, 'shared', relativePath);
      // Try adding .ts extension if needed
      if (!resolvedPath.match(/\.(ts|tsx|js|jsx)$/)) {
        const withExt = resolvedPath + '.ts';
        if (existsSync(withExt)) {
          resolvedPath = withExt;
        }
      }
      return { path: resolvedPath };
    });
    // Handle @/* imports
    build.onResolve({ filter: /^@\// }, (args) => {
      const relativePath = args.path.replace('@/', '');
      return {
        path: path.resolve(__dirname, 'client', 'src', relativePath),
      };
    });
    
    // CRITICAL: Handle ../server/* imports and ensure they're bundled
    build.onResolve({ filter: /^\.\.\/server/ }, (args) => {
      const importPath = args.path;
      const relativePath = importPath.replace('../server/', '');
      let resolvedPath = path.resolve(__dirname, 'server', relativePath);
      
      // Add .ts extension if no extension present
      if (!resolvedPath.match(/\.(ts|tsx|js|jsx)$/)) {
        const withTsExt = resolvedPath + '.ts';
        if (existsSync(withTsExt)) {
          resolvedPath = withTsExt;
        } else {
          const withJsExt = resolvedPath + '.js';
          if (existsSync(withJsExt)) {
            resolvedPath = withJsExt;
          }
        }
      }
      
      console.log(`Resolving server import: ${importPath} -> ${resolvedPath}`);
      
      // Return the resolved path - esbuild will bundle it because external is not set
      return {
        path: resolvedPath,
        namespace: 'file'
      };
    });
  },
};

try {
  const entryPoint = path.resolve(__dirname, 'api', 'index.ts');
  
  // Verify entry point exists
  if (!existsSync(entryPoint)) {
    console.error(`✘ Entry point not found: ${entryPoint}`);
    console.error(`Current directory: ${__dirname}`);
    console.error(`Looking for: api/index.ts`);
    process.exit(1);
  }
  
  console.log(`Building API from: ${entryPoint}`);
  
  await esbuild.build({
    entryPoints: [entryPoint],
    platform: 'node',
    bundle: true, // Bundle all imports
    format: 'esm',
    outfile: 'api/index.js',
    // Only externalize node_modules packages, NOT local files
    packages: 'external',
    plugins: [aliasPlugin],
    logLevel: 'info',
    // Resolve .ts extensions for TypeScript files
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // Explicitly don't mark local files as external
    external: [],
    // Loader for TypeScript files
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    banner: {
      js: '// Bundled for Vercel serverless function'
    }
  });
  console.log('✓ API build successful');
} catch (error) {
  console.error('✘ Build failed:', error);
  if (error.errors) {
    error.errors.forEach((err) => {
      console.error(`  ${err.text} at ${err.location?.file}:${err.location?.line}`);
    });
  }
  process.exit(1);
}

