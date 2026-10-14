# ADR 023 — Reestruturação da GUI Desktop como `prumo-coder-IDE` com Electron, Bun, SolidJS e Zed-like Design

**Status:** Accepted  
**Data:** 2026-10-12  
**Context:** Migração da GUI Desktop (`prumo-native` / `prumo-viewer` em Rust/Freya) para `prumo-coder-IDE` (Electron + Bun + SolidJS + Phosphor Icons + Zed-like Design)  
**Supersedes:** Decisão Freya em `docs/architecture/prumo-native-workspace-viewer.md` (CONST-82)  

## Contexto

A GUI de desktop do Prumo foi projetada como um Workspace Viewer agent-aware (CONST-82), focada em observabilidade do workspace, visualização de diffs e pequenas edições humanas. A implementação anterior em Rust com Freya 0.4.3 exigiu a manutenção de forks locais de editor de código (`vendor/freya-code-editor`), bindings manuais para Tree-sitter e reescrita profunda de componentes básicos de UI.

Além disso, a separação de linguagens (TUI em Go, Desktop em Rust) impedia o reuso de tipos, clientes de rede, parsers e lógicas de sessão. 

A combinação de **Electron + Bun + SolidJS**:
- Entrega uma fundação desktop madura e multiplataforma com aceleração gráfica de hardware;
- Permite uso de **Bun** como runtime de desenvolvimento, pacote e execução de scripts com máxima velocidade;
- Adota **SolidJS** no frontend, oferecendo velocidade e performance de memória sem overhead de Virtual DOM;
- Unifica a linguagem das duas interfaces do Prumo sob **TypeScript (Strict)**;
- Adota a linguagem visual e mental do **Zed** (alta densidade, divisórias sutis de 1px, paletas calmas e neutras, tipografia mono/sans calibrada e command palette modal);
- Integração da iconografia geométrica e consistente de **Phosphor Icons** (`@phosphor-icons/core` / `phosphor-solid`).

## Decisão

1. **Renomeação do Produto Desktop:** O cliente desktop passa a se chamar formalmente **`prumo-coder-IDE`** (localizado em `packages/prumo-coder-ide/`).
2. **Adoção do Electron + Bun + SolidJS:** O shell desktop utiliza Electron com backend/bundler Bun e frontend reativo puro em SolidJS.
3. **Consumo de `@prumo/client-core`:** A GUI consome a mesma biblioteca central de protocolo e stores de sessão utilizada pelo `prumo-coder` (TUI).
4. **Design System Zed-like:**
   - Densidade compacta: barras e tabs finas (header 32px, tabs 30px, statusbar 24px);
   - Paleta neutra técnica inspirada no Zed (carvão, off-black, divisórias `#24272e`);
   - Command Palette (`Ctrl+P` e `Ctrl+Shift+P`);
   - Explorer agent-aware exibindo artefatos criados (`+`), modificados (`M`) e removidos (`D`) pela Run ativa.
5. **Iconografia via Phosphor Icons:** Padronização nos pesos regular e duotone para navegação, explorer e status.
6. **Formato Canônico de Configuração TOML:** Adoção de `coder-ide.toml` (sob `~/.config/prumo/coder-ide.toml`), validado por `schemas/coder-ide-config.schema.json`.
7. **Terminal Integrado via PTY:** Utilização de `node-pty` e `xterm.js` no dock inferior retrátil, conectado ao PTY nativo do host.

## Consequências

- **Positivas:**
  - Código de protocolo, stores de eventos e telemetria 100% reutilizados com o `prumo-coder`.
  - Acesso ao ecossistema maduro de editores web (CodeMirror 6 / Monaco) e emuladores de terminal (`xterm.js`).
  - Iteração muito mais rápida no design system Zed-like e suporte simplificado a temas.
  - Eliminação da manutenção de forks complexos de editor em Rust.
- **Negativas / Desafios:**
  - Maior footprint em disco na distribuição de pacotes do Electron (mitigado pelo uso de Bun e SolidJS que reduzem o footprint de memória em execução).
  - Necessidade de garantir que a aplicação inicie em menos de 1 segundo (usando otimizações de bundle do Bun e Vite).
