# Working together

Each student uses their own GitHub account and identifiable Git author name and verified email. Do not share account credentials or attribute another person's work to yourself.

## Get the project

Accept the repository invitation, copy the real clone URL from GitHub and run:

```sh
git clone https://github.com/Dirolka/draWeb.git
cd draWeb
git config user.name "Your full name"
git config user.email "Your verified GitHub email"
npm ci
npm test
npm run build
npm run dev
```

Use Node.js 24 or newer. Open http://localhost:3000. See README.md and .env.example for configuration; .env is not loaded automatically. Dependencies are installed locally; runtime databases and credentials must not be shared through Git.

## A task and a pull request

1. Create a real YouTrack task with an owner, expected result, acceptance criteria and deadline.
2. Start from an up-to-date main branch with a clean working tree. Replace the example task ID below with the actual ID.

```sh
git switch main
git pull --ff-only origin main
git switch -c DIP-12-project-search
```

3. Implement one coherent task, inspect `git diff`, and run checks relevant to the changes. For code changes run `npm test` and `npm run build`; browser workflow verification uses `npm run test:browser` and requires a production build and installed Chrome.
4. Stage the specific changed files, review `git diff --cached`, then commit and push:

```sh
git add <changed-files>
git diff --cached
git commit -m "DIP-12: Describe the actual change"
git push -u origin DIP-12-project-search
```

5. Open a pull request against main and link the actual YouTrack task. Record the checks actually performed and their results.
6. The other student reviews the code and behavior. Address real findings in additional commits, then obtain approval before merging. Do not fabricate review comments.
7. Link the merged pull request in YouTrack and close the task only when acceptance criteria are met.

Documentation and design work follow the same process. Do not rewrite published submission tags or fabricate dates. Future main changes should go through peer-reviewed pull requests; the initial local import is a bootstrap exception and is explicitly documented.

## Submission tags

After the reviewed version is merged and checked, create the applicable annotated tag on main:

```sh
git switch main
git pull --ff-only origin main
git tag -a pre-defense-1 -m "First pre-defense submission"
git push origin pre-defense-1
```

Use pre-defense-2 and final-pre-defense at the corresponding stages. Never move an existing submission tag. Include completed work, limitations and outstanding tasks in each submission.
