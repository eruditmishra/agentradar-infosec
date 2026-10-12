const fs = require('fs');
let html = fs.readFileSync('raw_html.txt', 'utf8'); // Read utf8 now
const startIdx = html.indexOf('<body');
const endIdx = html.indexOf('</body>');
let body = html.slice(startIdx, endIdx);

body = body.replace(/class=/g, 'className=')
           .replace(/onclick=/g, 'onClick=')
           .replace(/<!--/g, '{/*')
           .replace(/-->/g, '*/}');
body = body.replace(/<body[^>]*>/, '').replace(/<style>[\s\S]*?<\/style>/, '');
// Note: React requires self-closing tags for br, hr, img, input, path, circle, line, rect, defs, marker, tspan, etc
body = body.replace(/<img(.*?)[^\/]>(\s*)/g, '<img$1 />$2')
           .replace(/<input(.*?)[^\/]>(\s*)/g, '<input$1 />$2')
           .replace(/<br>/g, '<br />')
           .replace(/<hr>/g, '<hr />');

// SVG Elements self closing issues (path, line, circle, rect)
// HTML parser allows <path d="..." /> or <path d="..."></path>. The user template likely has <path d="..."/> which is fine in JSX.
// Or <line ... />. Let's make sure they are self-closing if they don't have children.

body = body.replace(/style="([^"]+)"/g, (match, p1) => {
    const styleObj = {};
    p1.split(';').forEach(style => {
        const parts = style.split(':');
        if (parts.length === 2) {
            let key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
            styleObj[key] = parts[1].trim();
        }
    });
    return `style={${JSON.stringify(styleObj)}}`;
});

const tsx = `import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { discoveryAPI } from '../../lib/api';
import Chart from 'chart.js/auto';

export default function NewAgentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    discoveryAPI.getAgent(id as string).then(res => setAgent(res.data.agent));
  }, [id]);

  if (!agent) return <div className="p-10 text-white">Loading...</div>;

  return (
    <div className="bg-[#070A11] text-slate-200 font-sans antialiased min-h-screen flex flex-col custom-scrollbar">
      ${body}
    </div>
  );
}
`;

fs.writeFileSync('d:/citius/agentradar/dashboard/src/pages/super-admin/NewAgentDetails.tsx', tsx);
console.log('Conversion successful');
