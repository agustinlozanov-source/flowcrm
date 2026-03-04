const fs = require('fs');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace stage icons array elements or inline emojis
    content = content.replace(/'🚀'/g, "'rocket'")
        .replace(/'🎯'/g, "'target'")
        .replace(/'💬'/g, "'message-square'")
        .replace(/'🤖'/g, "'bot'")
        .replace(/'🎬'/g, "'clapperboard'")
        .replace(/'✅'/g, "'check-circle-2'")
        .replace(/'📋'/g, "'clipboard-list'")
        .replace(/'🔧'/g, "'wrench'")
        .replace(/'🔑'/g, "'key'")
        .replace(/'📊'/g, "'bar-chart-3'")
        .replace(/'🌐'/g, "'globe'")
        .replace(/'📱'/g, "'smartphone'")
        .replace(/'💡'/g, "'lightbulb'")
        .replace(/'🎓'/g, "'graduation-cap'")
        .replace(/'🔍'/g, "'search'");

    // Replace text emojis
    content = content.replace(/📅/g, '<Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} />');
    content = content.replace(/💬/g, '<MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/📁/g, '<Folder size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/🔗/g, '<LinkIcon size={14} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} />');
    content = content.replace(/🔑/g, '<KeyIcon size={14} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} />');
    content = content.replace(/✏️/g, '<Pencil size={12} style={{ display: "inline-block", marginBottom: -1 }} />');
    content = content.replace(/📄/g, '<FileText size={16} style={{ display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/🖼️/g, '<ImageIcon size={16} style={{ display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/📎/g, '<Paperclip size={16} style={{ display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/⚡/g, '<Zap size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} />');
    content = content.replace(/👤/g, '<User size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} />');
    content = content.replace(/🎉/g, '<Sparkles size={16} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/ℹ️/g, '<Info size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} />');
    content = content.replace(/👥/g, '<Users size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} />');


    // Replace <StageIcon icon={var} /> mapping because previously we just did an ad-hoc fix.
    // Actually, wait, let's fix the imports first
    if (!content.includes('import { Users')) {
        content = content.replace(/import \{.*\} from ["']lucide-react["']/,
            "import { Rocket, Target, MessageSquare, Bot, Clapperboard, CheckCircle2, ClipboardList, Wrench, Key as KeyIcon, BarChart3, Globe, Smartphone, Lightbulb, GraduationCap, Search, Sparkles, Calendar, MessageCircle, Folder, Link as LinkIcon, Pencil, FileText, Image as ImageIcon, Paperclip, Zap, User, LogOut, Info, Users } from 'lucide-react'"
        );
    }

    // Ensure StageIcon is properly defined
    if (!content.includes('const StageIcon =')) {
        const helper = `\nconst StageIcon = ({ icon, size = 16 }) => {
  const map = {
    'rocket': <Rocket size={size} />,
    'target': <Target size={size} />,
    'message-square': <MessageSquare size={size} />,
    'bot': <Bot size={size} />,
    'clapperboard': <Clapperboard size={size} />,
    'check-circle-2': <CheckCircle2 size={size} />,
    'clipboard-list': <ClipboardList size={size} />,
    'wrench': <Wrench size={size} />,
    'key': <KeyIcon size={size} />,
    'bar-chart-3': <BarChart3 size={size} />,
    'globe': <Globe size={size} />,
    'smartphone': <Smartphone size={size} />,
    'lightbulb': <Lightbulb size={size} />,
    'graduation-cap': <GraduationCap size={size} />,
    'search': <Search size={size} />
  }
  return map[icon] || <Sparkles size={size} />
}\n`;
        content = content.replace(/const css = `/, helper + '\nconst css = `');
    }

    // Fix up specific inline rendering
    content = content.replace(/\{stage\.icon\}/g, `<StageIcon icon={stage.icon} />`);
    content = content.replace(/\{currentStage\.icon\}/g, `<StageIcon icon={currentStage.icon} size={18} />`);
    content = content.replace(/\{value\}/g, `<StageIcon icon={value} />`); // In TemplateEditor -> <div className="te-icon-btn">{value}</div>
    content = content.replace(/\{ic\}/g, `<StageIcon icon={ic} />`); // In TemplateEditor -> >{ic}</button>

    // Cleanup duplicates from previous attempt
    content = content.replace(/<StageIcon icon=\{<StageIcon icon=\{stage\.icon\} \/>\} \/>/g, '<StageIcon icon={stage.icon} />');
    content = content.replace(/<StageIcon icon=\{<StageIcon icon=\{currentStage\.icon\} size=\{18\} \/>\} size=\{18\} \/>/g, '<StageIcon icon={currentStage.icon} size={18} />');
    content = content.replace(/<StageIcon icon=\{<StageIcon icon=\{value\} \/>\} \/>/g, '<StageIcon icon={value} />');
    content = content.replace(/<StageIcon icon=\{<StageIcon icon=\{ic\} \/>\} \/>/g, '<StageIcon icon={ic} />');

    // Fix double tags
    content = content.replace(/<Calendar.*?>\s*<Calendar.*?>/g, '<Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} />');

    fs.writeFileSync(filePath, content);
}

processFile('src/pages/ClientPortal.jsx');
processFile('src/pages/ImplementationPortal.jsx');
processFile('src/pages/TemplateEditor.jsx');

// For Superadmin.jsx increase font sizes more radically and safely
let sa = fs.readFileSync('src/pages/Superadmin.jsx', 'utf8');

// The user requested "increase font size of entire main content of superadmin". 
// A robust way: Add `.sa-layout { font-size: 1.1em; }` and increase the individual specific ones again
sa = sa.replace(/(\.sa-content\s*\{\s*flex:\s*1;\s*overflow-y:\s*auto;\s*position:\s*relative;\s*background:\s*#ffffff;\s*color:\s*var\(--black\);\s*)/, '$1font-size: 15px;\n  ');
// Let's also do a pass over small fonts to bump them
sa = sa.replace(/font-size:\s*10(\.5)?px/g, 'font-size: 12px');
sa = sa.replace(/font-size:\s*11(\.5)?px/g, 'font-size: 13px');
sa = sa.replace(/font-size:\s*12(\.5)?px/g, 'font-size: 14px');
sa = sa.replace(/font-size:\s*13(\.5)?px/g, 'font-size: 15px');
sa = sa.replace(/font-size:\s*14(\.5)?px/g, 'font-size: 16px');
sa = sa.replace(/font-size:\s*15(\.5)?px/g, 'font-size: 17px');
sa = sa.replace(/font-size:\s*16px/g, 'font-size: 18px');
sa = sa.replace(/font-size:\s*17px/g, 'font-size: 19px');

fs.writeFileSync('src/pages/Superadmin.jsx', sa);
