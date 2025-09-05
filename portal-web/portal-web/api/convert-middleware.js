const fs = require('fs');
const path = require('path');

// Lista de arquivos de middleware e config para converter
const filesToConvert = [
  'src/middleware/auth.js',
  'src/middleware/errorHandler.js',
  'src/middleware/validation.js',
  'src/middleware/security.js',
  'src/middleware/tenant.js',
  'src/config/supabase.js',
  'src/config/logger.js',
  'src/config/swagger.js',
  'src/utils/notifications.js'
];

function convertFileToCommonJS(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Convert import statements to require
    content = content.replace(/import\s+([^\s]+)\s+from\s+['"]([^'"]+)['"];?/g, 'const $1 = require(\'$2\');');
    content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, 'const {$1} = require(\'$2\');');
    content = content.replace(/import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"];?/g, 'const $1 = require(\'$2\');');
    
    // Convert export const/function to module.exports
    content = content.replace(/export\s+const\s+([^\s=]+)\s*=/g, 'const $1 =');
    content = content.replace(/export\s+function\s+([^\s(]+)/g, 'function $1');
    content = content.replace(/export\s+async\s+function\s+([^\s(]+)/g, 'async function $1');
    
    // Convert export default to module.exports
    content = content.replace(/export\s+default\s+([^;]+);?/g, 'module.exports = $1;');
    
    // Handle export { ... } statements
    const exportMatches = content.match(/export\s*\{([^}]+)\}/g);
    if (exportMatches) {
      exportMatches.forEach(match => {
        const exports = match.replace(/export\s*\{([^}]+)\}/, '$1').split(',').map(e => e.trim());
        const moduleExports = exports.map(exp => {
          const [name, alias] = exp.split(' as ').map(s => s.trim());
          return alias ? `${alias}: ${name}` : `${name}: ${name}`;
        }).join(', ');
        content = content.replace(match, `module.exports = { ${moduleExports} };`);
      });
    }
    
    // Fix __filename and __dirname for CommonJS
    content = content.replace(/import\s*\{\s*fileURLToPath\s*\}\s*from\s*['"]url['"];?/g, '');
    content = content.replace(/const\s+__filename\s*=\s*fileURLToPath\(import\.meta\.url\);?/g, '');
    content = content.replace(/const\s+__dirname\s*=\s*dirname\(__filename\);?/g, '');
    
    // Write back the converted content
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Converted: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error converting ${filePath}:`, error.message);
  }
}

console.log('🔄 Converting middleware and config files to CommonJS...');

filesToConvert.forEach(convertFileToCommonJS);

console.log('✅ Middleware conversion completed!');