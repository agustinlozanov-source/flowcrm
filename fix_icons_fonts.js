const fs = require('fs');

// 1. Upsize Fonts in Superadmin.jsx
let sa = fs.readFileSync('src/pages/Superadmin.jsx', 'utf8');
sa = sa.replace(/font-size:\s*([\d.]+)px/g, (match, valStr) => {
  let size = parseFloat(valStr);
  if (size < 10) return match; // Keep tiny stuff or maybe upsize?
  size = Math.round(size);
  let newSize = size + 2; 
  if (size >= 14) newSize = size + 3;
  if (size >= 20) newSize = size + 4;
  return `font-size: ${newSize}px`;
}).replace(/fontSize:\s*([\d.]+)/g, (match, valStr) => {
  let size = parseFloat(valStr);
  if (size < 10) return match;
  size = Math.round(size);
  let newSize = size + 2; 
  if (size >= 14) newSize = size + 3;
  if (size >= 20) newSize = size + 4;
  return `fontSize: ${newSize}`;
});
fs.writeFileSync('src/pages/Superadmin.jsx', sa);

// 2. Add Lucide icons helper and imports in ClientPortal and ImplementationPortal
function fixIcons(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Add imports
  if (!content.includes('lucide-react')) {
    content = content.replace(/(import .* from 'react'.*\n)/, `$1import { Rocket, Target, MessageSquare, Bot, Clapperboard, CheckCircle2, ClipboardList, Wrench, KeyIcon, BarChart3, Globe, Smartphone, Lightbulb, GraduationCap, Search, Sparkles, Calendar, MessageCircle, Folder, Link as LinkIcon, Pencil, FileText, Image as ImageIcon, Paperclip, Zap, User } from 'lucide-react'\n`);
  } else {
    content = content.replace(/import \{.*?\} from 'lucide-react'/, `import { Rocket, Target, MessageSquare, Bot, Clapperboard, CheckCircle2, ClipboardList, Wrench, Key as KeyIcon, BarChart3, Globe, Smartphone, Lightbulb, GraduationCap, Search, Sparkles, Calendar, MessageCircle, Folder, Link as LinkIcon, Pencil, FileText, Image as ImageIcon, Paperclip, Zap, User } from 'lucide-react'`);
  }

  // Helper render 
  const helper = `\nconst StageIcon = ({ icon, size = 16 }) => {
  const map = {
    '🚀': <Rocket size={size} />,
    '🎯': <Target size={size} />,
    '💬': <MessageSquare size={size} />,
    '🤖': <Bot size={size} />,
    '🎬': <Clapperboard size={size} />,
    '✅': <CheckCircle2 size={size} />,
    '📋': <ClipboardList size={size} />,
    '🔧': <Wrench size={size} />,
    '🔑': <KeyIcon size={size} />,
    '📊': <BarChart3 size={size} />,
    '🌐': <Globe size={size} />,
    '📱': <Smartphone size={size} />,
    '💡': <Lightbulb size={size} />,
    '🎓': <GraduationCap size={size} />,
    '🔍': <Search size={size} />
  }
  return map[icon] || <Sparkles size={size} />
}\n`;

  if (!content.includes('StageIcon =')) {
    content = content.replace(/const fmtShort = [^\n]*\n[^\n]*\n\}/, (match) => match + helper);
    // for ImplementationPortal which has different functions
    if (file.includes('ImplementationPortal')) {
        content = content.replace(/const fmtDateInput = [^\n]*\n[^\n]*\n\}/, (match) => match + helper);
    }
  }

  // Replacements of hardcoded emojis
  content = content.replace(/📅 Cronograma/g, `<Calendar size={14} style={{marginRight: 6}} /> Cronograma`);
  content = content.replace(/💬 Chat/g, `<MessageCircle size={14} style={{marginRight: 6}} /> Chat`);
  content = content.replace(/📁 Documentos/g, `<Folder size={14} style={{marginRight: 6}} /> Documentos`);
  content = content.replace(/🔗 Copiar link/g, `<LinkIcon size={14} /> Copiar link`);
  content = content.replace(/🔑 \{impl.portalPassword\}/g, `<KeyIcon size={12} style={{marginRight:4, display:'inline'}} /> {impl.portalPassword}`);
  content = content.replace(/>✏️</g, `><Pencil size={12} /></`);
  content = content.replace(/'📄' : d.type\?\.includes\('image'\) \? '🖼️' : '📎'/g, `<FileText size={16} /> : d.type?.includes('image') ? <ImageIcon size={16} /> : <Paperclip size={16} />`);
  content = content.replace(/>⚡/g, `><Zap size={10} style={{marginRight:4, display:'inline-block', marginBottom:-1}} />`);
  content = content.replace(/>👤/g, `><User size={10} style={{marginRight:4, display:'inline-block', marginBottom:-1}} />`);
  content = content.replace(/>📅/g, `><Calendar size={10} style={{marginRight:4, display:'inline-block', marginBottom:-1}} />`);
  content = content.replace(/>💬 /g, `><MessageCircle size={14} style={{marginRight:4, display:'inline-block', marginBottom:-2}} /> `);
  content = content.replace(/>📁 /g, `><Folder size={14} style={{marginRight:4, display:'inline-block', marginBottom:-2}} /> `);
  
  // stage icon dynamic rendering
  content = content.replace(/\{stage\.icon\}/g, `<StageIcon icon={stage.icon} />`);
  content = content.replace(/\{currentStage\.icon\}/g, `<StageIcon icon={currentStage.icon} size={18} />`);

  fs.writeFileSync(file, content);
}

fixIcons('src/pages/ClientPortal.jsx');
fixIcons('src/pages/ImplementationPortal.jsx');

// For TemplateEditor.jsx - fix icons and imports
let te = fs.readFileSync('src/pages/TemplateEditor.jsx', 'utf8');
if (!te.includes('lucide-react')) {
  te = te.replace(/(import .* from 'react'.*\n)/, `$1import { Rocket, Target, MessageSquare, Bot, Clapperboard, CheckCircle2, ClipboardList, Wrench, KeyIcon, BarChart3, Globe, Smartphone, Lightbulb, GraduationCap, Search, Sparkles, Calendar, MessageCircle, Folder, Link as LinkIcon, Pencil, FileText, Image as ImageIcon, Paperclip, Zap, User } from 'lucide-react'\n`);
}
const helperTe = `\nconst StageIcon = ({ icon, size = 16 }) => {
  const map = {
    '🚀': <Rocket size={size} />,
    '��': <Target size={size} />,
    '💬': <MessageSquare size={size} />,
    '🤖': <Bot size={size} />,
    '🎬': <Clapperboard size={size} />,
    '✅': <CheckCircle2 size={size} />,
    '📋': <ClipboardList size={size} />,
    '🔧': <Wrench size={size} />,
    '🔑': <KeyIcon size={size} />,
    '📊': <BarChart3 size={size} />,
    '🌐': <Globe size={size} />,
    '📱': <Smartphone size={size} />,
    '💡': <Lightbulb size={size} />,
    '🎓': <GraduationCap size={size} />,
    '🔍': <Search size={size} />
  }
  return map[icon] || <Sparkles size={size} />
}\n`;
if (!te.includes('StageIcon =')) {
  te = te.replace(/const genId = [^\n]*\n/, (match) => helperTe + '\n' + match);
}

te = te.replace(/<div className="te-icon-btn"[^>]*>\{value\}<\/div>/g, `<div className="te-icon-btn" onClick={() => setOpen(o => !o)}><StageIcon icon={value} /></div>`);
te = te.replace(/<button key=\{ic\} className="te-icon-opt"[^>]*>\{ic\}<\/button>/g, `<button key={ic} className="te-icon-opt" onClick={() => { onChange(ic); setOpen(false) }}><StageIcon icon={ic} /></button>`);
te = te.replace(/>⚡ /g, `><Zap size={10} style={{marginRight:4, display:'inline-block', marginBottom:-1}} /> `);
te = te.replace(/>👤 /g, `><User size={10} style={{marginRight:4, display:'inline-block', marginBottom:-1}} /> `);
te = te.replace(/>📅/g, `><Calendar size={10} style={{marginRight:4, display:'inline-block', marginBottom:-1}} />`);
fs.writeFileSync('src/pages/TemplateEditor.jsx', te);

