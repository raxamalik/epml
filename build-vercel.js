import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to resolve TypeScript path aliases
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
    bundle: true,
    format: 'esm',
    outdir: 'api',
    outExtension: { '.js': '.js' },
    packages: 'external',
    plugins: [aliasPlugin],
    logLevel: 'info',
  });
  console.log('✓ API build successful');
} catch (error) {
  console.error('✘ Build failed:', error);
  if (error.errors) {
    error.errors.forEach((err: any) => {
      console.error(`  ${err.text} at ${err.location?.file}:${err.location?.line}`);
    });
  }
  process.exit(1);
}

