const bankStatus = document.querySelector("#bankStatus");
const quizList = document.querySelector("#quizList");
const setupPanel = document.querySelector("#setupPanel");
const quizPanel = document.querySelector("#quizPanel");
const resultsPanel = document.querySelector("#resultsPanel");
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
  revealed: new Set(),
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

function difficultyCounts(questions) {
  return questions.reduce(
    (counts, question) => {
      counts[question.difficulty] = (counts[question.difficulty] || 0) + 1;
      return counts;
    },
    { Easy: 0, Medium: 0, Hard: 0 },
  );
}

function formatMix(counts) {
  return `${counts.Easy || 0} easy / ${counts.Medium || 0} medium / ${counts.Hard || 0} hard`;
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
  await Promise.all(state.catalog.map((quiz) => loadQuiz(quiz.id)));
  bankStatus.textContent = `${state.catalog.length} quiz${state.catalog.length === 1 ? "" : "zes"} available`;
  renderQuizList();
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

function renderQuizList() {
  quizList.innerHTML = state.catalog
    .map((entry) => {
      const quiz = state.loadedQuizzes.get(entry.id);
      const target = Math.min(quiz.targetQuestionCount || Math.round(quiz.questions.length / 2), quiz.questions.length);
      const bankMix = difficultyCounts(quiz.questions);
      const liveMix = targetByDifficulty(target);
      return `
        <article class="quiz-choice">
          <div>
            <h3>${escapeHtml(quiz.title)}</h3>
            <p>${escapeHtml(quiz.course)}</p>
            <div class="quiz-details">
              <span>${quiz.questions.length} questions in bank</span>
              <span>${target} questions per attempt</span>
              <span>Bank mix: ${escapeHtml(formatMix(bankMix))}</span>
              <span>Attempt mix: ${escapeHtml(formatMix(liveMix))}</span>
            </div>
          </div>
          <button class="primary-action" type="button" data-quiz-id="${escapeHtml(quiz.id)}">Start</button>
        </article>
      `;
    })
    .join("");

  quizList.querySelectorAll("button[data-quiz-id]").forEach((button) => {
    button.addEventListener("click", () => startQuiz(button.dataset.quizId));
  });
}

function startQuiz(id) {
  state.activeQuiz = state.loadedQuizzes.get(id);
  state.activeQuestions = selectQuestions(state.activeQuiz);
  state.currentIndex = 0;
  state.answers = new Map();
  state.revealed = new Set();
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
  const isRevealed = state.revealed.has(question.id);
  const total = state.activeQuestions.length;
  const position = state.currentIndex + 1;

  progressText.textContent = `${position} / ${total}`;
  progressBar.style.width = `${(position / total) * 100}%`;
  difficultyBadge.textContent = question.difficulty;
  questionText.textContent = question.question;
  optionsList.innerHTML = renderOptions(question, selected, isRevealed);

  if (!isRevealed) {
    optionsList.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        state.answers.set(question.id, input.value);
        updateNextButton();
      });
    });
  }

  backButton.disabled = state.currentIndex === 0;
  updateNextButton();
}

function renderOptions(question, selected, isRevealed) {
  const feedback = isRevealed ? renderFeedbackSummary(question, selected) : "";
  return `
    ${letters
      .map((letter) => renderOption(question, letter, selected, isRevealed))
      .join("")}
    ${feedback}
  `;
}

function renderOption(question, letter, selected, isRevealed) {
  const isRight = letter === question.correctOption;
  const isSelected = letter === selected;
  const explanation = isRight ? question.explanations.correct : question.explanations[letter];
  const classes = [
    "option-card",
    isRevealed ? "is-revealed" : "",
    isRevealed && isRight ? "is-correct" : "",
    isRevealed && isSelected && !isRight ? "is-incorrect" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <label class="${classes}">
      <input
        type="radio"
        name="answer"
        value="${letter}"
        ${selected === letter ? "checked" : ""}
        ${isRevealed ? "disabled" : ""}
      />
      <span>
        <span class="option-heading">
          <span class="option-letter">${letter}</span>
          ${isRevealed && isRight ? '<span class="answer-tag correct-tag">Correct</span>' : ""}
          ${isRevealed && isSelected && !isRight ? '<span class="answer-tag selected-tag">Selected</span>' : ""}
        </span>
        <span class="answer-text">${escapeHtml(question.options[letter])}</span>
        ${
          isRevealed
            ? `<span class="inline-explanation">
                <strong>${isRight ? "Why this is correct" : "Why this is not correct"}</strong>
                ${escapeHtml(explanation)}
              </span>`
            : ""
        }
      </span>
    </label>
  `;
}

function renderFeedbackSummary(question, selected) {
  const isSkipped = !selected;
  const isCorrect = selected === question.correctOption;
  const resultClass = isCorrect ? "correct" : isSkipped ? "skipped" : "incorrect";
  const resultText = isCorrect ? "Correct" : isSkipped ? "Skipped" : "Incorrect";
  return `
    <div class="question-feedback ${resultClass}">
      <strong>${resultText}</strong>
      <span>Correct answer: ${question.correctOption} · Source: ${escapeHtml(question.source.simanSeif)}</span>
    </div>
  `;
}

function updateNextButton() {
  const question = state.activeQuestions[state.currentIndex];
  const isRevealed = state.revealed.has(question.id);
  const isLast = state.currentIndex === state.activeQuestions.length - 1;

  nextButton.disabled = false;
  if (isRevealed) {
    nextButton.textContent = isLast ? "Finish" : "Next Question";
    return;
  }

  nextButton.textContent = state.answers.has(question.id) ? "Check Answer" : "Skip & See Answer";
}

function moveBack() {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
  }
}

function moveNext() {
  const question = state.activeQuestions[state.currentIndex];
  const isRevealed = state.revealed.has(question.id);

  if (!isRevealed) {
    state.revealed.add(question.id);
    renderQuestion();
    return;
  }

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
  const skippedCount = state.activeQuestions.filter((question) => !state.answers.has(question.id)).length;
  const percent = Math.round((correctCount / total) * 100);

  quizPanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");
  scoreTitle.textContent = `${correctCount} / ${total} (${percent}%)`;
  scoreSubtext.textContent = `${state.activeQuiz.title} · ${skippedCount} skipped`;
  reviewList.innerHTML = `
    <article class="review-card">
      <div class="review-header">
        <div>
          <h3>Attempt Complete</h3>
          <div class="source-line">You reviewed each answer as you went through the quiz.</div>
        </div>
      </div>
    </article>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLoadError(error) {
  bankStatus.textContent = "Could not load";
  quizList.innerHTML = `<div class="summary-tile"><strong>Error</strong><span>${escapeHtml(error.message)}</span></div>`;
}

backButton.addEventListener("click", moveBack);
nextButton.addEventListener("click", moveNext);
newAttemptButton.addEventListener("click", () => startQuiz(state.activeQuiz.id));

loadCatalog().catch(showLoadError);
