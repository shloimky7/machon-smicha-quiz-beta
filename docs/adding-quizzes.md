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

## Question Display

The app displays every question in the selected quiz bank, in the order the questions appear in the JSON file.
