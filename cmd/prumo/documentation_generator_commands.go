package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	docengine "github.com/raillen/prumo/internal/documentation"
	"github.com/raillen/prumo/internal/harness/doccompile"
	"github.com/raillen/prumo/internal/harness/humandocs"
	"github.com/raillen/prumo/internal/protocol"
	"github.com/raillen/prumo/internal/resolver"
)

var adrFilePattern = regexp.MustCompile(`^(\d{3})-(.+)\.md$`)

func runDocsADR(asJSON bool, args []string, root string) (any, int) {
	if len(args) < 3 {
		if asJSON {
			return nil, envelopeError(protocol.CodeConfiguration, "docs adr requires action: new <title>")
		}
		fmt.Fprintln(os.Stderr, "error: docs adr requires action (e.g. docs adr new <title>)")
		return nil, exitUsage
	}

	action := args[2]
	switch action {
	case "new":
		if len(args) < 4 {
			if asJSON {
				return nil, envelopeError(protocol.CodeConfiguration, "docs adr new requires a title")
			}
			fmt.Fprintln(os.Stderr, "error: docs adr new requires <title>")
			return nil, exitUsage
		}

		title := strings.Join(args[3:], " ")
		adrDir := filepath.Join(root, "docs", "adr")
		if err := os.MkdirAll(adrDir, 0o755); err != nil {
			return nil, serviceError(asJSON, err)
		}

		entries, err := os.ReadDir(adrDir)
		if err != nil {
			return nil, serviceError(asJSON, err)
		}

		maxNum := 0
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			match := adrFilePattern.FindStringSubmatch(e.Name())
			if len(match) == 3 {
				num, _ := strconv.Atoi(match[1])
				if num > maxNum {
					maxNum = num
				}
			}
		}

		nextNum := maxNum + 1
		numStr := fmt.Sprintf("%03d", nextNum)
		slug := slugify(title)
		fileName := fmt.Sprintf("%s-%s.md", numStr, slug)
		targetPath := filepath.Join(adrDir, fileName)

		today := time.Now().UTC().Format("2006-01-02")
		content := fmt.Sprintf(`# ADR %s: %s

## Status

Accepted

## Date

%s

## Context

Describe the background, architectural need, problem statement, and alternatives considered.

## Decision

State the clear architectural decision, invariants, boundaries, and chosen approach.

## Consequences

### Positive
- Specific benefits and enabled capabilities.

### Negative
- Trade-offs, migration overhead, or operational requirements.

## References

- Canonical specifications and source references.
`, numStr, title, today)

		art, err := doccompile.Write(targetPath, content)
		if err != nil {
			return nil, serviceError(asJSON, err)
		}

		relPath := filepath.Join("docs", "adr", fileName)
		payload := map[string]any{
			"number":      nextNum,
			"number_str":  numStr,
			"title":       title,
			"path":        relPath,
			"full_path":   targetPath,
			"fingerprint": art.Fingerprint,
			"operation":   artOperation(art),
		}

		if !asJSON {
			fmt.Printf("Created Architectural Decision Record (ADR):\n")
			fmt.Printf("  Number: %s\n", numStr)
			fmt.Printf("  Title:  %s\n", title)
			fmt.Printf("  Path:   %s\n", relPath)
		}
		return payload, exitOK

	case "list":
		adrDir := filepath.Join(root, "docs", "adr")
		entries, err := os.ReadDir(adrDir)
		if err != nil {
			return nil, serviceError(asJSON, err)
		}

		type adrSummary struct {
			Number int    `json:"number"`
			File   string `json:"file"`
			Path   string `json:"path"`
		}

		var adrs []adrSummary
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			match := adrFilePattern.FindStringSubmatch(e.Name())
			if len(match) == 3 {
				num, _ := strconv.Atoi(match[1])
				adrs = append(adrs, adrSummary{
					Number: num,
					File:   e.Name(),
					Path:   filepath.Join("docs", "adr", e.Name()),
				})
			}
		}

		sort.Slice(adrs, func(i, j int) bool {
			return adrs[i].Number < adrs[j].Number
		})

		if !asJSON {
			fmt.Printf("Architectural Decision Records (%d):\n", len(adrs))
			for _, a := range adrs {
				fmt.Printf("  • ADR %03d: %s\n", a.Number, a.Path)
			}
		}
		return adrs, exitOK

	default:
		if asJSON {
			return nil, envelopeError(protocol.CodeConfiguration, fmt.Sprintf("unsupported docs adr action: %s", action))
		}
		fmt.Fprintf(os.Stderr, "error: unsupported docs adr action: %s\n", action)
		return nil, exitUsage
	}
}

func runDocsScaffoldBrief(asJSON bool, args []string, root string) (any, int) {
	if len(args) < 3 {
		if asJSON {
			return nil, envelopeError(protocol.CodeConfiguration, "docs scaffold-brief requires <contract-id>")
		}
		fmt.Fprintln(os.Stderr, "error: docs scaffold-brief requires <contract-id> [--out <path>]")
		return nil, exitUsage
	}

	contractID := args[2]
	outPath := ""
	for i := 3; i < len(args); i++ {
		if args[i] == "--out" && i+1 < len(args) {
			outPath = args[i+1]
			i++
		}
	}

	registry, err := docengine.LoadRegistry(root)
	if err != nil {
		return nil, serviceError(asJSON, err)
	}

	contract, ok := registry.Contracts[contractID]
	if !ok {
		return nil, serviceError(asJSON, fmt.Errorf("unknown documentation contract: %s", contractID))
	}

	unit := humandocs.Unit{
		ID:       contractID,
		Title:    strings.Title(strings.ReplaceAll(contractID, "-", " ")),
		Intent:   humandocs.IntentExplanation,
		Audience: "developers",
		Sources:  []string{fmt.Sprintf("docs/contracts/builtin.json#%s", contractID)},
	}

	briefMD := humandocs.Brief(unit, contract)

	if outPath != "" {
		fullOut := filepath.Join(root, outPath)
		if err := os.MkdirAll(filepath.Dir(fullOut), 0o755); err != nil {
			return nil, serviceError(asJSON, err)
		}
		art, err := doccompile.Write(fullOut, briefMD)
		if err != nil {
			return nil, serviceError(asJSON, err)
		}

		payload := map[string]any{
			"contract_id": contractID,
			"path":        outPath,
			"fingerprint": art.Fingerprint,
			"operation":   artOperation(art),
		}

		if !asJSON {
			fmt.Printf("Scaffolded documentation brief for contract %q: %s\n", contractID, outPath)
		}
		return payload, exitOK
	}

	if asJSON {
		return map[string]any{
			"contract_id": contractID,
			"brief":       briefMD,
		}, exitOK
	}

	fmt.Println(briefMD)
	return map[string]any{"contract_id": contractID}, exitOK
}

func runDocsGenerateWorkforce(asJSON bool, root string) (any, int) {
	catalog, err := resolver.LoadCatalog(root)
	if err != nil {
		return nil, serviceError(asJSON, err)
	}

	// 1. Generate docs/workforce/recipes.md
	recipesDir := filepath.Join(root, "docs", "workforce")
	_ = os.MkdirAll(recipesDir, 0o755)

	var rb strings.Builder
	recipesList := catalog.Sections["recipes"]
	fmt.Fprintf(&rb, "# Receitas Determinísticas (%d Receitas)\n\n", len(recipesList))
	rb.WriteString("As **Receitas** no Prumo são sequências operacionais padronizadas que orquestram múltiplos passos e agentes em uma esteira de execução determinística com validação de portão (gate).\n\n")
	rb.WriteString("## Catálogo de Receitas\n\n")
	rb.WriteString("| Receita | Descrição | Agentes Envolvidos |\n")
	rb.WriteString("|---|---|---|\n")

	sort.Slice(recipesList, func(i, j int) bool {
		return fmt.Sprint(recipesList[i]["id"]) < fmt.Sprint(recipesList[j]["id"])
	})

	for _, item := range recipesList {
		id := fmt.Sprint(item["id"])
		purpose := fmt.Sprint(item["purpose"])
		agents := []string{}
		if rawAgents, ok := item["agents"].([]any); ok {
			for _, a := range rawAgents {
				agents = append(agents, fmt.Sprintf("`%v`", a))
			}
		}
		agentStr := strings.Join(agents, ", ")
		if agentStr == "" {
			agentStr = "—"
		}
		fmt.Fprintf(&rb, "| **`%s`** | %s | %s |\n", id, purpose, agentStr)
	}

	rb.WriteString("\n## Como Operar Receitas via CLI Canônico\n\n")
	rb.WriteString("```bash\n")
	rb.WriteString("# Listar todas as receitas catalogadas e seus passos\n")
	rb.WriteString("prumo recipe list\n\n")
	rb.WriteString("# Inspecionar os detalhes, dependências e gates de uma receita\n")
	rb.WriteString("prumo recipe show bug-fix\n\n")
	rb.WriteString("# Executar a receita determinística com o motor DAG\n")
	rb.WriteString("prumo recipe run bug-fix\n")
	rb.WriteString("prumo run --recipe bug-fix\n")
	rb.WriteString("```\n")

	recipesMDPath := filepath.Join(recipesDir, "recipes.md")
	art1, err := doccompile.Write(recipesMDPath, rb.String())
	if err != nil {
		return nil, serviceError(asJSON, err)
	}

	// 2. Generate docs/workforce/agents.md
	agentsList := catalog.Sections["agents"]
	var ab strings.Builder
	fmt.Fprintf(&ab, "# Catálogo de Agentes Especializados (%d Agentes)\n\n", len(agentsList))
	ab.WriteString("Os **Agentes** no Prumo são personas especializadas do workforce com papéis, entradas, saídas e permissões delimitadas.\n\n")
	ab.WriteString("## Agentes Catalogados\n\n")
	ab.WriteString("| Agente | Propósito | Habilidades Obrigatórias |\n")
	ab.WriteString("|---|---|---|\n")

	sort.Slice(agentsList, func(i, j int) bool {
		return fmt.Sprint(agentsList[i]["id"]) < fmt.Sprint(agentsList[j]["id"])
	})

	for _, item := range agentsList {
		id := fmt.Sprint(item["id"])
		purpose := fmt.Sprint(item["purpose"])
		skills := []string{}
		if rawSkills, ok := item["required_skills"].([]any); ok {
			for _, s := range rawSkills {
				skills = append(skills, fmt.Sprintf("`%v`", s))
			}
		}
		skillStr := strings.Join(skills, ", ")
		if skillStr == "" {
			skillStr = "—"
		}
		fmt.Fprintf(&ab, "| **`%s`** | %s | %s |\n", id, purpose, skillStr)
	}

	ab.WriteString("\n## Operações de Agente via CLI\n\n")
	ab.WriteString("```bash\n")
	ab.WriteString("# Inspecionar contrato canônico de um agente\n")
	ab.WriteString("prumo workforce inspect agent architect\n\n")
	ab.WriteString("# Criar um novo agente via scaffolding canônico\n")
	ab.WriteString("prumo workforce scaffold agent security-auditor --skills security-review\n")
	ab.WriteString("```\n")

	agentsMDPath := filepath.Join(recipesDir, "agents.md")
	art2, err := doccompile.Write(agentsMDPath, ab.String())
	if err != nil {
		return nil, serviceError(asJSON, err)
	}

	// 3. Generate docs/workforce/skills.md
	skillsList := catalog.Sections["skills"]
	var sb strings.Builder
	fmt.Fprintf(&sb, "# Catálogo de Habilidades da Workforce (%d Skills)\n\n", len(skillsList))
	sb.WriteString("As **Skills** no Prumo são módulos de conhecimento operacional empacotados conforme a especificação canônica Skill Package v3 (Capítulo 21).\n\n")
	sb.WriteString("## Habilidades Catalogadas\n\n")
	sb.WriteString("| Skill | Propósito | Nível de Risco | Modos Suportados |\n")
	sb.WriteString("|---|---|---|---|\n")

	sort.Slice(skillsList, func(i, j int) bool {
		return fmt.Sprint(skillsList[i]["id"]) < fmt.Sprint(skillsList[j]["id"])
	})

	for _, item := range skillsList {
		id := fmt.Sprint(item["id"])
		purpose := fmt.Sprint(item["purpose"])
		risk := fmt.Sprint(item["risk_level"])
		modes := []string{}
		if rawModes, ok := item["modes"].([]any); ok {
			for _, m := range rawModes {
				modes = append(modes, fmt.Sprint(m))
			}
		}
		riskTitle := strings.Title(risk)
		fmt.Fprintf(&sb, "| **`%s`** | %s | %s | %s |\n", id, purpose, riskTitle, strings.Join(modes, ", "))
	}

	sb.WriteString("\n## Invocando e Inspecionando Skills via CLI\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString("# Listar todas as skills instaladas e core\n")
	sb.WriteString("prumo workforce list\n\n")
	sb.WriteString("# Inspecionar contrato, checks e templates de uma skill\n")
	sb.WriteString("prumo workforce inspect skill clean-code\n\n")
	sb.WriteString("# Sincronizar skills da workforce para o projeto local\n")
	sb.WriteString("prumo workforce sync\n")
	sb.WriteString("```\n")

	skillsMDPath := filepath.Join(recipesDir, "skills.md")
	art3, err := doccompile.Write(skillsMDPath, sb.String())
	if err != nil {
		return nil, serviceError(asJSON, err)
	}

	payload := map[string]any{
		"recipes_md": recipesMDPath,
		"agents_md":  agentsMDPath,
		"skills_md":  skillsMDPath,
		"recipes_op": artOperation(art1),
		"agents_op":  artOperation(art2),
		"skills_op":  artOperation(art3),
		"ok":         true,
	}

	if !asJSON {
		fmt.Printf("Generated workforce documentation:\n")
		fmt.Printf("  • %s (%s)\n", recipesMDPath, artOperation(art1))
		fmt.Printf("  • %s (%s)\n", agentsMDPath, artOperation(art2))
		fmt.Printf("  • %s (%s)\n", skillsMDPath, artOperation(art3))
	}
	return payload, exitOK
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	s = reg.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func artOperation(art doccompile.Artifact) string {
	if art.NoOp {
		return "no_op"
	}
	return "written"
}
