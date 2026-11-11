# GitHub Pages — avaliação humana

## Publicar

1. Regere a amostra se necessário: `python scripts/build_amostra_professores.py`
2. `assets/config.js` deve ter `WEB_APP_URL` e `SECRET_TOKEN` (mesmo valor do Apps Script). Em repo **público**, não commite `config.js`; em repo **privado**, pode versionar para o Pages funcionar.
3. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from branch → main → /docs**

URL típica: `https://<usuario>.github.io/<repo>/`

## Teste local

Sirva a pasta `docs` com um servidor HTTP (abrir `index.html` via `file://` não carrega `items.json`):

```bash
python -m http.server 8080 --directory docs
```

Abra `http://localhost:8080/`

## Arquivos

| Arquivo | Função |
|---------|--------|
| `data/items.json` | Amostra pública (sem scores de IA) |
| `assets/app.js` | UI e envio para Google Sheets |
| `assets/config.js` | **Local apenas** — URL do Web App e token |
