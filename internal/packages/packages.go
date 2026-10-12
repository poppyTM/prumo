package packages

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"sort"
)

type Lock struct {
	Version  int        `json:"version"`
	Packages []Resolved `json:"packages"`
}
type Resolved struct {
	ID       string `json:"id"`
	Version  string `json:"version"`
	Checksum string `json:"checksum"`
	Type     string `json:"type"`
}

func NewLock(packages []Resolved) Lock {
	sort.Slice(packages, func(i, j int) bool { return packages[i].ID < packages[j].ID })
	return Lock{Version: 1, Packages: packages}
}
func Checksum(data []byte) string { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }

// DirectoryChecksum computes a deterministic SHA-256 digest of all files in a directory tree.
func DirectoryChecksum(dir string) (string, error) {
	var files []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			rel, err := filepath.Rel(dir, path)
			if err != nil {
				return err
			}
			files = append(files, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	sort.Strings(files)

	hasher := sha256.New()
	for _, rel := range files {
		hasher.Write([]byte(rel + "\n"))
		content, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(rel)))
		if err != nil {
			return "", err
		}
		hasher.Write(content)
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}
