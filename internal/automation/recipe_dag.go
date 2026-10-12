package automation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

var (
	ErrInvalidDAG          = errors.New("recipe: invalid DAG")
	ErrCycleDetected       = errors.New("recipe: cycle detected in recipe DAG")
	ErrMissingOwner        = errors.New("recipe: step missing owner actor")
	ErrInfiniteRetry       = errors.New("recipe: unbounded or infinite retry detected")
	ErrMissingCompensation = errors.New("recipe: destructive step missing compensation procedure")
	ErrStepFailed          = errors.New("recipe: step execution failed")
	ErrRecipeNotFound      = errors.New("recipe: recipe not found")
)

// ManifestStep describes one step in the canonical workforce recipe manifest.
type ManifestStep struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	DependsOn        []string `json:"depends_on,omitempty"`
	AgentRole        string   `json:"agent_role"`
	Skills           []string `json:"skills,omitempty"`
	Input            string   `json:"input,omitempty"`
	Output           string   `json:"output,omitempty"`
	RequiredEvidence []string `json:"required_evidence,omitempty"`
	Gates            []string `json:"gates,omitempty"`
}

// RecipeManifest represents the canonical schema for workforce recipes (schemas/recipe.schema.json).
type RecipeManifest struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Version        int            `json:"version,omitempty"`
	Purpose        string         `json:"purpose"`
	Select         map[string]any `json:"select,omitempty"`
	Preconditions  []string       `json:"preconditions,omitempty"`
	Inputs         []string       `json:"inputs,omitempty"`
	Agents         []string       `json:"agents,omitempty"`
	Skills         []string       `json:"skills,omitempty"`
	Gates          any            `json:"gates,omitempty"` // string array or object per schema
	Artifacts      []string       `json:"artifacts,omitempty"`
	Fallbacks      []any          `json:"fallbacks,omitempty"`
	StopConditions []string       `json:"stop_conditions,omitempty"`
	Steps          []ManifestStep `json:"steps"`
}

// RecipeStep declares one node in the Recipe workflow.
type RecipeStep struct {
	ID               string   `json:"id"`
	Name             string   `json:"name,omitempty"`
	Actor            string   `json:"actor"` // step owner (required)
	Capability       string   `json:"capability"`
	Skills           []string `json:"skills,omitempty"`
	Inputs           []string `json:"inputs"`
	Outputs          []string `json:"outputs"`
	Preconditions    []string `json:"preconditions,omitempty"`
	SideEffects      string   `json:"side_effects"`             // read_only, idempotent, stateful, destructive
	RetryLimit       int      `json:"retry_limit"`              // must be >= 0 and <= 10
	FailurePolicy    string   `json:"failure_policy,omitempty"` // stop, compensate, continue
	Compensation     string   `json:"compensation,omitempty"`   // required if destructive
	Evidence         string   `json:"evidence,omitempty"`
	RequiredEvidence []string `json:"required_evidence,omitempty"`
	Gate             string   `json:"gate,omitempty"`
	Gates            []string `json:"gates,omitempty"`
	DependsOn        []string `json:"depends_on,omitempty"`
	Next             []string `json:"next,omitempty"`
}

// RecipeDAG is the directed acyclic graph representing a complete recipe.
type RecipeDAG struct {
	ID    string                `json:"id"`
	Name  string                `json:"name"`
	Steps map[string]RecipeStep `json:"steps"`
	Start string                `json:"start"`
}

// FromManifest converts a canonical RecipeManifest into an executable RecipeDAG.
func FromManifest(m RecipeManifest) (*RecipeDAG, error) {
	if len(m.Steps) == 0 {
		return nil, fmt.Errorf("%w: recipe %q has no steps", ErrInvalidDAG, m.ID)
	}

	dag := &RecipeDAG{
		ID:    m.ID,
		Name:  m.Name,
		Steps: make(map[string]RecipeStep, len(m.Steps)),
	}

	stepMap := make(map[string]ManifestStep, len(m.Steps))
	for _, s := range m.Steps {
		stepMap[s.ID] = s
	}

	// Validate step dependencies and build Next transitions
	nextMap := make(map[string][]string)
	for _, s := range m.Steps {
		for _, dep := range s.DependsOn {
			if _, exists := stepMap[dep]; !exists {
				return nil, fmt.Errorf("%w: step %q depends on non-existent step %q", ErrInvalidDAG, s.ID, dep)
			}
			nextMap[dep] = append(nextMap[dep], s.ID)
		}
	}

	// Identify root steps (steps with no dependencies)
	var roots []string
	for _, s := range m.Steps {
		if len(s.DependsOn) == 0 {
			roots = append(roots, s.ID)
		}
	}
	if len(roots) == 0 {
		return nil, fmt.Errorf("%w: cycle detected, no root step found in recipe %q", ErrCycleDetected, m.ID)
	}

	sort.Strings(roots)
	dag.Start = roots[0]

	for _, s := range m.Steps {
		capName := s.AgentRole
		if len(s.Skills) > 0 {
			capName = s.Skills[0]
		}

		var inputs []string
		if s.Input != "" {
			inputs = []string{s.Input}
		}

		var outputs []string
		if s.Output != "" {
			outputs = []string{s.Output}
		}

		var ev string
		if len(s.RequiredEvidence) > 0 {
			ev = s.RequiredEvidence[0]
		}

		var g string
		if len(s.Gates) > 0 {
			g = s.Gates[0]
		}

		nextSteps := nextMap[s.ID]
		sort.Strings(nextSteps)

		step := RecipeStep{
			ID:               s.ID,
			Name:             s.Name,
			Actor:            s.AgentRole,
			Capability:       capName,
			Skills:           s.Skills,
			Inputs:           inputs,
			Outputs:          outputs,
			SideEffects:      "idempotent",
			RetryLimit:       1,
			Evidence:         ev,
			RequiredEvidence: s.RequiredEvidence,
			Gate:             g,
			Gates:            s.Gates,
			DependsOn:        s.DependsOn,
			Next:             nextSteps,
		}
		dag.Steps[s.ID] = step
	}

	findings := LintRecipeDAG(*dag)
	if len(findings) > 0 {
		return nil, fmt.Errorf("%w: %s", ErrInvalidDAG, findings[0].Message)
	}

	return dag, nil
}

// LintFinding describes one validation problem found in a Recipe DAG.
type LintFinding struct {
	StepID  string `json:"step_id,omitempty"`
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

// LintRecipeDAG validates all structural invariants per Rule 32.
func LintRecipeDAG(dag RecipeDAG) []LintFinding {
	findings := []LintFinding{}

	if len(dag.Steps) == 0 {
		return []LintFinding{{Kind: "empty_dag", Message: "recipe DAG has no steps"}}
	}

	if dag.Start == "" || dag.Steps[dag.Start].ID == "" {
		findings = append(findings, LintFinding{
			Kind:    "invalid_start",
			Message: fmt.Sprintf("start step %q does not exist in DAG", dag.Start),
		})
	}

	// 1. Step-level validation
	for id, step := range dag.Steps {
		if step.Actor == "" {
			findings = append(findings, LintFinding{
				StepID:  id,
				Kind:    "missing_owner",
				Message: fmt.Sprintf("step %q has no owner actor", id),
			})
		}

		if step.RetryLimit < 0 || step.RetryLimit > 10 {
			findings = append(findings, LintFinding{
				StepID:  id,
				Kind:    "infinite_retry",
				Message: fmt.Sprintf("step %q has invalid retry limit %d (must be 0-10)", id, step.RetryLimit),
			})
		}

		if step.SideEffects == "destructive" && step.Compensation == "" {
			findings = append(findings, LintFinding{
				StepID:  id,
				Kind:    "missing_compensation",
				Message: fmt.Sprintf("destructive step %q requires explicit compensation", id),
			})
		}

		for _, nextID := range step.Next {
			if _, exists := dag.Steps[nextID]; !exists {
				findings = append(findings, LintFinding{
					StepID:  id,
					Kind:    "dangling_transition",
					Message: fmt.Sprintf("step %q transitions to nonexistent step %q", id, nextID),
				})
			}
		}

		for _, depID := range step.DependsOn {
			if _, exists := dag.Steps[depID]; !exists {
				findings = append(findings, LintFinding{
					StepID:  id,
					Kind:    "dangling_dependency",
					Message: fmt.Sprintf("step %q depends on nonexistent step %q", id, depID),
				})
			}
		}
	}

	// 2. Cycle detection using DFS with 3-color states (0=unvisited, 1=visiting, 2=visited)
	visited := make(map[string]int)
	var hasCycle bool
	var cyclePath string

	var dfs func(u string, path []string)
	dfs = func(u string, path []string) {
		visited[u] = 1 // visiting
		currPath := append(path, u)

		step, ok := dag.Steps[u]
		if ok {
			for _, v := range step.Next {
				if visited[v] == 1 {
					hasCycle = true
					cyclePath = fmt.Sprintf("%v -> %s", currPath, v)
					return
				}
				if visited[v] == 0 {
					dfs(v, currPath)
					if hasCycle {
						return
					}
				}
			}
		}
		visited[u] = 2 // visited
	}

	for id := range dag.Steps {
		if visited[id] == 0 {
			dfs(id, []string{})
			if hasCycle {
				findings = append(findings, LintFinding{
					Kind:    "cycle_detected",
					Message: fmt.Sprintf("cycle detected in recipe DAG: %s", cyclePath),
				})
				break
			}
		}
	}

	return findings
}

// StepHandler is the function executed for a recipe step.
type StepHandler func(ctx context.Context, step RecipeStep) error

// Executor executes steps in a validated Recipe DAG with true topological traversal.
type Executor struct {
	Handlers       map[string]StepHandler
	Compensations  map[string]StepHandler
	DefaultHandler StepHandler
	Strict         bool
	StepHook       func(step RecipeStep, state string, err error)
}

// NewExecutor creates a new recipe workflow executor.
func NewExecutor() *Executor {
	return &Executor{
		Handlers:      make(map[string]StepHandler),
		Compensations: make(map[string]StepHandler),
	}
}

// Execute runs the DAG honoring all dependencies, parallel branches, and compensations (resolving GAP-134).
func (e *Executor) Execute(ctx context.Context, dag RecipeDAG) error {
	findings := LintRecipeDAG(dag)
	if len(findings) > 0 {
		return fmt.Errorf("%w: %s", ErrInvalidDAG, findings[0].Message)
	}

	// Build prerequisite (incoming edges) map
	prereqs := make(map[string]map[string]bool)
	for id := range dag.Steps {
		prereqs[id] = make(map[string]bool)
	}

	for id, step := range dag.Steps {
		if len(step.DependsOn) > 0 {
			for _, dep := range step.DependsOn {
				if _, ok := dag.Steps[dep]; ok {
					prereqs[id][dep] = true
				}
			}
		}
		for _, nextID := range step.Next {
			if _, ok := dag.Steps[nextID]; ok {
				prereqs[nextID][id] = true
			}
		}
	}

	completed := make(map[string]bool)
	executedSteps := []RecipeStep{}

	for len(completed) < len(dag.Steps) {
		// Identify ready steps (all prerequisites completed)
		var ready []string
		for id := range dag.Steps {
			if completed[id] {
				continue
			}
			canRun := true
			for dep := range prereqs[id] {
				if !completed[dep] {
					canRun = false
					break
				}
			}
			if canRun {
				ready = append(ready, id)
			}
		}

		if len(ready) == 0 {
			return fmt.Errorf("%w: deadlock or unreachable steps remaining in DAG", ErrInvalidDAG)
		}

		// Sort ready steps for deterministic order
		sort.Strings(ready)

		// Execute ready steps
		for _, stepID := range ready {
			step := dag.Steps[stepID]
			handler := e.Handlers[step.Capability]
			if handler == nil && e.DefaultHandler != nil {
				handler = e.DefaultHandler
			}
			if handler == nil {
				if e.Strict {
					return fmt.Errorf("%w: unregistered capability handler for %q in step %s", ErrStepFailed, step.Capability, step.ID)
				}
				handler = func(_ context.Context, _ RecipeStep) error { return nil }
			}

			if e.StepHook != nil {
				e.StepHook(step, "running", nil)
			}

			var lastErr error
			attempts := step.RetryLimit + 1
			for a := 0; a < attempts; a++ {
				lastErr = handler(ctx, step)
				if lastErr == nil {
					break
				}
			}

			if lastErr != nil {
				if e.StepHook != nil {
					e.StepHook(step, "failed", lastErr)
				}
				// Trigger compensation for previously executed destructive steps in reverse order
				for i := len(executedSteps) - 1; i >= 0; i-- {
					prev := executedSteps[i]
					if prev.SideEffects == "destructive" && prev.Compensation != "" {
						if compHandler := e.Compensations[prev.Compensation]; compHandler != nil {
							_ = compHandler(ctx, prev)
						}
					}
				}
				return fmt.Errorf("%w at step %s: %v", ErrStepFailed, step.ID, lastErr)
			}

			if e.StepHook != nil {
				e.StepHook(step, "completed", nil)
			}
			executedSteps = append(executedSteps, step)
			completed[stepID] = true
		}
	}

	return nil
}

// LoadRecipeFile loads a single recipe manifest from a file path.
func LoadRecipeFile(filePath string) (*RecipeManifest, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read recipe file %s: %w", filePath, err)
	}
	var manifest RecipeManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("unmarshal recipe file %s: %w", filePath, err)
	}
	return &manifest, nil
}

// LoadRecipeFromDir loads a recipe from its package directory.
func LoadRecipeFromDir(recipesDir, id string) (*RecipeManifest, error) {
	manifestPath := filepath.Join(recipesDir, id, "recipe.json")
	if _, err := os.Stat(manifestPath); err != nil {
		manifestPath = filepath.Join(recipesDir, id, "manifest.json")
	}
	if _, err := os.Stat(manifestPath); err != nil {
		return nil, fmt.Errorf("%w: %s at %s", ErrRecipeNotFound, id, recipesDir)
	}
	return LoadRecipeFile(manifestPath)
}

// LoadAllRecipesFromDir loads all recipes from a base directory.
func LoadAllRecipesFromDir(recipesDir string) ([]RecipeManifest, error) {
	entries, err := os.ReadDir(recipesDir)
	if err != nil {
		return nil, fmt.Errorf("read recipes directory %s: %w", recipesDir, err)
	}

	var recipes []RecipeManifest
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		manifest, err := LoadRecipeFromDir(recipesDir, entry.Name())
		if err != nil {
			continue
		}
		recipes = append(recipes, *manifest)
	}

	sort.Slice(recipes, func(i, j int) bool {
		return recipes[i].ID < recipes[j].ID
	})
	return recipes, nil
}

// LoadCatalogRecipes loads all recipes from catalog/recipes.json.
func LoadCatalogRecipes(catalogFile string) ([]RecipeManifest, error) {
	data, err := os.ReadFile(catalogFile)
	if err != nil {
		return nil, fmt.Errorf("read catalog file %s: %w", catalogFile, err)
	}

	var list []RecipeManifest
	if err := json.Unmarshal(data, &list); err == nil {
		return list, nil
	}

	var wrapped struct {
		Recipes []RecipeManifest `json:"recipes"`
	}
	if err := json.Unmarshal(data, &wrapped); err != nil {
		return nil, fmt.Errorf("unmarshal catalog recipes %s: %w", catalogFile, err)
	}
	return wrapped.Recipes, nil
}
