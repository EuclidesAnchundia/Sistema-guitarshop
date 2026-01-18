const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../dist/stats.html');
if (!fs.existsSync(file)) {
  console.error('No se encontró', file);
  process.exit(1);
}
let s = fs.readFileSync(file, 'utf8');
// Reemplaza prefijos absolutos Windows por rutas relativas
s = s.replaceAll('C:/Proyecto/Guitarshop/react-frontend/', '');
// También manejar caso con backslashes
s = s.replaceAll('C:\\Proyecto\\Guitarshop\\react-frontend\\', '');
// Evitar rutas que empiecen con a leading slash (normalize)
s = s.replaceAll('/C:/Proyecto/Guitarshop/react-frontend/', '');
fs.writeFileSync(file, s, 'utf8');
console.log('stats.html sanitizado');
