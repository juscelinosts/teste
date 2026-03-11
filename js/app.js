const featureButtons = document.querySelectorAll('.feature-btn');
const featurePanels = document.querySelectorAll('.feature-panel');

const correctBtn = document.getElementById('correct-btn');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');

const themeInput = document.getElementById('essay-theme');
const titleInput = document.getElementById('essay-title');
const textInput = document.getElementById('essay-text');

const resultCard = document.getElementById('result-card');
const resultEmpty = document.getElementById('result-empty');
const scoreGrid = document.getElementById('score-grid');
const totalScoreEl = document.getElementById('total-score');
const feedbackList = document.getElementById('feedback-list');
const historyList = document.getElementById('history-list');

const STORAGE_KEY = 'enem_essays_history_v2';

const competencies = [
  'Competência 1: Domínio da norma padrão',
  'Competência 2: Compreensão do tema',
  'Competência 3: Argumentação',
  'Competência 4: Coesão textual',
  'Competência 5: Proposta de intervenção'
];

featureButtons.forEach((button) => {
  button.addEventListener('click', () => switchPanel(button.dataset.target));
});

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  titleInput.value = '';
  statusEl.textContent = 'Texto limpo. Você pode começar uma nova redação.';
});

correctBtn.addEventListener('click', () => {
  const theme = themeInput.value.trim();
  const title = titleInput.value.trim() || 'Sem título';
  const essayText = textInput.value.trim();

  if (!theme || !essayText) {
    statusEl.textContent = 'Informe o tema e o texto da redação antes de corrigir.';
    return;
  }

  statusEl.textContent = 'A IA está avaliando sua redação...';

  const result = evaluateEssay(theme, essayText);
  renderResult(result);
  saveHistory({ title, theme, text: essayText, ...result });

  statusEl.textContent = 'Correção concluída! Resultado disponível na área de Correção por IA.';
  switchPanel('correction-panel');
});

function switchPanel(targetId) {
  featureButtons.forEach((btn) => {
    const isActive = btn.dataset.target === targetId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  featurePanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === targetId);
  });

  if (targetId === 'history-panel') {
    renderHistory();
  }
}

function evaluateEssay(theme, text) {
  const words = text.split(/\s+/).filter(Boolean);
  const paragraphs = text.split(/\n+/).filter((paragraph) => paragraph.trim().length > 0);

  const hasIntervention = /intervenção|proposta|governo|escola|sociedade|ação|agente/i.test(text);
  const hasConnectors = /(portanto|além disso|contudo|entretanto|assim|desse modo|logo|todavia)/i.test(text);
  const themeKeywords = theme.split(' ').filter((word) => word.length > 3).slice(0, 4);
  const mentionsTheme = themeKeywords.length
    ? new RegExp(themeKeywords.join('|'), 'i').test(text)
    : true;

  const c1 = clamp(scoreBase(words.length, 140, 200) - spellingPenalty(text), 0, 200);
  const c2 = clamp(scoreBase(words.length, 160, 180) + (mentionsTheme ? 20 : -20), 0, 200);
  const c3 = clamp(scoreBase(paragraphs.length, 4, 180) + (words.length > 220 ? 20 : 0), 0, 200);
  const c4 = clamp(scoreBase(hasConnectors ? 1 : 0, 1, 190) + (paragraphs.length >= 3 ? 10 : -25), 0, 200);
  const c5 = clamp(scoreBase(hasIntervention ? 1 : 0, 1, 200), 0, 200);

  const scores = [c1, c2, c3, c4, c5];

  const feedback = [
    c1 >= 160 ? 'Boa norma padrão. Continue revisando acentuação e pontuação.' : 'Reforce gramática e ortografia para elevar a Competência 1.',
    c2 >= 160 ? 'Tema atendido com boa contextualização.' : 'Aprofunde a tese e conecte os argumentos ao tema central.',
    c3 >= 160 ? 'Boa organização argumentativa entre os parágrafos.' : 'Melhore progressão de ideias e repertório para fortalecer argumentos.',
    c4 >= 160 ? 'Coesão eficiente com bons conectivos.' : 'Use mais conectores para unir melhor períodos e parágrafos.',
    c5 >= 160 ? 'Proposta de intervenção adequada ao ENEM.' : 'Detalhe melhor agente, ação, meio e finalidade na intervenção.'
  ];

  return { scores, total: scores.reduce((sum, value) => sum + value, 0), feedback };
}

function scoreBase(value, target, max) {
  const ratio = Math.min(value / target, 1);
  return Math.round(ratio * max);
}

function spellingPenalty(text) {
  const mistakes = ['menas', 'concerteza', 'agnt', 'pq'];
  let penalty = 0;
  mistakes.forEach((mistake) => {
    if (text.toLowerCase().includes(mistake)) penalty += 20;
  });
  return penalty;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function renderResult(result) {
  resultCard.hidden = false;
  resultEmpty.hidden = true;
  scoreGrid.innerHTML = '';

  result.scores.forEach((score, index) => {
    const item = document.createElement('div');
    item.className = 'score-item';
    item.innerHTML = `
      <div>${competencies[index]}</div>
      <strong>${score}</strong>
      <span>/200</span>
    `;
    scoreGrid.appendChild(item);
  });

  totalScoreEl.textContent = String(result.total);
  feedbackList.innerHTML = '';
  result.feedback.forEach((message) => {
    const li = document.createElement('li');
    li.textContent = message;
    feedbackList.appendChild(li);
  });
}

function saveHistory(essay) {
  const history = getHistory();
  history.unshift({
    id: crypto.randomUUID(),
    ...essay,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 40)));
}

function getHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = '<p class="muted">Nenhuma redação corrigida até agora.</p>';
    return;
  }

  history.forEach((essay) => {
    const item = document.createElement('article');
    item.className = 'history-item';

    const percentage = Math.round((essay.total / 1000) * 100);
    item.innerHTML = `
      <h3>${essay.title}</h3>
      <p><strong>Tema:</strong> ${essay.theme}</p>
      <p><strong>Data:</strong> ${new Date(essay.createdAt).toLocaleString('pt-BR')}</p>
      <p><strong>Nota:</strong> ${essay.total}/1000</p>
      <div class="bar-wrap"><div class="bar" style="width:${percentage}%"></div></div>
    `;

    historyList.appendChild(item);
  });
}

renderHistory();
