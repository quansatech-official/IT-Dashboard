const API = "/api";

const readJson = async (response, fallback = {}, errorMessage = "Anfrage fehlgeschlagen.") => {
  const data = await response.json().catch(() => fallback);
  if (!response.ok) throw new Error(data?.detail || errorMessage);
  return data;
};

export const projectFoldersApi = {
  listFolders: () => fetch(`${API}/project_folders`).then((response) => response.json()),
  getFolder: (id) => fetch(`${API}/project_folders/${id}`).then((response) => response.json()),
  createFolder: (payload) =>
    fetch(`${API}/project_folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => readJson(response, {}, "Projektmappe konnte nicht erstellt werden.")),
  updateFolder: (id, payload) =>
    fetch(`${API}/project_folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => readJson(response, {}, "Projektmappe konnte nicht gespeichert werden.")),
  deleteFolder: (id) =>
    fetch(`${API}/project_folders/${id}`, { method: "DELETE" }).then((response) =>
      readJson(response, {}, "Projektmappe konnte nicht gelöscht werden.")
    ),
  bootstrap: (payload) =>
    fetch(`${API}/project_folders/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => readJson(response, {}, "Vorschau konnte nicht erzeugt werden.")),
  aiAssist: (payload) =>
    fetch(`${API}/project_folders/ai_assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => readJson(response, {}, "KI-Aktion fehlgeschlagen.")),
  catalog: () => fetch(`${API}/project_folder_catalog`).then((response) => response.json()),
  updateCatalog: (payload) =>
    fetch(`${API}/project_folder_catalog`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => readJson(response, {}, "Bausteinkatalog konnte nicht gespeichert werden.")),
  customers: () => fetch(`${API}/customers`).then((response) => response.json()),
  employees: () => fetch(`${API}/employees`).then((response) => response.json()),
  integrations: () => fetch(`${API}/integrations`).then((response) => response.json().catch(() => ({}))),
  pushSevdeskDraft: (folderId, payload) =>
    fetch(`${API}/sevdesk/project_folders/${folderId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => readJson(response, {}, "sevDesk-Übergabe fehlgeschlagen."))
};
