// assets/dashboard.js
const $ = (s)=>document.querySelector(s);

// ✅ Encode GitHub contents path safely: keep "/" separators
function encPath(p){
  return String(p || "").split("/").map(encodeURIComponent).join("/");
}

// === repo config ===
const GITHUB_OWNER  = "younghyukkim";
const GITHUB_REPO   = "younghyukkim.github.io";
const GITHUB_BRANCH = "main";

// === auth keys (login.html과 동일해야 함) ===
const TOKEN_KEY = "gh_token_v3";
const ME_KEY    = "gh_me_v3";

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function getMe(){ return localStorage.getItem(ME_KEY) || ""; }
function clearAuth(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ME_KEY);
}

async function ghFetch(path, opts={}){
  const token = getToken();
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      ...(opts.headers||{}),
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error(`GitHub API ${res.status}: ${t}`);
  }
  return res.json();
}

async function ghFetchRaw(path, opts={}){
  const token = getToken();
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      ...(opts.headers||{}),
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    }
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error(`GitHub RAW ${res.status}: ${t}`);
  }
  return res.text();
}

// ===== markdown helpers =====
function parseFrontMatter(md){
  if(!md.startsWith("---")) return { meta:{}, body: md };
  const end = md.indexOf("\n---", 3);
  if(end < 0) return { meta:{}, body: md };
  const raw = md.slice(3, end).trim();
  const body = md.slice(end + "\n---".length).replace(/^\n/, "");
  const meta = {};
  raw.split("\n").forEach(line=>{
    const i = line.indexOf(":");
    if(i>0){
      const k = line.slice(0,i).trim();
      const v = line.slice(i+1).trim();
      meta[k]=v;
    }
  });
  return { meta, body };
}

function buildPostMarkdown(meta, body){
  const fm = [
    "---",
    `title: ${meta.title || ""}`,
    `date: ${meta.date || new Date().toISOString().slice(0,10)}`,
    `category: ${meta.category || "reviews"}`,
    `tags: ${meta.tags || ""}`,
    "---",
    "",
  ].join("\n");
  return fm + (body||"");
}

// ===== Path rules =====
function slugify(s){
  return (s||"")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g,"")
    .replace(/\s+/g,"-")
    .replace(/-+/g,"-");
}

function getDraftKey(){
  const cat = $("#category")?.value || "reviews";
  const slug = slugify($("#slug")?.value || "untitled");
  return `dash_draft_${cat}_${slug}`;
}

function currentPath(){
  const cat = $("#category")?.value || "reviews";
  const slug = slugify($("#slug")?.value || "untitled");
  return `content/${cat}/${slug}.md`;
}

function updatePathHint(){
  const el = $("#pathHint");
  if(el) el.textContent = currentPath();
}

function showStatus(msg, ok=true){
  const st = $("#status");
  if(!st) return;
  st.textContent = msg;
  st.style.color = ok ? "" : "crimson";
}

function showImgStatus(msg, ok=true){
  const st = $("#imgStatus");
  if(!st) return;
  st.textContent = msg;
  st.style.color = ok ? "" : "crimson";
}

// ===== drafts (localStorage) =====
function saveDraft(){
  const key = getDraftKey();
  const meta = {
    title: $("#title")?.value || "",
    date: $("#date")?.value || "",
    category: $("#category")?.value || "reviews",
    tags: $("#tags")?.value || "",
    slug: $("#slug")?.value || "",
    md: $("#md")?.value || "",
  };
  localStorage.setItem(key, JSON.stringify(meta));
  showStatus(`임시저장 완료: ${key}`);
}

function loadDraft(){
  const key = getDraftKey();
  const raw = localStorage.getItem(key);
  if(!raw){
    showStatus("임시저장 데이터가 없음", false);
    return;
  }
  try{
    const d = JSON.parse(raw);
    if($("#title")) $("#title").value = d.title || "";
    if($("#date")) $("#date").value = d.date || "";
    if($("#category")) $("#category").value = d.category || "reviews";
    if($("#tags")) $("#tags").value = d.tags || "";
    if($("#slug")) $("#slug").value = d.slug || "";
    if($("#md")) $("#md").value = d.md || "";
    updatePathHint();
    updatePreview();
    showStatus("임시저장 불러오기 완료");
  }catch{
    showStatus("임시저장 파싱 실패", false);
  }
}

// ===== preview =====
function updatePreview(){
  const md = $("#md")?.value || "";
  const parsed = parseFrontMatter(md);
  const html = window.mdToHtml ? window.mdToHtml(parsed.body) : "";
  const pv = $("#preview");
  if(pv) pv.innerHTML = html;
}

// ===== text insertion helper =====
function insertAtCursor(textarea, text){
  if(!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
}

// ===== github contents helpers =====
async function getFileSha(path){
  // 1) ref=브랜치로 시도
  try{
    const data = await ghFetch(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
    );
    if (data?.sha) return data.sha;
  }catch{}

  // 2) ref 없이 시도 (기본 브랜치로 조회)
  try{
    const data = await ghFetch(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}`
    );
    if (data?.sha) return data.sha;
  }catch{}

  // 3) repo 기본 브랜치 자동 감지 후 그걸로 다시 시도
  try{
    const repo = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}`);
    const def = repo?.default_branch;
    if(def){
      const data = await ghFetch(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}?ref=${encodeURIComponent(def)}`
      );
      if (data?.sha) return data.sha;
    }
  }catch{}

  return null;
}

// text file put
async function putFile(path, content, message){
  const sha = await getFileSha(path);
  const body = {
    message,
    branch: GITHUB_BRANCH,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha ? { sha } : {})
  };
  return ghFetch(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}`,
    {
      method:"PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body),
    }
  );
}

// ✅ binary(file) put (이미지 등)
async function putBinaryFile(path, base64Content, message){
  const sha = await getFileSha(path);
  const body = {
    message,
    branch: GITHUB_BRANCH,
    content: base64Content, // ⚠️ 이미 base64인 문자열 그대로
    ...(sha ? { sha } : {})
  };
  return ghFetch(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}`,
    {
      method:"PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body),
    }
  );
}

async function deleteFile(path, message){
  const sha = await getFileSha(path);

  if(!sha){
    try{
      await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}`);
      throw new Error(`파일은 보이는데 sha를 못 가져왔어. 브랜치/권한 문제 가능성: ${path}`);
    }catch{
      throw new Error(`삭제 실패: sha를 못 가져왔어(경로/브랜치 확인): ${path}`);
    }
  }

  const body = { message, branch: GITHUB_BRANCH, sha };

  return ghFetch(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}`,
    {
      method:"DELETE",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body),
    }
  );
}

// ===== posts.json rebuild (index/reviews 목록용) =====
async function listDir(path){
  try{
    const arr = await ghFetch(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
    );
    return (arr||[]).filter(x => x.type==="file" && x.name.endsWith(".md"));
  }catch{
    return [];
  }
}

async function readMetaFromMd(path){
  const txt = await ghFetchRaw(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
  );
  const { meta } = parseFrontMatter(txt);
  return meta || {};
}

async function rebuildPostsJson(){
  const cats = ["Paper-reviews","Implementation","Project"];
  const posts = [];

  for(const c of cats){
    const files = await listDir(`content/${c}`);
    for(const f of files){
      const path = `content/${c}/${f.name}`;
      let meta = {};
      try { meta = await readMetaFromMd(path); } catch {}
      posts.push({
        title: meta.title || f.name.replace(/\.md$/,""),
        date: meta.date || "",
        category: c,
        tags: meta.tags || "",
        path
      });
    }
  }

  posts.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const json = JSON.stringify(posts, null, 2);
  await putFile("content/posts.json", json, "dashboard: rebuild posts index");
}

// ===== UI: list posts (option.dataset.sha 저장) =====
async function loadPostsIndex(){
  const list = $("#postsList");
  if(!list) return;

  list.innerHTML = "";
  const optLoading = document.createElement("option");
  optLoading.value = "";
  optLoading.textContent = "(불러오는 중...)";
  list.appendChild(optLoading);

  const cats = ["reviews", "papers", "notes", "etc"];
  const items = [];

  for(const cat of cats){
    try{
      const arr = await ghFetch(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(`content/${cat}`)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
      );
      (arr||[]).forEach(it=>{
        if(it && it.type==="file" && it.name.endsWith(".md")){
          items.push({
            label: `${cat}/${it.name}`,
            path: `content/${cat}/${it.name}`,
            sha: it.sha,
          });
        }
      });
    }catch{}
  }

  list.innerHTML = "";

  if(items.length === 0){
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "(게시글 없음)";
    list.appendChild(optEmpty);
    return;
  }

  items.sort((a,b)=>a.label.localeCompare(b.label));

  const optPick = document.createElement("option");
  optPick.value = "";
  optPick.textContent = "(선택)";
  list.appendChild(optPick);

  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it.path;
    opt.textContent = it.label;
    if(it.sha) opt.dataset.sha = it.sha;
    list.appendChild(opt);
  }
}

async function openPost(path){
  const txt = await ghFetchRaw(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
  );

  const { meta } = parseFrontMatter(txt);

  const m = path.match(/^content\/([^/]+)\/(.+)\.md$/);
  const cat  = m ? m[1] : (meta.category || "reviews");
  const slug = m ? m[2] : "";

  if($("#category")) $("#category").value = cat;
  if($("#slug")) $("#slug").value = slug;
  if($("#title")) $("#title").value = meta.title || "";
  if($("#date")) $("#date").value = meta.date || "";
  if($("#tags")) $("#tags").value = meta.tags || "";
  if($("#md")) $("#md").value = txt;

  updatePathHint();
  updatePreview();
  showStatus(`열기 완료: ${path}`);
}

// ===== publish / delete =====
async function publish(){
  const cat = $("#category")?.value || "reviews";
  const slug = slugify($("#slug")?.value || "");
  if(!slug){
    showStatus("slug를 입력해줘!", false);
    return;
  }

  const mdAll = $("#md")?.value || "";
  const parsed = parseFrontMatter(mdAll);

  const meta = {
    title: $("#title")?.value || "",
    date: ($("#date")?.value || "") || new Date().toISOString().slice(0,10),
    category: cat,
    tags: $("#tags")?.value || "",
  };

  const md = buildPostMarkdown(meta, parsed.body);
  const path = currentPath();

  showStatus("발행 중...");

  try{
    await putFile(path, md, `dashboard: publish ${path}`);
    await rebuildPostsJson();
    showStatus(`발행 완료 ✅ (${path})`);
    await loadPostsIndex();
  }catch(e){
    showStatus(`발행 실패: ${e.message}`, false);
  }
}

async function removeSelected(){
  const list = $("#postsList");
  if(!list){
    showStatus("postsList가 없음", false);
    return;
  }
  const opt = list.selectedOptions?.[0];
  const path = (opt?.value || "").trim();
  if(!path){
    showStatus("삭제할 파일을 선택해줘!", false);
    return;
  }

  showStatus("삭제 중...");

  try{
    // ✅ option의 sha 우선 사용
    let sha = (opt?.dataset?.sha || "").trim();
    if(!sha) sha = await getFileSha(path);
    if(!sha) throw new Error(`sha를 못 가져왔어(경로/브랜치 확인): ${path}`);

    const body = { message: `dashboard: delete ${path}`, branch: GITHUB_BRANCH, sha };

    await ghFetch(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encPath(path)}`,
      {
        method:"DELETE",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(body),
      }
    );

    await rebuildPostsJson();
    showStatus(`삭제 완료 🗑️ (${path})`);
    await loadPostsIndex();
  }catch(e){
    showStatus(`삭제 실패: ${e.message}`, false);
  }
}

// ===== ✅ image upload =====
function getImageFolder(){
  // 글 단위로 이미지 폴더 분리: assets/uploads/<category>/<slug>/
  const cat = $("#category")?.value || "reviews";
  const slug = slugify($("#slug")?.value || "untitled");
  return `assets/uploads/${cat}/${slug}`;
}

function safeFilename(name){
  // 파일명에 공백/한글/특수문자 들어가도 GitHub 경로로 안전하게
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0) ? name.slice(0, dot) : name;
  const ext  = (dot >= 0) ? name.slice(dot).toLowerCase() : "";
  const b = base
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g,"")
    .replace(/\s+/g,"-")
    .replace(/-+/g,"-");
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  return `${b || "image"}-${ts}${ext || ".png"}`;
}

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> {
      const dataUrl = String(reader.result || "");
      const comma = dataUrl.indexOf(",");
      if(comma < 0) return reject(new Error("base64 변환 실패"));
      resolve(dataUrl.slice(comma + 1)); // data:image/...;base64,xxxxx 중 xxxxx
    };
    reader.onerror = ()=> reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

async function uploadImagesAndInsert(){
  const input = $("#imgFile");
  const files = Array.from(input?.files || []);
  if(files.length === 0){
    showImgStatus("이미지를 선택해줘!", false);
    return;
  }

  // slug가 있어야 이미지 폴더가 안정적임
  const slug = slugify($("#slug")?.value || "");
  if(!slug){
    showImgStatus("먼저 slug를 입력해줘! (이미지 폴더를 만들기 위해 필요)", false);
    return;
  }

  const folder = getImageFolder();
  const mdArea = $("#md");

  showImgStatus("업로드 중...");

  try{
    for(const f of files){
      const fname = safeFilename(f.name);
      const path = `${folder}/${fname}`;
      const b64 = await fileToBase64(f);

      await putBinaryFile(path, b64, `dashboard: upload image ${path}`);

      // ✅ 마크다운 커서 위치에 자동 삽입 (상대경로)
      const rel = path; // 사이트 루트 기준 상대경로
      const snippet = `\n![${fname}](${rel})\n`;
      insertAtCursor(mdArea, snippet);
    }

    updatePreview();
    // 파일 선택 초기화
    input.value = "";
    showImgStatus(`업로드 완료 ✅ (${files.length}개) — 마크다운에 삽입했어!`);
  }catch(e){
    showImgStatus(`업로드 실패: ${e.message}`, false);
  }
}

// ===== init =====
document.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){
    location.href = "login.html";
    return;
  }

  const who = $("#whoami");
  if(who) who.textContent = `Logged in as ${getMe() || "(unknown)"}`;

  const note = $("#dashNote");
  if(note) note.textContent = "※ 대시보드는 직접 URL 접근용";

  const logoutBtn = $("#logoutBtn");
  if(logoutBtn){
    logoutBtn.addEventListener("click", (e)=>{
      e.preventDefault?.();
      clearAuth();
      location.href = "index.html";
    });
  }

  if($("#category")) $("#category").addEventListener("change", updatePathHint);
  if($("#slug")) $("#slug").addEventListener("input", updatePathHint);
  if($("#md")) $("#md").addEventListener("input", updatePreview);

  if($("#btnSaveDraft")) $("#btnSaveDraft").addEventListener("click", saveDraft);
  if($("#btnLoadDraft")) $("#btnLoadDraft").addEventListener("click", loadDraft);
  if($("#btnPublish")) $("#btnPublish").addEventListener("click", publish);
  if($("#btnDelete")) $("#btnDelete").addEventListener("click", removeSelected);

  if($("#btnUploadImg")) $("#btnUploadImg").addEventListener("click", uploadImagesAndInsert);

  if($("#postsList")){
    $("#postsList").addEventListener("change", async ()=>{
      const p = $("#postsList").value;
      if(p) await openPost(p);
    });
  }

  if($("#date") && !$("#date").value){
    $("#date").value = new Date().toISOString().slice(0,10);
  }

  updatePathHint();
  updatePreview();
  await loadPostsIndex();
});
