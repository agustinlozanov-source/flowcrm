const fs = require('fs');
let sa = fs.readFileSync('src/pages/Superadmin.jsx', 'utf8');

sa = sa.replace(/font-size:\s*([\d.]+)(px)?/g, (match, valStr, px) => {
  let size = parseFloat(valStr);
  if (size < 10) return match; 
  if (size === 10 || size === 10.5) return 'font-size: 12px';
  if (size === 11 || size === 11.5) return 'font-size: 13px';
  if (size === 12 || size === 12.5) return 'font-size: 14px';
  if (size === 13 || size === 13.5) return 'font-size: 15px';
  if (size === 14 || size === 14.5) return 'font-size: 16px';
  if (size === 15 || size === 15.5) return 'font-size: 17px';
  if (size === 16) return 'font-size: 18px';
  if (size === 17) return 'font-size: 19px';
  return match;
});

// For inline styles that miss "font-size" and use "fontSize:"
sa = sa.replace(/fontSize:\s*([\d.]+)/g, (match, valStr) => {
  let size = parseFloat(valStr);
  if (size < 10) return match; 
  if (size === 10 || size === 10.5) return 'fontSize: 12';
  if (size === 11 || size === 11.5) return 'fontSize: 13';
  if (size === 12 || size === 12.5) return 'fontSize: 14';
  if (size === 13 || size === 13.5) return 'fontSize: 15';
  if (size === 14 || size === 14.5) return 'fontSize: 16';
  if (size === 15 || size === 15.5) return 'fontSize: 17';
  if (size === 16) return 'fontSize: 18';
  if (size === 17) return 'fontSize: 19';
  return match;
});

fs.writeFileSync('src/pages/Superadmin.jsx', sa);
