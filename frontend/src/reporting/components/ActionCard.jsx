import { useState } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { priorityStyles } from "../constants";

export default function ActionCard({ action, onChange, onRemove, onSaveToCatalog }) {
  const isSecurityReport = action?.action_type === "security_report";
  const [uploadError, setUploadError] = useState("");
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);
  const [programPickerState, setProgramPickerState] = useState(null);

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
    if (text.includes(" for microsoft ")) return false;
    if (text.startsWith("microsoft ")) return true;

    const knownThirdPartyVendors = [
      "adobe",
      "notepad++",
      "7-zip",
      "7zip",
      "google",
      "mozilla",
      "oracle",
      "zoom",
      "teamviewer",
      "vmware",
      "citrix"
    ];
    if (knownThirdPartyVendors.some((vendor) => text.includes(vendor))) return false;

    const microsoftProductPatterns = [
      /\bsql\s*server\b/,
      /\bssms\b/,
      /\bmanagement\s*studio\b/,
      /\bshared\s*management\s*objects\b/,
      /\bsystem\s*clr\s*types\b/,
      /\bdata-?tier\b/,
      /\bt-?sql\b/,
      /\bxevent\b/,
      /\bdatabase\s*engine\b/,
      /\bintegration\s*services\b/,
      /\breporting\s*services\b/,
      /\banalysis\s*services\b/,
      /\bvisual\s*studio\b/,
      /\bvisual\s*c\+\+\b/,
      /\bvisual\s*c\+\+\s*library\b/,
      /\bvs\s+script\s+debugging\b/,
      /\bentity\s*framework\b/,
      /\bclickonce\b/,
      /\broslyn\b/,
      /\bmsvc\b/,
      /\basp\.?\s*net\b/,
      /\btypescript\s*sdk\b/,
      /\bnetstandard\b/,
      /\buniversal\s*crt\b/,
      /\bwinrt\b/,
      /\bapp\s*certification\s*kit\b/,
      /\bdesktop\s*extension\s*sdk\b/,
      /\bmobile\s*extension\s*sdk\b/,
      /\bteam\s*extension\s*sdk\b/,
      /\bsoftware\s*development\s*kit\b/,
      /\bwindows\s*sdk\b/,
      /\bwindows\s+desktop\s+runtime\b/,
      /\bwindows\s+desktop\s+targeting\s+pack\b/,
      /\bwindows\s+phone\s*sdk\b/,
      /\bwindows\s+store\s+apps\b/,
      /\bwindows\s+iot\b/,
      /\bwindows\s+app\b/,
      /\bwindows\b/,
      /\bskype\s*for\s*business\b/,
      /\bexchange\b/,
      /\bsharepoint\b/,
      /\bteams\b/,
      /\bone\s*drive\b/,
      /\bonenote\b/,
      /\boutlook\b/,
      /\boffice\b/,
      /\bword\b/,
      /\bexcel\b/,
      /\bpowerpoint\b/,
      /\bvisio\b/,
      /\bpublisher\b/,
      /\baccess\b/,
      /\bazure\b/,
      /\bdefender\b/,
      /\bintune\b/,
      /\bactive\s*directory\b/,
      /\bentra\b/,
      /\bhyper-?v\b/,
      /\bdotnet\b/,
      /\b\.net\b/,
      /\bedge\b/,
      /\bremote\s*desktop\b/,
      /\brdp\b/,
      /\biis\b/,
      /\bole\s*db\b.*\b(sql|analysis)\b/,
      /\bvss\s*writer\b/
    ];

    return microsoftProductPatterns.some((pattern) => pattern.test(text));
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

  const buildSecurityPayload = (rawItems, includeMicrosoft, selectedPrograms = []) => {
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
    const combinedGrouped = new Map([...thirdPartyGrouped, ...microsoftGrouped]);

    const rank = (entries) =>
      [...entries.values()].sort((a, b) => {
        const scoreA = priorityScore(a.priority) * 10 + (a.count || 0);
        const scoreB = priorityScore(b.priority) * 10 + (b.count || 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      });

    const rankedThirdParty = rank(thirdPartyGrouped).map((item) => ({
      ...item,
      versionFrom: item.version || ""
    }));
    const rankedCombined = rank(combinedGrouped).map((item) => ({
      ...item,
      versionFrom: item.version || ""
    }));
    const rankedBase = includeMicrosoft ? rankedCombined : rankedThirdParty;

    const normalizedSelectedPrograms = selectedPrograms
      .map((entry) => {
        if (typeof entry === "string") {
          const name = normalizeText(entry);
          if (!name) return null;
          return { name, versionFrom: "" };
        }
        const name = normalizeText(entry?.name);
        if (!name) return null;
        return {
          name, versionFrom: normalizeText(entry?.versionFrom)
        };
      })
      .filter(Boolean);

    const selectedMap = new Map(
      normalizedSelectedPrograms.map((entry) => [normalizeText(entry.name).toLowerCase(), entry])
    );
    const selectedSet = new Set(selectedMap.keys());
    const selectedRanked = rankedBase
      .filter((item) => selectedSet.has(normalizeText(item.name).toLowerCase()))
      .map((item) => {
        const selected = selectedMap.get(normalizeText(item.name).toLowerCase());
        return {
          ...item,
          versionFrom: selected?.versionFrom || item.versionFrom || ""
        };
      });
    const finalRanked = selectedSet.size ? selectedRanked : rankedBase.slice(0, 3);
    const candidates = rankedBase.slice(0, 20).map((item) => ({
      name: item.name,
      versionFrom: item.versionFrom || ""
    }));

    return {
      includeMicrosoft,
      rawItems,
      selectedPrograms: normalizedSelectedPrograms,
      selectedProgramNames: normalizedSelectedPrograms.map((entry) => entry.name),
      candidates,
      items: finalRanked
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
                <span>
                  <span className="font-semibold text-sand-900">{item.name}</span>
                  {item.versionFrom ? (
                    <span className="block text-[11px] text-sand-500">
                      von {item.versionFrom}
                    </span>
                  ) : null}
                </span>
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
      setUploadError("");
      const text = await file.text();
      const rawItems = parseHtmlReport(text);
      if (!rawItems.length) {
        setUploadError("Keine Programme im HTML gefunden.");
        return;
      }
      const includeMicrosoft = Boolean(action.custom_data?.includeMicrosoft);
      const initialPayload = buildSecurityPayload(rawItems, includeMicrosoft);
      const candidates = initialPayload.candidates || [];
      const defaultSelection = initialPayload.items.map((item) => ({
        name: item.name,
        versionFrom: item.versionFrom || item.version || ""
      }));
      setProgramPickerState({
        text,
        rawItems,
        includeMicrosoft,
        candidates,
        selectedPrograms: defaultSelection
      });
    } catch (error) {
      setUploadError("Upload fehlgeschlagen. Bitte HTML-Datei prüfen.");
    }
  };

  const closeProgramPicker = () => setProgramPickerState(null);

  const openProgramPicker = () => {
    setUploadError("");
    const includeMicrosoft = Boolean(action.custom_data?.includeMicrosoft);
    let rawItems = Array.isArray(action.custom_data?.rawItems) ? action.custom_data.rawItems : [];
    if (!rawItems.length && action.custom_html) {
      rawItems = parseHtmlReport(action.custom_html);
    }
    if (!rawItems.length) {
      setUploadError("Kein geladener HTML-Report zum Bearbeiten vorhanden.");
      return;
    }
    const basePayload = buildSecurityPayload(rawItems, includeMicrosoft);
    const selectedPrograms = Array.isArray(action.custom_data?.selectedPrograms)
      ? action.custom_data.selectedPrograms
      : (action.custom_data?.selectedProgramNames || []).map((name) => ({ name, versionFrom: "" }));
    setProgramPickerState({
      text: action.custom_html || "",
      rawItems,
      includeMicrosoft,
      candidates: basePayload.candidates || [],
      selectedPrograms
    });
  };

  const toggleProgramSelection = (name) => {
    setProgramPickerState((prev) => {
      if (!prev) return prev;
      const selected = Array.isArray(prev.selectedPrograms) ? [...prev.selectedPrograms] : [];
      const idx = selected.findIndex(
        (entry) => normalizeText(entry?.name).toLowerCase() === normalizeText(name).toLowerCase()
      );
      if (idx >= 0) {
        selected.splice(idx, 1);
        return { ...prev, selectedPrograms: selected };
      }
      const candidate = (prev.candidates || []).find(
        (entry) => normalizeText(entry?.name).toLowerCase() === normalizeText(name).toLowerCase()
      );
      selected.push({
        name,
        versionFrom: normalizeText(candidate?.versionFrom)
      });
      return { ...prev, selectedPrograms: selected };
    });
  };

  const confirmProgramPicker = () => {
    if (!programPickerState) return;
    const selectedPrograms = programPickerState.selectedPrograms || [];
    const customData = buildSecurityPayload(
      programPickerState.rawItems,
      programPickerState.includeMicrosoft,
      selectedPrograms
    );
    onChange({ custom_html: programPickerState.text, custom_data: customData });
    closeProgramPicker();
  };

  const handleHtmlDrop = (event) => {
    event.preventDefault();
    setIsDragOverUpload(false);
    setUploadError("");
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const lowerName = String(file.name || "").toLowerCase();
    if (!(lowerName.endsWith(".html") || lowerName.endsWith(".htm"))) {
      setUploadError("Bitte eine HTML-Datei (.html/.htm) ablegen.");
      return;
    }
    handleHtmlUpload(file);
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
            placeholder="Die Schwachstellen der angezeigten Programme werden bereits aktiv ausgenutzt."
          />
        </label>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            if (!isDragOverUpload) setIsDragOverUpload(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOverUpload(false);
          }}
          onDrop={handleHtmlDrop}
          className={`rounded-xl border border-dashed bg-sand-50 px-3 py-3 text-sm text-sand-600 flex flex-wrap items-center justify-between gap-2 ${
            isDragOverUpload ? "border-sand-400 bg-sand-100" : "border-sand-200"
          }`}
        >
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
                  const selectedProgramNames = Array.isArray(action.custom_data?.selectedProgramNames)
                    ? action.custom_data.selectedProgramNames
                    : [];
                  const selectedPrograms = Array.isArray(action.custom_data?.selectedPrograms)
                    ? action.custom_data.selectedPrograms
                    : selectedProgramNames;
                  const customData = buildSecurityPayload(
                    rawItems,
                    includeMicrosoft,
                    selectedPrograms
                  );
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
            <button
              type="button"
              onClick={openProgramPicker}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
            >
              Programme bearbeiten
            </button>
          </div>
        </div>
        {uploadError ? <p className="text-xs text-rose-600">{uploadError}</p> : null}

        {programPickerState ? (
          <div className="rounded-xl border border-sand-200 bg-white p-3 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-sand-500">Programme auswählen</p>
              <p className="text-sm text-sand-700">
                Top 3 sind vorausgewählt. Du kannst manuell weitere Programme auswählen.
              </p>
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-sand-100">
              {(programPickerState.candidates || []).map((candidate) => {
                const candidateName = candidate?.name || "";
                const selectedEntry = (programPickerState.selectedPrograms || []).find(
                  (entry) =>
                    normalizeText(entry?.name).toLowerCase() === normalizeText(candidateName).toLowerCase()
                );
                const checked = Boolean(selectedEntry);
                return (
                  <label
                    key={candidateName}
                    className="block px-3 py-2 text-sm border-b border-sand-100 last:border-b-0 text-sand-700"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProgramSelection(candidateName)}
                        className="h-4 w-4"
                      />
                      <span>{candidateName}</span>
                    </div>
                    {checked && selectedEntry?.versionFrom ? (
                      <div className="mt-1 text-xs text-sand-500">Version: {selectedEntry.versionFrom}</div>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeProgramPicker}
                className="rounded-md border border-sand-200 px-3 py-1.5 text-xs text-sand-700 hover:bg-sand-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmProgramPicker}
                title="Auswahl übernehmen"
                className="rounded-md border border-sand-300 bg-sand-100 px-3 py-1.5 text-xs font-semibold text-sand-900 hover:bg-sand-200"
              >
                Übernehmen
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm text-sand-700">
          {renderTopList(action.custom_data?.items, "Programme mit Updatebedarf")}
          {!action.custom_data?.items?.length ? (
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
