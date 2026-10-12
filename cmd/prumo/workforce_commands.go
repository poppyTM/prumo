package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/raillen/prumo/internal/harness/team"
	"github.com/raillen/prumo/internal/protocol"
	"github.com/raillen/prumo/internal/resolver"
	"github.com/raillen/prumo/internal/workforcesync"
)

func runWorkforce(asJSON bool, home string, args []string) int {
	if len(args) == 0 {
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, "workforce subcommand required: sync, list, scaffold, inspect, lint")
		}
		fmt.Fprintf(os.Stderr, "error: workforce requires a subcommand (sync, list, scaffold, inspect, lint)\n")
		return exitUsage
	}

	subcommand := args[0]
	rest := args[1:]

	path := "."
	offline := false
	forceRemote := false
	remoteBaseURL := ""
	version := protocol.CLIVersion
	var targetSkills []string
	var targetAgents []string
	var targetRecipes []string

	for i := 0; i < len(rest); i++ {
		switch rest[i] {
		case "--path":
			if i+1 < len(rest) {
				path = rest[i+1]
				i++
			}
		case "--offline":
			offline = true
		case "--force-remote":
			forceRemote = true
		case "--remote":
			remoteBaseURL = rest[i+1]
			i++
		case "--version":
			if i+1 < len(rest) {
				version = rest[i+1]
				i++
			}
		case "--skills":
			if i+1 < len(rest) {
				targetSkills = strings.Split(rest[i+1], ",")
				i++
			}
		case "--agents":
			if i+1 < len(rest) {
				targetAgents = strings.Split(rest[i+1], ",")
				i++
			}
		case "--recipes":
			if i+1 < len(rest) {
				targetRecipes = strings.Split(rest[i+1], ",")
				i++
			}
		}
	}

	switch subcommand {
	case "sync":
		service := workforcesync.NewService()
		opts := workforcesync.Options{
			ProjectRoot:   path,
			HomeDir:       home,
			RepoRoot:      repoRoot(),
			RemoteBaseURL: remoteBaseURL,
			Version:       version,
			OfflineOnly:   offline,
			ForceRemote:   forceRemote,
			TargetSkills:  targetSkills,
			TargetAgents:  targetAgents,
			TargetRecipes: targetRecipes,
		}

		result, err := service.Sync(opts)
		if err != nil {
			return serviceError(asJSON, err)
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(result))
		}

		fmt.Printf("Workforce synchronized (Prumo v%s)\n", opts.Version)
		fmt.Printf("Total skills installed: %d\n", len(result.InstalledSkills))
		if len(result.InstalledAgents) > 0 {
			fmt.Printf("Total agents installed: %d\n", len(result.InstalledAgents))
		}
		if len(result.InstalledRecipes) > 0 {
			fmt.Printf("Total recipes installed: %d\n", len(result.InstalledRecipes))
		}
		if len(result.RemoteDownloads) > 0 {
			fmt.Printf("Downloaded from remote: %s\n", strings.Join(result.RemoteDownloads, ", "))
		}
		if len(result.CacheHits) > 0 {
			fmt.Printf("Cached items used: %d\n", len(result.CacheHits))
		}
		fmt.Println("Lockfile updated: prumo.lock")
		return exitOK

	case "list":
		skillsDir := filepath.Join(path, ".ai", "skills")
		entries, err := os.ReadDir(skillsDir)
		installed := []string{}
		if err == nil {
			for _, e := range entries {
				if e.IsDir() {
					installed = append(installed, e.Name())
				}
			}
		}

		coreSkills := []string{"clean-code", "cognitive-clarity", "testing-quality"}

		payload := map[string]any{
			"installed_skills": installed,
			"core_skills":      coreSkills,
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}

		fmt.Println("Core Skills (mandatory):")
		for _, c := range coreSkills {
			fmt.Printf("  - %s\n", c)
		}
		fmt.Printf("\nInstalled Skills in %s (%d):\n", skillsDir, len(installed))
		for _, inst := range installed {
			fmt.Printf("  - %s\n", inst)
		}
		return exitOK

	case "scaffold":
		return runWorkforceScaffold(asJSON, rest, path)

	case "inspect":
		return runWorkforceInspect(asJSON, rest, path)

	case "lint":
		return runWorkforceLint(asJSON, rest, path)

	default:
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, fmt.Sprintf("unknown workforce subcommand: %s", subcommand))
		}
		fmt.Fprintf(os.Stderr, "error: unknown workforce subcommand: %s\n", subcommand)
		return exitUsage
	}
}

func runWorkforceScaffold(asJSON bool, args []string, root string) int {
	if len(args) < 2 {
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, "workforce scaffold requires: <skill|agent> <id> [--name <name>] [--purpose <purpose>] [--out <dir>]")
		}
		fmt.Fprintln(os.Stderr, "error: workforce scaffold requires: <skill|agent> <id> [--name <name>] [--purpose <purpose>] [--out <dir>]")
		return exitUsage
	}

	kind := args[0]
	id := args[1]
	name := ""
	purpose := ""
	outDir := ""

	for i := 2; i < len(args); i++ {
		switch args[i] {
		case "--name":
			if i+1 < len(args) {
				name = args[i+1]
				i++
			}
		case "--purpose":
			if i+1 < len(args) {
				purpose = args[i+1]
				i++
			}
		case "--out":
			if i+1 < len(args) {
				outDir = args[i+1]
				i++
			}
		}
	}

	if name == "" {
		name = strings.Title(strings.ReplaceAll(id, "-", " "))
	}
	if purpose == "" {
		purpose = fmt.Sprintf("Operational workforce contract for %s", name)
	}

	switch kind {
	case "skill":
		if outDir == "" {
			if _, err := os.Stat(filepath.Join(root, "src", "prumo", "resources", "workforce", "skills")); err == nil {
				outDir = filepath.Join(root, "src", "prumo", "resources", "workforce", "skills", id)
			} else {
				outDir = filepath.Join(root, ".ai", "skills", id)
			}
		}

		if err := os.MkdirAll(outDir, 0o755); err != nil {
			return serviceError(asJSON, err)
		}

		// Subdirectories for Skill Package v3
		for _, sub := range []string{"references", "templates", "checks", "scripts", "examples"} {
			if err := os.MkdirAll(filepath.Join(outDir, sub), 0o755); err != nil {
				return serviceError(asJSON, err)
			}
		}

		manifest := map[string]any{
			"id":             id,
			"name":           name,
			"core":           false,
			"version":        1,
			"schema_version": 3,
			"purpose":        purpose,
			"risk_level":     "medium",
			"modes": []string{
				"implementation",
				"review",
				"testing",
			},
			"inputs": []map[string]any{
				{
					"name":        "context",
					"type":        "string",
					"description": "Context and instructions for this skill",
					"required":    true,
				},
			},
			"outputs": []map[string]any{
				{
					"name":        "result",
					"type":        "document",
					"description": "Output generated conforming to templates/output.md",
				},
			},
			"requires":     []string{},
			"conflicts":    []string{},
			"capabilities": []string{"filesystem.read", "filesystem.write"},
			"references": []string{
				"references/overview.md",
			},
			"templates": []string{
				"templates/output.md",
			},
			"checks": []string{
				"checks/checklist.md",
			},
			"scripts": []string{
				"scripts/verify.sh",
			},
			"examples": []string{
				"examples/example.md",
			},
			"required_evidence": []string{
				"test",
				"review",
			},
			"stop_conditions": []string{
				"Task acceptance criteria satisfied with evidence",
				"All verification checks pass",
			},
		}

		mBytes, _ := json.MarshalIndent(manifest, "", "  ")
		if err := os.WriteFile(filepath.Join(outDir, "manifest.json"), append(mBytes, '\n'), 0o644); err != nil {
			return serviceError(asJSON, err)
		}

		skillMD := fmt.Sprintf(`# Skill: %s

## Purpose
%s

## Operational Invariants
1. **Lean Progressive Context**: Load only what is needed for the current step.
2. **Deterministic Output**: Produce machine-verifiable deliverables conforming to the output schema.
3. **Evidence Gate**: Validate results against checklist and automated verification scripts before concluding.

## Instructions
1. Review the input context and identify the exact goals.
2. Follow the principles documented in `+"`references/overview.md`"+`.
3. Format output following `+"`templates/output.md`"+`.
4. Run `+"`scripts/verify.sh`"+` to confirm correctness.
`, name, purpose)
		if err := os.WriteFile(filepath.Join(outDir, "SKILL.md"), []byte(skillMD), 0o644); err != nil {
			return serviceError(asJSON, err)
		}

		_ = os.WriteFile(filepath.Join(outDir, "references", "overview.md"), []byte(fmt.Sprintf("# Overview: %s\n\nArchitectural guidelines and principles.\n", name)), 0o644)
		_ = os.WriteFile(filepath.Join(outDir, "templates", "output.md"), []byte(fmt.Sprintf("# Output Template: %s\n\nDeliverable structure.\n", name)), 0o644)
		_ = os.WriteFile(filepath.Join(outDir, "checks", "checklist.md"), []byte(fmt.Sprintf("# Checklist: %s\n\n- [ ] Quality gates satisfied\n- [ ] Regression checks green\n", name)), 0o644)
		_ = os.WriteFile(filepath.Join(outDir, "examples", "example.md"), []byte(fmt.Sprintf("# Example: %s\n\nSample inputs and expected outputs.\n", name)), 0o644)
		_ = os.WriteFile(filepath.Join(outDir, "scripts", "verify.sh"), []byte("#!/usr/bin/env bash\nset -euo pipefail\n\necho \"Verifying skill package contract...\"\nexit 0\n"), 0o755)

		payload := map[string]any{
			"kind":    "skill",
			"id":      id,
			"name":    name,
			"dir":     outDir,
			"files":   []string{"manifest.json", "SKILL.md", "references/overview.md", "templates/output.md", "checks/checklist.md", "scripts/verify.sh", "examples/example.md"},
			"version": 3,
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}
		fmt.Printf("Scaffolded Skill Package v3 %q at %s\n", id, outDir)
		return exitOK

	case "agent":
		if outDir == "" {
			if _, err := os.Stat(filepath.Join(root, "src", "prumo", "resources", "workforce", "agents")); err == nil {
				outDir = filepath.Join(root, "src", "prumo", "resources", "workforce", "agents", id)
			} else {
				outDir = filepath.Join(root, ".ai", "agents", id)
			}
		}

		if err := os.MkdirAll(outDir, 0o755); err != nil {
			return serviceError(asJSON, err)
		}

		agentManifest := map[string]any{
			"id":         id,
			"name":       name,
			"version":    1,
			"purpose":    purpose,
			"risk_level": "medium",
			"allowed_capabilities": []string{
				"filesystem.read",
				"filesystem.write",
				"process.spawn",
			},
			"inputs": []string{
				"task_brief",
			},
			"outputs": []string{
				"delivery_evidence",
			},
			"required_evidence": []string{
				"review",
				"test",
			},
			"handoff_to": []string{
				"reviewer",
			},
			"permissions": map[string]any{
				"filesystem.read":  []string{"*"},
				"filesystem.write": []string{"src/**", "tests/**", "docs/**"},
			},
			"stop_conditions": []string{
				"Acceptance criteria met with verified evidence",
			},
		}

		mBytes, _ := json.MarshalIndent(agentManifest, "", "  ")
		if err := os.WriteFile(filepath.Join(outDir, "manifest.json"), append(mBytes, '\n'), 0o644); err != nil {
			return serviceError(asJSON, err)
		}

		agentMD := fmt.Sprintf(`# Agent: %s

## Purpose
%s

## Responsibilities
- Execute operations aligned with declared capabilities.
- Produce evidence-backed outputs and hand off cleanly.

## Non-Goals
- Blanket unbound permissions.
- Skipping quality or verification gates.
`, name, purpose)
		if err := os.WriteFile(filepath.Join(outDir, "AGENT.md"), []byte(agentMD), 0o644); err != nil {
			return serviceError(asJSON, err)
		}

		payload := map[string]any{
			"kind":  "agent",
			"id":    id,
			"name":  name,
			"dir":   outDir,
			"files": []string{"manifest.json", "AGENT.md"},
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}
		fmt.Printf("Scaffolded Agent %q at %s\n", id, outDir)
		return exitOK

	default:
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, fmt.Sprintf("unsupported scaffold kind %q (must be skill or agent)", kind))
		}
		fmt.Fprintf(os.Stderr, "error: unsupported scaffold kind %q (must be skill or agent)\n", kind)
		return exitUsage
	}
}

func runWorkforceInspect(asJSON bool, args []string, root string) int {
	if len(args) < 2 {
		if asJSON {
			return envelopeError(protocol.CodeConfiguration, "workforce inspect requires: <skill|agent|recipe> <id>")
		}
		fmt.Fprintln(os.Stderr, "error: workforce inspect requires: <skill|agent|recipe> <id>")
		return exitUsage
	}

	kind := args[0]
	if !strings.HasSuffix(kind, "s") {
		kind = kind + "s"
	}
	id := args[1]

	// 1. Look in filesystem
	candidates := []string{
		filepath.Join(root, ".ai", kind, id),
		filepath.Join(root, "src", "prumo", "resources", "workforce", kind, id),
	}

	var foundDir string
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			foundDir = c
			break
		}
	}

	if foundDir != "" {
		// Read manifest
		manifestCandidates := []string{"manifest.json", "agent.json", "recipe.json"}
		var manifestData []byte
		var manifestFile string
		for _, mc := range manifestCandidates {
			p := filepath.Join(foundDir, mc)
			if data, err := os.ReadFile(p); err == nil {
				manifestData = data
				manifestFile = mc
				break
			}
		}

		var parsed map[string]any
		_ = json.Unmarshal(manifestData, &parsed)

		docCandidate := "SKILL.md"
		if strings.HasPrefix(kind, "agent") {
			docCandidate = "AGENT.md"
		} else if strings.HasPrefix(kind, "recipe") {
			docCandidate = "RECIPE.md"
		}

		docPath := filepath.Join(foundDir, docCandidate)
		docPresent := false
		if _, err := os.Stat(docPath); err == nil {
			docPresent = true
		}

		payload := map[string]any{
			"kind":          strings.TrimSuffix(kind, "s"),
			"id":            id,
			"path":          foundDir,
			"manifest_file": manifestFile,
			"document":      docCandidate,
			"doc_present":   docPresent,
			"contract":      parsed,
		}

		if asJSON {
			return printEnvelope(protocol.OkEnvelope(payload))
		}

		fmt.Printf("Workforce Package (%s): %s\n", strings.TrimSuffix(kind, "s"), id)
		fmt.Printf("  Directory: %s\n", foundDir)
		fmt.Printf("  Manifest:  %s\n", manifestFile)
		fmt.Printf("  Document:  %s (present: %v)\n", docCandidate, docPresent)
		if name, ok := parsed["name"].(string); ok {
			fmt.Printf("  Name:      %s\n", name)
		}
		if purpose, ok := parsed["purpose"].(string); ok {
			fmt.Printf("  Purpose:   %s\n", purpose)
		}
		if risk, ok := parsed["risk_level"].(string); ok {
			fmt.Printf("  Risk:      %s\n", risk)
		}
		return exitOK
	}

	// 2. Look in canonical catalog
	catalog, err := resolver.LoadCatalog(root)
	if err == nil {
		if section, ok := catalog.Sections[kind]; ok {
			for _, item := range section {
				if item["id"] == id {
					payload := map[string]any{
						"kind":     strings.TrimSuffix(kind, "s"),
						"id":       id,
						"source":   "catalog",
						"contract": item,
					}
					if asJSON {
						return printEnvelope(protocol.OkEnvelope(payload))
					}
					fmt.Printf("Workforce Catalog Entry (%s): %s\n", strings.TrimSuffix(kind, "s"), id)
					if name, ok := item["name"].(string); ok {
						fmt.Printf("  Name:    %s\n", name)
					}
					if purpose, ok := item["purpose"].(string); ok {
						fmt.Printf("  Purpose: %s\n", purpose)
					}
					return exitOK
				}
			}
		}
	}

	if asJSON {
		return envelopeError(protocol.CodeConfiguration, fmt.Sprintf("workforce entity %s %q not found in filesystem or catalog", kind, id))
	}
	fmt.Fprintf(os.Stderr, "error: workforce entity %s %q not found in filesystem or catalog\n", kind, id)
	return exitUsage
}

func runWorkforceLint(asJSON bool, args []string, root string) int {
	var findings []team.ContractFinding

	// 1. Check skills
	skillDirs := []string{
		filepath.Join(root, ".ai", "skills"),
		filepath.Join(root, "src", "prumo", "resources", "workforce", "skills"),
	}

	checkedSkills := 0
	for _, base := range skillDirs {
		entries, err := os.ReadDir(base)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			checkedSkills++
			sDir := filepath.Join(base, e.Name())
			f := team.LintSkillContract(sDir)
			findings = append(findings, f...)
		}
	}

	// 2. Check agents
	agentDirs := []string{
		filepath.Join(root, ".ai", "agents"),
		filepath.Join(root, "src", "prumo", "resources", "workforce", "agents"),
	}

	checkedAgents := 0
	for _, base := range agentDirs {
		entries, err := os.ReadDir(base)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			checkedAgents++
			aDir := filepath.Join(base, e.Name())
			mPath := filepath.Join(aDir, "manifest.json")
			if _, err := os.Stat(mPath); err != nil {
				mPath = filepath.Join(aDir, "agent.json")
			}
			mData, err := os.ReadFile(mPath)
			if err != nil {
				findings = append(findings, team.ContractFinding{
					EntityID: e.Name(),
					Kind:     "agent",
					Rule:     "manifest_exists",
					Severity: "error",
					Message:  fmt.Sprintf("missing agent manifest: %v", err),
				})
				continue
			}
			f := team.LintAgentContract(mData)
			findings = append(findings, f...)
		}
	}

	hasErrors := false
	for _, f := range findings {
		if f.Severity == "error" {
			hasErrors = true
			break
		}
	}

	payload := map[string]any{
		"checked_skills": checkedSkills,
		"checked_agents": checkedAgents,
		"findings_count": len(findings),
		"findings":       findings,
		"ok":             !hasErrors,
	}

	if asJSON {
		if hasErrors {
			_ = printEnvelope(protocol.OkEnvelope(payload))
			return exitValidation
		}
		return printEnvelope(protocol.OkEnvelope(payload))
	}

	fmt.Printf("Workforce Contract Lint: %d skills, %d agents scanned\n", checkedSkills, checkedAgents)
	if len(findings) == 0 {
		fmt.Println("✓ All workforce contracts conform to specifications (0 findings).")
		return exitOK
	}

	fmt.Printf("Findings (%d):\n", len(findings))
	for _, f := range findings {
		fmt.Printf("  [%s] %s %s (%s): %s\n", strings.ToUpper(f.Severity), f.Kind, f.EntityID, f.Rule, f.Message)
	}

	if hasErrors {
		return exitValidation
	}
	return exitOK
}
