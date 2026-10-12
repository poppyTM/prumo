# Receitas Determinísticas (20 Receitas)

As **Receitas** no Prumo são sequências operacionais padronizadas que orquestram múltiplos passos e agentes em uma esteira de execução determinística com validação de portão (gate).

## Catálogo de Receitas

| Receita | Descrição | Agentes Envolvidos |
|---|---|---|
| **`architecture-change`** | Safely modify system boundaries, public contracts, and ADRs with staged execution. | `explorer`, `architect`, `implementer`, `tester`, `reviewer` |
| **`brand-creation`** | End-to-end brand identity engineering: market positioning, aesthetic definition, vector logo marks, OKLCH color tokenization, typography systems, and brand guidelines manual. | `creative-director`, `brand-designer`, `svg-artist`, `visual-identity-auditor` |
| **`bug-fix`** | Reproduce, isolate, and repair defects without masking regressions. | `debugger`, `tester`, `reviewer` |
| **`compiler-change`** | Safely modify parsing, IR, AST, or runtime behavior with conformance test validation. | `architect`, `compiler-engineer`, `tester`, `reviewer` |
| **`compiler-conformance`** | Execute end-to-end verification of compiler passes, type systems, SSA lowering, bytecode VM, and grammar fuzzing. | `architect`, `compiler-engineer`, `systems-architect`, `tester`, `reviewer` |
| **`design-system-foundation`** | Comprehensive engineering of an enterprise design system: W3C DTCG tokens, perceptual color spaces, modular typography, atomic primitives, and automated accessibility verification. | `creative-director`, `brand-designer`, `design-system-engineer`, `ui-component-engineer`, `accessibility-reviewer` |
| **`documentation-refactor`** | Reorganize canonical docs, docs/PRUMO.md navigation, and audience split without document proliferation. | `explorer`, `documentation-maintainer`, `reviewer` |
| **`engine-renderer`** | Safely modify GPU, 2D/3D pipelines, and shader systems with visual fixture verification. | `explorer`, `renderer-engineer`, `tester`, `reviewer` |
| **`feature-standard`** | Default multi-agent implementation flow for ordinary product and feature work with independent cross-model review. | `explorer`, `architect`, `implementer`, `tester`, `reviewer`, `documentation-maintainer` |
| **`github-issue`** | Standardized issue authoring, refinement, and triaging with Goal linkage. | `explorer`, `issue-triager`, `issue-author` |
| **`icon-library-creation`** | End-to-end icon library production pipeline: geometric grid standards, optical weight balance, SVG path optimization, accessibility metadata, and framework component generation. | `svg-artist`, `design-system-engineer`, `accessibility-reviewer`, `tester` |
| **`marketing-campaign`** | Execution pipeline for multi-channel marketing campaigns using the AIDA framework: value proposition, advertising creatives, landing view architecture, and conversion optimization. | `creative-director`, `advertising-designer`, `frontend-engineer`, `quality-reviewer` |
| **`multiplayer-feature`** | Implement authoritative replication and network protocols with packet loss simulation. | `networking-engineer`, `tester`, `security-reviewer` |
| **`project-bootstrap`** | Initialize Prumo configuration, schema validation, and minimal workforce for a new repository. | `explorer`, `architect`, `implementer`, `tester` |
| **`release`** | Produce, verify, and audit release artifacts across target matrices. | `architect`, `release-verifier`, `tester`, `security-reviewer` |
| **`security-audit-release`** | Execute comprehensive secure-by-design verification covering threat models, authorization matrices, multi-tenant isolation, memory safety sanitizers, and supply chain attestations. | `security-architect`, `security-reviewer`, `isolation-auditor`, `release-verifier` |
| **`security-review`** | Threat-model, audit, and remediate security-sensitive features. | `security-architect`, `security-reviewer`, `implementer` |
| **`ui-feature`** | End-to-end design, tokenization, implementation, and accessibility audit of UI features. | `design-researcher`, `ux-architect`, `design-system-engineer`, `frontend-engineer`, `accessibility-reviewer` |
| **`ui-review`** | Review user interface ergonomics, visual fidelity, and accessibility standards. | `ux-architect`, `accessibility-reviewer`, `reviewer` |
| **`web-feature`** | Implement fullstack web features across frontend components and backend API endpoints. | `backend-engineer`, `frontend-engineer`, `tester`, `reviewer` |

## Como Operar Receitas via CLI Canônico

```bash
# Listar todas as receitas catalogadas e seus passos
prumo recipe list

# Inspecionar os detalhes, dependências e gates de uma receita
prumo recipe show bug-fix

# Executar a receita determinística com o motor DAG
prumo recipe run bug-fix
prumo run --recipe bug-fix
```
