# Adding Quizzes

Each quiz bank is stored as a JSON file in `data/`, and the app lists available quizzes from `data/quizzes.json`.

## Excel Format

The importer expects these columns:

- `Question`
- `Option A`
- `Option B`
- `Option C`
- `Option D`
- `Correct Option`
- `Difficulty Level`
- `Siman and Seif`
- `Page Number(s)`
- `Explanation Why the Correct Answer Is Correct`
- `Why Option A Is Not Correct`
- `Why Option B Is Not Correct`
- `Why Option C Is Not Correct`
- `Why Option D Is Not Correct`

## Import Command

From the workspace root:

```bash
/Users/shlomochaimkesselman/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  quiz-beta-app/scripts/import_xlsx.py path/to/question_bank.xlsx \
  --id basar-bchalav-siman-88 \
  --title "Basar B'chalav - Siman 88" \
  --course "Smicha - Basar B'chalav" \
  --target-count 10 \
  --out quiz-beta-app/data/basar-bchalav-siman-88.json
```

Then add the new file to `data/quizzes.json`:

```json
{
  "id": "basar-bchalav-siman-88",
  "title": "Basar B'chalav - Siman 88",
  "course": "Smicha - Basar B'chalav",
  "kind": "quiz",
  "dataUrl": "data/basar-bchalav-siman-88.json"
}
```

## Question Selection

The app uses the quiz bank's `targetQuestionCount` and selects a fresh random set each attempt.

The default mix follows the quiz principles:

- 50% easy
- 30% medium
- 20% hard

For Siman 87, the bank has 26 questions and the live quiz uses 13 questions.
