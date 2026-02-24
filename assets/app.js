// assets/app.js
const $ = (s)=>document.querySelector(s);

function setActiveNav(){
  const path = location.pathname.split("/").pop() || "index.html";
  const map = {
    "index.html":"home",
    "reviews.html":"reviews",
    "implementations.html":"impl",
    "projects.html":"projects",
    "contacts.html":"contacts",
    "post.html":null
  };
  const key = map[path];
  const nav = document.querySelectorAll("#nav a[data-nav]");
  nav.forEach(a=>{
    a.classList.toggle("active", a.dataset.nav === key);
  });
}

async function loadPostsIndex(){
  const res = await fetch("content/posts.json?ts="+Date.now());
  if(!res.ok) throw new Error("posts.json not found");
  return await res.json();
}

function itemHtml(p){
  const catLabel = p.category === "reviews" ? "논문 리뷰" :
                   p.category === "implementations" ? "논문 구현" : "프로젝트";
  const href = `post.html?c=${encodeURIComponent(p.category)}&s=${encodeURIComponent(p.slug)}`;
  return `
    <a class="item" href="${href}">
      <div style="flex:1">
        <div style="font-weight:800">${p.title}</div>
        <div class="meta">
          <span class="badge">${catLabel}</span>
          <span>${p.date || ""}</span>
        </div>
        ${p.desc ? `<div class="small" style="margin-top:6px">${p.desc}</div>` : ""}
      </div>
    </a>
  `;
}

async function renderCategoryList(){
  const list = $("#postList");
  if(!list || !window.PAGE_CATEGORY) return;

  try{
    const idx = await loadPostsIndex();
    const posts = idx.posts
      .filter(p=>p.category===window.PAGE_CATEGORY)
      .sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    list.innerHTML = posts.length ? posts.map(itemHtml).join("") : `<div class="small">아직 글이 없어.</div>`;
  }catch(e){
    list.innerHTML = `<div class="small">posts.json을 찾을 수 없어. 관리자에서 첫 글을 발행하면 자동 생성돼.</div>`;
  }
}

async function renderRecent(){
  const box = $("#recentList");
  if(!box) return;
  try{
    const idx = await loadPostsIndex();
    const posts = [...idx.posts].sort((a,b)=> (b.date||"").localeCompare(a.date||"")).slice(0,6);
    box.innerHTML = posts.length ? posts.map(itemHtml).join("") : `<div class="small">최근 글이 없어.</div>`;
  }catch{
    box.innerHTML = `<div class="small">아직 posts.json이 없어. 관리자에서 글을 발행해봐.</div>`;
  }
}

function qs(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

async function renderPost(){
  const body = $("#postBody");
  if(!body) return;

  const c = qs("c");
  const s = qs("s");
  if(!c || !s){
    body.innerHTML = `<div class="small">잘못된 접근이야.</div>`;
    return;
  }

  try{
    const mdRes = await fetch(`content/${c}/${s}.md?ts=${Date.now()}`);
    if(!mdRes.ok) throw new Error("missing md");
    const md = await mdRes.text();

    // front-matter(아주 간단) 지원: --- ... ---
    let meta = {};
    let content = md;
    const fm = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if(fm){
      const lines = fm[1].split("\n");
      lines.forEach(l=>{
        const i = l.indexOf(":");
        if(i>0){
          const k = l.slice(0,i).trim();
          const v = l.slice(i+1).trim();
          meta[k]=v;
        }
      });
      content = fm[2];
    }

    $("#postTitle").textContent = meta.title || s;
    $("#postDesc").textContent = meta.desc || "";
    $("#postMeta").innerHTML = `
      <span class="badge">${c}</span>
      <span>${meta.date || ""}</span>
      <span class="badge"><a href="${c}.html">Back</a></span>
    `;
    document.title = meta.title ? meta.title : "Post";
    body.innerHTML = window.mdToHtml(content);
  }catch(e){
    body.innerHTML = `<div class="small">글을 찾을 수 없어: content/${c}/${s}.md</div>`;
  }
}

(function init(){
  setActiveNav();
  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();
  renderRecent();
  renderCategoryList();
  renderPost();
})();