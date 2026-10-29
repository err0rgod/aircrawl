# Project Guidelines & Rules

- **Strict AWS Account Rule:** Always use the AWS account/profile `err0rgod` for any AWS configurations, CLI commands, infrastructure provisioning, and deployments related to this project. No other AWS account or profile should be used.
- **Strict Variable Naming:** Use `camelCase` for variables, function arguments, and internal identifiers throughout the entire codebase.
- **Decision Framework:** Never make unilateral engineering or architectural decisions. Always present:
  - **Why X or Y:** The core problem and proposed directions.
  - **What is the Z output:** The exact expected output/behavior.
  - **Alternatives (A, B, C):** Viable alternatives.
  - **Tradeoffs:** Pros and cons of each option.
  - **User Confirmation:** Await user choice before implementing.
