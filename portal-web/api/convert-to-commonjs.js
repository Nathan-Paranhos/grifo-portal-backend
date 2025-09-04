const fs = require('fs');
const path = require('path');

// Lista de arquivos para converter
const filesToConvert = [
  'src/routes/v1/users.js',
  'src/routes/v1/companies.js',
  'src/routes/v1/inspections.js',
  'src/routes/public.js',
  'src/routes/v1/auth.js',
  'src/routes/v1/reports.js',
  'src/routes/health.js',
  'src/routes/contests.js',
  'src/routes/v1/admin-clients.js',
  'src/routes/inspections.js',
  'src/routes/uploads.js',
  'src/routes/v1/settings.js',
  'src/routes/mvp-routes.js',
  'src/routes/reports.js',
  'src/routes/inspection-requests.js',
  'src/routes/clients.js',
  'src/routes/v1/properties.js',
  'src/routes/auth.js',
  'src/routes/sync.js',
  'src/routes/v1/uploads.js',
  'src/routes/companies.js',
  'src/routes/properties.js',
  'src/routes/v1/notifications.js',
  'src/routes/v1/index.js',
  'src/routes/dashboard.js',
  'src/routes/v1/health.js',
  'src/routes/users.js'
];

function convertFileToCommonJS(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Convert import statements to require
    content = content.replace(/import\s+([^\s]+)\s+from\s+['"]([^'"]+)['"];?/g, 'const $1 = require(\'$2\');');
    content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, 'const {$1} = require(\'$2\');');
    content = content.replace(/import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"];?/g, 'const $1 = require(\'$2\');');
    
    // Convert export default to module.exports
    content = content.replace(/export\s+default\s+([^;]+);?/g, 'module.exports = $1;');
    
    // Write back the converted content
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Converted: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error converting ${filePath}:`, error.message);
  }
}

console.log('🔄 Converting ES6 modules to CommonJS...');

filesToConvert.forEach(convertFileToCommonJS);

console.log('✅ Conversion completed!');