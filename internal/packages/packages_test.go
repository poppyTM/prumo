package packages

import (
	"os"
	"testing"
)

func TestLockSorts(t *testing.T) {
	lock := NewLock([]Resolved{{ID: "z"}, {ID: "a"}})
	if lock.Packages[0].ID != "a" {
		t.Fatal(lock)
	}
}
func TestChecksum(t *testing.T) {
	if len(Checksum([]byte("x"))) != 64 {
		t.Fatal("invalid checksum")
	}
}

func TestDirectoryChecksum(t *testing.T) {
	dir := t.TempDir()
	sum1, err := DirectoryChecksum(dir)
	if err != nil {
		t.Fatalf("empty dir checksum failed: %v", err)
	}
	if len(sum1) != 64 {
		t.Fatalf("expected 64 hex chars, got %d", len(sum1))
	}

	f1 := dir + "/a.txt"
	_ = os.WriteFile(f1, []byte("hello"), 0644)
	sum2, err := DirectoryChecksum(dir)
	if err != nil {
		t.Fatalf("checksum failed: %v", err)
	}
	if sum1 == sum2 {
		t.Fatal("checksum should change when file is added")
	}

	sum3, _ := DirectoryChecksum(dir)
	if sum2 != sum3 {
		t.Fatal("checksum should be deterministic")
	}
}
