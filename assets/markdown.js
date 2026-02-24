// assets/markdown.js
(function(){
  function esc(s){
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function mdToHtml(md){
    md = md.replace(/\r\n/g,"\n");
    // fenced code
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
      return `<pre><code>${esc(code.trim())}</code></pre>`;
    });
    // headings
    md = md.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    md = md.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    md = md.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    // bold/italic (simple)
    md = md.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    md = md.replace(/\*(.+?)\*/g, "<i>$1</i>");
    // links
    md = md.replace(/\[(.+?)\]\((.+?)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
    // unordered lists
    md = md.replace(/^(?:- |\* )(.*)$/gm, "<li>$1</li>");
    md = md.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
    // paragraphs (naive)
    md = md.split("\n\n").map(block=>{
      if(/^\s*<(h1|h2|h3|ul|pre)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g,"<br/>")}</p>`;
    }).join("\n");
    return md;
  }
  window.mdToHtml = mdToHtml;
})();