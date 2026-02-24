// assets/post.js
const $ = (s)=>document.querySelector(s);

// 🔧 너 레포 정보 (dashboard.js랑 동일하게)
const GITHUB_OWNER  = "younghyukkim";
const GITHUB_REPO   = "younghyukkim.github.io";
const GITHUB_BRANCH = "main";

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

function qp(name){
  return new URLSearchParams(location.search).get(name);
}

function safeDecode(v){
  try { return decodeURIComponent(v); } catch { return v; }
}

function normalizePostPath(raw){
  const v = (raw || "").trim();
  const decoded = safeDecode(v);
  const decoded2 = safeDecode(decoded);
  const p = decoded2.replace(/\\/g, "/");

  if(!p.startsWith("content/")) return null;
  if(p.includes("..")) return null;
  if(!p.endsWith(".md")) return null;
  return p;
}

function normalizeMediaUrls(rootEl){
  if(!rootEl) return;

  const fix = (url)=>{
    if(!url) return url;
    if(/^https?:\/\//i.test(url)) return url;
    if(/^data:/i.test(url)) return url;
    if(url.startsWith("/")) return url;

    let u = url.replace(/^\.\//, "");
    u = encodeURI(u);

    const base = new URL(location.href);
    base.pathname = base.pathname.replace(/\/[^/]*$/, "/");
    return new URL(u, base).toString();
  };

  rootEl.querySelectorAll("img").forEach(img=>{
    img.src = fix(img.getAttribute("src"));
    img.loading = "lazy";
  });

  rootEl.querySelectorAll("a").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;
    if(!href.startsWith("#")) a.href = fix(href);
  });
}

// ✅ 1차: 사이트에서 직접 읽기
async function fetchFromSite(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`site fetch failed (HTTP ${res.status})`);
  return res.text();
}

// ✅ 2차: raw.githubusercontent.com에서 읽기 (Pages 설정과 무관하게 레포에서 직접 읽음)
async function fetchFromRawGitHub(path){
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
  const res = await fetch(rawUrl, { cache: "no-store" });
  if(!res.ok) throw new Error(`raw fetch failed (HTTP ${res.status})`);
  return res.text();
}

async function main(){
  const raw = qp("path");
  const path = normalizePostPath(raw);

  if(!path){
    $("#postTitle").textContent = "잘못된 접근";
    $("#postBody").textContent = "URL에 ?path=content/...xxx.md 형식이 필요해.";
    return;
  }

  const m = path.match(/^content\/([^/]+)\//);
  const cat = m ? m[1] : "";

  $("#backLink").href =
    (cat === "reviews") ? "reviews.html" :
    (cat === "papers")  ? "papers.html"  :
    (cat === "notes")   ? "notes.html"   :
    (cat === "etc")     ? "etc.html"     : "index.html";

  let md = "";
  let sourceNote = "";

  try{
    md = await fetchFromSite(path);
    sourceNote = ""; // 정상
  }catch(e1){
    // ✅ 사이트에서 404면 raw로 fallback
    try{
      md = await fetchFromRawGitHub(path);
      sourceNote = " (raw fallback)";
    }catch(e2){
      $("#postTitle").textContent = "불러오기 실패";
      $("#postBody").textContent =
        `파일을 못 불러왔어:\n- site: ${path}\n- raw: ${e2.message}\n\n` +
        `※ 레포 브랜치(${GITHUB_BRANCH})에 파일이 있는지, Pages 배포 브랜치/폴더가 다른지 확인해줘.`;
      return;
    }
  }

  const { meta, body } = parseFrontMatter(md);

  const title = meta.title || path.split("/").pop();
  const date  = meta.date || "";
  const tags  = meta.tags || "";

  $("#postTitle").textContent = title + sourceNote;
  document.title = `${title} | YoungHyuk`;

  $("#postMeta").textContent =
    [date && `📅 ${date}`, cat && `📁 ${cat}`, tags && `🏷 ${tags}`]
      .filter(Boolean).join("  ·  ");

  const html = window.mdToHtml ? window.mdToHtml(body) : body;
  $("#postBody").innerHTML = html;

  // ✅ 이미지/링크 보정 (assets/uploads/... 포함)
  normalizeMediaUrls($("#postBody"));
}

document.addEventListener("DOMContentLoaded", main);
