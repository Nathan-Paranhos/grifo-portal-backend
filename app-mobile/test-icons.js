// Teste para verificar ícones do lucide-react-native
try {
  const lucide = require('lucide-react-native');
  
  const iconsToCheck = ['Edit3', 'Archive', 'Star', 'Trash2', 'Edit', 'ArchiveIcon', 'StarIcon', 'Trash'];
  
  console.log('Verificando ícones do lucide-react-native:');
  
  iconsToCheck.forEach(iconName => {
    if (lucide[iconName]) {
      console.log(`✓ ${iconName} - ENCONTRADO`);
    } else {
      console.log(`✗ ${iconName} - NÃO ENCONTRADO`);
    }
  });
  
  // Listar alguns ícones disponíveis
  const availableIcons = Object.keys(lucide).filter(key => 
    typeof lucide[key] === 'function' && 
    key.charAt(0) === key.charAt(0).toUpperCase()
  ).slice(0, 20);
  
  console.log('\nAlguns ícones disponíveis:', availableIcons);
  
} catch (error) {
  console.error('Erro ao verificar ícones:', error.message);
}