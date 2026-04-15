const fs = require('fs');

const p = 'app/(app)/compare/page.tsx';
let txt = fs.readFileSync(p, 'utf-8');

txt = txt.replace(/import { getAnalysis, generateAnalysisStream, type AnalysisData, type StreamingTask } from "@\/lib\/analysis-api"[\r\n]+/, '');

txt = txt.replace(/  \/\/ Analysis[\s\S]*?const \[streamingTasksB, setStreamingTasksB\] = useState<StreamingTask\[\]>\(\[\]\)[\r\n]+/, '');

txt = txt.replace(/  \/\/ ─── Fetch cached analysis on load ──────────────────────────────────────[\s\S]*?  \}, \[\]\)[\r\n]+/, '');

txt = txt.replace(/<TabsTrigger value="analysis">AI Analysis<\/TabsTrigger>[\r\n]+/, '');

txt = txt.replace(/        \{\/\* ── Analysis Tab ────────────────────────────────────────────── \*\/\}[\s\S]*?<\/TabsContent>[\r\n]+/, '');

fs.writeFileSync(p, txt, 'utf-8');
console.log("Done modifying page.tsx");
