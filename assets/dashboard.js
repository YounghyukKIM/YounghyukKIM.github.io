// assets/dashboard.js
const $ = (s)=>document.querySelector(s);

// === repo config ===
const GITHUB_OWNER = "younghyukkim";
const GITHUB_REPO  = "younghyukkim.github.io";
const GITHUB_BRANCH = "main";

// === auth keys (login.html과 동일해야 함) ===
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
    headers: {
      "Accept":"application/vnd.github.raw+json",
      "Authorization": `Bearer ${token}`
    }
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
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g,"")
    .replace(/\s+/g,"-")
    .replace(/-+/g,"-");
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
    method:"PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
}

async function deleteFile(path, message){
  const sha = await getFileSha(path);
  if(!sha) throw new Error("File not found");
  const body = { message, sha, branch: GITHUB_BRANCH };
  return ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`, {
    method:"DELETE",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
}

async function loadPostsIndex(){
  try{
    const txt = await ghFetchRaw(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content/posts.json?ref=${GITHUB_BRANCH}`);
    return JSON.parse(txt);
  }catch{
    return { posts: [] };
  }
}

async function savePostsIndex(idx){
  await putFile("content/posts.json", JSON.stringify(idx, null, 2), "Update posts index");
}

function buildFrontMatter({title, desc, date, category, slug}){
  return `---\ntitle: ${title}\ndesc: ${desc || ""}\ndate: ${date}\ncategory: ${category}\nslug: ${slug}\n---\n\n`;
}

/* ===== editor helpers ===== */
function updatePathHint(){
  const c = $("#category").value || "reviews";
  const s = $("#slug").value || "(slug)";
  $("#pathHint").textContent = `content/${c}/${s}.md`;
}

function updatePreview(){
  $("#preview").innerHTML = window.mdToHtml ? window.mdToHtml($("#md").value || "") : "";
}

function insertAtCursor(text){
  const ta = $("#md");
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0,start) + text + ta.value.slice(end);
  const pos = start + text.length;
  ta.focus();
  ta.selectionStart = ta.selectionEnd = pos;
  updatePreview();
}

function wrapSelection(left, right){
  const ta = $("#md");
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  const sel = ta.value.slice(start, end);
  const before = ta.value.slice(0,start);
  const after = ta.value.slice(end);
  ta.value = before + left + sel + right + after;
  ta.focus();
  if(sel){
    ta.selectionStart = start + left.length;
    ta.selectionEnd = start + left.length + sel.length;
  }else{
    ta.selectionStart = ta.selectionEnd = start + left.length;
  }
  updatePreview();
}

/* ===== manage list ===== */
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
  const posts = idx.posts
    .filter(p=>p.category===cat)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

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

/* ===== publish / open ===== */
async function publish(){
  const category = $("#category").value;
  const slug = slugify($("#slug").value.trim());
  const title = $("#title").value.trim();
  const desc = $("#desc").value.trim();
  const body = $("#md").value;

  if(!category || !slug || !title || !body.trim()){
    alert("category/slug/title/내용은 필수!");
    return;
  }

  const date = nowISODate();
  const full = buildFrontMatter({title, desc, date, category, slug}) + body.trim() + "\n";

  await putFile(`content/${category}/${slug}.md`, full, `Publish: ${category}/${slug}`);

  const idx = await loadPostsIndex();
  const exists = idx.posts.find(p=>p.category===category && p.slug===slug);
  const entry = { category, slug, title, desc, date };
  if(exists) Object.assign(exists, entry);
  else idx.posts.push(entry);

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

/* ===== image upload =====
   저장 경로: assets/uploads/<name>-<timestamp>.<ext>
   (레포에 assets/uploads 폴더를 미리 만들어두면 베스트)
*/
async function uploadImageFile(file){
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const base = slugify(file.name.replace(/\.[^/.]+$/, "")) || "image";
  const filename = `${base}-${Date.now()}.${ext}`;
  const repoPath = `assets/uploads/${filename}`;

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);

  const sha = await getFileSha(repoPath);
  const body = {
    message: `Upload image: ${filename}`,
    content: b64,
    branch: GITHUB_BRANCH,
    ...(sha ? {sha} : {})
  };

  await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(repoPath)}`, {
    method:"PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  insertAtCursor(`\n![${base}](assets/uploads/${filename})\n`);
}

/* ===== init / wire ===== */
(function init(){
  // auth guard
  if(!getToken()){
    location.href = "login.html";
    return;
  }

  // header info
  $("#whoami").textContent = `Logged in as ${getMe() || "(unknown)"}`;
  $("#dashNote").textContent = "※ 홈에서는 이 페이지를 노출하지 않음(직접 URL 접근).";

  // logout link
  $("#logoutLink").addEventListener("click", (e)=>{
    e.preventDefault();
    clearAuth();
    location.href = "index.html";
  });

  // editor events
  $("#category").addEventListener("change", updatePathHint);
  $("#slug").addEventListener("input", updatePathHint);
  $("#md").addEventListener("input", updatePreview);

  $("#title").addEventListener("input", ()=>{
    if($("#slug").value.trim()) return;
    const t = $("#title").value.trim();
    if(t) $("#slug").value = slugify(t);
    updatePathHint();
  });

  $("#saveDraftBtn").addEventListener("click", ()=>{
    const k = `draft_${$("#category").value}_${$("#slug").value || "new"}`;
    localStorage.setItem(k, JSON.stringify({
      category: $("#category").value,
      slug: $("#slug").value,
      title: $("#title").value,
      desc: $("#desc").value,
      md: $("#md").value
    }));
    alert("임시저장 완료!");
  });

  $("#publishBtn").addEventListener("click", ()=>publish().catch(e=>alert(e.message)));

  // manage
  $("#refreshBtn").addEventListener("click", ()=>refreshManageList().catch(e=>alert(e.message)));
  $("#manageCategory").addEventListener("change", ()=>refreshManageList().catch(()=>{}));

  // toolbar
  document.querySelectorAll("[data-ins]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const t = btn.getAttribute("data-ins");
      if(t==="h2") insertAtCursor("\n## 소제목\n");
      else if(t==="bold") wrapSelection("**","**");
      else if(t==="inlinecode") wrapSelection("`","`");
      else if(t==="codeblock"){
        const lang = prompt("언어(예: python, cpp, bash). 비우면 plain","python") || "";
        insertAtCursor(`\n\`\`\`${lang}\n// code here\n\`\`\`\n`);
      }
      else if(t==="link"){
        const url = prompt("URL","https://") || "https://";
        insertAtCursor(`[링크텍스트](${url})`);
      }
    });
  });

  $("#insertTemplateBtn").addEventListener("click", ()=>{
    const tpl =
`# Title

## TL;DR
- 

## Problem
- 

## Method
- 

## Experiments
- Dataset:
- Metrics:
- Results:

## My Notes
- 

## Todo
- [ ] 
`;
    insertAtCursor("\n" + tpl + "\n");
  });

  // image input
  $("#imageFile").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    try{ await uploadImageFile(f); }
    catch(err){ alert(err.message); }
    e.target.value = "";
  });

  // drop zone
  const dz = $("#dropZone");
  dz.addEventListener("dragover", (e)=>{ e.preventDefault(); dz.style.borderColor="rgba(122,162,255,.6)"; });
  dz.addEventListener("dragleave", ()=>{ dz.style.borderColor=""; });
  dz.addEventListener("drop", async (e)=>{
    e.preventDefault();
    dz.style.borderColor="";
    const f = e.dataTransfer?.files?.[0];
    if(!f) return;
    if(!f.type.startsWith("image/")) return alert("이미지 파일만 가능!");
    try{ await uploadImageFile(f); }
    catch(err){ alert(err.message); }
  });

  // initial UI
  updatePathHint();
  updatePreview();
  refreshManageList().catch(()=>{});
})();
