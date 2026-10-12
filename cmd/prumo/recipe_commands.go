package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/raillen/prumo/internal/automation"
	"github.com/raillen/prumo/internal/harness/doccompile"
	"github.com/raillen/prumo/internal/protocol"
	"github.com/raillen/prumo/internal/validation"
)

func runRecipe(asJSON bool, args []string) int {
	if len(args) == 0 {
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, "recipe subcommand required: list, show, scaffold, compile-doc, pack, run")
		}
		fmt.Fprintf(os.Stderr, "error: recipe requires a subcommand (list, show, scaffold, compile-doc, pack, run)\n")
		return exitUsage
	}

	subcommand := args[0]
	rest := args[1:]
	root := repoRoot()

	switch subcommand {
	case "list":
		catalogPath := filepath.Join(root, "src", "prumo", "resources", "catalog", "recipes.json")
		recipes, err := automation.LoadCatalogRecipes(catalogPath)
		if err != nil {
			return serviceError(asJSON, err)
		}

		type recipeSummary struct {
			ID        string   `json:"id"`
			Name      string   `json:"name"`
			Purpose   string   `json:"purpose"`
			StepCount int      `json:"step_count"`
			Agents    []string `json:"agents"`
			Gates     any      `json:"gates"`
		}

		summaries := make([]recipeSummary, len(recipes))
		for i, r := range recipes {
			summaries[i] = recipeSummary{
				ID:        r.ID,
				Name:      r.Name,
				Purpose:   r.Purpose,
				StepCount: len(r.Steps),
				Agents:    r.Agents,
				Gates:     r.Gates,
			}
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(summaries))
		}

		fmt.Printf("Canonical Workforce Recipes (%d):\n\n", len(recipes))
		for _, s := range summaries {
			fmt.Printf("  • %-24s %s (%d steps)\n", s.ID, s.Name, s.StepCount)
			fmt.Printf("    Purpose: %s\n", s.Purpose)
			if len(s.Agents) > 0 {
				fmt.Printf("    Agents:  %s\n", strings.Join(s.Agents, ", "))
			}
			fmt.Println()
		}
		return exitOK

	case "show":
		if len(rest) == 0 {
			if asJSON {
				return envelopeError(protocol.CodeConfiguration, "recipe show requires a recipe ID")
			}
			fmt.Fprintf(os.Stderr, "error: recipe show requires <recipe-id>\n")
			return exitUsage
		}

		recipeID := rest[0]
		recipesDir := filepath.Join(root, "src", "prumo", "resources", "workforce", "recipes")
		recipe, err := automation.LoadRecipeFromDir(recipesDir, recipeID)
		if err != nil {
			catalogPath := filepath.Join(root, "src", "prumo", "resources", "catalog", "recipes.json")
			catalog, catErr := automation.LoadCatalogRecipes(catalogPath)
			if catErr == nil {
				for _, r := range catalog {
					if r.ID == recipeID {
						recipe = &r
						err = nil
						break
					}
				}
			}
		}
		if err != nil {
			return serviceError(asJSON, err)
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(recipe))
		}

		fmt.Printf("Recipe: %s (%s)\n", recipe.Name, recipe.ID)
		fmt.Printf("Purpose: %s\n\n", recipe.Purpose)
		if len(recipe.Preconditions) > 0 {
			fmt.Printf("Preconditions:\n")
			for _, p := range recipe.Preconditions {
				fmt.Printf("  - %s\n", p)
			}
			fmt.Println()
		}
		if len(recipe.Inputs) > 0 {
			fmt.Printf("Inputs:\n")
			for _, in := range recipe.Inputs {
				fmt.Printf("  - %s\n", in)
			}
			fmt.Println()
		}
		fmt.Printf("Workflow Steps DAG (%d):\n", len(recipe.Steps))
		for i, s := range recipe.Steps {
			depStr := "none (root)"
			if len(s.DependsOn) > 0 {
				depStr = strings.Join(s.DependsOn, ", ")
			}
			fmt.Printf("  %d. [%s] %s\n", i+1, s.ID, s.Name)
			fmt.Printf("     Role:         %s\n", s.AgentRole)
			fmt.Printf("     Depends on:   %s\n", depStr)
			if len(s.Skills) > 0 {
				fmt.Printf("     Skills:       %s\n", strings.Join(s.Skills, ", "))
			}
			if s.Input != "" {
				fmt.Printf("     Input:        %s\n", s.Input)
			}
			if s.Output != "" {
				fmt.Printf("     Output:       %s\n", s.Output)
			}
			if len(s.RequiredEvidence) > 0 {
				fmt.Printf("     Evidence:     %s\n", strings.Join(s.RequiredEvidence, ", "))
			}
			if len(s.Gates) > 0 {
				fmt.Printf("     Gates:        %s\n", strings.Join(s.Gates, ", "))
			}
			fmt.Println()
		}
		return exitOK

	case "scaffold":
		if len(rest) == 0 {
			if asJSON {
				return envelopeError(protocol.CodeConfiguration, "recipe scaffold requires a recipe ID")
			}
			fmt.Fprintf(os.Stderr, "error: recipe scaffold requires <recipe-id> [--name <name>] [--purpose <purpose>]\n")
			return exitUsage
		}

		recipeID := rest[0]
		name := strings.Title(strings.ReplaceAll(recipeID, "-", " "))
		purpose := fmt.Sprintf("Execute coordinated %s workflow with staged verification.", name)

		for i := 1; i < len(rest); i++ {
			switch rest[i] {
			case "--name":
				if i+1 < len(rest) {
					name = rest[i+1]
					i++
				}
			case "--purpose":
				if i+1 < len(rest) {
					purpose = rest[i+1]
					i++
				}
			}
		}

		recipeDir := filepath.Join(root, "src", "prumo", "resources", "workforce", "recipes", recipeID)
		if err := os.MkdirAll(recipeDir, 0o755); err != nil {
			return serviceError(asJSON, err)
		}

		recipe := automation.RecipeManifest{
			ID:            recipeID,
			Name:          name,
			Version:       1,
			Purpose:       purpose,
			Preconditions: []string{fmt.Sprintf("Validated Goal or specification for %s", name)},
			Inputs:        []string{"Feature specification", "Repository context"},
			Agents:        []string{"architect", "implementer", "tester", "reviewer"},
			Skills:        []string{"architecture-quality", "clean-code", "testing-quality", "code-review"},
			Gates:         []string{"tests", "review"},
			Artifacts:     []string{"Verified implementation", "Test evidence", "Review sign-off"},
			StopConditions: []string{
				"All workflow tasks completed",
				"Verification evidence recorded and gates passed",
			},
			Steps: []automation.ManifestStep{
				{
					ID:               "plan",
					Name:             "Design implementation plan DAG",
					AgentRole:        "architect",
					Skills:           []string{"architecture-quality"},
					Input:            "Feature specification",
					Output:           "Plan DAG specification",
					RequiredEvidence: []string{"review"},
				},
				{
					ID:               "implement",
					Name:             "Implement code changes",
					DependsOn:        []string{"plan"},
					AgentRole:        "implementer",
					Skills:           []string{"clean-code"},
					Input:            "Plan DAG specification",
					Output:           "Source code diff",
					RequiredEvidence: []string{"test"},
				},
				{
					ID:               "test",
					Name:             "Execute automated verification",
					DependsOn:        []string{"implement"},
					AgentRole:        "tester",
					Skills:           []string{"testing-quality"},
					Input:            "Source code diff",
					Output:           "Test pass evidence",
					RequiredEvidence: []string{"test"},
					Gates:            []string{"tests"},
				},
				{
					ID:               "review",
					Name:             "Conduct quality and safety review",
					DependsOn:        []string{"test"},
					AgentRole:        "reviewer",
					Skills:           []string{"code-review"},
					Input:            "Diff and test evidence",
					Output:           "Review sign-off report",
					RequiredEvidence: []string{"review"},
					Gates:            []string{"review"},
				},
			},
		}

		recipeJSONPath := filepath.Join(recipeDir, "recipe.json")
		data, err := json.MarshalIndent(recipe, "", "  ")
		if err != nil {
			return serviceError(asJSON, err)
		}
		if err := os.WriteFile(recipeJSONPath, append(data, '\n'), 0o644); err != nil {
			return serviceError(asJSON, err)
		}

		recipeMDPath := filepath.Join(recipeDir, "RECIPE.md")
		mdContent := renderRecipeMarkdown(recipe)
		if _, err := doccompile.Write(recipeMDPath, mdContent); err != nil {
			return serviceError(asJSON, err)
		}

		payload := map[string]any{
			"id":          recipeID,
			"path":        recipeDir,
			"recipe_json": recipeJSONPath,
			"recipe_md":   recipeMDPath,
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}

		fmt.Printf("Scaffolded new workforce recipe: %s\n", recipeID)
		fmt.Printf("  Directory:   %s\n", recipeDir)
		fmt.Printf("  Manifest:    %s\n", recipeJSONPath)
		fmt.Printf("  Doc:         %s\n", recipeMDPath)
		return exitOK

	case "compile-doc":
		if len(rest) == 0 {
			if asJSON {
				return envelopeError(protocol.CodeConfiguration, "recipe compile-doc requires a recipe ID")
			}
			fmt.Fprintf(os.Stderr, "error: recipe compile-doc requires <recipe-id>\n")
			return exitUsage
		}

		recipeID := rest[0]
		recipesDir := filepath.Join(root, "src", "prumo", "resources", "workforce", "recipes")
		recipe, err := automation.LoadRecipeFromDir(recipesDir, recipeID)
		if err != nil {
			return serviceError(asJSON, err)
		}

		recipeMDPath := filepath.Join(recipesDir, recipeID, "RECIPE.md")
		mdContent := renderRecipeMarkdown(*recipe)
		art, err := doccompile.Write(recipeMDPath, mdContent)
		if err != nil {
			return serviceError(asJSON, err)
		}

		op := "written"
		if art.NoOp {
			op = "no_op"
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(map[string]any{"id": recipeID, "path": recipeMDPath, "operation": op}))
		}

		fmt.Printf("Compiled documentation for recipe %s (%s): %s\n", recipeID, op, recipeMDPath)
		return exitOK

	case "pack":
		recipesDir := filepath.Join(root, "src", "prumo", "resources", "workforce", "recipes")
		recipes, err := automation.LoadAllRecipesFromDir(recipesDir)
		if err != nil {
			return serviceError(asJSON, err)
		}

		catalogPath := filepath.Join(root, "src", "prumo", "resources", "catalog", "recipes.json")
		wrapped := map[string]any{
			"recipes": recipes,
		}
		data, err := json.MarshalIndent(wrapped, "", "  ")
		if err != nil {
			return serviceError(asJSON, err)
		}
		if err := os.WriteFile(catalogPath, append(data, '\n'), 0o644); err != nil {
			return serviceError(asJSON, err)
		}

		schemaPath := filepath.Join(root, "schemas", "recipe.schema.json")
		schemasDir := filepath.Join(root, "schemas")
		for _, r := range recipes {
			rPath := filepath.Join(recipesDir, r.ID, "recipe.json")
			if _, statErr := os.Stat(rPath); statErr != nil {
				rPath = filepath.Join(recipesDir, r.ID, "manifest.json")
			}
			for _, msg := range validation.ValidateFile(rPath, "recipe.schema.json", schemasDir) {
				_ = schemaPath
				return serviceError(asJSON, fmt.Errorf("recipe %s schema validation failed: %s", r.ID, msg))
			}
		}

		payload := map[string]any{
			"total_recipes": len(recipes),
			"catalog_path":  catalogPath,
			"ok":            true,
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}

		fmt.Printf("Successfully packed %d recipes into %s\n", len(recipes), catalogPath)
		return exitOK

	case "run":
		if len(rest) == 0 {
			if asJSON {
				return envelopeError(protocol.CodeConfiguration, "recipe run requires a recipe ID")
			}
			fmt.Fprintf(os.Stderr, "error: recipe run requires <recipe-id> [--param key=val]\n")
			return exitUsage
		}

		recipeID := rest[0]
		recipesDir := filepath.Join(root, "src", "prumo", "resources", "workforce", "recipes")
		recipe, err := automation.LoadRecipeFromDir(recipesDir, recipeID)
		if err != nil {
			return serviceError(asJSON, err)
		}

		dag, err := automation.FromManifest(*recipe)
		if err != nil {
			return serviceError(asJSON, err)
		}

		executedSteps := []string{}
		exec := automation.NewExecutor()
		exec.StepHook = func(step automation.RecipeStep, state string, stepErr error) {
			if state == "completed" {
				executedSteps = append(executedSteps, step.ID)
				if !asJSON {
					fmt.Printf("  ✓ [%s] %s (%s)\n", step.ID, step.Name, step.Actor)
				}
			} else if state == "failed" {
				if !asJSON {
					fmt.Printf("  ✗ [%s] %s failed: %v\n", step.ID, step.Name, stepErr)
				}
			}
		}

		if !asJSON {
			fmt.Printf("Executing Recipe DAG: %s (%s) [%d steps]\n\n", recipe.Name, recipe.ID, len(dag.Steps))
		}

		ctx := context.Background()
		if err := exec.Execute(ctx, *dag); err != nil {
			return serviceError(asJSON, err)
		}

		payload := map[string]any{
			"recipe_id":      recipe.ID,
			"executed_steps": executedSteps,
			"total_steps":    len(dag.Steps),
			"ok":             true,
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}

		fmt.Printf("\nRecipe %s completed successfully (%d/%d steps executed).\n", recipe.ID, len(executedSteps), len(dag.Steps))
		return exitOK

	default:
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, fmt.Sprintf("unknown recipe subcommand: %s", subcommand))
		}
		fmt.Fprintf(os.Stderr, "error: unknown recipe subcommand: %s\n", subcommand)
		return exitUsage
	}
}

func renderRecipeMarkdown(r automation.RecipeManifest) string {
	var b strings.Builder
	b.WriteString("# " + r.Name + "\n\n")
	b.WriteString("## Purpose\n" + r.Purpose + "\n\n")

	if len(r.Preconditions) > 0 {
		b.WriteString("## Preconditions\n")
		for _, p := range r.Preconditions {
			b.WriteString("- " + p + "\n")
		}
		b.WriteString("\n")
	}

	if len(r.Inputs) > 0 {
		b.WriteString("## Required Inputs\n")
		for _, in := range r.Inputs {
			b.WriteString("- " + in + "\n")
		}
		b.WriteString("\n")
	}

	b.WriteString("## Step DAG & Dependencies\n")
	for i, s := range r.Steps {
		depStr := "None (entry step)"
		if len(s.DependsOn) > 0 {
			depStr = strings.Join(s.DependsOn, ", ")
		}
		fmt.Fprintf(&b, "%d. **%s** (`%s`)\n", i+1, s.Name, s.ID)
		fmt.Fprintf(&b, "   - **Role:** `%s`\n", s.AgentRole)
		if len(s.Skills) > 0 {
			fmt.Fprintf(&b, "   - **Skills:** `%s`\n", strings.Join(s.Skills, "`, `"))
		}
		if s.Input != "" {
			fmt.Fprintf(&b, "   - **Input:** %s\n", s.Input)
		}
		if s.Output != "" {
			fmt.Fprintf(&b, "   - **Output:** %s\n", s.Output)
		}
		if len(s.RequiredEvidence) > 0 {
			fmt.Fprintf(&b, "   - **Evidence Required:** `%s`\n", strings.Join(s.RequiredEvidence, "`, `"))
		}
		fmt.Fprintf(&b, "   - **Dependencies:** %s\n", depStr)
		if len(s.Gates) > 0 {
			fmt.Fprintf(&b, "   - **Gates:** `%s`\n", strings.Join(s.Gates, "`, `"))
		}
	}
	b.WriteString("\n")

	if len(r.Artifacts) > 0 {
		b.WriteString("## Expected Artifacts\n")
		for _, a := range r.Artifacts {
			b.WriteString("- " + a + "\n")
		}
		b.WriteString("\n")
	}

	if len(r.StopConditions) > 0 {
		b.WriteString("## Stop Conditions\n")
		for _, sc := range r.StopConditions {
			b.WriteString("- " + sc + "\n")
		}
		b.WriteString("\n")
	}

	return b.String()
}
