# Catálogo de Agentes Especializados (39 Agentes)

Os **Agentes** no Prumo são personas especializadas do workforce com papéis, entradas, saídas e permissões delimitadas.

## Agentes Catalogados

| Agente | Propósito | Habilidades Obrigatórias |
|---|---|---|
| **`accessibility-reviewer`** | Verify accessibility compliance across keyboard, screen readers, contrast, and cognitive load. | `accessibility`, `keyboard-accessibility`, `contrast` |
| **`advertising-designer`** | Design advertising materials and marketing campaigns using AIDA model, visual persuasion, and conversion-optimized layouts across digital and print channels. | `advertising-design`, `marketing-collateral` |
| **`architect`** | Own system boundaries, contract specifications, ADR authoring, and Plan DAG design. | `architecture-quality`, `clean-code` |
| **`backend-engineer`** | Implement server-side APIs, domain logic, and database integrations. | `backend-api`, `clean-code` |
| **`brand-designer`** | Design and govern brand identity systems including logo architecture, color palettes, typography, imagery style, and cross-touchpoint consistency. | `brand-identity`, `color-science`, `typography-system` |
| **`compiler-engineer`** | Implement compiler frontend, IR transformations, codegen, and language diagnostics. | `compiler-development` |
| **`creative-director`** | Provide strategic creative direction through aesthetic analysis, structured design critique, cognitive science application, and visual communication strategy. | `aesthetic-analysis`, `design-critique`, `design-psychology` |
| **`database-engineer`** | Review schemas, migrations, indexes, consistency, and data lifecycle. | `database-review` |
| **`debugger`** | Reproduce, isolate, and repair defects using evidence and regression tests without masking failures. | `testing-quality`, `clean-code`, `refactoring` |
| **`design-researcher`** | Analyze references and turn them into reusable design evidence. | `design-research`, `website-forensics` |
| **`design-system-engineer`** | Define design tokens, component specifications, and brand-consistent design rules. | `design-system`, `design-tokens` |
| **`devops-engineer`** | Own CI/CD pipelines, containerization, deployment automation, and operational reliability. | `ci-cd`, `containers` |
| **`documentation-maintainer`** | Keep canonical Markdown documentation, docs/PRUMO.md, and user/developer/operations docs aligned with implementation. | `documentation`, `lean-progressive-context` |
| **`editor-engineer`** | Implement desktop/editor tools, inspectors, asset workflows, and authoring UX. | `editor-tooling` |
| **`engine-engineer`** | Implement runtime, tooling, and core engine subsystems. | `game-engine-architecture`, `game-runtime` |
| **`explorer`** | Map the repository, documentation, dependencies, risks, and impact before changes without making unrequested modifications. | `prumo-navigation`, `lean-progressive-context` |
| **`frontend-engineer`** | Implement accessible, tested web user interfaces. | `frontend-web`, `clean-code` |
| **`implementer`** | Implement scoped Goal work with minimal unrelated change and accompanying unit tests. | `clean-code`, `refactoring`, `error-handling` |
| **`isolation-auditor`** | Audit and verify multi-tenant isolation, process containment, capability boundaries, sandbox policies, and abuse resistance. | `security-review`, `untrusted-project-security`, `secrets-security`, `security-saas-isolation` |
| **`issue-author`** | Author structured, actionable, evidence-linked GitHub issues. | `github-issue-create`, `github-issue-refine` |
| **`issue-triager`** | Classify incoming issues, detect duplicates, assign milestones, and link to Goals. | `github-issue-triage` |
| **`motion-designer`** | Design and implement motion systems including animation tokens, spring physics, choreography patterns, and reduced-motion accessibility. | `motion-library`, `interaction-design` |
| **`networking-engineer`** | Own multiplayer protocols, authoritative replication, latency compensation, and network resilience. | `multiplayer-networking`, `network-testing` |
| **`performance-agent`** | Identify system bottlenecks, optimize cache locality, SIMD vectorization, and concurrency using hardware counters, profilers (perf, VTune, Nsight), and disassembly. | `performance-native`, `benchmarking`, `memory-management` |
| **`prototyper`** | Create prototypes at progressive fidelity levels for rapid validation, user testing, and implementation handoff. | `prototyping`, `wireframe-styleguide` |
| **`quality-reviewer`** | Review maintainability, clean engineering standards, and project quality budgets. | `clean-code`, `architecture-quality` |
| **`release-verifier`** | Verify release gates, build artifacts, checksums, migrations, docs, and rollback readiness before publishing. | `release-engineering`, `testing-quality` |
| **`renderer-engineer`** | Own 2D/3D rendering architecture, GPU pipelines, and visual correctness. | `rendering-2d`, `shaders` |
| **`reviewer`** | Independently review correctness, maintainability, security, scope, and evidence against Goal acceptance criteria. | `code-review`, `clean-code`, `architecture-quality` |
| **`scientific-computing-agent`** | Design and verify numerical algorithms, linear algebra routines, ODE/PDE solvers, molecular potentials, and floating-point error propagation against trusted reference solutions. | `applied-mathematics-dsp`, `computational-physics`, `testing-quality` |
| **`security-architect`** | Design trust boundaries, attack surface mitigations, privilege models, and security invariants. | `threat-modeling`, `secure-coding` |
| **`security-reviewer`** | Independently audit changesets for security vulnerabilities, memory safety, and permission boundaries. | `security-review`, `secure-coding` |
| **`svg-artist`** | Create, optimize, and govern SVG assets including icon libraries, generative art, and vector illustrations with accessibility and performance optimization. | `svg-engineering`, `icon-system` |
| **`systems-architect`** | Architect low-level systems, compiler backends, VMs, frame/audio budgets, memory models, and cache-conscious layouts. | `architecture-quality`, `clean-code`, `memory-management`, `concurrency-quality` |
| **`technology-decision-agent`** | Evaluate technology candidates, programming languages, runtimes, and architectures using hard constraint elimination, Pareto analysis, and benchmark experiment plans. | `clean-code`, `architecture-quality`, `benchmarking` |
| **`tester`** | Design, maintain, and execute deterministic verification suites proportional to project risk. | `testing-quality` |
| **`ui-component-engineer`** | Design and implement reusable, accessible, token-bound UI components following Atomic Design, compound component patterns, and strict design system contracts. | `ui-implementation`, `component-specification`, `design-system` |
| **`ux-architect`** | Design information architecture, user flows, structured wireframes, and progressive disclosure. | `ux-architecture`, `wireframing`, `user-flows` |
| **`visual-identity-auditor`** | Audit visual consistency across touchpoints, verifying brand compliance, color accuracy, typography usage, iconography coherence, and design token adherence. | `visual-qa`, `brand-identity`, `color-science` |

## Operações de Agente via CLI

```bash
# Inspecionar contrato canônico de um agente
prumo workforce inspect agent architect

# Criar um novo agente via scaffolding canônico
prumo workforce scaffold agent security-auditor --skills security-review
```
