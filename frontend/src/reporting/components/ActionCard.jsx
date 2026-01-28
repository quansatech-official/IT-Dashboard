import { BookmarkPlus, Trash2 } from "lucide-react";
import { priorityStyles } from "../constants";

export default function ActionCard({ action, onChange, onRemove, onSaveToCatalog }) {
  const isSecurityReport = action?.action_type === "security_report";

  const normalizeText = (value) => String(value ?? "").trim();
  const extractVersion = (value) => {
    const text = normalizeText(value);
    if (!text) return "";
    const match = text.match(/\d+(?:\.\d+)+/);
    return match ? match[0] : text;
  };
  const isMicrosoftEntry = (name) => {
    const text = String(name || "").trim().toLowerCase();
    if (!text) return false;
    if (!text.startsWith("microsoft ")) return false;
    if (text.includes(" for microsoft ")) return false;
    return true;
  };
  const normalizePriority = (value) => {
    const raw = normalizeText(value).toLowerCase();
    if (raw.includes("critical") || raw.includes("krit")) return "critical";
    if (raw.includes("high") || raw.includes("hoch")) return "high";
    if (raw.includes("medium") || raw.includes("mittel")) return "medium";
    if (raw.includes("low") || raw.includes("nied")) return "low";
    return "";
  };
  const priorityScore = (value) => {
    const normalized = normalizePriority(value);
    if (normalized === "critical") return 4;
    if (normalized === "high") return 3;
    if (normalized === "medium") return 2;
    if (normalized === "low") return 1;
    return 0;
  };
  const buildRecommendation = ({ priority, count }) => {
    const score = priorityScore(priority);
    if (score >= 4 || count >= 15) return "Sicherheitsupdate dringend einspielen";
    if (score >= 3 || count >= 8) return "Update zeitnah einplanen";
    return "Update empfohlen";
  };
  const deDupeRecommendation = (name, recommendation) => {
    const cleanName = normalizeText(name).toLowerCase();
    const cleanRec = normalizeText(recommendation).toLowerCase();
    if (!cleanRec) return "";
    if (cleanName && cleanRec === cleanName) return "Update empfohlen";
    if (cleanName && cleanRec.startsWith(cleanName)) {
      const remainder = recommendation.slice(name.length);
      const cleaned = remainder.replace(/^(\s*[-–—:]\s*)/g, "").trim();
      return cleaned || "Update empfohlen";
    }
    return recommendation;
  };
  const sanitizeItem = (item) => {
    const name = normalizeText(item.name);
    return {
      name,
      version: extractVersion(item.version),
      recommendation: deDupeRecommendation(name, normalizeText(item.recommendation)),
      priority: normalizePriority(item.priority),
      count: Number.isNaN(Number(item.count)) ? 0 : Number(item.count)
    };
  };

  const parseHtmlReport = (html) => {
    if (!html) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    const items = [];
    tables.forEach((table) => {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length < 2) return;
      const headerCells = Array.from(rows[0].querySelectorAll("th,td")).map((cell) =>
        normalizeText(cell.textContent || "").toLowerCase()
      );
      const isKevTable =
        headerCells.some((cell) => cell.includes("software")) &&
        headerCells.some((cell) => cell.includes("priorität")) &&
        headerCells.some((cell) => cell.includes("anzahl"));
      if (isKevTable) {
        rows.slice(1).forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td")).map((cell) =>
            normalizeText(cell.textContent || "")
          );
          if (cells.length < 3) return;
          const name = cells[0] || "";
          if (!name) return;
          const count = Number(cells[1]) || 0;
          const priority = cells[2] || "";
          items.push({
            name,
            version: "",
            recommendation: buildRecommendation({ priority, count }),
            priority,
            count
          });
        });
        return;
      }
      const nameIdx = headerCells.findIndex((cell) =>
        /name|programm|software|application|produkt/.test(cell)
      );
      const versionIdx = headerCells.findIndex((cell) => /version|installed|current/.test(cell));
      const recIdx = headerCells.findIndex((cell) => /empfehl|maßnahme|recommend|action|update/.test(cell));
      rows.slice(1).forEach((row) => {
        const cells = Array.from(row.querySelectorAll("td")).map((cell) =>
          normalizeText(cell.textContent || "")
        );
        if (!cells.length) return;
        const name = cells[nameIdx] || cells[0] || "";
        if (!name) return;
        const version = cells[versionIdx] || "";
        const recommendation = cells[recIdx] || "Update empfohlen";
        items.push({ name, version, recommendation, priority: "", count: 0 });
      });
    });
    if (items.length) return items.map(sanitizeItem).filter((item) => item.name);
    const textLines = normalizeText(doc.body?.textContent || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return textLines.slice(0, 50).map((line) => {
      const parts = line.split(/\s{2,}| - | – | \| /).map((part) => part.trim());
      return sanitizeItem({
        name: parts[0] || line,
        version: parts[1] || "",
        recommendation: parts.slice(2).join(" ") || "Update empfohlen",
        priority: "",
        count: 0
      });
    });
  };

  const buildSecurityPayload = (rawItems, includeMicrosoft) => {
    const filtered = rawItems.filter((item) => item.name);
    const unique = [];
    const seen = new Set();
    filtered.forEach((item) => {
      const key = `${item.name}|${item.version}|${item.recommendation}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    const buildGroupLabel = (name) => {
      const tokens = String(name || "").trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) return "";
      const vendor = tokens[0];
      const family = [];
      const stopTokens = new Set(["for", "für"]);
      const skipTokens = new Set(["&", "und", "and"]);
      for (let i = 1; i < tokens.length; i += 1) {
        const token = tokens[i];
        const lower = token.toLowerCase();
        if (stopTokens.has(lower)) break;
        if (skipTokens.has(lower)) continue;
        if (/\d/.test(token)) break;
        family.push(token.replace(/[(),]/g, ""));
        if (family.length >= 2) break;
      }
      const familyLabel = family.filter(Boolean).join(" ");
      return familyLabel ? `${vendor} ${familyLabel}` : vendor;
    };
    const grouped = (entries) => {
      const map = new Map();
      entries.forEach((item) => {
        const label = buildGroupLabel(item.name || "");
        const groupKey = label.toLowerCase();
        const existing = map.get(groupKey);
        if (!existing) {
          map.set(groupKey, {
            ...item,
            name: label || item.name,
            count: item.count || 0,
            priority: item.priority || ""
          });
          return;
        }
        existing.count = (existing.count || 0) + (item.count || 0);
        if (priorityScore(item.priority) > priorityScore(existing.priority)) {
          existing.priority = item.priority;
        }
      });
      return map;
    };
    const microsoftItems = unique.filter((item) => isMicrosoftEntry(item.name));
    const thirdPartyItems = unique.filter((item) => !isMicrosoftEntry(item.name));
    const thirdPartyGrouped = grouped(thirdPartyItems);
    const microsoftGrouped = grouped(microsoftItems);

    const rank = (entries) =>
      [...entries.values()].sort((a, b) => {
        const scoreA = priorityScore(a.priority) * 10 + (a.count || 0);
        const scoreB = priorityScore(b.priority) * 10 + (b.count || 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      });

    const rankedThirdParty = rank(thirdPartyGrouped);
    const rankedMicrosoft = rank(microsoftGrouped);

    return {
      includeMicrosoft,
      rawItems,
      items: rankedThirdParty.slice(0, 3),
      microsoftItems: rankedMicrosoft.slice(0, 3)
    };
  };

  const renderTopList = (list, label) => {
    if (!Array.isArray(list) || !list.length) {
      return null;
    }
    return (
      <div className="mt-3">
        <p className="text-xs uppercase tracking-[0.2em] text-sand-500">{label}</p>
        <div className="mt-2 space-y-2">
          {list.map((item, index) => (
            <div
              key={`${label}-${item.name}-${item.version}-${index}`}
              className="flex items-center justify-between rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-700"
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-sand-500">{index + 1}.</span>
                <span className="font-semibold text-sand-900">{item.name}</span>
              </div>
              <span className="text-[11px] text-sand-500">
                {item.priority ? item.priority : "Priorität n/a"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleHtmlUpload = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const rawItems = parseHtmlReport(text);
      const includeMicrosoft = Boolean(action.custom_data?.includeMicrosoft);
      const customData = buildSecurityPayload(rawItems, includeMicrosoft);
      onChange({ custom_html: text, custom_data: customData });
    } catch (error) {
      // ignore read errors
    }
  };

  if (isSecurityReport) {
    return (
      <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-soft space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold uppercase tracking-wide border px-2 py-1 rounded-full ${priorityStyles.Hinweis}`}
          >
            Hinweis
          </span>
          <label className="flex-1">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Überschrift</span>
            <input
              value={action.title || ""}
              onChange={(event) => onChange({ title: event.target.value })}
              className="mt-1 w-full text-sm font-semibold border-b border-sand-200 focus:border-sand-400 focus:outline-none"
              placeholder="Sicherheitsreport"
            />
          </label>
          <button type="button" onClick={onRemove} className="text-slate-400 hover:text-rose-500">
            <Trash2 size={16} />
          </button>
        </div>

        <label className="text-xs uppercase tracking-wide text-sand-600 block">
          Kurztext
          <textarea
            value={action.custom_text || ""}
            onChange={(event) => onChange({ custom_text: event.target.value })}
            rows={3}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Unsere monatliche Systemauswertung hat unter anderem folgende Schwachstellen gefunden. Wir empfehlen, diese so bald wie möglich zu beheben."
          />
        </label>

        <div className="rounded-xl border border-dashed border-sand-200 bg-sand-50 px-3 py-3 text-sm text-sand-600 flex flex-wrap items-center justify-between gap-2">
          <span>{action.custom_html ? "HTML-Report geladen." : "HTML-Report hochladen."}</span>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-sand-600">
              <input
                type="checkbox"
                checked={Boolean(action.custom_data?.includeMicrosoft)}
                onChange={(event) => {
                  const includeMicrosoft = event.target.checked;
                  let rawItems = action.custom_data?.rawItems || [];
                  if (!rawItems.length && action.custom_html) {
                    rawItems = parseHtmlReport(action.custom_html);
                  }
                  const customData = buildSecurityPayload(rawItems, includeMicrosoft);
                  onChange({ custom_data: customData });
                }}
                className="h-4 w-4"
              />
              Microsoft einschließen
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100 cursor-pointer">
              HTML Upload
              <input
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleHtmlUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm text-sand-700">
          {renderTopList(action.custom_data?.items, "Top 3 Updatebedarf")}
          {action.custom_data?.includeMicrosoft
            ? renderTopList(action.custom_data?.microsoftItems, "Top 3 Microsoft")
            : null}
          {!action.custom_data?.items?.length &&
          (!action.custom_data?.includeMicrosoft || !action.custom_data?.microsoftItems?.length) ? (
            <p className="mt-2 text-xs text-sand-500">Noch keine Einträge.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-soft space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wide border px-2 py-1 rounded-full ${priorityStyles[action.priority]}`}
        >
          {action.priority}
        </span>
        <label className="flex-1">
          <span className="text-[10px] uppercase tracking-wide text-sand-500">Überschrift</span>
          <input
            value={action.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="mt-1 w-full text-sm font-semibold border-b border-sand-200 focus:border-sand-400 focus:outline-none"
            placeholder="Titel der Maßnahme"
          />
        </label>
        <button
          type="button"
          onClick={onSaveToCatalog}
          className="text-slate-400 hover:text-sand-700"
          title="Als Baustein speichern"
        >
          <BookmarkPlus size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-rose-500">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          System/Betreff
          <input
            value={action.system}
            onChange={(event) => onChange({ system: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Server, Firewall, Client..."
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Priorität
          <select
            value={action.priority}
            onChange={(event) => onChange({ priority: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          >
            {["Dringend", "Planbar", "Hinweis"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-xs uppercase tracking-wide text-sand-600 block">
        Warum / Nutzen
        <textarea
          value={action.why_text}
          onChange={(event) => onChange({ why_text: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          placeholder="Warum ist diese Maßnahme wichtig?"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Auswirkung
          <select
            value={action.impact}
            onChange={(event) => onChange({ impact: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          >
            {["Keine Unterbrechung", "Kurzunterbrechung", "Wartungsfenster"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Dauer
          <input
            value={action.duration}
            onChange={(event) => onChange({ duration: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="0,5–1,0 h"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Kostenrahmen
          <input
            value={action.cost}
            onChange={(event) => onChange({ cost: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="60-120 €"
          />
        </label>
      </div>

    </div>
  );
}
