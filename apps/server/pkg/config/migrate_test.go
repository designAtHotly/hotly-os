package config

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func TestEmptyDatabaseMigration(t *testing.T) {
	adminURL := os.Getenv("TEST_DATABASE_URL")
	if adminURL == "" {
		adminURL = "postgres://hotly:changeme@127.0.0.1:5432/postgres?sslmode=disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Skip("postgres is not reachable for migration test")
	}
	defer admin.Close(ctx)

	dbName := fmt.Sprintf("hotly_mig_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+dbName); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer dropCancel()
		_, _ = admin.Exec(dropCtx, "DROP DATABASE IF EXISTS "+dbName+" WITH (FORCE)")
	})

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot resolve migration path")
	}
	up := filepath.Join(filepath.Dir(file), "../../../../db/migrations")
	entries, err := os.ReadDir(up)
	if err != nil {
		t.Fatal(err)
	}
	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, filepath.Join(up, e.Name()))
		}
	}
	sort.Strings(files)
	if len(files) == 0 {
		t.Fatal("no migrations")
	}

	dbURL := "postgres://hotly:changeme@127.0.0.1:5432/" + dbName + "?sslmode=disable"
	if os.Getenv("TEST_DATABASE_URL") != "" {
		u, err := pgx.ParseConfig(adminURL)
		if err != nil {
			t.Fatal(err)
		}
		u.Database = dbName
		dbURL = u.ConnString()
	}
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	for _, path := range files {
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := conn.Exec(ctx, string(sqlBytes)); err != nil {
			t.Fatalf("apply %s: %v", path, err)
		}
	}
	var checkouts int
	if err := conn.QueryRow(ctx, "SELECT count(*) FROM checkouts").Scan(&checkouts); err != nil {
		t.Fatalf("checkouts table missing: %v", err)
	}
	if checkouts != 0 {
		t.Fatalf("fresh migration should have zero checkouts, got %d", checkouts)
	}
}
