// assets/post.js
const $ = (s)=>document.querySelector(s);

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

/**
 * ✅ path 파라미터를 안전하게 정규화
 * - 인코딩된 %2F 처리
 * - "content/" 하위만 허용 (보안/오작동 방지)
 */
function normalizePostPath(raw){
  const v = (raw || "").trim();
  const decoded = safeDecode(v);

  // 흔한 케이스: 이미 path가 한 번 더 encode된 경우를 대비해 2회까지 디코드
  const decoded2 = safeDecode(decoded);

  const p = decoded2.replace(/\\/g, "/"); // 윈도우 슬래시 방지

  // 보안/안정성: content 아래만 허용
  if(!p.startsWith("content/")) return null;
  if(p.includes("..")) return null;
  if(!p.endsWith(".md")) return null;

  return p;
}

/**
 * ✅ 렌더된 HTML 내부의 이미지/링크 경로 보정
 * - 마크다운에 "assets/..."처럼 상대경로가 들어오면 post.html 기준으로 잘 뜨지만,
 *   "./assets/..." / 공백 / 한글 등 때문에 깨지는 경우를 줄이기 위해 정규화
 */
function normalizeMediaUrls(rootEl){
  if(!rootEl) return;

  const fix = (url)=>{
    if(!url) return url;

    // 이미 절대/데이터 URL이면 그대로
    if(/^https?:\/\//i.test(url)) return url;
    if(/^data:/i.test(url)) return url;
    if(url.startsWith("/")) return url;

    // "./" 제거
    let u = url.replace(/^\.\//, "");

    // 공백 처리(파일명에 공백 들어간 경우)
    // (URLSearchParams 방식이 아니라 단순 href/src라서 encodeURI 사용)
    u = encodeURI(u);

    // 사이트 루트 기준 상대경로로 보정:
    // post.html이 루트에 있으니 대부분 문제 없지만, 혹시 하위 경로 배포에도 대비
    const base = new URL(location.href);
    base.pathname = base.pathname.replace(/\/[^/]*$/, "/"); // 현재 문서 디렉토리
    return new URL(u, base).toString();
  };

  // images
  rootEl.querySelectorAll("img").forEach(img=>{
    img.src = fix(img.getAttribute("src"));
    // lazy 로딩(옵션)
    img.loading = "lazy";
  });

  // links (이미지 링크도 있을 수 있음)
  rootEl.querySelectorAll("a").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;
    // md 내 상대 링크도 깨짐 줄이기
    if(!href.startsWith("#")) a.href = fix(href);
  });
}

async function main(){
  const raw = qp("path"); // ex) content/reviews/xxx.md (혹은 인코딩된 형태)
  const path = normalizePostPath(raw);

  if(!path){
    $("#postTitle").textContent = "잘못된 접근";
    $("#postBody").textContent = "URL에 ?path=content/...xxx.md 형식이 필요해.";
    return;
  }

  // category 추출
  const m = path.match(/^content\/([^/]+)\//);
  const cat = m ? m[1] : "";

  // back link
  $("#backLink").href =
    (cat === "reviews") ? "reviews.html" :
    (cat === "papers")  ? "papers.html"  :
    (cat === "notes")   ? "notes.html"   :
    (cat === "etc")     ? "etc.html"     : "index.html";

  // ✅ fetch는 decode된 정규 path로
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok){
    $("#postTitle").textContent = "불러오기 실패";
    $("#postBody").textContent =
      `파일을 못 불러왔어: ${path}\n(HTTP ${res.status})\n\n` +
      `※ 대시보드에서 발행했는지 / 파일이 실제 레포에 있는지 확인해줘.`;
    return;
  }

  const md = await res.text();
  const { meta, body } = parseFrontMatter(md);

  const title = meta.title || path.split("/").pop();
  const date  = meta.date || "";
  const tags  = meta.tags || "";

  $("#postTitle").textContent = title;
  document.title = `${title} | YoungHyuk`;

  $("#postMeta").textContent =
    [date && `📅 ${date}`, cat && `📁 ${cat}`, tags && `🏷 ${tags}`]
      .filter(Boolean).join("  ·  ");

  // ✅ markdown 렌더
  const html = window.mdToHtml ? window.mdToHtml(body) : body;
  $("#postBody").innerHTML = html;

  // ✅ 이미지/링크 경로 보정
  normalizeMediaUrls($("#postBody"));
}

document.addEventListener("DOMContentLoaded", main);
