# Contributing to SheetInvoicer

Thank you for contributing to SheetInvoicer.

## 1. How to Contribute

- Report bugs with clear reproduction steps.
- Suggest features with product/use-case context.
- Submit pull requests for fixes, improvements, and docs.

## 2. Code of Conduct

- Be respectful and constructive.
- Assume good intent.
- Focus on ideas and implementation, not individuals.
- Harassment, discrimination, and abusive behavior are not tolerated.

## 3. Development Workflow

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feat/short-description
   ```

3. Install dependencies and run locally:

   ```bash
   npm install
   npm run dev
   ```

4. Implement your changes.
5. Run checks:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

6. Commit with clear messages.
7. Open a Pull Request.

## 4. Pull Request Guidelines

- Keep PRs focused and reasonably small.
- Include a clear summary and rationale.
- Reference related issues.
- Update documentation for behavior/config changes.
- Add or update tests when changing logic.

## 5. Branch Naming Suggestions

- `feat/<topic>`
- `fix/<topic>`
- `docs/<topic>`
- `refactor/<topic>`

## 6. Review Expectations

- At least one reviewer approval before merge.
- CI checks must pass.
- Resolve all review comments.
