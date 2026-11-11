# Coleta de avaliações humanas (professores)

## Arquivos gerados pelo script

| Arquivo | Descrição |
|---------|-----------|
| [`amostra_manifest.csv`](amostra_manifest.csv) | IDs e estratos da amostra (regerar com `python scripts/build_amostra_professores.py`) |
| [`referencia_ia.csv`](referencia_ia.csv) | Scores Likert 1–3 de Gemini e GPT por `item_id` (privado — não publicar na Pages) |
| `respostas_professores.csv` | Export manual da aba **respostas** da planilha (após a coleta) |

## Google Sheets

1. Crie uma planilha vazia (ex.: “Avaliação feedback SLM — professores”).
2. **Extensões → Apps Script**, cole o conteúdo de [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. Ajuste `SECRET_TOKEN` no script (e o mesmo valor em `docs/assets/config.js` após copiar de `config.example.js`).
4. Execute `setupRespostasSheet` uma vez (menu **Avaliação professores**) ou deixe o primeiro `doPost` criar a aba.
5. **Implantar → Nova implantação → Aplicativo da Web**  
   - Executar como: **Eu**  
   - Quem tem acesso: **Qualquer pessoa**  
   - Copie a URL terminando em `/exec` para `WEB_APP_URL` em `config.js`.

### Aba `respostas` (colunas)

`timestamp`, `item_id`, `avaliador_id`, `likert_alinhamento`, `likert_especificidade`, `likert_tom`, `likert_fortes`, `likert_fracos`, `comentario_opcional`, `tempo_segundos`

### Aba `referencia_ia` (opcional)

Importe o CSV [`referencia_ia.csv`](referencia_ia.csv) para uma segunda aba, só para consulta sua — não é enviado pelo formulário.

## GitHub Pages

Veja [`docs/README.md`](../docs/README.md). Ative **Settings → Pages → Source: pasta `/docs`**.

## Análise

Notebook [`notebooks/avaliacao_professores.ipynb`](../notebooks/avaliacao_professores.ipynb): exporte a planilha como `respostas_professores.csv` nesta pasta e execute o notebook.
