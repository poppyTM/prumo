// Command wiring for `prumo native` (and `prumo viewer`).
//
// The native desktop Workspace Viewer is not compiled into this Go binary.
// It lives in its own Rust crate (`prumo-viewer`, producing `prumo-native`)
// and communicates with the Go harness strictly over IPC (Unix domain socket
// or TCP), preserving the core boundary and the invariant `Run != GUI`.
// This launcher resolves the viewer binary and forwards CLI flags.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/raillen/prumo/internal/protocol"
)

func runNative(asJSON bool, args []string) int {
	if asJSON {
		return serviceError(true, fmt.Errorf("native viewer is an interactive desktop GUI and has no --json output"))
	}

	binary, cargoArgs, err := resolveNativeBinary()
	if err != nil {
		return serviceError(asJSON, err)
	}

	forwarded := append([]string{}, cargoArgs...)
	forwarded = append(forwarded, args...)

	// Default workspace to current directory if not specified
	hasWorkspace := false
	for _, arg := range args {
		if arg == "--workspace" || arg == "-w" {
			hasWorkspace = true
			break
		}
	}
	if !hasWorkspace && len(cargoArgs) == 0 {
		forwarded = append(forwarded, "--workspace", ".")
	}

	cmd := exec.Command(binary, forwarded...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()

	if err := cmd.Run(); err != nil {
		return serviceError(asJSON, fmt.Errorf("prumo native viewer: %w", err))
	}
	return exitOK
}

func resolveNativeBinary() (string, []string, error) {
	// 1. Explicit environment variable
	if fromEnv := strings.TrimSpace(os.Getenv("PRUMO_IDE_BIN")); fromEnv != "" {
		return fromEnv, nil, nil
	}
	if fromEnv := strings.TrimSpace(os.Getenv("PRUMO_NATIVE_BIN")); fromEnv != "" {
		return fromEnv, nil, nil
	}
	if fromEnv := strings.TrimSpace(os.Getenv("PRUMO_VIEWER_BIN")); fromEnv != "" {
		return fromEnv, nil, nil
	}

	// 2. Sibling binary in executable directory
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		for _, name := range []string{"prumo-coder-ide", "prumo-ide", "prumo-native", "prumo-viewer"} {
			sibling := filepath.Join(exeDir, name)
			if _, err := os.Stat(sibling); err == nil {
				return sibling, nil, nil
			}
		}
	}

	// 3. Local build target in repository
	root := repoRoot()
	if root != "" {
		idePkg := filepath.Join(root, "packages", "prumo-coder-ide", "package.json")
		if _, err := os.Stat(idePkg); err == nil {
			if bunPath, err := exec.LookPath("bun"); err == nil {
				return bunPath, []string{"--cwd", filepath.Join(root, "packages", "prumo-coder-ide"), "run", "dev", "--"}, nil
			}
		}

		targetRelease := filepath.Join(root, "prumo-viewer", "target", "release", "prumo-native")
		if _, err := os.Stat(targetRelease); err == nil {
			return targetRelease, nil, nil
		}
		targetDebug := filepath.Join(root, "prumo-viewer", "target", "debug", "prumo-native")
		if _, err := os.Stat(targetDebug); err == nil {
			return targetDebug, nil, nil
		}
	}

	// 4. System PATH lookup
	for _, name := range []string{"prumo-coder-ide", "prumo-ide", "prumo-native", "prumo-viewer"} {
		if path, err := exec.LookPath(name); err == nil {
			return path, nil, nil
		}
	}

	return "", nil, fmt.Errorf("the native workspace viewer is a separate binary: build `prumo-coder-ide` / `prumo-viewer` (producing `prumo-ide` / `prumo-native`), or set PRUMO_NATIVE_BIN (protocol %s)", protocol.CLIVersion)
}
