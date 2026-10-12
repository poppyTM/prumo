package resolver

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type Profile struct {
	Raw map[string]any
}

func LoadProfile(path string) (Profile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Profile{}, err
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return Profile{}, err
	}
	return Profile{Raw: raw}, nil
}

func (p Profile) ProjectTypes() map[string]bool { return stringSet(nested(p.Raw, "project", "type")) }
func (p Profile) Features() map[string]bool     { return stringSet(p.Raw["features"]) }
func (p Profile) Risks() map[string]bool {
	out := stringSet(p.Raw["risk"])
	quality, _ := p.Raw["quality"].(map[string]any)
	for key, value := range quality {
		if value == true || value == "high" {
			out[strings.ToLower(key)] = true
		}
	}
	return out
}
func (p Profile) StackTokens() map[string]bool { return flattenSet(p.Raw["stack"]) }
func (p Profile) Orchestrator() string {
	ai, _ := p.Raw["ai"].(map[string]any)
	if value, ok := ai["orchestrator"].(string); ok && value != "" {
		return value
	}
	return "native"
}

func (p Profile) Autonomy() string {
	ai, _ := p.Raw["ai"].(map[string]any)
	if value, ok := ai["autonomy"].(string); ok && value != "" {
		return value
	}
	return "agentic"
}

func (p Profile) PreferredModels() []map[string]any {
	ai, _ := p.Raw["ai"].(map[string]any)
	raw, _ := ai["preferred_models"].([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if m, ok := item.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

func nested(root map[string]any, keys ...string) any {
	var value any = root
	for _, key := range keys {
		m, ok := value.(map[string]any)
		if !ok {
			return nil
		}
		value = m[key]
	}
	return value
}
func stringSet(value any) map[string]bool {
	out := map[string]bool{}
	switch v := value.(type) {
	case string:
		out[strings.ToLower(v)] = true
	case []any:
		for _, x := range v {
			out[strings.ToLower(fmt.Sprint(x))] = true
		}
	case []string:
		for _, x := range v {
			out[strings.ToLower(x)] = true
		}
	}
	return out
}
func flattenSet(value any) map[string]bool {
	out := map[string]bool{}
	var walk func(any)
	walk = func(v any) {
		switch x := v.(type) {
		case map[string]any:
			for k, child := range x {
				out[strings.ToLower(k)] = true
				walk(child)
			}
		case []any:
			for _, child := range x {
				walk(child)
			}
		case []string:
			for _, child := range x {
				out[strings.ToLower(child)] = true
			}
		case string:
			out[strings.ToLower(x)] = true
		case float64, bool:
			out[strings.ToLower(fmt.Sprint(x))] = true
		}
	}
	walk(value)
	return out
}
func anyMatch(values any, actual map[string]bool) bool {
	for key := range stringSet(values) {
		if actual[key] {
			return true
		}
	}
	return false
}

type Catalog struct{ Sections map[string][]map[string]any }

func LoadCatalog(repoRoot string) (Catalog, error) {
	base := filepath.Join(repoRoot, "src", "prumo", "resources", "catalog")
	manifestBytes, err := os.ReadFile(filepath.Join(base, "catalog.json"))
	if err != nil {
		return Catalog{}, err
	}
	var manifest struct {
		Sections map[string]string `json:"sections"`
	}
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return Catalog{}, err
	}
	catalog := Catalog{Sections: map[string][]map[string]any{}}
	for section, file := range manifest.Sections {
		data, err := os.ReadFile(filepath.Join(base, file))
		if err != nil {
			return Catalog{}, err
		}
		var raw []any
		var body map[string]any
		if err := json.Unmarshal(data, &body); err == nil {
			raw, _ = body[section].([]any)
		} else {
			var list []any
			if err := json.Unmarshal(data, &list); err != nil {
				return Catalog{}, err
			}
			raw = list
		}
		for _, item := range raw {
			if m, ok := item.(map[string]any); ok {
				catalog.Sections[section] = append(catalog.Sections[section], m)
			}
		}
	}
	return catalog, nil
}
func byID(items []map[string]any) map[string]map[string]any {
	out := map[string]map[string]any{}
	for _, item := range items {
		if id, ok := item["id"].(string); ok {
			out[id] = item
		}
	}
	return out
}
func sortedKeys(values map[string]bool) []string {
	out := []string{}
	for key := range values {
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}

type Resolution struct {
	Agents  []string                    `json:"agents"`
	Skills  []string                    `json:"skills"`
	Recipes []string                    `json:"recipes"`
	Reasons map[string][]string         `json:"reasons"`
	Traces  map[string][]map[string]any `json:"traces"`
}

func selectorMatches(item map[string]any, p Profile) (bool, []string, []map[string]any) {
	if item["core"] == true {
		return true, []string{"core"}, []map[string]any{{"type": "core", "value": "core"}}
	}
	selector, _ := item["select"].(map[string]any)
	checks := []bool{}
	reasons := []string{}
	traces := []map[string]any{}
	checksFor := []struct {
		name   string
		key    string
		actual map[string]bool
	}{{"project-type", "project_types", p.ProjectTypes()}, {"stack", "stack_any", p.StackTokens()}, {"feature", "features_any", p.Features()}, {"risk", "risk_any", p.Risks()}}
	for _, check := range checksFor {
		if raw, ok := selector[check.key]; ok {
			matched := anyMatch(raw, check.actual)
			checks = append(checks, matched)
			if matched {
				reasons = append(reasons, check.name)
				traces = append(traces, map[string]any{"type": check.name, "value": raw})
			}
		}
	}
	if len(checks) == 0 {
		return false, nil, nil
	}
	for _, ok := range checks {
		if !ok {
			return false, nil, nil
		}
	}
	return true, reasons, traces
}
func intersectRequired(item map[string]any, selected map[string]bool) []string {
	raw, _ := item["requires_skills_any"].([]any)
	out := []string{}
	for _, v := range raw {
		if selected[fmt.Sprint(v)] {
			out = append(out, fmt.Sprint(v))
		}
	}
	sort.Strings(out)
	return out
}
func (c Catalog) Resolve(p Profile) Resolution {
	skills := byID(c.Sections["skills"])
	agents := byID(c.Sections["agents"])
	recipes := byID(c.Sections["recipes"])
	selectedSkills, selectedAgents, selectedRecipes := map[string]bool{}, map[string]bool{}, map[string]bool{}
	reasons := map[string][]string{}
	traces := map[string][]map[string]any{}
	for _, bundle := range c.Sections["bundles"] {
		if strings.ToLower(fmt.Sprint(bundle["project_type"])) != "" && p.ProjectTypes()[strings.ToLower(fmt.Sprint(bundle["project_type"]))] {
			bt := map[string]any{"type": "bundle", "value": bundle["id"]}
			for _, pair := range []struct {
				key string
				out map[string]bool
			}{{"skills", selectedSkills}, {"agents", selectedAgents}, {"recipes", selectedRecipes}} {
				if raw, ok := bundle[pair.key].([]any); ok {
					for _, v := range raw {
						id := fmt.Sprint(v)
						pair.out[id] = true
						reasons[id] = append(reasons[id], "bundle:"+fmt.Sprint(bundle["id"]))
						traces[id] = append(traces[id], bt)
					}
				}
			}
		}
	}
	for id, item := range skills {
		if ok, why, tr := selectorMatches(item, p); ok {
			selectedSkills[id] = true
			reasons[id] = append(reasons[id], why...)
			traces[id] = append(traces[id], tr...)
		}
	}
	for _, rule := range c.Sections["risk_rules"] {
		trigger := stringSet(rule["when_any"])
		universe := p.Risks()
		for k := range p.Features() {
			universe[k] = true
		}
		for k := range p.ProjectTypes() {
			universe[k] = true
		}
		hit := false
		for k := range trigger {
			if universe[k] {
				hit = true
			}
		}
		if hit {
			trace := map[string]any{"type": "risk-rule", "value": rule["id"]}
			if raw, ok := rule["require_skills"].([]any); ok {
				for _, v := range raw {
					id := fmt.Sprint(v)
					selectedSkills[id] = true
					reasons[id] = append(reasons[id], "risk-rule:"+fmt.Sprint(rule["id"]))
					traces[id] = append(traces[id], trace)
				}
			}
		}
	}
	for id, item := range agents {
		ok, why, tr := selectorMatches(item, p)
		required := intersectRequired(item, selectedSkills)
		if ok || len(required) > 0 {
			selectedAgents[id] = true
			if len(why) == 0 {
				why = []string{"skill-match"}
				tr = []map[string]any{{"type": "skill-match", "value": required}}
			}
			reasons[id] = append(reasons[id], why...)
			traces[id] = append(traces[id], tr...)
		}
	}
	for id, item := range recipes {
		ok, why, tr := selectorMatches(item, p)
		required := intersectRequired(item, selectedSkills)
		if ok || len(required) > 0 {
			selectedRecipes[id] = true
			if len(why) == 0 {
				why = []string{"skill-match"}
				tr = []map[string]any{{"type": "skill-match", "value": required}}
			}
			reasons[id] = append(reasons[id], why...)
			traces[id] = append(traces[id], tr...)
		}
	}
	changed := true
	for changed {
		changed = false
		for id := range selectedSkills {
			raw, _ := skills[id]["requires"].([]any)
			for _, v := range raw {
				dep := fmt.Sprint(v)
				if !selectedSkills[dep] {
					selectedSkills[dep] = true
					reasons[dep] = append(reasons[dep], "dependency:"+id)
					traces[dep] = append(traces[dep], map[string]any{"type": "dependency", "value": id})
					changed = true
				}
			}
		}
	}
	clean := func(values map[string]bool) []string { return sortedKeys(values) }
	for id, values := range reasons {
		set := map[string]bool{}
		for _, v := range values {
			set[v] = true
		}
		reasons[id] = sortedKeys(set)
	}
	return Resolution{Agents: clean(selectedAgents), Skills: clean(selectedSkills), Recipes: clean(selectedRecipes), Reasons: reasons, Traces: traces}
}
