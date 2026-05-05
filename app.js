const quizSelect = document.querySelector("#quizSelect");
const bankStatus = document.querySelector("#bankStatus");
const selectedMetric = document.querySelector("#selectedMetric");
const quizSummary = document.querySelector("#quizSummary");
const setupPanel = document.querySelector("#setupPanel");
const quizPanel = document.querySelector("#quizPanel");
const resultsPanel = document.querySelector("#resultsPanel");
const startButton = document.querySelector("#startButton");
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const newAttemptButton = document.querySelector("#newAttemptButton");
const quizCourse = document.querySelector("#quizCourse");
const quizTitle = document.querySelector("#quizTitle");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const difficultyBadge = document.querySelector("#difficultyBadge");
const questionText = document.querySelector("#questionText");
const optionsList = document.querySelector("#optionsList");
const scoreTitle = document.querySelector("#scoreTitle");
const scoreSubtext = document.querySelector("#scoreSubtext");
const reviewList = document.querySelector("#reviewList");

const state = {
  catalog: [],
  loadedQuizzes: new Map(),
  activeQuiz: null,
  activeQuestions: [],
  currentIndex: 0,
  answers: new Map(),
};

const letters = ["A", "B", "C", "D"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function targetByDifficulty(total) {
  const hard = Math.floor(total * 0.2);
  const easy = Math.ceil(total * 0.5);
  const medium = Math.max(0, total - easy - hard);
  return { Easy: easy, Medium: medium, Hard: hard };
}

function selectQuestions(quiz) {
  const target = Math.min(quiz.targetQuestionCount || Math.round(quiz.questions.length / 2), quiz.questions.length);
  const desired = targetByDifficulty(target);
  const questionOrder = new Map(quiz.questions.map((question, index) => [question.id, index]));
  const selected = [];
  const selectedIds = new Set();

  for (const difficulty of ["Easy", "Medium", "Hard"]) {
    const pool = shuffle(quiz.questions.filter((q) => q.difficulty === difficulty));
    for (const question of pool.slice(0, desired[difficulty])) {
      selected.push(question);
      selectedIds.add(question.id);
    }
  }

  if (selected.length < target) {
    const remaining = shuffle(quiz.questions.filter((q) => !selectedIds.has(q.id)));
    selected.push(...remaining.slice(0, target - selected.length));
  }

  return selected.sort((a, b) => questionOrder.get(a.id) - questionOrder.get(b.id));
}

async function loadCatalog() {
  const response = await fetch("data/quizzes.json");
  if (!response.ok) throw new Error("Could not load quiz catalog.");
  const catalog = await response.json();
  state.catalog = catalog.quizzes || [];
  quizSelect.innerHTML = state.catalog
    .map((quiz) => `<option value="${escapeHtml(quiz.id)}">${escapeHtml(quiz.title)}</option>`)
    .join("");
  bankStatus.textContent = `${state.catalog.length} bank${state.catalog.length === 1 ? "" : "s"} available`;
  await selectQuiz(state.catalog[0]?.id);
}

async function loadQuiz(id) {
  if (state.loadedQuizzes.has(id)) return state.loadedQuizzes.get(id);
  const entry = state.catalog.find((quiz) => quiz.id === id);
  if (!entry) throw new Error("Quiz not found.");
  const response = await fetch(entry.dataUrl);
  if (!response.ok) throw new Error(`Could not load ${entry.title}.`);
  const quiz = await response.json();
  state.loadedQuizzes.set(id, quiz);
  return quiz;
}

async function selectQuiz(id) {
  const quiz = await loadQuiz(id);
  state.activeQuiz = quiz;
  selectedMetric.textContent = `${quiz.questions.length} bank questions`;
  const target = quiz.targetQuestionCount || Math.round(quiz.questions.length / 2);
  const mix = targetByDifficulty(target);
  quizSummary.innerHTML = [
    ["Quiz Length", `${target}`, "random questions"],
    ["Bank Size", `${quiz.questions.length}`, "available questions"],
    ["Mix", `${mix.Easy}/${mix.Medium}/${mix.Hard}`, "easy / medium / hard"],
    ["Mode", "Review", "answers shown at end"],
  ]
    .map(
      ([label, value, detail]) => `
        <div class="summary-tile">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)} · ${escapeHtml(detail)}</span>
        </div>
      `,
    )
    .join("");
}

function startQuiz() {
  state.activeQuestions = selectQuestions(state.activeQuiz);
  state.currentIndex = 0;
  state.answers = new Map();
  setupPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  quizPanel.classList.remove("hidden");
  quizCourse.textContent = state.activeQuiz.course;
  quizTitle.textContent = state.activeQuiz.title;
  renderQuestion();
}

function renderQuestion() {
  const question = state.activeQuestions[state.currentIndex];
  const selected = state.answers.get(question.id);
  const total = state.activeQuestions.length;
  const position = state.currentIndex + 1;

  progressText.textContent = `${position} / ${total}`;
  progressBar.style.width = `${(position / total) * 100}%`;
  difficultyBadge.textContent = question.difficulty;
  questionText.textContent = question.question;

  optionsList.innerHTML = letters
    .map(
      (letter) => `
        <label class="option-card">
          <input
            type="radio"
            name="answer"
            value="${letter}"
            ${selected === letter ? "checked" : ""}
          />
          <span>
            <span class="option-letter">${letter}</span>
            ${escapeHtml(question.options[letter])}
          </span>
        </label>
      `,
    )
    .join("");

  optionsList.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      state.answers.set(question.id, input.value);
      updateNextButton();
    });
  });

  backButton.disabled = state.currentIndex === 0;
  updateNextButton();
}

function updateNextButton() {
  nextButton.disabled = false;
  nextButton.textContent = state.currentIndex === state.activeQuestions.length - 1 ? "Finish" : "Next";
}

function moveBack() {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
  }
}

function moveNext() {
  if (state.currentIndex < state.activeQuestions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
    return;
  }
  showResults();
}

function showResults() {
  const total = state.activeQuestions.length;
  const correctCount = state.activeQuestions.filter((question) => state.answers.get(question.id) === question.correctOption).length;
  const percent = Math.round((correctCount / total) * 100);
  quizPanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");
  scoreTitle.textContent = `${correctCount} / ${total} (${percent}%)`;
  scoreSubtext.textContent = state.activeQuiz.title;

  reviewList.innerHTML = state.activeQuestions.map(renderReviewCard).join("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderReviewCard(question, index) {
  const selected = state.answers.get(question.id);
  const wasSkipped = !selected;
  const isCorrect = selected === question.correctOption;
  const resultClass = isCorrect ? "correct" : wasSkipped ? "skipped" : "incorrect";
  const resultLabel = isCorrect ? "Correct" : wasSkipped ? "Skipped" : "Incorrect";

  return `
    <article class="review-card ${resultClass}">
      <div class="review-header">
        <div>
          <h3>${index + 1}. ${escapeHtml(question.question)}</h3>
          <div class="source-line">${escapeHtml(question.source.simanSeif)} · ${escapeHtml(question.source.pageNumbers)} · ${escapeHtml(question.difficulty)}</div>
        </div>
        <span class="result-badge ${resultClass}">${resultLabel}</span>
      </div>
      <div class="review-body">
        <div class="answer-grid">
          ${letters
            .map((letter) => {
              const isRight = letter === question.correctOption;
              const explanation = isRight ? question.explanations.correct : question.explanations[letter];
              const classes = [
                "answer-pill",
                isRight ? "is-correct" : "",
                letter === selected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `
                <div class="${classes}">
                  <strong>${letter}${letter === selected ? " · selected" : ""}${letter === question.correctOption ? " · correct" : ""}</strong>
                  <div class="answer-text">${escapeHtml(question.options[letter])}</div>
                  <div class="answer-explanation">
                    <h4>${isRight ? "Why this is correct" : "Why this is not correct"}</h4>
                    <p>${escapeHtml(explanation)}</p>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </article>
  `;
}

quizSelect.addEventListener("change", () => {
  selectQuiz(quizSelect.value).catch(showLoadError);
});
startButton.addEventListener("click", startQuiz);
backButton.addEventListener("click", moveBack);
nextButton.addEventListener("click", moveNext);
newAttemptButton.addEventListener("click", startQuiz);

function showLoadError(error) {
  bankStatus.textContent = "Could not load";
  quizSummary.innerHTML = `<div class="summary-tile"><strong>Error</strong><span>${escapeHtml(error.message)}</span></div>`;
  startButton.disabled = true;
}

loadCatalog().catch(showLoadError);
