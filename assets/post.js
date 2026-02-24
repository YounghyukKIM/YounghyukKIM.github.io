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

async function main(){
  const path = qp("path"); // ex) content/reviews/my-post.md
  if(!path){
    $("#postTitle").textContent = "잘못된 접근";
    $("#postBody").textContent = "path 파라미터가 없어.";
    return;
  }

  // back link (카테고리로)
  const m = path.match(/^content\/([^/]+)\//);
  const cat = m ? m[1] : "home";
  $("#backLink").href = (cat === "reviews") ? "reviews.html"
                   : (cat === "papers") ? "papers.html"
                   : (cat === "notes") ? "notes.html"
                   : (cat === "etc") ? "etc.html"
                   : "index.html";

  // fetch md from same origin
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok){
    $("#postTitle").textContent = "불러오기 실패";
    $("#postBody").textContent = `파일을 못 불러왔어: ${path}`;
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

  $("#postBody").innerHTML = window.mdToHtml ? window.mdToHtml(body) : body;
}

document.addEventListener("DOMContentLoaded", main);
