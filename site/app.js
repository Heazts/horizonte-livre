const $ = (selector) => document.querySelector(selector);
const catalogNode = $('#resultados');
const countNode = $('#resultado-contagem');
const form = $('#filtros');
const search = $('#busca');
const collectionFilter = $('#colecao');
const typeFilter = $('#tipo');
const yearFilter = $('#ano');
const favoritesFilter = $('#apenas-favoritos');
const pagination = $('#paginacao');
const previousButton = $('#anterior');
const nextButton = $('#proxima');
const taskForm = $('#tarefa-form');
const taskInput = $('#tarefa');
const tasksNode = $('#tarefas');
const taskStatus = $('#tarefas-status');
const storageKey = 'horizonte-livre-v1';
const pageSize = 12;
let catalog = { colecoes: [], recursos: [] };
let page = 1;
let storageAvailable = true;

function readState() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {
      favorites: Array.isArray(data.favorites) ? data.favorites.filter((item) => typeof item === 'string') : [],
      tasks: Array.isArray(data.tasks) ? data.tasks.filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean').slice(0, 100) : []
    };
  } catch {
    storageAvailable = false;
    return { favorites: [], tasks: [] };
  }
}
let state = readState();

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    taskStatus.textContent = 'Não foi possível salvar neste navegador. Seus dados ficam disponíveis apenas enquanto esta página estiver aberta.';
    return false;
  }
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
function fillSelect(select, entries) {
  entries.forEach(([value, label]) => {
    const option = node('option', '', label);
    option.value = value;
    select.append(option);
  });
}
function bytes(value) {
  if (!Number.isFinite(value) || value < 0) return 'Tamanho não informado';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1024 / 1024) + ' MB';
}
function renderResults() {
  const query = normalize(search.value.trim());
  const collectionNames = new Map(catalog.colecoes.map((item) => [item.id, item.titulo]));
  const filtered = catalog.recursos.filter((item) => {
    const title = collectionNames.get(item.colecaoId) || '';
    const text = normalize([item.titulo, title, item.tipo, item.ano].join(' '));
    return (!query || text.includes(query)) &&
      (!collectionFilter.value || item.colecaoId === collectionFilter.value) &&
      (!typeFilter.value || item.tipo === typeFilter.value) &&
      (!yearFilter.value || String(item.ano) === yearFilter.value) &&
      (!favoritesFilter.checked || state.favorites.includes(item.id));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.max(1, Math.min(page, totalPages));
  catalogNode.replaceChildren();
  if (!filtered.length) {
    catalogNode.append(node('p', 'empty-state', 'Nenhum material encontrado. Experimente outros termos ou limpe os filtros.'));
  }
  filtered.slice((page - 1) * pageSize, page * pageSize).forEach((item) => {
    const article = node('article', 'resource-row');
    const content = node('div');
    const title = node('h3', 'resource-title', item.titulo);
    const meta = node('p', 'resource-meta', [
      collectionNames.get(item.colecaoId) || 'Coleção',
      item.tipo,
      item.ano ? item.ano + ' (sugerido)' : 'Ano não identificado',
      item.extensao,
      bytes(item.tamanhoBytes)
    ].join(' · '));
    const status = item.status === 'autorizado' ? 'Disponível para baixar' :
      item.status === 'link_para_fonte' ? 'Disponível na fonte' :
      item.status === 'removido' ? 'Indisponível' : 'Em revisão de origem e direitos';
    content.append(title, meta, node('p', 'resource-status', status));
    const url = safeUrl(item.url);
    if (url && (item.status === 'autorizado' || item.status === 'link_para_fonte')) {
      const link = node('a', 'result-link', item.status === 'autorizado' ? 'Acessar material autorizado' : 'Acessar fonte original');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(node('span', 'sr-only', ' (abre em nova aba)'));
      content.append(link);
    }
    const favorite = node('button', 'favorite-button', state.favorites.includes(item.id) ? '★' : '☆');
    favorite.type = 'button';
    favorite.setAttribute('aria-pressed', String(state.favorites.includes(item.id)));
    favorite.setAttribute('aria-label', (state.favorites.includes(item.id) ? 'Remover dos favoritos: ' : 'Adicionar aos favoritos: ') + item.titulo);
    favorite.addEventListener('click', () => {
      state.favorites = state.favorites.includes(item.id) ? state.favorites.filter((id) => id !== item.id) : [...state.favorites, item.id];
      saveState();
      renderResults();
      const focusTarget = [...catalogNode.querySelectorAll('.favorite-button')].find((button) => button.dataset.id === item.id);
      focusTarget?.focus();
    });
    favorite.dataset.id = item.id;
    article.append(content, favorite);
    catalogNode.append(article);
  });
  countNode.textContent = filtered.length + (filtered.length === 1 ? ' material encontrado' : ' materiais encontrados');
  pagination.hidden = filtered.length <= pageSize;
  $('#pagina-atual').textContent = 'Página ' + page + ' de ' + totalPages;
  previousButton.disabled = page === 1;
  nextButton.disabled = page === totalPages;
}
async function loadCatalog() {
  try {
    const response = await fetch('catalogo.json');
    if (!response.ok) throw new Error('Catálogo indisponível');
    const data = await response.json();
    if (!Array.isArray(data.colecoes) || !Array.isArray(data.recursos)) throw new Error('Catálogo inválido');
    catalog = data;
    $('#total-recursos').textContent = String(data.recursos.length);
    $('#total-colecoes').textContent = data.colecoes.length + ' coleções';
    fillSelect(collectionFilter, data.colecoes.map((item) => [item.id, item.titulo]));
    fillSelect(typeFilter, [...new Set(data.recursos.map((item) => item.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((item) => [item, item]));
    fillSelect(yearFilter, [...new Set(data.recursos.map((item) => item.ano).filter(Number.isInteger))].sort((a, b) => b - a).map((year) => [String(year), String(year)]));
    renderResults();
  } catch {
    countNode.textContent = 'Não foi possível carregar o catálogo. Os links para fontes oficiais continuam disponíveis.';
  }
}
for (const filter of [search, collectionFilter, typeFilter, yearFilter, favoritesFilter]) {
  filter.addEventListener(filter === search ? 'input' : 'change', () => { page = 1; renderResults(); });
}
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('reset', () => requestAnimationFrame(() => { page = 1; renderResults(); }));
previousButton.addEventListener('click', () => { page -= 1; renderResults(); });
nextButton.addEventListener('click', () => { page += 1; renderResults(); });

function renderTasks() {
  tasksNode.replaceChildren();
  if (!state.tasks.length) {
    tasksNode.append(node('li', '', 'Nenhuma tarefa adicionada ainda.'));
    return;
  }
  state.tasks.forEach((task) => {
    const item = node('li');
    const checkbox = node('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'task-' + task.id;
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; saveState(); renderTasks(); });
    const label = node('label', '', task.text);
    label.htmlFor = checkbox.id;
    const remove = node('button', '', 'Remover');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remover tarefa: ' + task.text);
    remove.addEventListener('click', () => { state.tasks = state.tasks.filter((value) => value.id !== task.id); saveState(); renderTasks(); });
    item.append(checkbox, label, remove);
    tasksNode.append(item);
  });
}
taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) { taskStatus.textContent = 'Escreva uma tarefa antes de adicionar.'; return; }
  if (state.tasks.length >= 100) { taskStatus.textContent = 'Sua lista atingiu o limite de 100 tarefas.'; return; }
  state.tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9), text, done: false });
  if (saveState()) taskStatus.textContent = 'Tarefa adicionada.';
  taskInput.value = '';
  renderTasks();
});
$('#apagar-dados').addEventListener('click', () => {
  if (!confirm('Apagar suas tarefas e favoritos salvos neste navegador?')) return;
  state = { favorites: [], tasks: [] };
  try { localStorage.removeItem(storageKey); } catch { storageAvailable = false; }
  taskStatus.textContent = 'Tarefas e favoritos foram apagados deste navegador.';
  renderTasks();
  renderResults();
});

const minutes = $('#minutos');
const clock = $('#relogio');
const timerStatus = $('#timer-status');
const start = $('#iniciar');
const pause = $('#pausar');
let remaining = 25 * 60 * 1000;
let deadline = null;
let ticker = null;
function paintTime() {
  const seconds = Math.ceil(remaining / 1000);
  clock.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
function stopTimer() {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
  deadline = null;
  start.disabled = false;
  pause.disabled = true;
  minutes.disabled = false;
}
function updateTimer() {
  if (deadline === null) return;
  remaining = Math.max(0, deadline - Date.now());
  paintTime();
  if (remaining === 0) { stopTimer(); timerStatus.textContent = 'Tempo concluído. Faça uma pausa se puder.'; }
}
minutes.addEventListener('change', () => {
  const value = Number(minutes.value);
  if (!Number.isInteger(value) || value < 1 || value > 180) {
    minutes.value = '25';
    timerStatus.textContent = 'Escolha um número inteiro entre 1 e 180 minutos.';
  } else timerStatus.textContent = '';
  remaining = Number(minutes.value) * 60 * 1000;
  paintTime();
});
start.addEventListener('click', () => {
  if (!minutes.checkValidity()) { minutes.reportValidity(); return; }
  if (remaining <= 0) remaining = Number(minutes.value) * 60 * 1000;
  deadline = Date.now() + remaining;
  start.disabled = true;
  pause.disabled = false;
  minutes.disabled = true;
  timerStatus.textContent = 'Contagem iniciada.';
  ticker = setInterval(updateTimer, 250);
});
pause.addEventListener('click', () => { updateTimer(); stopTimer(); timerStatus.textContent = 'Contagem pausada.'; });
$('#reiniciar').addEventListener('click', () => { stopTimer(); remaining = Number(minutes.value) * 60 * 1000; paintTime(); timerStatus.textContent = 'Contagem reiniciada.'; });
document.addEventListener('visibilitychange', updateTimer);

renderTasks();
if (!storageAvailable) taskStatus.textContent = 'O armazenamento deste navegador não está disponível. Seus dados podem não ser salvos.';
loadCatalog();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
