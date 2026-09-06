package media

import (
	"bytes"
	"io"
	"testing"
)

func TestDetectAcceptsJPEGAndRejectsPlainText(t *testing.T) {
	jpeg := []byte{0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01}
	got, rest, err := Detect(bytes.NewReader(jpeg))
	if err != nil {
		t.Fatal(err)
	}
	if got.Kind != KindImage || got.ContentType != "image/jpeg" {
		t.Fatalf("jpeg detect: %+v", got)
	}
	raw, _ := io.ReadAll(rest)
	if !bytes.Equal(raw, jpeg) {
		t.Fatal("detect must not consume the stream")
	}
	if _, _, err := Detect(bytes.NewReader([]byte("not a picture"))); err != ErrUnsupportedType {
		t.Fatalf("expected unsupported, got %v", err)
	}
}

func TestDetectAcceptsMP4Ftyp(t *testing.T) {
	buf := make([]byte, 32)
	copy(buf[4:8], "ftyp")
	copy(buf[8:12], "isom")
	got, _, err := Detect(bytes.NewReader(buf))
	if err != nil {
		t.Fatal(err)
	}
	if got.Kind != KindVideo || got.ContentType != "video/mp4" {
		t.Fatalf("mp4 detect: %+v", got)
	}
}
