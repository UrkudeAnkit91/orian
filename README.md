# ORIAN Website

Public landing + privacy policy for **ORIAN — Personal Neural OS**.
Plain HTML/CSS/JS, no build step. Hosted on **GitHub Pages**:
https://urkudeankit91.github.io/orian/

| File | Purpose |
|------|---------|
| `index.html` | Landing page (hero, features, privacy strip, contact) |
| `privacy.html` | Privacy policy — linked from GCP OAuth console + app |
| `styles.css` | All styles (dark Neural OS theme, app brand colors) |

## Deploy / update (ORIAN agents or manual)

```powershell
# from E:\ORIAN\website
git add -A
git commit -m "describe change"
git push
# GitHub Pages auto-deploys on push (takes ~1 min)
```

Requires `gh` CLI authenticated (machine account: **UrkudeAnkit91**).
Pages settings: repo `orian` → Settings → Pages → Source: main / root.

## Rules

- Keep `privacy.html` content in sync with the app's data practices.
- If the privacy URL changes, update GCP Console → Auth → Branding →
  "Application privacy policy link" and `AGENTS.md`.
- No trackers, no analytics, no external CDNs — matches the local-first claim.
