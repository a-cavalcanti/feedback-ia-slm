/**
 * Coloque este arquivo em Extensões → Apps Script na planilha de coleta.
 * Publique como Web App: Executar como “Eu”, Acesso “Qualquer pessoa”.
 */

const SHEET_RESPOSTAS = "respostas";

/** Defina o mesmo valor em docs/assets/config.js (não commite o token). */
const SECRET_TOKEN = "ALTERE_ESTE_TOKEN";

const HEADERS = [
  "timestamp",
  "item_id",
  "avaliador_id",
  "likert_alinhamento",
  "likert_especificidade",
  "likert_tom",
  "likert_fortes",
  "likert_fracos",
  "comentario_opcional",
  "tempo_segundos",
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Avaliação professores")
    .addItem("Criar aba respostas", "setupRespostasSheet")
    .addToUi();
}

function setupRespostasSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_RESPOSTAS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RESPOSTAS);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, service: "avaliacao-professores" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.token !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    setupRespostasSheet();
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESPOSTAS);

    const row = [
      payload.timestamp || new Date().toISOString(),
      payload.item_id || "",
      payload.avaliador_id || "",
      numOrBlank(payload.likert_alinhamento),
      numOrBlank(payload.likert_especificidade),
      numOrBlank(payload.likert_tom),
      numOrBlank(payload.likert_fortes),
      numOrBlank(payload.likert_fracos),
      (payload.comentario_opcional || "").toString().slice(0, 4000),
      numOrBlank(payload.tempo_segundos),
    ];

    sheet.appendRow(row);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

function numOrBlank(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function jsonResponse(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
  if (status) {
    // Apps Script não expõe código HTTP; o corpo indica erro.
    return out;
  }
  return out;
}
