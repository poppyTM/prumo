package workforcesync

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/raillen/prumo/internal/install"
	"github.com/raillen/prumo/internal/packages"
	"github.com/raillen/prumo/internal/protocol"
	"github.com/raillen/prumo/internal/resolver"
)

var (
	ErrSkillNotFound   = errors.New("skill not found in catalog or remote")
	ErrOfflineRequired = errors.New("cannot download skill: offline mode enabled and package not cached")
)

type Options struct {
	ProjectRoot   string
	HomeDir       string
	RepoRoot      string
	RemoteBaseURL string
	Version       string
	OfflineOnly   bool
	ForceRemote   bool
	TargetSkills  []string
	TargetAgents  []string
	TargetRecipes []string
}

type Result struct {
	ResolvedSkills   []string            `json:"resolved_skills"`
	InstalledSkills  []string            `json:"installed_skills"`
	ResolvedAgents   []string            `json:"resolved_agents,omitempty"`
	InstalledAgents  []string            `json:"installed_agents,omitempty"`
	ResolvedRecipes  []string            `json:"resolved_recipes,omitempty"`
	InstalledRecipes []string            `json:"installed_recipes,omitempty"`
	CacheHits        []string            `json:"cache_hits"`
	RemoteDownloads  []string            `json:"remote_downloads"`
	LockPackages     []packages.Resolved `json:"lock_packages"`
}

type Service struct {
	HTTPClient *http.Client
}

func NewService() *Service {
	return &Service{
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *Service) Sync(opts Options) (*Result, error) {
	if opts.ProjectRoot == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return nil, err
		}
		opts.ProjectRoot = cwd
	}
	if opts.HomeDir == "" {
		home, err := install.HomeDir("")
		if err != nil {
			return nil, err
		}
		opts.HomeDir = home
	}
	if opts.Version == "" {
		opts.Version = protocol.CLIVersion
	}
	if opts.RemoteBaseURL == "" {
		opts.RemoteBaseURL = fmt.Sprintf("https://raw.githubusercontent.com/raillen/prumo/v%s", opts.Version)
	}

	// 1. Determine skills to install
	skillsToInstall := opts.TargetSkills
	if len(skillsToInstall) == 0 {
		var profile resolver.Profile
		profilePath := filepath.Join(opts.ProjectRoot, "prumo.json")
		if p, err := resolver.LoadProfile(profilePath); err == nil {
			profile = p
		} else {
			profile = resolver.Profile{Raw: map[string]any{}}
		}

		catalogRoot := opts.RepoRoot
		if catalogRoot == "" {
			// Check if we are within the prumo repository
			if _, err := os.Stat("src/prumo/resources/catalog/catalog.json"); err == nil {
				catalogRoot = "."
			}
		}

		if catalogRoot != "" {
			catalog, err := resolver.LoadCatalog(catalogRoot)
			if err == nil {
				resolution := catalog.Resolve(profile)
				skillsToInstall = resolution.Skills
			}
		}

		// Always ensure core skills are included
		coreSkills := []string{"clean-code", "cognitive-clarity", "testing-quality"}
		present := map[string]bool{}
		for _, s := range skillsToInstall {
			present[s] = true
		}
		for _, c := range coreSkills {
			if !present[c] {
				skillsToInstall = append(skillsToInstall, c)
			}
		}
	}
	sort.Strings(skillsToInstall)

	result := &Result{
		ResolvedSkills:  skillsToInstall,
		InstalledSkills: []string{},
		CacheHits:       []string{},
		RemoteDownloads: []string{},
		LockPackages:    []packages.Resolved{},
	}

	targetDir := filepath.Join(opts.ProjectRoot, ".ai", "skills")
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return nil, err
	}

	for _, skillID := range skillsToInstall {
		cacheSkillDir := filepath.Join(opts.HomeDir, "cache", "workforce", opts.Version, "skills", skillID)
		manifestPath := filepath.Join(cacheSkillDir, "manifest.json")

		inCache := false
		if !opts.ForceRemote {
			if info, err := os.Stat(manifestPath); err == nil && !info.IsDir() {
				inCache = true
			}
		}

		if inCache {
			result.CacheHits = append(result.CacheHits, skillID)
		} else {
			// Populate cache from RepoRoot if available
			populated := false
			if opts.RepoRoot != "" {
				repoSkillDir := filepath.Join(opts.RepoRoot, "src", "prumo", "resources", "workforce", "skills", skillID)
				if info, err := os.Stat(repoSkillDir); err == nil && info.IsDir() {
					_ = copyDir(repoSkillDir, cacheSkillDir)
					populated = true
				}
			}

			// If not populated from repo, attempt remote download
			if !populated {
				if opts.OfflineOnly {
					return nil, fmt.Errorf("%w: %s", ErrOfflineRequired, skillID)
				}
				if err := s.downloadSkill(opts.RemoteBaseURL, skillID, cacheSkillDir); err != nil {
					// Fallback to local fallback if exists in relative directory
					fallbackDir := filepath.Join("src", "prumo", "resources", "workforce", "skills", skillID)
					if info, statErr := os.Stat(fallbackDir); statErr == nil && info.IsDir() {
						_ = copyDir(fallbackDir, cacheSkillDir)
					} else {
						return nil, fmt.Errorf("failed to fetch skill %q: %w", skillID, err)
					}
				} else {
					result.RemoteDownloads = append(result.RemoteDownloads, skillID)
				}
			}
		}

		// Copy from cache to project .ai/skills/<skillID>
		destSkillDir := filepath.Join(targetDir, skillID)
		if err := copyDir(cacheSkillDir, destSkillDir); err != nil {
			return nil, fmt.Errorf("failed to install skill %q into project: %w", skillID, err)
		}
		result.InstalledSkills = append(result.InstalledSkills, skillID)

		// Calculate recursive tree checksum of installed skill package (GAP-147)
		sum, err := packages.DirectoryChecksum(destSkillDir)
		if err != nil {
			destManifest := filepath.Join(destSkillDir, "manifest.json")
			if manifestData, readErr := os.ReadFile(destManifest); readErr == nil {
				sum = packages.Checksum(manifestData)
			} else {
				sum = "unknown"
			}
		}

		result.LockPackages = append(result.LockPackages, packages.Resolved{
			ID:       skillID,
			Version:  opts.Version,
			Checksum: sum,
			Type:     "skill",
		})
	}

	// Update .ai/skills/manifest.json
	skillsManifest := map[string]any{
		"version": opts.Version,
		"skills":  result.InstalledSkills,
		"updated": time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.MarshalIndent(skillsManifest, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(targetDir, "manifest.json"), append(data, '\n'), 0644)
	}

	// 2. Synchronize agents if requested
	if len(opts.TargetAgents) > 0 {
		agentsTargetDir := filepath.Join(opts.ProjectRoot, ".ai", "agents")
		if err := os.MkdirAll(agentsTargetDir, 0755); err != nil {
			return nil, err
		}
		sort.Strings(opts.TargetAgents)
		result.ResolvedAgents = opts.TargetAgents
		for _, agentID := range opts.TargetAgents {
			cacheAgentDir := filepath.Join(opts.HomeDir, "cache", "workforce", opts.Version, "agents", agentID)
			inCache := false
			if !opts.ForceRemote {
				if info, err := os.Stat(filepath.Join(cacheAgentDir, "manifest.json")); err == nil && !info.IsDir() {
					inCache = true
				} else if info, err := os.Stat(filepath.Join(cacheAgentDir, "agent.json")); err == nil && !info.IsDir() {
					inCache = true
				}
			}

			if inCache {
				result.CacheHits = append(result.CacheHits, agentID)
			} else {
				populated := false
				if opts.RepoRoot != "" {
					repoAgentDir := filepath.Join(opts.RepoRoot, "src", "prumo", "resources", "workforce", "agents", agentID)
					if info, err := os.Stat(repoAgentDir); err == nil && info.IsDir() {
						_ = copyDir(repoAgentDir, cacheAgentDir)
						populated = true
					}
				}
				if !populated {
					fallbackDir := filepath.Join("src", "prumo", "resources", "workforce", "agents", agentID)
					if info, statErr := os.Stat(fallbackDir); statErr == nil && info.IsDir() {
						_ = copyDir(fallbackDir, cacheAgentDir)
						populated = true
					}
				}
				if !populated {
					if opts.OfflineOnly {
						return nil, fmt.Errorf("%w: agent %s", ErrOfflineRequired, agentID)
					}
					if err := s.downloadAgent(opts.RemoteBaseURL, agentID, cacheAgentDir); err != nil {
						return nil, fmt.Errorf("failed to fetch agent %q: %w", agentID, err)
					}
					result.RemoteDownloads = append(result.RemoteDownloads, agentID)
				}
			}

			destAgentDir := filepath.Join(agentsTargetDir, agentID)
			if err := copyDir(cacheAgentDir, destAgentDir); err != nil {
				return nil, fmt.Errorf("failed to install agent %q into project: %w", agentID, err)
			}
			result.InstalledAgents = append(result.InstalledAgents, agentID)

			sum, err := packages.DirectoryChecksum(destAgentDir)
			if err != nil {
				sum = "unknown"
			}
			result.LockPackages = append(result.LockPackages, packages.Resolved{
				ID:       agentID,
				Version:  opts.Version,
				Checksum: sum,
				Type:     "agent",
			})
		}

		agentsManifest := map[string]any{
			"version": opts.Version,
			"agents":  result.InstalledAgents,
			"updated": time.Now().UTC().Format(time.RFC3339),
		}
		if data, err := json.MarshalIndent(agentsManifest, "", "  "); err == nil {
			_ = os.WriteFile(filepath.Join(agentsTargetDir, "manifest.json"), append(data, '\n'), 0644)
		}
	}

	// 3. Synchronize recipes if requested
	if len(opts.TargetRecipes) > 0 {
		recipesTargetDir := filepath.Join(opts.ProjectRoot, ".ai", "recipes")
		if err := os.MkdirAll(recipesTargetDir, 0755); err != nil {
			return nil, err
		}
		sort.Strings(opts.TargetRecipes)
		result.ResolvedRecipes = opts.TargetRecipes
		for _, recipeID := range opts.TargetRecipes {
			cacheRecipeDir := filepath.Join(opts.HomeDir, "cache", "workforce", opts.Version, "recipes", recipeID)
			inCache := false
			if !opts.ForceRemote {
				if info, err := os.Stat(filepath.Join(cacheRecipeDir, "recipe.json")); err == nil && !info.IsDir() {
					inCache = true
				} else if info, err := os.Stat(filepath.Join(cacheRecipeDir, "manifest.json")); err == nil && !info.IsDir() {
					inCache = true
				}
			}

			if inCache {
				result.CacheHits = append(result.CacheHits, recipeID)
			} else {
				populated := false
				if opts.RepoRoot != "" {
					repoRecipeDir := filepath.Join(opts.RepoRoot, "src", "prumo", "resources", "workforce", "recipes", recipeID)
					if info, err := os.Stat(repoRecipeDir); err == nil && info.IsDir() {
						_ = copyDir(repoRecipeDir, cacheRecipeDir)
						populated = true
					}
				}
				if !populated {
					fallbackDir := filepath.Join("src", "prumo", "resources", "workforce", "recipes", recipeID)
					if info, statErr := os.Stat(fallbackDir); statErr == nil && info.IsDir() {
						_ = copyDir(fallbackDir, cacheRecipeDir)
						populated = true
					}
				}
				if !populated {
					if opts.OfflineOnly {
						return nil, fmt.Errorf("%w: recipe %s", ErrOfflineRequired, recipeID)
					}
					if err := s.downloadRecipe(opts.RemoteBaseURL, recipeID, cacheRecipeDir); err != nil {
						return nil, fmt.Errorf("failed to fetch recipe %q: %w", recipeID, err)
					}
					result.RemoteDownloads = append(result.RemoteDownloads, recipeID)
				}
			}

			destRecipeDir := filepath.Join(recipesTargetDir, recipeID)
			if err := copyDir(cacheRecipeDir, destRecipeDir); err != nil {
				return nil, fmt.Errorf("failed to install recipe %q into project: %w", recipeID, err)
			}
			result.InstalledRecipes = append(result.InstalledRecipes, recipeID)

			sum, err := packages.DirectoryChecksum(destRecipeDir)
			if err != nil {
				sum = "unknown"
			}
			result.LockPackages = append(result.LockPackages, packages.Resolved{
				ID:       recipeID,
				Version:  opts.Version,
				Checksum: sum,
				Type:     "recipe",
			})
		}

		recipesManifest := map[string]any{
			"version": opts.Version,
			"recipes": result.InstalledRecipes,
			"updated": time.Now().UTC().Format(time.RFC3339),
		}
		if data, err := json.MarshalIndent(recipesManifest, "", "  "); err == nil {
			_ = os.WriteFile(filepath.Join(recipesTargetDir, "manifest.json"), append(data, '\n'), 0644)
		}
	}

	// Update prumo.lock
	lock := packages.NewLock(result.LockPackages)
	lockData, err := json.MarshalIndent(lock, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(opts.ProjectRoot, "prumo.lock"), append(lockData, '\n'), 0644)
	}

	return result, nil
}

func (s *Service) downloadSkill(baseURL, skillID, destDir string) error {
	client := s.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	manifestURL := fmt.Sprintf("%s/src/prumo/resources/workforce/skills/%s/manifest.json", strings.TrimRight(baseURL, "/"), skillID)
	resp, err := client.Get(manifestURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("remote responded with HTTP %d for %s", resp.StatusCode, manifestURL)
	}

	manifestData, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	manifestPath := filepath.Join(destDir, "manifest.json")
	if err := os.WriteFile(manifestPath, manifestData, 0644); err != nil {
		return err
	}

	type skillManifestAssets struct {
		References []string `json:"references"`
		Templates  []string `json:"templates"`
		Checks     []string `json:"checks"`
		Scripts    []string `json:"scripts"`
		Examples   []string `json:"examples"`
	}
	var assets skillManifestAssets
	_ = json.Unmarshal(manifestData, &assets)

	filesToDownload := []string{"SKILL.md"}
	filesToDownload = append(filesToDownload, assets.References...)
	filesToDownload = append(filesToDownload, assets.Templates...)
	filesToDownload = append(filesToDownload, assets.Checks...)
	filesToDownload = append(filesToDownload, assets.Scripts...)
	filesToDownload = append(filesToDownload, assets.Examples...)

	for _, file := range filesToDownload {
		fileURL := fmt.Sprintf("%s/src/prumo/resources/workforce/skills/%s/%s", strings.TrimRight(baseURL, "/"), skillID, file)
		fResp, err := client.Get(fileURL)
		if err != nil {
			return err
		}
		if fResp.StatusCode != http.StatusOK {
			fResp.Body.Close()
			if file == "SKILL.md" {
				altURL := fmt.Sprintf("%s/src/prumo/resources/workforce/skills/%s/skill.md", strings.TrimRight(baseURL, "/"), skillID)
				altResp, altErr := client.Get(altURL)
				if altErr == nil && altResp.StatusCode == http.StatusOK {
					destPath := filepath.Join(destDir, "SKILL.md")
					if out, err := os.Create(destPath); err == nil {
						_, _ = io.Copy(out, altResp.Body)
						out.Close()
					}
					altResp.Body.Close()
					continue
				}
				if altResp != nil {
					altResp.Body.Close()
				}
			}
			continue
		}

		destPath := filepath.Join(destDir, file)
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			fResp.Body.Close()
			return err
		}
		out, err := os.Create(destPath)
		if err != nil {
			fResp.Body.Close()
			return err
		}
		_, err = io.Copy(out, fResp.Body)
		fResp.Body.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) downloadAgent(baseURL, agentID, destDir string) error {
	client := s.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	files := []string{"manifest.json", "AGENT.md"}
	for _, file := range files {
		url := fmt.Sprintf("%s/src/prumo/resources/workforce/agents/%s/%s", strings.TrimRight(baseURL, "/"), agentID, file)
		resp, err := client.Get(url)
		if err != nil {
			return err
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			altName := file
			if file == "manifest.json" {
				altName = "agent.json"
			} else if file == "AGENT.md" {
				altName = "agent.md"
			}
			altURL := fmt.Sprintf("%s/src/prumo/resources/workforce/agents/%s/%s", strings.TrimRight(baseURL, "/"), agentID, altName)
			altResp, altErr := client.Get(altURL)
			if altErr == nil && altResp.StatusCode == http.StatusOK {
				destPath := filepath.Join(destDir, file)
				if out, err := os.Create(destPath); err == nil {
					_, _ = io.Copy(out, altResp.Body)
					out.Close()
				}
				altResp.Body.Close()
				continue
			}
			if altResp != nil {
				altResp.Body.Close()
			}
			return fmt.Errorf("remote responded with HTTP %d for %s", resp.StatusCode, url)
		}

		destPath := filepath.Join(destDir, file)
		out, err := os.Create(destPath)
		if err != nil {
			resp.Body.Close()
			return err
		}
		_, err = io.Copy(out, resp.Body)
		resp.Body.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) downloadRecipe(baseURL, recipeID, destDir string) error {
	client := s.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	files := []string{"recipe.json", "RECIPE.md"}
	for _, file := range files {
		url := fmt.Sprintf("%s/src/prumo/resources/workforce/recipes/%s/%s", strings.TrimRight(baseURL, "/"), recipeID, file)
		resp, err := client.Get(url)
		if err != nil {
			return err
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			altName := file
			if file == "recipe.json" {
				altName = "manifest.json"
			} else if file == "RECIPE.md" {
				altName = "recipe.md"
			}
			altURL := fmt.Sprintf("%s/src/prumo/resources/workforce/recipes/%s/%s", strings.TrimRight(baseURL, "/"), recipeID, altName)
			altResp, altErr := client.Get(altURL)
			if altErr == nil && altResp.StatusCode == http.StatusOK {
				destPath := filepath.Join(destDir, file)
				if out, err := os.Create(destPath); err == nil {
					_, _ = io.Copy(out, altResp.Body)
					out.Close()
				}
				altResp.Body.Close()
				continue
			}
			if altResp != nil {
				altResp.Body.Close()
			}
			return fmt.Errorf("remote responded with HTTP %d for %s", resp.StatusCode, url)
		}

		destPath := filepath.Join(destDir, file)
		out, err := os.Create(destPath)
		if err != nil {
			resp.Body.Close()
			return err
		}
		_, err = io.Copy(out, resp.Body)
		resp.Body.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func copyDir(source, target string) error {
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		dest := filepath.Join(target, rel)
		if info.IsDir() {
			return os.MkdirAll(dest, 0755)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return err
		}
		return os.WriteFile(dest, data, 0644)
	})
}
