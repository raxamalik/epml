import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, cpSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Alternative build approach: Copy server files to api/server first
// This ensures all imports can be resolved

try {
  const entryPoint = path.resolve(__dirname, 'api', 'index.ts');
  
  if (!existsSync(entryPoint)) {
    console.error(`✘ Entry point not found: ${entryPoint}`);
    process.exit(1);
  }
  
  console.log('Building API with alternative approach...');
  
  // Step 1: Copy server directory to api/server
  const serverSrc = path.resolve(__dirname, 'server');
  const serverDest = path.resolve(__dirname, 'api', 'server');
  
  if (existsSync(serverDest)) {
    // Remove existing copy
    const { rmSync } = await import('fs');
    rmSync(serverDest, { recursive: true, force: true });
  }
  
  console.log(`Copying ${serverSrc} to ${serverDest}...`);
  mkdirSync(serverDest, { recursive: true });
  cpSync(serverSrc, serverDest, { recursive: true });
  console.log('✓ Server files copied');
  
  // Step 2: Copy shared directory to api/shared
  const sharedSrc = path.resolve(__dirname, 'shared');
  const sharedDest = path.resolve(__dirname, 'api', 'shared');
  
  if (existsSync(sharedDest)) {
    const { rmSync } = await import('fs');
    rmSync(sharedDest, { recursive: true, force: true });
  }
  
  console.log(`Copying ${sharedSrc} to ${sharedDest}...`);
  mkdirSync(sharedDest, { recursive: true });
  cpSync(sharedSrc, sharedDest, { recursive: true });
  console.log('✓ Shared files copied');
  
  // Step 3: Update the import in api/index.ts temporarily
  // Actually, we'll just build with the new structure
  // The import "../server/routes" will now resolve to "./server/routes"
  
  // Step 4: Build with esbuild
  console.log(`Building API from: ${entryPoint}`);
  
  await esbuild.build({
    entryPoints: [entryPoint],
    platform: 'node',
    bundle: true,
    format: 'esm',
    outfile: 'api/index.js',
    packages: 'external',
    logLevel: 'info',
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    external: [],
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
  });
  
  console.log('✓ API build successful');
  
  // Step 5: Clean up copied directories (optional - Vercel will use the built file)
  // We can leave them for debugging or remove them
  
} catch (error) {
  console.error('✘ Build failed:', error);
  if (error.errors) {
    error.errors.forEach((err) => {
      console.error(`  ${err.text} at ${err.location?.file}:${err.location?.line}`);
    });
  }
  process.exit(1);
}

