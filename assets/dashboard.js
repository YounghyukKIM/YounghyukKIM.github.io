// assets/dashboard.js
const $ = (s)=>document.querySelector(s);

const GITHUB_OWNER = "younghyukkim";
const GITHUB_REPO  = "younghyukkim.github.io";
const GITHUB_BRANCH = "main";

const TOKEN_KEY = "gh_token_v3";
const ME_KEY = "gh_me_v3";

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function getMe(){ return localStorage.getItem(ME_KEY) || ""; }
function clearAuth(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ME_KEY); }

async function ghFetch(path, options={}){
  const token = getToken();
  if(!token) throw new Error("No token");
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Accept":"application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers||{})
    }
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}
async function ghFetchRaw(path){
  const token = getToken();
  if(!token) throw new Error("No token");
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { "Accept":"application/vnd.github.raw+json", "Authorization": `Bearer ${token}` }
  });
  if(!res.ok) throw new Error(await res.text());
  return res.text();
}

function nowISODate(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function slugify(s){
  return s.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-");
}

async function getFileSha(path){
  try{
    const data = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`);
    return data.sha;
  }catch{ return null; }
}
async function putFile(path, contentText, message){
  const b64 = btoa(unescape(encodeURIComponent(contentText)));
  const sha = await getFileSha(path);
  const body = { message, content: b64, branch: GITHUB_BRANCH, ...(sha ? {sha} : {}) };
  return ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`, {
    method:"PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body)
  });
}
async function deleteFile(path, message){
  const sha = await getFileSha(path);
  if(!sha) throw new Error("File not found");
  const body = { message, sha, branch: GITHUB_BRANCH };
  return ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`, {
    method:"DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body)
  });
}

async function loadPostsIndex(){
  try{
    const txt = await ghFetchRaw(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content/posts.json?ref=${GITHUB_BRANCH}`);
    return JSON.parse(txt);
  }catch{ return { posts: [] }; }
}
async function savePostsIndex(idx){
  await putFile("content/posts.json", JSON.stringify(idx,null,2), "Update posts index");
}

function buildFrontMatter({title, desc, date, category, slug}){
  return `---\ntitle: ${title}\ndesc: ${desc || ""}\ndate: ${date}\ncategory: ${category}\nslug: ${slug}\n---\n\n`;
}

function updatePathHint(){
  const c = $("#category").value || "reviews";
  const s = $("#slug").value || "(slug)";
  $("#pathHint").textContent = `content/${c}/${s}.md`;
}
function updatePreview(){
  $("#preview").innerHTML = window.mdToHtml ? window.mdToHtml($("#md").value || "") : "";
}
function manageItemHtml(p){
  const href = `post.html?c=${encodeURIComponent(p.category)}&s=${encodeURIComponent(p.slug)}`;
  return `
    <div class="item">
      <div style="flex:1">
        <div style="font-weight:800">${p.title}</div>
        <div class="meta"><span class="badge">${p.slug}</span><span>${p.date||""}</span></div>
        <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap">
          <a class="btn" href="${href}" target="_blank" rel="noopener">보기</a>
          <button class="btn danger" data-del="${p.category}/${p.slug}">삭제</button>
        </div>
      </div>
    </div>
  `;
}

async function refreshManageList(){
  const idx = await loadPostsIndex();
  const cat = $("#manageCategory").value;
  const posts = idx.posts.filter(p=>p.category===cat).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("#manageList").innerHTML = posts.length ? posts.map(manageItemHtml).join("") : `<div class="small">글이 없어.</div>`;

  document.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const [category, slug] = btn.getAttribute("data-del").split("/");
      if(!confirm(`정말 삭제?\ncontent/${category}/${slug}.md`)) return;
      await deleteFile(`content/${category}/${slug}.md`, `Delete: ${category}/${slug}`);
      const idx2 = await loadPostsIndex();
      idx2.posts = idx2.posts.filter(p=>!(p.category===category && p.slug===slug));
      await savePostsIndex(idx2);
      refreshManageList();
    });
  });
}

async function publish(){
  const category = $("#category").value;
  const slug = slugify($("#slug").value.trim());
  const title = $("#title").value.trim();
  const desc = $("#desc").value.trim();
  const body = $("#md").value;

  if(!category || !slug || !title || !body.trim()) return alert("category/slug/title/내용은 필수!");
  const date = nowISODate();

  const full = buildFrontMatter({title, desc, date, category, slug}) + body.trim() + "\n";
  await putFile(`content/${category}/${slug}.md`, full, `Publish: ${category}/${slug}`);

  const idx = await loadPostsIndex();
  const exists = idx.posts.find(p=>p.category===category && p.slug===slug);
  const entry = { category, slug, title, desc, date };
  if(exists) Object.assign(exists, entry); else idx.posts.push(entry);
  await savePostsIndex(idx);

  alert("✅ 발행 완료");
  refreshManageList();
}

async function openPost(category, slug){
  const path = `content/${category}/${slug}.md`;
  const txt = await ghFetchRaw(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`);

  let meta = {};
  let content = txt;
  const fm = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if(fm){
    fm[1].split("\n").forEach(l=>{
      const i = l.indexOf(":");
      if(i>0) meta[l.slice(0,i).trim()] = l.slice(i+1).trim();
    });
    content = fm[2];
  }

  $("#category").value = category;
  $("#slug").value = slug;
  $("#title").value = meta.title || slug;
  $("#desc").value = meta.desc || "";
  $("#md").value = content.trim();
  updatePathHint(); updatePreview();
}

function applyIntent(){
  const intent = window.YHRouter?.getIntent?.();
  if(!intent) { $("#dashNote").textContent = "intent 없음(기본 대시보드)"; return; }
  $("#dashNote").textContent = `intent: ${intent.mode}${intent.category ? " / "+intent.category : ""}${intent.slug ? " / "+intent.slug : ""}`;

  if(intent.category){
    $("#category").value = intent.category;
    $("#manageCategory").value = intent.category;
    updatePathHint();
  }
  if(intent.mode === "write"){
    $("#md").focus();
  }
  if(intent.mode === "manage"){
    refreshManageList();
  }
  if(intent.mode === "open" && intent.category && intent.slug){
    openPost(intent.category, intent.slug).catch(()=>{});
  }

  // 한 번 쓰고 지우고 싶으면:
  // window.YHRouter.clearIntent();
}

(function init(){
  const token = getToken();
  if(!token){
    location.href = "login.html";
    return;
  }

  $("#whoami").textContent = `Logged in as ${getMe() || "(unknown)"}`;
  $("#logoutBtn").addEventListener("click", ()=>{
    clearAuth();
    location.href = "index.html";
  });

  $("#category").addEventListener("change", updatePathHint);
  $("#slug").addEventListener("input", updatePathHint);
  $("#md").addEventListener("input", updatePreview);
  $("#title").addEventListener("input", ()=>{
    if($("#slug").value.trim()) return;
    const t = $("#title").value.trim();
    if(t) $("#slug").value = slugify(t);
    updatePathHint();
  });

  $("#publishBtn").addEventListener("click", ()=>publish().catch(e=>alert(e.message)));
  $("#refreshBtn").addEventListener("click", ()=>refreshManageList().catch(e=>alert(e.message)));
  $("#manageCategory").addEventListener("change", ()=>refreshManageList().catch(()=>{}));

  updatePathHint(); updatePreview();
  refreshManageList().catch(()=>{});
  applyIntent();
})();
