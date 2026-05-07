const bankStatus = document.querySelector("#bankStatus");
const courseList = document.querySelector("#courseList");
const courseQuizPanel = document.querySelector("#courseQuizPanel");
const selectedCourseTitle = document.querySelector("#selectedCourseTitle");
const selectedCourseMeta = document.querySelector("#selectedCourseMeta");
const backToCoursesButton = document.querySelector("#backToCoursesButton");
const quizList = document.querySelector("#quizList");
const setupPanel = document.querySelector("#setupPanel");
const quizPanel = document.querySelector("#quizPanel");
const resultsPanel = document.querySelector("#resultsPanel");
const homeButton = document.querySelector("#homeButton");
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
  courses: [],
  loadedQuizzes: new Map(),
  activeCourseId: null,
  activeQuiz: null,
  activeQuestions: [],
  currentIndex: 0,
  answers: new Map(),
  revealed: new Set(),
  reviewMode: "immediate",
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
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeDifficulty(question) {
  return question.difficulty || "Other";
}

function buildDifficultyTargets(groups, targetTotal) {
  const total = Object.values(groups).reduce((sum, questions) => sum + questions.length, 0);
  const targets = Object.entries(groups).map(([difficulty, questions]) => {
    const raw = (questions.length / total) * targetTotal;
    return {
      difficulty,
      count: questions.length,
      target: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    };
  });

  let assigned = targets.reduce((sum, item) => sum + item.target, 0);
  targets
    .filter((item) => item.count > item.target)
    .sort((a, b) => b.remainder - a.remainder || b.count - a.count)
    .forEach((item) => {
      if (assigned < targetTotal) {
        item.target += 1;
        assigned += 1;
      }
    });

  while (assigned < targetTotal) {
    const next = targets.find((item) => item.count > item.target);
    if (!next) break;
    next.target += 1;
    assigned += 1;
  }

  return targets;
}

function prepareAttemptQuestion(question, sourceIndex) {
  const optionItems = letters.map((letter) => ({
    originalLetter: letter,
    text: question.options[letter],
    explanation: question.explanations[letter],
    isCorrect: letter === question.correctOption,
  }));
  const randomizedOptions = shuffle(optionItems);
  const options = {};
  const explanations = { correct: question.explanations.correct };
  let correctOption = question.correctOption;

  randomizedOptions.forEach((option, index) => {
    const letter = letters[index];
    options[letter] = option.text;
    explanations[letter] = option.isCorrect ? "This is the correct option; see the main explanation above." : option.explanation;
    if (option.isCorrect) correctOption = letter;
  });

  return {
    ...question,
    attemptId: `${question.id}-attempt-${sourceIndex}`,
    sourceIndex,
    options,
    explanations,
    correctOption,
  };
}

function selectQuestions(quiz) {
  const allQuestions = quiz.questions.map((question, index) => ({ question, index }));
  const targetTotal = Math.max(1, Math.ceil(allQuestions.length / 2));
  const groups = allQuestions.reduce((acc, item) => {
    const difficulty = normalizeDifficulty(item.question);
    acc[difficulty] ||= [];
    acc[difficulty].push(item);
    return acc;
  }, {});
  const targets = buildDifficultyTargets(groups, targetTotal);
  const selected = [];

  targets.forEach(({ difficulty, target }) => {
    selected.push(...shuffle(groups[difficulty]).slice(0, target));
  });

  if (selected.length < targetTotal) {
    const selectedIds = new Set(selected.map((item) => item.question.id));
    const remaining = shuffle(allQuestions.filter((item) => !selectedIds.has(item.question.id)));
    selected.push(...remaining.slice(0, targetTotal - selected.length));
  }

  if (selected.length > targetTotal) {
    selected.length = targetTotal;
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map(({ question, index }) => prepareAttemptQuestion(question, index));
}

async function loadCatalog() {
  const response = await fetch("data/quizzes.json");
  if (!response.ok) throw new Error("Could not load quiz catalog.");
  const catalog = await response.json();
  state.courses = catalog.courses || [];
  state.catalog = catalog.quizzes || [];
  bankStatus.textContent = `${state.catalog.length} quizzes available`;
  renderCourseList();
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

function renderCourseList() {
  courseList.innerHTML = state.courses
    .map((course) => {
      const quizCount = state.catalog.filter((quiz) => quiz.courseId === course.id).length;
      return `
        <button class="course-card ${state.activeCourseId === course.id ? "is-active" : ""}" type="button" data-course-id="${escapeHtml(course.id)}">
          <span>${escapeHtml(course.title)}</span>
          <small>${quizCount} quiz${quizCount === 1 ? "" : "zes"}</small>
        </button>
      `;
    })
    .join("");

  courseList.querySelectorAll("button[data-course-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCourseId = button.dataset.courseId;
      renderCourseList();
      renderQuizList();
    });
  });
}

function renderQuizList() {
  const course = state.courses.find((item) => item.id === state.activeCourseId);
  const quizzes = state.catalog.filter((entry) => entry.courseId === state.activeCourseId);

  courseQuizPanel.classList.remove("hidden");
  selectedCourseTitle.textContent = course?.title || "Course";
  selectedCourseMeta.textContent = `${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} available`;
  quizList.innerHTML = quizzes
    .map((entry) => `
      <article class="quiz-choice">
        <div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(entry.courseTitle || course?.title || "")}</p>
        </div>
        <button class="primary-action" type="button" data-quiz-id="${escapeHtml(entry.id)}">Start</button>
      </article>
    `)
    .join("");

  quizList.querySelectorAll("button[data-quiz-id]").forEach((button) => {
    button.addEventListener("click", () => startQuiz(button.dataset.quizId));
  });
}

function showCoursesOnly() {
  state.activeCourseId = null;
  courseQuizPanel.classList.add("hidden");
  renderCourseList();
}

async function startQuiz(id) {
  state.activeQuiz = await loadQuiz(id);
  state.activeQuestions = selectQuestions(state.activeQuiz);
  state.currentIndex = 0;
  state.answers = new Map();
  state.revealed = new Set();
  state.reviewMode = document.querySelector('input[name="reviewMode"]:checked')?.value || "immediate";
  setupPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  quizPanel.classList.remove("hidden");
  homeButton.classList.remove("hidden");
  quizCourse.textContent = state.activeQuiz.course;
  quizTitle.textContent = state.activeQuiz.title;
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  setupPanel.classList.remove("hidden");
  quizPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  homeButton.classList.add("hidden");
  state.activeCourseId = null;
  state.activeQuiz = null;
  state.activeQuestions = [];
  state.currentIndex = 0;
  state.answers = new Map();
  state.revealed = new Set();
  courseQuizPanel.classList.add("hidden");
  renderCourseList();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  const question = state.activeQuestions[state.currentIndex];
  const selected = state.answers.get(question.attemptId);
  const isRevealed = state.reviewMode === "immediate" && state.revealed.has(question.attemptId);
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
        state.answers.set(question.attemptId, input.value);
        updateNextButton();
      });
    });
  }

  updatePreviousButton();
  updateNextButton();
}

function renderOptions(question, selected, isRevealed) {
  const feedback = isRevealed ? renderFeedbackSummary(question, selected) : "";
  return `
    ${letters.map((letter) => renderOption(question, letter, selected, isRevealed)).join("")}
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
  const isRevealed = state.reviewMode === "immediate" && state.revealed.has(question.attemptId);
  const isLast = state.currentIndex === state.activeQuestions.length - 1;

  nextButton.disabled = false;
  if (state.reviewMode === "end") {
    nextButton.textContent = isLast ? "Finish Quiz" : "Next Question";
    return;
  }

  if (isRevealed) {
    nextButton.textContent = isLast ? "Finish" : "Next Question";
    return;
  }

  nextButton.textContent = state.answers.has(question.attemptId) ? "Check Answer" : "Skip & See Answer";
}

function updatePreviousButton() {
  const isFirst = state.currentIndex === 0;
  backButton.disabled = isFirst;
  backButton.textContent = "Previous Question";
}

function movePrevious() {
  if (state.currentIndex === 0) return;
  state.currentIndex -= 1;
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function moveNext() {
  const question = state.activeQuestions[state.currentIndex];
  const isRevealed = state.revealed.has(question.attemptId);

  if (state.reviewMode === "immediate" && !isRevealed) {
    state.revealed.add(question.attemptId);
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

function getResult(question) {
  const selected = state.answers.get(question.attemptId);
  const isSkipped = !selected;
  const isCorrect = selected === question.correctOption;
  return {
    selected,
    isSkipped,
    isCorrect,
    resultClass: isCorrect ? "correct" : isSkipped ? "skipped" : "incorrect",
    resultText: isCorrect ? "Correct" : isSkipped ? "Skipped" : "Incorrect",
  };
}

function renderReviewOption(question, letter, selected) {
  const isRight = letter === question.correctOption;
  const isSelected = letter === selected;
  const explanation = isRight ? question.explanations.correct : question.explanations[letter];
  const classes = [
    "answer-pill",
    isRight ? "is-correct" : "",
    isSelected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${classes}">
      <strong>${letter}${isRight ? " · Correct" : ""}${isSelected && !isRight ? " · Selected" : ""}</strong>
      <span class="answer-text">${escapeHtml(question.options[letter])}</span>
      <span class="inline-explanation">
        <strong>${isRight ? "Why this is correct" : "Why this is not correct"}</strong>
        ${escapeHtml(explanation)}
      </span>
    </div>
  `;
}

function renderReviewCard(question, index) {
  const result = getResult(question);
  return `
    <article class="review-card ${result.resultClass}">
      <div class="review-header">
        <div>
          <h3>${index + 1}. ${escapeHtml(question.question)}</h3>
          <div class="source-line">Source: ${escapeHtml(question.source.simanSeif)}</div>
        </div>
        <span class="result-badge ${result.resultClass}">${result.resultText}</span>
      </div>
      <div class="review-body">
        <div class="answer-grid">
          ${letters.map((letter) => renderReviewOption(question, letter, result.selected)).join("")}
        </div>
      </div>
    </article>
  `;
}

function showResults() {
  const total = state.activeQuestions.length;
  const correctCount = state.activeQuestions.filter((question) => getResult(question).isCorrect).length;
  const skippedCount = state.activeQuestions.filter((question) => getResult(question).isSkipped).length;
  const percent = Math.round((correctCount / total) * 100);

  quizPanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");
  homeButton.classList.remove("hidden");
  scoreTitle.textContent = `${correctCount} / ${total} (${percent}%)`;
  scoreSubtext.textContent = `${state.activeQuiz.title} · ${skippedCount} skipped`;
  reviewList.innerHTML =
    state.reviewMode === "end"
      ? state.activeQuestions.map((question, index) => renderReviewCard(question, index)).join("")
      : `
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

backButton.addEventListener("click", movePrevious);
nextButton.addEventListener("click", moveNext);
homeButton.addEventListener("click", showHome);
newAttemptButton.addEventListener("click", () => startQuiz(state.activeQuiz.id));
backToCoursesButton.addEventListener("click", showCoursesOnly);

loadCatalog().catch(showLoadError);
