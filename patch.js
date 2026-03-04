const fs = require('fs');

function fixClientPortal() {
  let file = 'src/pages/ClientPortal.jsx';
  let c = fs.readFileSync(file, 'utf8');
  
  // Fix progress === 100 ternary
  c = c.replace(
    /"inline-block"\}\} \/> ¡Implementación completada!' : \`Etapa actual: \$\<StageIcon icon=\<StageIcon icon=\{currentStage\.icon\} size=\{18\} \/> size=\{18\} \/> \$\{currentStage\.name\}\`/,
    '"inline-block"}} /> ¡Implementación completada!</> : <>Etapa actual: <StageIcon icon={currentStage.icon} size={18} /> {currentStage.name}</>'
  );
  c = c.replace(/'<Sparkles size=\{16\}/, '<><Sparkles size={16}');

  // form: '<Zap ... /> Qubit Corp.' => <><Zap ... /> Qubit Corp.</>
  c = c.replace(/'(<Zap.*?Qubit Corp\.)'/g, '<>$1</>');
  c = c.replace(/'(<User.*?Tú)'/g, '<>$1</>');
  
  // File types ternary
  c = c.replace(/'(<FileText.*?\/>)'/g, '$1');
  c = c.replace(/'(<ImageIcon.*?\/>)'/g, '$1');
  c = c.replace(/'(<Paperclip.*?\/>)'/g, '$1');

  
  fs.writeFileSync(file, c);
}

function fixImplPortal() {
  let file = 'src/pages/ImplementationPortal.jsx';
  let c = fs.readFileSync(file, 'utf8');

  // Tabs labels
  c = c.replace(/['"](<Calendar.*?)['"]/g, '<>$1</>');
  c = c.replace(/['"](<MessageCircle.*?)['"]/g, '<>$1</>');
  c = c.replace(/['"](<Folder.*?)['"]/g, '<>$1</>');
  
  // File types ternary
  c = c.replace(/'(<FileText.*?\/>)'/g, '$1');
  c = c.replace(/'(<ImageIcon.*?\/>)'/g, '$1');
  c = c.replace(/'(<Paperclip.*?\/>)'/g, '$1');

  // task map 
  c = c.replace(/'(<Zap.*?Qubit)'/g, '<>$1</>');
  c = c.replace(/'(<User.*?Cliente)'/g, '<>$1</>');
  
  fs.writeFileSync(file, c);
}

function fixTemplateEditor() {
  let file = 'src/pages/TemplateEditor.jsx';
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/'(<Calendar.*?\/>)'/g, '$1');
  c = c.replace(/value=<StageIcon icon=<StageIcon icon=\{stage.icon\} \/> \/>/g, 'value={stage.icon}');
  fs.writeFileSync(file, c);
}

fixClientPortal();
fixImplPortal();
fixTemplateEditor();
