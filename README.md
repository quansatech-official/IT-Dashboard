# IT-Dashboard
Workbench for IT-Teams

## Deploy

Produktivdeploy läuft über den Portainer-Stack `it-dashboard` auf `root@192.168.100.4`.

Wichtig:
- Nicht `/opt/it-dashboard` verwenden. Das ist auf dem Zielsystem nicht der aktuelle Stack-Stand.
- Der aktive Portainer-Stackinhalt liegt unter:
  `/var/lib/docker/volumes/portainer_data/_data/compose/23/76e80823478a017a7188f036ffa3ee90249573ad`
- Der Compose-Projektname muss `it_dashboard` sein, sonst versucht Docker parallele Hash-Container anzulegen und läuft in Namenskonflikte.

Bewährter Ablauf:

```bash
tar --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='frontend/dist' --exclude='mobile-frontend/dist' -czf - . \
  | ssh root@192.168.100.4 "cd /var/lib/docker/volumes/portainer_data/_data/compose/23/76e80823478a017a7188f036ffa3ee90249573ad && tar -xzf -"

ssh root@192.168.100.4 "cd /var/lib/docker/volumes/portainer_data/_data/compose/23/76e80823478a017a7188f036ffa3ee90249573ad && docker compose -p it_dashboard --env-file stack.env up -d --build frontend"
```

Verifikation:

```bash
ssh root@192.168.100.4 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep 'it-dashboard-frontend\|it-dashboard-backend\|it-dashboard-telephony\|it-dashboard-mobile-frontend'"
ssh root@192.168.100.4 "wget -qO- http://127.0.0.1:7000/healthz"
```

## Fernwartungslink-Generator

Die Workbench enthält unter `Tools -> Fernwartungslink-Generator` eine Verwaltung für kurze öffentliche Deploy-Links, z. B. `https://fw.quansatech.at/marek`.

Ergänzte Datenbanktabellen:

- `remote_deploy_links`: optional verknüpfter Kunde, freier Kundenname, sichtbares Kürzel, Paket (`tv`, `tv_rmm`, `rmm`), Alias-Präfix, TeamViewer-/RMM-Konfiguration, Aktivstatus, Ablaufdatum, Installationslimit, Verwendungszähler, interner Token und Soft-Delete.
- `remote_deploy_events`: Resolve-, Download- und Installationsstatus mit Hostname, Benutzer, Gerätealias, Meldung, IP, User-Agent und Zeitstempel.

Wichtige Backend-Routen:

- `GET /api/remote-deploy/settings`: Standardwerte für Public Base URL, TeamViewer IDs und RMM Installer URL.
- `GET /api/remote-deploy/rmm_deployments`: liest TacticalRMM Deployments über die konfigurierte RMM API und liefert daraus Download-Links.
- `GET /api/remote-deploy/links`: interne Übersicht aller Links.
- `POST /api/remote-deploy/links`: internen Link anlegen.
- `PATCH /api/remote-deploy/links/{id}`: Link bearbeiten, aktivieren oder deaktivieren.
- `DELETE /api/remote-deploy/links/{id}`: Soft-Delete.
- `POST /api/remote-deploy/slug_suggestions`: kurze sprechende Kürzel aus Kundenname oder Präfix vorschlagen.
- `GET /api/remote-deploy/resolve/{slug}`: vom öffentlichen Deploy-Container aufzurufen. Liefert nur bei aktivem, nicht abgelaufenem Link unterhalb der Installationsgrenze die Installer-Konfiguration.
- `POST /api/remote-deploy/status`: Status-Rückmeldung vom Bootstrapper oder Deploy-Container.

Konfiguration:

- `REMOTE_DEPLOY_PUBLIC_BASE_URL`, Standard `https://fw.quansatech.at`
- `REMOTE_DEPLOY_TEAMVIEWER_CUSTOM_CONFIG_ID`
- `REMOTE_DEPLOY_TEAMVIEWER_ASSIGNMENT_ID`
- `REMOTE_DEPLOY_RMM_INSTALLER_URL`
- `REMOTE_DEPLOY_DEFAULT_MAX_INSTALLS`
- `REMOTE_DEPLOY_DEFAULT_EXPIRY_DAYS`

Der öffentliche Deploy-Container liefert Landingpage und `qt_fernwartung.exe` aus. Die Workbench verwaltet nur Links, Paketlogik und Konfigurationsdaten. Der Deploy-Container löst das sichtbare Kürzel über `GET /api/remote-deploy/resolve/{slug}` auf und meldet Fortschritt über `POST /api/remote-deploy/status` zurück.

Für TeamViewer ist die Konfigurations-ID `6uxwetg` als Standard hinterlegt. Im Link kann entweder der komplette permanente Link `https://get.teamviewer.com/6uxwetg` oder nur der Code `6uxwetg` gespeichert werden. `GET /api/remote-deploy/resolve/{slug}` liefert zusätzlich `teamViewerDownloadUrl`; der Bootstrapper lädt TeamViewer direkt von dieser URL, wenn `installTeamViewer` aktiv ist. TeamViewer-MSI-URLs für 32/64-bit können später als eigene Download-Quelle ergänzt werden, sobald die konkreten MSI-Links vorliegen.

Für RMM nutzt die Workbench die bestehende TacticalRMM API-Konfiguration (`rmm_host`, `rmm_api_key`, Header). Deployments werden über `/clients/deployments/` gelesen und in der Workbench auswählbar angezeigt; beim Laden wird das erste Deployment vorbelegt. Der Download-Link wird als `{rmm_host}/clients/{deployment_uid}/deploy/` an den Bootstrapper geliefert. Ein manuell gesetzter `rmmInstallerUrl` am Link überschreibt diese automatische Auswahl.
