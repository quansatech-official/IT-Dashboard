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
