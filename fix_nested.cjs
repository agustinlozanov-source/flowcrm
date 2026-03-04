const fs = require('fs');

function fix(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/<StageIcon icon=<StageIcon icon=\{stage\.icon\} \/> \/>/g, '<StageIcon icon={stage.icon} />');
  c = c.replace(/<StageIcon icon=<StageIcon icon=\{currentStage\.icon\} size=\{18\} \/> size=\{18\} \/>/g, '<StageIcon icon={currentStage.icon} size={18} />');
  c = c.replace(/<StageIcon icon=<StageIcon icon=\{value\} \/> \/>/g, '<StageIcon icon={value} />');
  c = c.replace(/<StageIcon icon=<StageIcon icon=\{ic\} \/> \/>/g, '<StageIcon icon={ic} />');
  c = c.replace(/key=<StageIcon icon=\{ic\} \/> /g, 'key={ic} ');
  fs.writeFileSync(file, c);
}

fix('src/pages/ClientPortal.jsx');
fix('src/pages/ImplementationPortal.jsx');
fix('src/pages/TemplateEditor.jsx');
