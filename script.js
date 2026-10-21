"use strict";

const STORAGE_KEY = "meu-ritmo-activities";
const form = document.querySelector("#activity-form");
const nameInput = document.querySelector("#activity-name");
const dateInput = document.querySelector("#activity-date");
const categoryInput = document.querySelector("#activity-category");
const priorityInput = document.querySelector("#activity-priority");
const filterInput = document.querySelector("#category-filter");
const activityList = document.querySelector("#activity-list");
const feedback = document.querySelector("#form-feedback");
const todayLabel = document.querySelector("#today-label");
const completedCount = document.querySelector("#completed-count");
const totalCount = document.querySelector("#total-count");
const visibleCount = document.querySelector("#visible-count");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const progressMessage = document.querySelector("#progress-message");
const themeToggle = document.querySelector("#theme-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const THEME_STORAGE_KEY = "meu-ritmo-theme";
const glassOpacityInput = document.querySelector("#glass-opacity");
const glassOpacityValue = document.querySelector("#glass-opacity-value");
const backgroundUpload = document.querySelector("#background-upload");
const clearBackgroundButton = document.querySelector("#clear-background");
const appearanceStatus = document.querySelector("#appearance-status");
const wallpaperVideo = document.querySelector("#wallpaper-video");
const GLASS_OPACITY_STORAGE_KEY = "meu-ritmo-glass-transparency";
const WALLPAPER_DATABASE = "meu-ritmo-settings";
const WALLPAPER_STORE = "preferences";
const MAX_WALLPAPER_SIZE = 50 * 1024 * 1024;

let activities = loadActivities();
let feedbackTimer;
let wallpaperObjectUrl;
let wallpaperDatabasePromise;

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", `Ativar tema ${isDark ? "claro" : "escuro"}`);
  themeToggle.title = `Ativar tema ${isDark ? "claro" : "escuro"}`;
  themeColorMeta.setAttribute("content", isDark ? "#101713" : "#edf2ef");
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    console.error("Não foi possível carregar a preferência de tema.", error);
    return "light";
  }
}

applyTheme(loadTheme());

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.error("Não foi possível salvar a preferência de tema.", error);
  }
});

function applyGlassOpacity(value) {
  const transparency = Number(value);
  const transparencyRange = (95 - transparency) / 50;
  const opacity = 0.012 + transparencyRange * 0.065;
  const secondaryOpacity = opacity * 0.72;
  const controlOpacity = 0.02 + transparencyRange * 0.09;
  const panelOpacity = 0.04 + transparencyRange * 0.075;
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty("--glass-light-primary", `rgba(255, 255, 255, ${opacity})`);
  rootStyle.setProperty("--glass-light-secondary", `rgba(220, 228, 231, ${secondaryOpacity})`);
  rootStyle.setProperty("--glass-dark-primary", `rgba(222, 228, 232, ${opacity})`);
  rootStyle.setProperty("--glass-dark-secondary", `rgba(166, 176, 183, ${secondaryOpacity})`);
  rootStyle.setProperty("--glass-light-control", `rgba(255, 255, 255, ${controlOpacity})`);
  rootStyle.setProperty("--glass-dark-control", `rgba(194, 201, 206, ${controlOpacity})`);
  rootStyle.setProperty("--glass-light-panel", `rgba(248, 251, 248, ${panelOpacity})`);
  rootStyle.setProperty("--glass-dark-panel", `rgba(74, 81, 86, ${panelOpacity})`);
  glassOpacityValue.value = `${value}%`;
  glassOpacityValue.textContent = `${value}%`;
}

function loadGlassOpacity() {
  try {
    const stored = Number(localStorage.getItem(GLASS_OPACITY_STORAGE_KEY));
    return Number.isInteger(stored) && stored >= 45 && stored <= 95 ? stored : 95;
  } catch (error) {
    console.error("Não foi possível carregar a transparência salva.", error);
    return 95;
  }
}

glassOpacityInput.value = String(loadGlassOpacity());
applyGlassOpacity(glassOpacityInput.value);

glassOpacityInput.addEventListener("input", () => {
  applyGlassOpacity(glassOpacityInput.value);
  try {
    localStorage.setItem(GLASS_OPACITY_STORAGE_KEY, glassOpacityInput.value);
  } catch (error) {
    console.error("Não foi possível salvar a transparência.", error);
    appearanceStatus.textContent = "A transparência foi alterada, mas não pôde ser salva.";
  }
});

function openWallpaperDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não oferece armazenamento local de imagens."));
  }

  if (!wallpaperDatabasePromise) {
    wallpaperDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(WALLPAPER_DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(WALLPAPER_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Falha ao abrir o armazenamento da imagem."));
      request.onblocked = () => reject(new Error("O armazenamento da imagem está bloqueado por outra aba."));
    });
  }

  return wallpaperDatabasePromise;
}

async function storeWallpaper(blob) {
  const database = await openWallpaperDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(WALLPAPER_STORE, "readwrite");
    transaction.objectStore(WALLPAPER_STORE).put(blob, "background");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Falha ao salvar a imagem."));
    transaction.onabort = () => reject(transaction.error || new Error("O salvamento da imagem foi cancelado."));
  });
}

async function readWallpaper() {
  const database = await openWallpaperDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(WALLPAPER_STORE, "readonly")
      .objectStore(WALLPAPER_STORE)
      .get("background");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Falha ao carregar a imagem."));
  });
}

async function deleteWallpaper() {
  const database = await openWallpaperDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(WALLPAPER_STORE, "readwrite");
    transaction.objectStore(WALLPAPER_STORE).delete("background");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Falha ao remover a imagem."));
    transaction.onabort = () => reject(transaction.error || new Error("A remoção da imagem foi cancelada."));
  });
}

function applyWallpaper(blob) {
  wallpaperVideo.pause();
  wallpaperVideo.removeAttribute("src");
  wallpaperVideo.load();
  wallpaperVideo.hidden = true;

  if (wallpaperObjectUrl) {
    URL.revokeObjectURL(wallpaperObjectUrl);
    wallpaperObjectUrl = undefined;
  }

  if (!blob) {
    document.documentElement.style.removeProperty("--wallpaper-image");
    clearBackgroundButton.hidden = true;
    return;
  }

  wallpaperObjectUrl = URL.createObjectURL(blob);
  if (blob.type.startsWith("video/")) {
    document.documentElement.style.removeProperty("--wallpaper-image");
    wallpaperVideo.src = wallpaperObjectUrl;
    wallpaperVideo.hidden = false;
    wallpaperVideo.load();
    wallpaperVideo.play().catch((error) => {
      if (!wallpaperVideo.hidden && wallpaperVideo.src === wallpaperObjectUrl) {
        console.error("Não foi possível iniciar o vídeo de fundo.", error);
        appearanceStatus.textContent = "O vídeo foi carregado, mas não pôde ser reproduzido neste navegador.";
      }
    });
  } else if (blob.type.startsWith("image/")) {
    document.documentElement.style.setProperty("--wallpaper-image", `url("${wallpaperObjectUrl}")`);
  } else {
    URL.revokeObjectURL(wallpaperObjectUrl);
    wallpaperObjectUrl = undefined;
    throw new Error("O arquivo salvo não é uma imagem ou vídeo compatível.");
  }

  clearBackgroundButton.hidden = false;
}

wallpaperVideo.addEventListener("error", () => {
  if (!wallpaperVideo.hidden) {
    appearanceStatus.textContent = "Não foi possível reproduzir este vídeo. Tente MP4 ou WebM.";
  }
});

function validateVideoFile(file) {
  return new Promise((resolve, reject) => {
    const preview = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish(new Error("Tempo esgotado ao verificar o vídeo."));
    }, 10000);

    function finish(error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      preview.removeAttribute("src");
      preview.load();
      URL.revokeObjectURL(objectUrl);
      if (error) reject(error);
      else resolve();
    }

    preview.muted = true;
    preview.preload = "metadata";
    preview.addEventListener("loadedmetadata", () => {
      if (preview.videoWidth > 0 && preview.videoHeight > 0) finish();
      else finish(new Error("O arquivo de vídeo não tem dimensões válidas."));
    }, { once: true });
    preview.addEventListener("error", () => {
      finish(new Error("O formato ou codec do vídeo não é compatível com este navegador."));
    }, { once: true });
    preview.src = objectUrl;
    preview.load();
  });
}

async function restoreWallpaper() {
  try {
    const wallpaper = await readWallpaper();
    if (wallpaper) applyWallpaper(wallpaper);
  } catch (error) {
    console.error("Não foi possível carregar a mídia de fundo.", error);
    appearanceStatus.textContent = "Não foi possível carregar a mídia de fundo salva.";
  }
}

backgroundUpload.addEventListener("change", async () => {
  const [file] = backgroundUpload.files;
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    appearanceStatus.textContent = "Escolha uma imagem ou um vídeo compatível.";
    backgroundUpload.value = "";
    return;
  }

  if (file.size > MAX_WALLPAPER_SIZE) {
    appearanceStatus.textContent = "O arquivo deve ter no máximo 50 MB.";
    backgroundUpload.value = "";
    return;
  }

  try {
    if (isVideo) await validateVideoFile(file);
    await storeWallpaper(file);
    applyWallpaper(file);
    appearanceStatus.textContent = `${isVideo ? "Vídeo" : "Imagem"} de fundo aplicado e salvo neste navegador.`;
  } catch (error) {
    console.error("Não foi possível salvar a mídia de fundo.", error);
    appearanceStatus.textContent = isVideo && error.message.includes("compatível")
      ? "Este formato ou codec não é compatível. Tente um vídeo MP4 ou WebM."
      : "Não foi possível aplicar o arquivo. Tente uma imagem ou vídeo menor.";
  } finally {
    backgroundUpload.value = "";
  }
});

clearBackgroundButton.addEventListener("click", async () => {
  try {
    await deleteWallpaper();
    applyWallpaper(null);
    appearanceStatus.textContent = "Imagem de fundo removida.";
  } catch (error) {
    console.error("Não foi possível remover a mídia de fundo.", error);
    appearanceStatus.textContent = "Não foi possível remover a mídia de fundo.";
  }
});

restoreWallpaper();

function loadActivities() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      throw new Error("Os dados salvos não estão no formato esperado.");
    }

    return parsed.filter((activity) =>
      activity &&
      typeof activity.id === "string" &&
      typeof activity.name === "string" &&
      typeof activity.dueDate === "string" &&
      typeof activity.category === "string" &&
      typeof activity.priority === "string" &&
      typeof activity.completed === "boolean"
    );
  } catch (error) {
    console.error("Não foi possível carregar as atividades salvas.", error);
    showFeedback("Não foi possível carregar os dados salvos neste navegador.", true);
    return [];
  }
}

function saveActivities() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar as atividades.", error);
    showFeedback("Não foi possível salvar. Verifique o espaço disponível no navegador.", true);
    return false;
  }
}

function showFeedback(message, isError = false) {
  window.clearTimeout(feedbackTimer);
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
  if (message) {
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = "";
      feedback.classList.remove("is-error");
    }, 4500);
  }
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createActivityCard(activity) {
  const card = document.createElement("article");
  card.className = `activity-card${activity.completed ? " is-completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.className = "activity-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = activity.completed;
  checkbox.setAttribute("aria-label", `Marcar "${activity.name}" como ${activity.completed ? "não concluída" : "concluída"}`);
  checkbox.addEventListener("change", () => {
    activity.completed = checkbox.checked;
    saveActivities();
    renderActivities();
  });

  const main = document.createElement("div");
  main.className = "activity-main";

  const title = document.createElement("h3");
  title.className = "activity-title";
  title.textContent = activity.name;

  const meta = document.createElement("div");
  meta.className = "activity-meta";

  const category = document.createElement("span");
  category.className = "category-tag";
  category.textContent = activity.category;

  const priority = document.createElement("span");
  priority.className = `priority-tag priority-${getPriorityClass(activity.priority)}`;
  priority.textContent = `Prioridade ${activity.priority.toLowerCase()}`;

  const dueDate = document.createElement("span");
  dueDate.className = "due-date";
  dueDate.textContent = `Entrega: ${formatDate(activity.dueDate)}`;
  if (!activity.completed && activity.dueDate < getLocalDateString()) {
    dueDate.classList.add("is-overdue");
    dueDate.setAttribute("aria-label", `Prazo vencido: ${formatDate(activity.dueDate)}`);
  }

  meta.append(category, priority, dueDate);
  main.append(title, meta);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", `Excluir atividade "${activity.name}"`);
  deleteButton.addEventListener("click", () => {
    activities = activities.filter((item) => item.id !== activity.id);
    const saved = saveActivities();
    renderActivities();
    if (saved) showFeedback("Atividade excluída.");
  });

  card.append(checkbox, main, deleteButton);
  return card;
}

function getPriorityClass(priority) {
  if (priority === "Alta") return "high";
  if (priority === "Baixa") return "low";
  return "medium";
}

function renderProgress() {
  const completed = activities.filter((activity) => activity.completed).length;
  const total = activities.length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  completedCount.textContent = String(completed);
  totalCount.textContent = String(total);
  progressTrack.setAttribute("aria-valuenow", String(percentage));
  progressFill.style.width = `${percentage}%`;

  if (total === 0) {
    progressMessage.textContent = "Adicione sua primeira atividade para começar.";
  } else if (completed === total) {
    progressMessage.textContent = "Tudo concluído. Que conquista!";
  } else {
    progressMessage.textContent = `${percentage}% do seu caminho concluído. Continue no seu ritmo.`;
  }
}

function renderActivities() {
  const selectedCategory = filterInput.value;
  const filteredActivities = activities.filter((activity) =>
    selectedCategory === "Todas" || activity.category === selectedCategory
  );

  activityList.replaceChildren();
  visibleCount.textContent = String(filteredActivities.length);

  if (filteredActivities.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = selectedCategory === "Todas" ? "✳" : "⌕";

    const title = document.createElement("h3");
    title.textContent = selectedCategory === "Todas" ? "Seu espaço está livre." : "Nenhuma atividade por aqui.";

    const message = document.createElement("p");
    message.textContent = selectedCategory === "Todas"
      ? "Adicione uma atividade para começar a organizar seus planos."
      : `Não encontramos atividades na categoria ${selectedCategory}.`;

    emptyState.append(icon, title, message);
    activityList.append(emptyState);
  } else {
    filteredActivities
      .slice()
      .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
      .forEach((activity) => activityList.append(createActivityCard(activity)));
  }

  renderProgress();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const activity = {
    id: window.crypto.randomUUID(),
    name: nameInput.value.trim(),
    dueDate: dateInput.value,
    category: categoryInput.value,
    priority: priorityInput.value,
    completed: false,
  };

  if (!activity.name) {
    nameInput.setCustomValidity("Informe um nome para a atividade.");
    nameInput.reportValidity();
    nameInput.addEventListener("input", () => nameInput.setCustomValidity(""), { once: true });
    return;
  }

  activities.unshift(activity);
  const saved = saveActivities();
  form.reset();
  priorityInput.value = "Média";
  filterInput.value = "Todas";
  renderActivities();
  nameInput.focus();
  if (saved) showFeedback("Atividade adicionada com sucesso.");
});

filterInput.addEventListener("change", renderActivities);

todayLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

renderActivities();
