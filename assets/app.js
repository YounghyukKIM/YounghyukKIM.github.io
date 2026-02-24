// assets/app.js
const $ = (s)=>document.querySelector(s);

async function loadPosts(){
  const res = await fetch("content/posts.json", { cache:"no-store" });
  if(!res.ok) throw new Error("posts.json not found");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.posts || []);
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function itemHTML(p){
  const href = `post.html?path=${encodeURIComponent(p.path)}`;
  const tags = (p.tags||"").trim();
  return `
    <a class="item" href="${href}">
      <div style="flex:1">
        <div style="font-weight:800">${escapeHtml(p.title || p.path)}</div>
        <div class="small">
          ${escapeHtml(p.date || "")}
          · ${escapeHtml(p.category || "")}
          ${tags ? " · " + escapeHtml(tags) : ""}
        </div>
      </div>
    </a>
  `;
}

async function render(){
  const targetRecent = $("#recentList"); // index.html
  const targetList   = $("#postList");   // reviews.html (and others)

  let posts = [];
  try{
    posts = await loadPosts();
  }catch(e){
    const msg = `<div class="small">content/posts.json이 없어. (대시보드에서 한 번 발행하면 생성돼)</div>`;
    if(targetRecent) targetRecent.innerHTML = msg;
    if(targetList) targetList.innerHTML = msg;
    return;
  }

  posts.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));

  // index.html: 최근 글
  if(targetRecent){
    targetRecent.innerHTML = posts.slice(0, 12).map(itemHTML).join("");
  }

  // category page: window.PAGE_CATEGORY 지정되면 필터
  if(targetList){
    const cat = window.PAGE_CATEGORY || "";
    const filtered = cat ? posts.filter(p=>p.category===cat) : posts;
    targetList.innerHTML = filtered.map(itemHTML).join("");
  }
}

document.addEventListener("DOMContentLoaded", render);
