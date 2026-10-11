"""AI PR review: send the diff to a model, post/update ONE sticky PR comment,
and always write a job summary so a passing run is visible."""
import json
import os
import urllib.request

MARKER = "<!-- ai-pr-review -->"
MODEL = "deepseek/deepseek-chat"
LIMIT = 60000

repo = os.environ["GITHUB_REPOSITORY"]
pr = os.environ["PR_NUMBER"]
diff = os.environ["DIFF"]
diff_bytes = int(os.environ["DIFF_BYTES"])
truncated = diff_bytes > LIMIT


def summary(text):
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write(text + "\n")


def gh(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
            "Accept": "application/vnd.github+json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def find_comment():
    page = 1
    while True:
        batch = gh("GET", f"issues/{pr}/comments?per_page=100&page={page}")
        for c in batch:
            if MARKER in c["body"] and c["user"]["login"] == "github-actions[bot]":
                return c["id"]
        if len(batch) < 100:
            return None
        page += 1


def ask_model():
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": os.environ["REVIEW_SYSTEM_PROMPT"]},
            {"role": "user", "content": f"Pull Request Diff:\n\n{diff}"},
        ],
        "temperature": 0.1,
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com",
            "X-Title": "GitHub React PR Reviewer",
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
    return data["choices"][0]["message"]["content"].strip(), data.get("usage", {})


try:
    review, usage = ask_model()
except Exception as e:
    summary(f"### AI review failed\n\n`{e}`")
    print(f"Review execution failed: {e}")
    raise SystemExit(1)

sha = os.environ.get("HEAD_SHA", "")[:7]
note = (
    f"\n\n> Diff was {diff_bytes:,} bytes; only the first {LIMIT:,} were reviewed."
    if truncated
    else ""
)
stats = f"model `{MODEL}`, diff {diff_bytes:,} bytes, tokens {usage.get('total_tokens', '?')}"
passed = review == "LGTM"

if passed:
    body = f"{MARKER}\n### ✅ AI Code Review (DeepSeek)\n\nLGTM on `{sha}`. No blockers found.{note}"
else:
    body = f"{MARKER}\n### 🔍 AI Code Review (DeepSeek) — `{sha}`\n\n{review}{note}"

existing = find_comment()
if existing:
    gh("PATCH", f"issues/comments/{existing}", {"body": body})
elif not passed:
    gh("POST", f"issues/{pr}/comments", {"body": body})

summary(f"### AI review: {'LGTM' if passed else 'findings posted'}\n\n{stats}{note}")
print("LGTM." if passed else "Findings posted.")
