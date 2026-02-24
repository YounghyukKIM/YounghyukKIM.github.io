// assets/markdown.js
// Minimal Markdown -> HTML renderer with:
// - Headings (#..######)
// - Bold/italic (** **, * *)
// - Inline code (`code`)
// - Fenced code blocks (```)
// - Links [text](url)
// - Images ![alt](url)  ✅
// - Blockquotes (> )
// - Unordered lists (-, *, +)
// - Ordered lists (1.)
// - Horizontal rule (---, ***)
// - Paragraphs
//
// Security: escapes all raw HTML from markdown input, only emits safe HTML.

(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    // for attributes; keep it conservative
    return escapeHtml(s).replaceAll("`", "&#096;");
  }

  function isSafeUrl(url) {
    // allow:
    // - relative: assets/..., ./..., ../... (we'll still allow ../ because user may use it)
    // - http(s)
    // - data:image/... (for inline images if any)
    // block javascript:, vbscript:
    const u = String(url || "").trim();
    if (!u) return false;
    const lower = u.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return false;
    if (lower.startsWith("data:")) {
      return lower.startsWith("data:image/");
    }
    if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
    if (lower.startsWith("/") || lower.startsWith("./") || lower.startsWith("../")) return true;
    // plain relative (e.g., assets/uploads/..)
    return !lower.includes(":");
  }

  function inlineFormat(text) {
    // text comes in already escaped, so we can safely inject tags we generate
    // Order matters: code -> images -> links -> bold -> italic
    let t = text;

    // Inline code: `code`
    t = t.replace(/`([^`]+)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`);

    // Images: ![alt](url)
    // alt can be empty. url cannot contain spaces unless encoded; that's standard.
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
      const a = escapeAttr(alt || "");
      const u = String(url || "").trim();
      if (!isSafeUrl(u)) return escapeHtml(m);
      const uu = escapeAttr(u);
      return `<img src="${uu}" alt="${a}" loading="lazy">`;
    });

    // Links: [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
      const u = String(url || "").trim();
      if (!isSafeUrl(u)) return escapeHtml(m);
      const href = escapeAttr(u);
      const lab = escapeHtml(label);
      const target = (href.startsWith("http://") || href.startsWith("https://")) ? ` target="_blank" rel="noopener noreferrer"` : "";
      return `<a href="${href}"${target}>${lab}</a>`;
    });

    // Bold: **text**
    t = t.replace(/\*\*([^*]+)\*\*/g, (m, b) => `<strong>${escapeHtml(b)}</strong>`);

    // Italic: *text*  (avoid matching inside words too aggressively)
    t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (m, p1, it) => `${p1}<em>${escapeHtml(it)}</em>`);

    return t;
  }

  function mdToHtml(md) {
    const src = String(md ?? "").replace(/\r\n/g, "\n");
    const lines = src.split("\n");

    let out = [];
    let inCode = false;
    let codeLang = "";
    let codeBuf = [];

    let inUl = false;
    let inOl = false;
    let inBlockquote = false;

    const closeLists = () => {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
    };

    const closeBlockquote = () => {
      if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; }
    };

    const flushParagraph = (paraLines) => {
      if (!paraLines.length) return;
      const text = paraLines.join(" ").trim();
      if (!text) return;
      out.push(`<p>${inlineFormat(escapeHtml(text))}</p>`);
      paraLines.length = 0;
    };

    let para = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine; // keep original for parsing, but escape when outputting

      // fenced code start/end
      const fenceMatch = line.match(/^```(\w+)?\s*$/);
      if (fenceMatch) {
        // flush paragraph/lists/blockquote
        flushParagraph(para);
        closeLists();
        closeBlockquote();

        if (!inCode) {
          inCode = true;
          codeLang = fenceMatch[1] || "";
          codeBuf = [];
        } else {
          inCode = false;
          const codeText = escapeHtml(codeBuf.join("\n"));
          const cls = codeLang ? ` class="language-${escapeAttr(codeLang)}"` : "";
          out.push(`<pre><code${cls}>${codeText}</code></pre>`);
          codeLang = "";
          codeBuf = [];
        }
        continue;
      }

      if (inCode) {
        codeBuf.push(rawLine);
        continue;
      }

      // blank line => paragraph break + close lists/blockquote if needed
      if (/^\s*$/.test(line)) {
        flushParagraph(para);
        closeLists();
        closeBlockquote();
        continue;
      }

      // Horizontal rule
      if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flushParagraph(para);
        closeLists();
        closeBlockquote();
        out.push("<hr>");
        continue;
      }

      // Blockquote
      const bq = line.match(/^\s*>\s?(.*)$/);
      if (bq) {
        flushParagraph(para);
        closeLists();
        if (!inBlockquote) {
          out.push("<blockquote>");
          inBlockquote = true;
        }
        // inside blockquote: allow headings/lists minimally as plain paragraphs
        const content = bq[1] || "";
        out.push(`<p>${inlineFormat(escapeHtml(content.trim()))}</p>`);
        continue;
      } else {
        closeBlockquote();
      }

      // Headings
      const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (h) {
        flushParagraph(para);
        closeLists();
        const level = h[1].length;
        const content = inlineFormat(escapeHtml(h[2].trim()));
        out.push(`<h${level}>${content}</h${level}>`);
        continue;
      }

      // Ordered list
      const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (ol) {
        flushParagraph(para);
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push("<ol>"); inOl = true; }
        const item = inlineFormat(escapeHtml(ol[2].trim()));
        out.push(`<li>${item}</li>`);
        continue;
      }

      // Unordered list
      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ul) {
        flushParagraph(para);
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push("<ul>"); inUl = true; }
        const item = inlineFormat(escapeHtml(ul[1].trim()));
        out.push(`<li>${item}</li>`);
        continue;
      }

      // Normal text line => accumulate into paragraph
      closeLists();
      para.push(line.trim());
    }

    // flush tail
    if (inCode) {
      // unclosed fence: still render
      const codeText = escapeHtml(codeBuf.join("\n"));
      const cls = codeLang ? ` class="language-${escapeAttr(codeLang)}"` : "";
      out.push(`<pre><code${cls}>${codeText}</code></pre>`);
    } else {
      flushParagraph(para);
      closeLists();
      closeBlockquote();
    }

    return out.join("\n");
  }

  window.mdToHtml = mdToHtml;
})();
