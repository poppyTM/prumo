package workforcesync_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/raillen/prumo/internal/workforcesync"
)

func TestWorkforceSyncLocalAndCore(t *testing.T) {
	tempProject := t.TempDir()
	tempHome := t.TempDir()
	repoRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatalf("failed to get repo root: %v", err)
	}

	service := workforcesync.NewService()
	opts := workforcesync.Options{
		ProjectRoot:  tempProject,
		HomeDir:      tempHome,
		RepoRoot:     repoRoot,
		Version:      "0.5.1",
		OfflineOnly:  true,
		TargetSkills: []string{"cognitive-clarity", "clean-code"},
	}

	result, err := service.Sync(opts)
	if err != nil {
		t.Fatalf("Sync failed: %v", err)
	}

	if len(result.InstalledSkills) != 2 {
		t.Fatalf("expected 2 installed skills, got %d: %v", len(result.InstalledSkills), result.InstalledSkills)
	}

	// Verify files created in project
	for _, skill := range []string{"cognitive-clarity", "clean-code"} {
		manifestPath := filepath.Join(tempProject, ".ai", "skills", skill, "manifest.json")
		if _, err := os.Stat(manifestPath); err != nil {
			t.Fatalf("expected skill manifest at %s: %v", manifestPath, err)
		}
		skillMDPath := filepath.Join(tempProject, ".ai", "skills", skill, "SKILL.md")
		if _, err := os.Stat(skillMDPath); err != nil {
			t.Fatalf("expected SKILL.md at %s: %v", skillMDPath, err)
		}
	}

	// Verify prumo.lock created
	lockPath := filepath.Join(tempProject, "prumo.lock")
	if _, err := os.Stat(lockPath); err != nil {
		t.Fatalf("expected prumo.lock at %s: %v", lockPath, err)
	}

	// Second sync should hit cache
	result2, err := service.Sync(opts)
	if err != nil {
		t.Fatalf("second sync failed: %v", err)
	}
	if len(result2.CacheHits) != 2 {
		t.Fatalf("expected 2 cache hits on second sync, got %d", len(result2.CacheHits))
	}
}

func TestWorkforceSyncRemoteHTTP(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/src/prumo/resources/workforce/skills/mock-skill/manifest.json" {
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `{"id":"mock-skill","name":"Mock Skill","version":1}`)
			return
		}
		if r.URL.Path == "/src/prumo/resources/workforce/skills/mock-skill/SKILL.md" {
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, "# Mock Skill Instructions")
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	tempProject := t.TempDir()
	tempHome := t.TempDir()

	service := &workforcesync.Service{
		HTTPClient: mockServer.Client(),
	}

	opts := workforcesync.Options{
		ProjectRoot:   tempProject,
		HomeDir:       tempHome,
		RemoteBaseURL: mockServer.URL,
		Version:       "0.5.1",
		ForceRemote:   true,
		TargetSkills:  []string{"mock-skill"},
	}

	result, err := service.Sync(opts)
	if err != nil {
		t.Fatalf("remote sync failed: %v", err)
	}

	if len(result.RemoteDownloads) != 1 || result.RemoteDownloads[0] != "mock-skill" {
		t.Fatalf("expected remote download for mock-skill, got: %v", result.RemoteDownloads)
	}

	manifestPath := filepath.Join(tempProject, ".ai", "skills", "mock-skill", "manifest.json")
	if _, err := os.Stat(manifestPath); err != nil {
		t.Fatalf("manifest not found: %v", err)
	}
}

func TestWorkforceSyncOfflineErrorWhenUncached(t *testing.T) {
	tempProject := t.TempDir()
	tempHome := t.TempDir()

	service := workforcesync.NewService()
	opts := workforcesync.Options{
		ProjectRoot:  tempProject,
		HomeDir:      tempHome,
		RepoRoot:     "/nonexistent/repo",
		Version:      "0.5.1",
		OfflineOnly:  true,
		TargetSkills: []string{"nonexistent-skill-xyz"},
	}

	_, err := service.Sync(opts)
	if err == nil {
		t.Fatalf("expected error in offline mode when skill not in cache, got nil")
	}
}

func TestWorkforceSyncFullPackageAndAgentsRecipes(t *testing.T) {
	tempProject := t.TempDir()
	tempHome := t.TempDir()
	repoRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatalf("failed to get repo root: %v", err)
	}

	service := workforcesync.NewService()
	opts := workforcesync.Options{
		ProjectRoot:   tempProject,
		HomeDir:       tempHome,
		RepoRoot:      repoRoot,
		Version:       "0.5.1",
		OfflineOnly:   true,
		TargetSkills:  []string{"clean-code"},
		TargetAgents:  []string{"architect"},
		TargetRecipes: []string{"bug-fix"},
	}

	result, err := service.Sync(opts)
	if err != nil {
		t.Fatalf("Sync failed: %v", err)
	}

	// Verify skill package subdirectories copied
	skillRefDir := filepath.Join(tempProject, ".ai", "skills", "clean-code", "references")
	if info, err := os.Stat(skillRefDir); err != nil || !info.IsDir() {
		t.Fatalf("expected clean-code references/ directory: %v", err)
	}

	// Verify agent installed
	agentMD := filepath.Join(tempProject, ".ai", "agents", "architect", "AGENT.md")
	if _, err := os.Stat(agentMD); err != nil {
		t.Fatalf("expected architect AGENT.md: %v", err)
	}

	// Verify recipe installed
	recipeMD := filepath.Join(tempProject, ".ai", "recipes", "bug-fix", "RECIPE.md")
	if _, err := os.Stat(recipeMD); err != nil {
		t.Fatalf("expected bug-fix RECIPE.md: %v", err)
	}

	// Verify lock entries and checksums
	if len(result.LockPackages) != 3 {
		t.Fatalf("expected 3 lock packages, got %d", len(result.LockPackages))
	}

	for _, lp := range result.LockPackages {
		if len(lp.Checksum) != 64 {
			t.Errorf("expected 64-char sha256 checksum for %s (%s), got: %s", lp.ID, lp.Type, lp.Checksum)
		}
	}
}
