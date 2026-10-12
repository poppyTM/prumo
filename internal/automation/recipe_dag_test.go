package automation

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestLintRecipeDAG_CycleDetected(t *testing.T) {
	dag := RecipeDAG{
		ID:    "rec-cycle",
		Name:  "Cyclic Recipe",
		Start: "step-1",
		Steps: map[string]RecipeStep{
			"step-1": {ID: "step-1", Actor: "agent-1", Capability: "build", Next: []string{"step-2"}},
			"step-2": {ID: "step-2", Actor: "agent-1", Capability: "test", Next: []string{"step-3"}},
			"step-3": {ID: "step-3", Actor: "agent-1", Capability: "deploy", Next: []string{"step-1"}}, // Cycle!
		},
	}

	findings := LintRecipeDAG(dag)
	hasCycle := false
	for _, f := range findings {
		if f.Kind == "cycle_detected" {
			hasCycle = true
			break
		}
	}
	if !hasCycle {
		t.Fatalf("expected cycle_detected finding, got: %#v", findings)
	}
}

func TestLintRecipeDAG_MissingOwnerAndInfiniteRetry(t *testing.T) {
	dag := RecipeDAG{
		ID:    "rec-invalid",
		Name:  "Invalid Recipe",
		Start: "step-1",
		Steps: map[string]RecipeStep{
			"step-1": {
				ID:           "step-1",
				Actor:        "", // Missing owner!
				Capability:   "build",
				RetryLimit:   99, // Infinite / unbounded retry!
				SideEffects:  "destructive",
				Compensation: "", // Missing compensation!
			},
		},
	}

	findings := LintRecipeDAG(dag)
	kinds := make(map[string]bool)
	for _, f := range findings {
		kinds[f.Kind] = true
	}

	if !kinds["missing_owner"] {
		t.Error("expected missing_owner finding")
	}
	if !kinds["infinite_retry"] {
		t.Error("expected infinite_retry finding")
	}
	if !kinds["missing_compensation"] {
		t.Error("expected missing_compensation finding")
	}
}

func TestExecuteRecipe_SuccessAndCompensation(t *testing.T) {
	dag := RecipeDAG{
		ID:    "rec-exec",
		Name:  "Exec Recipe",
		Start: "step-1",
		Steps: map[string]RecipeStep{
			"step-1": {
				ID:           "step-1",
				Actor:        "agent-1",
				Capability:   "create_tmp",
				SideEffects:  "destructive",
				Compensation: "delete_tmp",
				Next:         []string{"step-2"},
			},
			"step-2": {
				ID:          "step-2",
				Actor:       "agent-1",
				Capability:  "run_fail",
				SideEffects: "read_only",
			},
		},
	}

	compensated := false
	exec := NewExecutor()
	exec.Handlers["create_tmp"] = func(ctx context.Context, step RecipeStep) error {
		return nil
	}
	exec.Handlers["run_fail"] = func(ctx context.Context, step RecipeStep) error {
		return errors.New("simulated failure")
	}
	exec.Compensations["delete_tmp"] = func(ctx context.Context, step RecipeStep) error {
		compensated = true
		return nil
	}

	ctx := context.Background()
	err := exec.Execute(ctx, dag)
	if err == nil || !strings.Contains(err.Error(), "simulated failure") {
		t.Fatalf("expected step failure, got: %v", err)
	}

	if !compensated {
		t.Error("expected compensation delete_tmp to be executed on step failure")
	}
}

func TestFromManifest_SuccessAndExecution(t *testing.T) {
	manifest := RecipeManifest{
		ID:      "test-workflow",
		Name:    "Test Workflow",
		Purpose: "Demonstrate manifest conversion and DAG execution",
		Steps: []ManifestStep{
			{
				ID:        "step-a",
				Name:      "Step A (Root)",
				AgentRole: "explorer",
				Skills:    []string{"prumo-navigation"},
			},
			{
				ID:        "step-b1",
				Name:      "Step B1 (Parallel Branch 1)",
				DependsOn: []string{"step-a"},
				AgentRole: "implementer",
				Skills:    []string{"clean-code"},
			},
			{
				ID:        "step-b2",
				Name:      "Step B2 (Parallel Branch 2)",
				DependsOn: []string{"step-a"},
				AgentRole: "tester",
				Skills:    []string{"testing-quality"},
			},
			{
				ID:        "step-c",
				Name:      "Step C (Join)",
				DependsOn: []string{"step-b1", "step-b2"},
				AgentRole: "reviewer",
				Skills:    []string{"code-review"},
				Gates:     []string{"review"},
			},
		},
	}

	dag, err := FromManifest(manifest)
	if err != nil {
		t.Fatalf("FromManifest failed: %v", err)
	}

	if dag.ID != "test-workflow" {
		t.Errorf("expected ID 'test-workflow', got %s", dag.ID)
	}
	if len(dag.Steps) != 4 {
		t.Fatalf("expected 4 steps, got %d", len(dag.Steps))
	}
	if dag.Start != "step-a" {
		t.Errorf("expected Start 'step-a', got %s", dag.Start)
	}

	executedOrder := []string{}
	exec := NewExecutor()
	exec.StepHook = func(step RecipeStep, state string, _ error) {
		if state == "completed" {
			executedOrder = append(executedOrder, step.ID)
		}
	}

	err = exec.Execute(context.Background(), *dag)
	if err != nil {
		t.Fatalf("execution failed: %v", err)
	}

	if len(executedOrder) != 4 {
		t.Fatalf("expected 4 executed steps, got %d: %v", len(executedOrder), executedOrder)
	}
	if executedOrder[0] != "step-a" {
		t.Errorf("expected step-a to execute first, got %s", executedOrder[0])
	}
	if executedOrder[3] != "step-c" {
		t.Errorf("expected step-c to execute last, got %s", executedOrder[3])
	}
}

func TestFromManifest_CatalogRecipes(t *testing.T) {
	catalogPath := "../../src/prumo/resources/catalog/recipes.json"
	recipes, err := LoadCatalogRecipes(catalogPath)
	if err != nil {
		t.Fatalf("failed to load catalog recipes from %s: %v", catalogPath, err)
	}

	if len(recipes) == 0 {
		t.Fatalf("expected at least 1 recipe in catalog, got 0")
	}

	for _, r := range recipes {
		dag, err := FromManifest(r)
		if err != nil {
			t.Errorf("failed to convert catalog recipe %s to DAG: %v", r.ID, err)
			continue
		}
		if dag.ID != r.ID {
			t.Errorf("expected DAG ID %s, got %s", r.ID, dag.ID)
		}
		if len(dag.Steps) != len(r.Steps) {
			t.Errorf("recipe %s: expected %d steps, got %d", r.ID, len(r.Steps), len(dag.Steps))
		}
	}
}

func TestExecuteRecipe_StrictMissingCapability(t *testing.T) {
	dag := RecipeDAG{
		ID:    "rec-strict",
		Name:  "Strict Test",
		Start: "step-1",
		Steps: map[string]RecipeStep{
			"step-1": {
				ID:         "step-1",
				Actor:      "agent-1",
				Capability: "unknown-cap",
			},
		},
	}

	exec := NewExecutor()
	exec.Strict = true

	err := exec.Execute(context.Background(), dag)
	if err == nil || !strings.Contains(err.Error(), "unregistered capability handler") {
		t.Fatalf("expected unregistered capability error in strict mode, got: %v", err)
	}
}
