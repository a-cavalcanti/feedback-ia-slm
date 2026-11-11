const STORAGE_AVALIADOR = "avaliacao_professores_avaliador_id";
const STORAGE_PROGRESS = "avaliacao_professores_progress";

const DIMENSIONS = [
  {
    key: "likert_alinhamento",
    title: "Alinhamento com os objetivos",
    hint: "1 = não aborda o objetivo; 2 = parcial; 3 = claramente alinhado ao que a atividade pede.",
  },
  {
    key: "likert_especificidade",
    title: "Especificidade",
    hint: "1 = genérico; 2 = alguns detalhes; 3 = cita trechos ou aspectos concretos da resposta.",
  },
  {
    key: "likert_tom",
    title: "Tom motivacional",
    hint: "1 = frio ou negativo; 2 = neutro; 3 = encorajador e respeitoso.",
  },
  {
    key: "likert_fortes",
    title: "Identificação de pontos fortes",
    hint: "1 = não identifica; 2 = vago; 3 = destaca acertos específicos do aluno.",
  },
  {
    key: "likert_fracos",
    title: "Identificação de pontos fracos",
    hint: "1 = não identifica lacunas; 2 = vago; 3 = aponta o que falta ou está incorreto com clareza.",
  },
];

let items = [];
let currentIndex = 0;
let itemStartedAt = null;
const completedIds = new Set();

function getConfig() {
  return window.AVALIACAO_CONFIG || {};
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) {
      ids.forEach((id) => completedIds.add(id));
    }
  } catch {
    /* ignore */
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_PROGRESS, JSON.stringify([...completedIds]));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function buildLikertField(dim) {
  const block = document.createElement("div");
  block.className = "dim-block";
  block.innerHTML = `
    <label class="title">${escapeHtml(dim.title)}</label>
    <p class="hint">${escapeHtml(dim.hint)}</p>
    <div class="likert" role="radiogroup" aria-label="${escapeHtml(dim.title)}"></div>
  `;
  const group = block.querySelector(".likert");
  for (let v = 1; v <= 3; v++) {
    const id = `${dim.key}_${v}`;
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="${dim.key}" id="${id}" value="${v}" required /> ${v}`;
    group.appendChild(label);
  }
  return block;
}

function renderItem(item) {
  document.getElementById("item-id-label").textContent = item.item_id;
  document.getElementById("item-meta").textContent = `Modelo: ${item.modelo} · Prompt: ${item.prompt_variant}${
    item.disciplina ? ` · ${item.disciplina}` : ""
  }`;
  document.getElementById("ctx-pergunta").textContent = item.pergunta;
  document.getElementById("ctx-resposta").textContent = item.resposta_aluno;
  document.getElementById("ctx-explicacao").textContent = item.explicacao || "—";
  document.getElementById("ctx-feedback").textContent = item.feedback;

  const form = document.getElementById("rating-form");
  const dimsContainer = document.getElementById("dimensions");
  dimsContainer.replaceChildren();
  DIMENSIONS.forEach((dim) => dimsContainer.appendChild(buildLikertField(dim)));
  form.querySelector("#comentario_opcional").value = "";
  document.getElementById("submit-status").textContent = "";
  document.getElementById("submit-status").className = "status";
  itemStartedAt = Date.now();
  updateProgress();
}

function updateProgress() {
  const total = items.length;
  const done = completedIds.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("progress-fill").style.width = `${pct}%`;
  document.getElementById("progress-label").textContent = `${done} de ${total} itens enviados`;
  const btnBack = document.getElementById("btn-prev");
  btnBack.disabled = currentIndex <= 0;
}

function nextUncompletedIndex(from) {
  for (let i = from; i < items.length; i++) {
    if (!completedIds.has(items[i].item_id)) return i;
  }
  for (let i = 0; i < from; i++) {
    if (!completedIds.has(items[i].item_id)) return i;
  }
  return -1;
}

function showDone() {
  document.getElementById("app-screen").hidden = true;
  document.getElementById("done-screen").hidden = false;
}

async function submitRating(event) {
  event.preventDefault();
  const config = getConfig();
  if (!config.WEB_APP_URL || config.WEB_APP_URL.includes("SEU_ID")) {
    document.getElementById("submit-status").textContent =
      "Configure docs/assets/config.js com a URL do Apps Script.";
    document.getElementById("submit-status").className = "status err";
    return;
  }

  const item = items[currentIndex];
  const form = event.target;
  const payload = {
    token: config.SECRET_TOKEN || "",
    timestamp: new Date().toISOString(),
    item_id: item.item_id,
    avaliador_id: localStorage.getItem(STORAGE_AVALIADOR) || "",
    comentario_opcional: form.comentario_opcional.value.trim(),
    tempo_segundos: itemStartedAt
      ? Math.round((Date.now() - itemStartedAt) / 1000)
      : "",
  };

  for (const dim of DIMENSIONS) {
    const selected = form.querySelector(`input[name="${dim.key}"]:checked`);
    if (!selected) {
      document.getElementById("submit-status").textContent =
        "Marque todas as dimensões (1–3) antes de enviar.";
      document.getElementById("submit-status").className = "status err";
      return;
    }
    payload[dim.key] = Number(selected.value);
  }

  const btn = document.getElementById("btn-submit");
  btn.disabled = true;
  document.getElementById("submit-status").textContent = "Enviando…";
  document.getElementById("submit-status").className = "status";

  try {
    const res = await fetch(config.WEB_APP_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "Falha no envio");
    }
    completedIds.add(item.item_id);
    saveProgress();
    document.getElementById("submit-status").textContent = "Salvo.";
    document.getElementById("submit-status").className = "status ok";

    const next = nextUncompletedIndex(currentIndex + 1);
    if (next === -1) {
      showDone();
    } else {
      currentIndex = next;
      renderItem(items[currentIndex]);
    }
  } catch (err) {
    document.getElementById("submit-status").textContent =
      `Erro ao enviar: ${err.message}. Verifique a implantação do Apps Script.`;
    document.getElementById("submit-status").className = "status err";
  } finally {
    btn.disabled = false;
  }
}

function startSession() {
  const id = document.getElementById("avaliador_id").value.trim();
  if (!id) {
    document.getElementById("setup-error").textContent = "Informe um código ou identificador.";
    return;
  }
  localStorage.setItem(STORAGE_AVALIADOR, id);
  document.getElementById("setup-screen").hidden = true;
  document.getElementById("app-screen").hidden = false;
  const first = nextUncompletedIndex(0);
  if (first === -1) {
    showDone();
    return;
  }
  currentIndex = first;
  renderItem(items[currentIndex]);
}

function initNav() {
  document.getElementById("btn-start").addEventListener("click", startSession);
  document.getElementById("rating-form").addEventListener("submit", submitRating);
  document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex -= 1;
      renderItem(items[currentIndex]);
    }
  });
  document.getElementById("btn-skip").addEventListener("click", () => {
    if (currentIndex < items.length - 1) {
      currentIndex += 1;
      renderItem(items[currentIndex]);
    }
  });
}

async function loadItems() {
  const res = await fetch("data/items.json");
  if (!res.ok) throw new Error("Não foi possível carregar data/items.json");
  const data = await res.json();
  items = data.items || [];
  document.getElementById("total-items").textContent = String(items.length);
}

async function main() {
  loadProgress();
  initNav();
  try {
    await loadItems();
  } catch (err) {
    document.getElementById("setup-error").textContent = err.message;
  }
  const saved = localStorage.getItem(STORAGE_AVALIADOR);
  if (saved) {
    document.getElementById("avaliador_id").value = saved;
  }
}

main();
