const fs = require('fs');

function bumpFonts(file) {
  let c = fs.readFileSync(file, 'utf8');

  // Let's add +2 or +3 aggressively to any font-size
  c = c.replace(/font-size:\s*([\d.]+)(px)?/g, (match, valStr, px) => {
    let size = parseFloat(valStr);
    if (size < 10) return match; 
    let newSize = size + 2; 
    if (size >= 14) newSize = size + 3;
    if (size >= 20) newSize = size + 4;
    return `font-size: ${Math.round(newSize)}px`;
  });

  c = c.replace(/fontSize:\s*([\d.]+)/g, (match, valStr) => {
    let size = parseFloat(valStr);
    if (size < 10) return match; 
    let newSize = size + 2; 
    if (size >= 14) newSize = size + 3;
    if (size >= 20) newSize = size + 4;
    return `fontSize: ${Math.round(newSize)}`;
  });
  
  // Specific fixes
  if (file.includes('TemplateEditor')) {
    c = c.replace(/<div className="te-root sa-content" style=\{\{ maxWidth: 760 \}\}>/, 
                  '<div className="te-root sa-content" style={{ maxWidth: 760, background: "#070708", color: "white", minHeight: "100%", padding: 32 }}>');
  }
  
  if (file.includes('ImplementationPortal')) {
    c = c.replace(/<div className="ip-root sa-content" style=\{\{ maxWidth: '100%' \}\}>/, 
                  '<div className="ip-root sa-content" style={{ maxWidth: "100%", background: "#070708", color: "white", minHeight: "100%", padding: 32 }}>');
  }

  fs.writeFileSync(file, c);
}

bumpFonts('src/pages/ClientPortal.jsx');
bumpFonts('src/pages/ImplementationPortal.jsx');
bumpFonts('src/pages/TemplateEditor.jsx');

let sa = fs.readFileSync('src/pages/Superadmin.jsx', 'utf8');
sa = sa.replace(/<div id="sa-quote-preview" style=\{\{ background: '#070708', minHeight: '100%' \}\}>/, 
                '<div id="sa-quote-preview" style={{ background: "#070708", color: "white", minHeight: "100%" }}>');
fs.writeFileSync('src/pages/Superadmin.jsx', sa);
