import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export type ParsedChapter = { title: string | null; content: string };
export type ParsedEpub = {
  title: string;
  author: string | null;
  chapters: ParsedChapter[];
};

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["item", "itemref", "rootfile", "navPoint"].includes(name),
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Путь относительно директории base-файла, нормализованный (всегда «/»).
function resolvePath(baseFile: string, href: string): string {
  const base = baseFile.includes("/")
    ? baseFile.slice(0, baseFile.lastIndexOf("/") + 1)
    : "";
  const combined = base + decodeURIComponent(href);
  const parts: string[] = [];
  for (const seg of combined.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

function decodeEntities(s: string): string {
  return s.replace(/&[a-z]+;|&#\d+;/gi, (m) => {
    if (ENTITIES[m]) return ENTITIES[m];
    const num = /^&#(\d+);$/.exec(m);
    if (num) return String.fromCodePoint(Number(num[1]));
    return m;
  });
}

// Удаляем <head>…</head> целиком, чтобы <title>/<meta> не попадали в текст.
function stripHead(html: string): string {
  return html.replace(/<head[\s\S]*?<\/head>/i, "");
}

export function htmlToText(html: string): string {
  return decodeEntities(
    stripHead(html)
      .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(
        /<\/\s*(p|div|h[1-6]|li|section|article|blockquote|tr)\s*>/gi,
        "\n\n"
      )
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Заголовок главы из первого <h1..h3> в теле (head уже без значения).
function headingTitle(html: string): string | null {
  const body = stripHead(html);
  const h = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(body);
  if (h) {
    const t = htmlToText(`<p>${h[1]}</p>`).trim();
    if (t) return t.slice(0, 80);
  }
  return null;
}

function pickText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return pickText(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o["#text"] != null) return pickText(o["#text"]);
  }
  return null;
}

function isGenericTitle(title: string | null, bookTitle: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t.length === 0) return true;
  if (/^(unknown|untitled|cover|toc|contents|оглавление)$/.test(t)) return true;
  if (t === bookTitle.trim().toLowerCase()) return true;
  return false;
}

// ─── Парсинг оглавления (TOC) → карта «путь к файлу → заголовок» ───

interface NavPointNode {
  navLabel?: { text?: unknown };
  content?: { "@_src"?: string };
  navPoint?: NavPointNode[];
}

function collectNcx(node: { navPoint?: NavPointNode[] } | undefined, ncxPath: string, map: Map<string, string>) {
  for (const p of asArray(node?.navPoint)) {
    const label = pickText(p?.navLabel?.text);
    const src = p?.content?.["@_src"];
    if (label && src) {
      const target = resolvePath(ncxPath, src.split("#")[0]);
      if (!map.has(target)) map.set(target, label.slice(0, 80));
    }
    collectNcx(p, ncxPath, map);
  }
}

function parseNavXhtml(navHtml: string, navPath: string, map: Map<string, string>) {
  const aRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(navHtml)) !== null) {
    const href = m[1].split("#")[0];
    const title = htmlToText(`<p>${m[2]}</p>`).trim();
    if (href && title) {
      const target = resolvePath(navPath, href);
      if (!map.has(target)) map.set(target, title.slice(0, 80));
    }
  }
}

export async function parseEpub(buffer: ArrayBuffer): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(buffer);

  // 1. OPF через META-INF/container.xml
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Это не похоже на EPUB (нет container.xml)");
  const container = xml.parse(await containerFile.async("string"));
  const opfPath: string | undefined = asArray(
    container?.container?.rootfiles?.rootfile
  )[0]?.["@_full-path"];
  if (!opfPath) throw new Error("Не найден OPF-файл в EPUB");

  // 2. OPF: метаданные, manifest, spine
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("OPF-файл не читается");
  const opf = xml.parse(await opfFile.async("string"));
  const pkg = opf.package ?? opf;

  const meta = pkg.metadata ?? {};
  const title =
    pickText(meta["dc:title"]) || pickText(meta.title) || "Без названия";
  const author = pickText(meta["dc:creator"]) || pickText(meta.creator) || null;

  const items = asArray(pkg.manifest?.item);
  const manifest = new Map<
    string,
    { href: string; type: string; props: string }
  >();
  for (const it of items) {
    if (it["@_id"] && it["@_href"]) {
      manifest.set(it["@_id"], {
        href: it["@_href"],
        type: it["@_media-type"] || "",
        props: it["@_properties"] || "",
      });
    }
  }

  // 3. TOC: ncx (EPUB2) и/или nav (EPUB3)
  const tocMap = new Map<string, string>();
  try {
    const ncxId = pkg.spine?.["@_toc"];
    let ncxEntry = ncxId ? manifest.get(ncxId) : undefined;
    if (!ncxEntry) {
      for (const e of manifest.values()) {
        if (/dtbncx/i.test(e.type)) {
          ncxEntry = e;
          break;
        }
      }
    }
    if (ncxEntry) {
      const ncxPath = resolvePath(opfPath, ncxEntry.href);
      const f = zip.file(ncxPath);
      if (f) {
        const ncx = xml.parse(await f.async("string"));
        collectNcx(ncx?.ncx?.navMap, ncxPath, tocMap);
      }
    }

    let navEntry: { href: string } | undefined;
    for (const e of manifest.values()) {
      if (/\bnav\b/.test(e.props)) {
        navEntry = e;
        break;
      }
    }
    if (navEntry) {
      const navPath = resolvePath(opfPath, navEntry.href);
      const f = zip.file(navPath);
      if (f) parseNavXhtml(await f.async("string"), navPath, tocMap);
    }
  } catch {
    /* TOC не критичен — будут номера глав */
  }

  // 4. Главы по порядку spine
  const spine = asArray(pkg.spine?.itemref);
  const chapters: ParsedChapter[] = [];

  for (const ref of spine) {
    const entry = manifest.get(ref["@_idref"]);
    if (!entry) continue;
    // принимаем html/xml по типу ИЛИ по расширению (нестандартные/пустые media-type)
    const looksLikeDoc =
      /html|xml/i.test(entry.type) || /\.x?html?$/i.test(entry.href);
    if (!looksLikeDoc) continue;

    const path = resolvePath(opfPath, entry.href);
    const file = zip.file(path);
    if (!file) continue;

    const raw = await file.async("string");
    const text = htmlToText(raw);
    if (text.replace(/\s/g, "").length < 3) continue; // пропускаем пустышки/обложки

    // Заголовок: TOC → первый заголовок в теле → null (станет «Глава N»).
    // Повторяющиеся реальные названия сохраняем как есть.
    let chTitle = tocMap.get(path) ?? headingTitle(raw);
    if (isGenericTitle(chTitle, title)) chTitle = null;

    chapters.push({ title: chTitle, content: text });
  }

  if (chapters.length === 0) {
    throw new Error("Не удалось извлечь текст из EPUB");
  }

  return { title, author, chapters };
}
