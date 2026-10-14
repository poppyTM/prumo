# ADR 022 — Unificação da TUI com OpenTUI, SolidJS e transição para `prumo-coder`

**Status:** Accepted  
**Data:** 2026-10-12  
**Context:** Migração da TUI (`prumo-tui` Go/Bubble Tea v2) para `prumo-coder` (OpenTUI + TypeScript + SolidJS + TOML + Nerd Fonts)  
**Supersedes:** ADR 013 (OpenCode Go / Bubble Tea v2 foundation)  

## Contexto

O cliente de terminal do Prumo (`prumo-tui`) atingiu alta maturidade sob Go e Bubble Tea v2 (ADR 013), implementando streaming push, modais, dirty tree protection, Vim navigation e Leader keys. No entanto, a coexistência de Go na TUI e Rust no Desktop (`prumo-viewer` / Freya) criou uma fragmentação onde nenhuma lógica de apresentação, stores de eventos ou modelos de UI pôde ser compartilhada entre as superfícies.

Além disso, a evolução dos terminais modernos exige renderização sem travamentos de redraw (problema O(n) enfrentado em janelas extensas com Lipgloss) e reatividade declarativa de alta densidade. O **OpenTUI** surge como a fundação de ponta para interfaces de terminal:
- Core em **Zig** de altíssima performance para layout Flexbox (Yoga) e renderização assíncrona;
- Reconciliador dedicado para **SolidJS** (`@opentui/solid`), trazendo reatividade granular (`createSignal`, `createMemo`, `createEffect`) sem overhead de Virtual DOM;
- Tipagem estrita de primeira classe em **TypeScript**;
- Suporte nativo a **Nerd Fonts** e 24-bit TrueColor.

## Decisão

1. **Renomeação do Produto de Terminal:** O cliente de terminal passa a se chamar formalmente **`prumo-coder`** (localizado em `packages/prumo-coder/`).
2. **Adoção do OpenTUI + SolidJS:** A camada de apresentação é reconstruída em TypeScript sobre `@opentui/core` e `@opentui/solid`.
3. **Compartilhamento de Código via `@prumo/client-core`:** Toda a lógica de comunicação com o Daemon do Prumo, parsing de eventos JSONL, streams de timeline, cálculo de métricas de tokens/custo e stores reativos vive no pacote compartilhado `@prumo/client-core`.
4. **Formato Canônico de Configuração TOML:** A TUI abandona o formato JSON legado e adota **TOML** (`coder.toml` sob `~/.config/prumo/coder.toml`), com validação rigorosa via schema `schemas/coder-config.schema.json`.
5. **Iconografia via Nerd Fonts:** Adoção padronizada de Nerd Fonts para indicadores de git status, branch, status de agentes, modelos e spinners.
6. **Fronteira com o Core:** `prumo-coder` permanece um cliente estrito do Prumo Daemon, consumindo apenas o protocolo público (Protocol 0.4.0+) via Unix Socket ou TCP+TLS, sem importar código de `internal/`.

## Consequências

- **Positivas:**
  - Compartilhamento de mais de 85% do código de protocolo e estado com a GUI (`prumo-coder-IDE`).
  - Reatividade fina: alterações na statusline ou em tokens individuais não forçam redraw da árvore do transcript.
  - Layouts flexíveis e responsivos nativos através do engine Yoga em Zig.
  - Eliminação da duplicação de clientes de teste e stores entre Go e outras linguagens.
- **Negativas / Desafios:**
  - Dependência do runtime Bun/Node para build/desenvolvimento (mitigada por distribuição standalone compilada para usuários finais).
  - Necessidade de reimplementar os componentes visuais com paridade estrita aos testes canônicos existentes.
