// assets/router.js
const ROUTE_KEY = "yh_intent_v1";

function setIntent(intent){
  sessionStorage.setItem(ROUTE_KEY, JSON.stringify(intent));
}
function getIntent(){
  try { return JSON.parse(sessionStorage.getItem(ROUTE_KEY) || "null"); }
  catch { return null; }
}
function clearIntent(){
  sessionStorage.removeItem(ROUTE_KEY);
}

function parseHomeCommand(raw){
  const line = raw.trim();
  const p = line.split(/\s+/);
  const cmd = (p[0]||"").toLowerCase();

  // 기본: admin/dashboard 진입
  if(cmd === "admin" || cmd === "dashboard") return { target:"dashboard", mode:"manage" };

  // write <category>
  if(cmd === "write"){
    const cat = p[1] || "reviews";
    return { target:"dashboard", mode:"write", category: cat };
  }

  // manage <category>
  if(cmd === "manage"){
    const cat = p[1] || "reviews";
    return { target:"dashboard", mode:"manage", category: cat };
  }

  // open <category> <slug>
  if(cmd === "open"){
    const cat = p[1]; const slug = p[2];
    if(!cat || !slug) throw new Error("usage: open <category> <slug>");
    return { target:"dashboard", mode:"open", category:cat, slug };
  }

  // help
  if(cmd === "help"){
    return { target:"help" };
  }

  // fallback
  throw new Error("unknown command. try: help");
}

window.YHRouter = { setIntent, getIntent, clearIntent, parseHomeCommand };
