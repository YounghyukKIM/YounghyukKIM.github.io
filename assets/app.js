// assets/app.js
const $ = (s)=>document.querySelector(s);

async function loadPosts(){
  const res = await fetch("content/posts.json", { cache: "no-store" });
  if(!res.ok) throw new Error("posts.json not found");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.posts || []);
}

function itemHTML(p){
  // p: {title,date,category,tags,path}
  const href = `post.html?path=${encodeURIComponent(p.path)}`;
  const tag = (p.tags||"").trim();
  return `
    <a class="item" href="${href}">
      <div style="flex:1">
        <div style="font-weight:800">${escapeHtml(p.title || p.path)}</div>
        <div class="small">${escapeHtml(p.date || "")} · ${escapeHtml(p.category || "")}${tag ? " · " + escapeHtml(tag) : ""}</div>
      </div>
    </a>
  `;
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function render(){
  let posts = [];
  try{
    posts = await loadPosts();
  }catch(e){
    // 없으면 안내
    if($("#recentList")) $("#recentList").innerHTML = `<div class="small">content/posts.json이 없어. (대시보드 발행 후 자동 생성)</div>`;
    if($("#postList")) $("#postList").innerHTML = `<div class="small">content/posts.json이 없어. (대시보드 발행 후 자동 생성)</div>`;
    return;
  }

  // 최신순
  posts.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));

  // index: 최근 글
  if($("#recentList")){
    const top = posts.slice(0, 12);
    $("#recentList").innerHTML = top.map(itemHTML).join("");
  }

  // category page: window.PAGE_CATEGORY가 있으면 필터
  if($("#postList")){
    const cat = window.PAGE_CATEGORY || "";
    const filtered = cat ? posts.filter(p=>p.category===cat) : posts;
    $("#postList").innerHTML = filtered.map(itemHTML).join("");
  }

  // nav active 처리(기존 data-nav 그대로 유지)
  const active = window.PAGE_CATEGORY === "reviews" ? "reviews"
               : window.PAGE_CATEGORY === "impl" ? "impl"
               : window.PAGE_CATEGORY === "projects" ? "projects"
               : window.PAGE_CATEGORY === "contacts" ? "contacts"
               : "home";
  document.querySelectorAll("#nav a[data-nav]").forEach(a=>{
    a.classList.toggle("active", a.dataset.nav === active);
  });
}

document.addEventListener("DOMContentLoaded", render);
