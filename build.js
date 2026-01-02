/**
 * Build script for production
 * Removes console.log statements and minifies code
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy non-JS files
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

// Process JS files
async function processJSFile(filePath, outputPath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  const result = await minify(code, {
    compress: {
      drop_console: true, // Remove all console statements
      drop_debugger: true, // Remove debugger statements
      pure_funcs: ['console.log', 'console.debug', 'console.info'], // Remove specific console calls
    },
    mangle: false, // Keep names unmangled for debugging - consider enabling for production builds to reduce file size
    format: {
      comments: false, // Remove comments
    },
  });

  const destDir = path.dirname(outputPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, result.code, 'utf8');
  console.log(`Processed: ${filePath} -> ${outputPath}`);
}

// Process all files recursively
async function processDirectory(dir, baseDir, outputBaseDir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.relative(baseDir, filePath);
    const outputPath = path.join(outputBaseDir, relativePath);

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      await processDirectory(filePath, baseDir, outputBaseDir);
    } else if (file.endsWith('.js')) {
      await processJSFile(filePath, outputPath);
    } else {
      // Copy non-JS files as-is
      copyFile(filePath, outputPath);
    }
  }
}

async function build() {
  console.log('Building extension for production...\n');

  // Process src directory
  await processDirectory(srcDir, srcDir, path.join(distDir, 'src'));

  // Copy other necessary files
  copyFile(
    path.join(__dirname, 'manifest.json'),
    path.join(distDir, 'manifest.json')
  );
  copyFile(
    path.join(__dirname, 'styles', 'overlay.css'),
    path.join(distDir, 'styles', 'overlay.css')
  );

  // Copy icons directory
  const iconsDir = path.join(__dirname, 'icons');
  const distIconsDir = path.join(distDir, 'icons');
  if (fs.existsSync(iconsDir)) {
    if (!fs.existsSync(distIconsDir)) {
      fs.mkdirSync(distIconsDir, { recursive: true });
    }
    const iconFiles = fs.readdirSync(iconsDir);
    for (const icon of iconFiles) {
      if (icon.endsWith('.png')) {
        copyFile(path.join(iconsDir, icon), path.join(distIconsDir, icon));
      }
    }
  }

  console.log('\n✅ Build complete! Output in ./dist directory');
  console.log('Load the extension from the dist folder in Chrome.');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
