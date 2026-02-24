// assets/admin.js
const $ = (s)=>document.querySelector(s);

const GITHUB_OWNER = "younghyukkim";
const GITHUB_REPO  = "younghyukkim.github.io";
const GITHUB_BRANCH = "main";

const TOKEN_KEY = "gh_token_v2";
const ME_KEY = "gh_me_v2";

function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ME_KEY); }

function adminNote(msg){
  const el = $("#adminNote");
  if(el) el.textContent = msg;
}

function setLoginUI(loggedIn, who){
  const loginBtn = $("#tokenLoginBtn");
  const logoutBtn = $("#logoutBtn");
  const publishBtn = $("#publishBtn");
  const refreshBtn = $("#refreshBtn");
  const whoEl = $("#whoami");

  if(loginBtn) loginBtn.disabled = loggedIn;
  if(logoutBtn) logoutBtn.disabled = !loggedIn;
  if(publishBtn) publishBtn.disabled = !loggedIn;
  if(refreshBtn) refreshBtn.disabled = !loggedIn;
  if(whoEl) whoEl.textContent = loggedIn ? `Logged in as ${who}` : "";
}

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
  if(!res.ok){
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${t}`);
  }
  return res.text();
}

async function whoAmI(){
  const cached = localStorage.getItem(ME_KEY);
  if(cached) return cached;
  const me = await ghFetch("/user");
  localStorage.setItem(ME_KEY, me.login);
  return me.login;
}

function nowISODate(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function slugify(s){
  return s.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g,"")
    .replace(/\s+/g,"-")
    .replace(/-+/g,"-");
}

async function getFileSha(path){
  try{
    const data = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`);
    return data.sha;
  }catch{
    return null;
  }
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
  const txt = JSON.stringify(idx, null, 2);
  await putFile("content/posts.json", txt, "Update posts index");
}

function buildFrontMatter({title, desc, date, category, slug}){
  return `---\ntitle: ${title}\ndesc: ${desc || ""}\ndate: ${date}\ncategory: ${category}\nslug: ${slug}\n---\n\n`;
}

/* ===== UI helpers (admin.html의 id들과 매칭) ===== */
function updatePathHint(){
  const c = $("#category")?.value || "reviews";
  const s = $("#slug")?.value || "(slug)";
  const ph = $("#pathHint");
  if(ph) ph.textContent = `content/${c}/${s}.md`;
}

function updatePreview(){
  const md = $("#md")?.value || "";
  const pv = $("#preview");
  if(pv && window.mdToHtml) pv.innerHTML = window.mdToHtml(md);
}

function manageItemHtml(p){
  const href = `post.html?c=${encodeURIComponent(p.category)}&s=${encodeURIComponent(p.slug)}`;
  return `
    <div class="item">
      <div style="flex:1">
        <div style="font-weight:800">${p.title}</div>
        <div class="meta">
          <span class="badge">${p.slug}</span>
          <span>${p.date || ""}</span>
        </div>
        ${p.desc ? `<div class="small" style="margin-top:6px">${p.desc}</div>` : ""}
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
  const cat = $("#manageCategory")?.value || "reviews";
  const posts = idx.posts
    .filter(p=>p.category===cat)
    .sort((a,b)=> (b.date||"").localeCompare(a.date||""));

  const box = $("#manageList");
  if(box) box.innerHTML = posts.length ? posts.map(manageItemHtml).join("") : `<div class="small">글이 없어.</div>`;

  document.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const key = btn.getAttribute("data-del");
      const [category, slug] = key.split("/");
      if(!confirm(`정말 삭제할까?\ncontent/${category}/${slug}.md`)) return;

      await deleteFile(`content/${category}/${slug}.md`, `Delete: ${category}/${slug}`);

      const idx2 = await loadPostsIndex();
      idx2.posts = idx2.posts.filter(p=> !(p.category===category && p.slug===slug));
      await savePostsIndex(idx2);

      alert("🗑️ 삭제 완료!");
      refreshManageList();
    });
  });
}

async function publish(){
  const category = $("#category").value;
  const slug = slugify($("#slug").value.trim());
  const title = $("#title").value.trim();
  const desc = $("#desc").value.trim();
  const mdBody = $("#md").value;

  if(!slug || !title || !mdBody.trim()){
    alert("category/slug/title/내용은 필수야!");
    return;
  }

  const date = nowISODate();
  const fm = buildFrontMatter({title, desc, date, category, slug});
  const full = fm + mdBody.trim() + "\n";

  await putFile(`content/${category}/${slug}.md`, full, `Publish: ${category}/${slug}`);

  const idx = await loadPostsIndex();
  const exists = idx.posts.find(p=>p.category===category && p.slug===slug);
  const entry = { category, slug, title, desc, date };
  if(exists) Object.assign(exists, entry);
  else idx.posts.push(entry);

  await savePostsIndex(idx);
  alert("✅ 발행 완료!");
  refreshManageList();
}

function wire(){
  // 작성/미리보기
  $("#category")?.addEventListener("change", updatePathHint);
  $("#slug")?.addEventListener("input", updatePathHint);
  $("#md")?.addEventListener("input", updatePreview);

  $("#title")?.addEventListener("input", ()=>{
    if($("#slug").value.trim()) return;
    const t = $("#title").value.trim();
    if(t) $("#slug").value = slugify(t);
    updatePathHint();
  });

  $("#publishBtn")?.addEventListener("click", ()=>publish().catch(e=>alert(e.message)));
  $("#refreshBtn")?.addEventListener("click", ()=>refreshManageList().catch(e=>alert(e.message)));
  $("#manageCategory")?.addEventListener("change", ()=>refreshManageList().catch(()=>{}));

  // 토큰 로그인
  $("#tokenLoginBtn")?.addEventListener("click", async ()=>{
    const pat = ($("#tokenInput")?.value || "").trim();
    if(!pat) return alert("토큰을 붙여넣어줘!");
    try{
      setToken(pat);
      const me = await whoAmI();
      setLoginUI(true, me);
      adminNote("✅ 토큰으로 로그인됨.");
      await refreshManageList();
    }catch(e){
      clearToken();
      alert(e.message);
    }
  });

  $("#logoutBtn")?.addEventListener("click", ()=>{
    clearToken();
    setLoginUI(false, "");
    adminNote("로그아웃됨.");
  });

  updatePathHint();
  updatePreview();
}

(async function init(){
  try{
    wire();

    const t = getToken();
    if(t){
      try{
        const me = await whoAmI();
        setLoginUI(true, me);
        adminNote("✅ 이미 로그인 상태야.");
        await refreshManageList();
      }catch{
        clearToken();
        setLoginUI(false, "");
      }
    }else{
      setLoginUI(false, "");
      adminNote("PAT를 입력해서 로그인해줘.");
    }
  }catch(e){
    console.error(e);
    adminNote("admin.js 초기화 에러: " + e.message);
  }
})();
