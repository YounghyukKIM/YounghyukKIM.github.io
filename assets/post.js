// assets/post.js
const $ = (s)=>document.querySelector(s);

// 🔧 repo info (dashboard.js와 동일)
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
  const decoded1 = safeDecode(v);
  const decoded2 = safeDecode(decoded1);
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

    // "./" 제거 + 공백/한글 safe
    let u = url.replace(/^\.\//, "");
    u = encodeURI(u);

    // post.html 기준 상대경로로 안전하게
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

function looksLikeHtml(text){
  const t = (text || "").trim().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head") || t.includes("<body");
}

// ✅ 1차: 사이트에서 가져오기 (근데 md가 아니라 HTML이 올 수도 있음)
async function fetchFromSite(path){
  const res = await fetch(path, { cache:"no-store" });
  if(!res.ok) throw new Error(`site fetch failed (HTTP ${res.status})`);
  const txt = await res.text();

  // ✅ 핵심: 200이어도 HTML이면 md 원본이 아님 → 실패 처리해서 raw로 넘어감
  if(looksLikeHtml(txt)){
    throw new Error("site returned HTML (not raw markdown)");
  }
  return txt;
}

// ✅ 2차: raw.githubusercontent.com에서 가져오기 (항상 md 원본)
async function fetchFromRawGitHub(path){
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
  const res = await fetch(rawUrl, { cache:"no-store" });
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
    sourceNote = ""; // site에서 raw md를 주는 경우
  }catch(e1){
    // ✅ site가 HTML을 주거나 실패하면 raw로 fallback
    try{
      md = await fetchFromRawGitHub(path);
      sourceNote = " (raw)";
    }catch(e2){
      $("#postTitle").textContent = "불러오기 실패";
      $("#postBody").textContent =
        `site 경로는 열리지만(md 원본이 아니라 HTML이 반환될 수 있음) 글 원본을 못 가져왔어.\n\n` +
        `- path: ${path}\n- site: ${String(e1.message || e1)}\n- raw: ${String(e2.message || e2)}\n\n` +
        `※ 브랜치(${GITHUB_BRANCH})에 파일이 있는지 확인해줘.`;
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

  // ✅ 이미지/링크 경로 보정 (assets/uploads/... 안정)
  normalizeMediaUrls($("#postBody"));
}

document.addEventListener("DOMContentLoaded", main);
