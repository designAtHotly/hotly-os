package media

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
)

const (
	MaxAttachmentBytes = 50 * 1024 * 1024
	MaxAvatarBytes     = 3 * 1024 * 1024
	MaxAttachments     = 10
)

var (
	ErrUnsupportedType = errors.New("unsupported_media_type")
	ErrTooLarge        = errors.New("media_too_large")
	ErrTooMany         = errors.New("too_many_attachments")
	ErrNotFound        = errors.New("not_found")
	ErrNotConfigured   = errors.New("media_not_configured")
)

type Kind string

const (
	KindImage Kind = "image"
	KindVideo Kind = "video"
)

type Detected struct {
	Kind        Kind
	ContentType string
}

var allow = map[string]Kind{
	"image/jpeg":      KindImage,
	"image/png":       KindImage,
	"image/gif":       KindImage,
	"image/webp":      KindImage,
	"video/mp4":       KindVideo,
	"video/webm":      KindVideo,
	"video/quicktime": KindVideo,
}

func Detect(r io.Reader) (Detected, io.Reader, error) {
	head := make([]byte, 512)
	n, err := io.ReadFull(r, head)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return Detected{}, nil, err
	}
	head = head[:n]
	contentType := sniff(head)
	kind, ok := allow[contentType]
	if !ok {
		return Detected{}, nil, ErrUnsupportedType
	}
	return Detected{Kind: kind, ContentType: contentType}, io.MultiReader(bytes.NewReader(head), r), nil
}

func sniff(head []byte) string {
	if looksMP4(head) {
		return "video/mp4"
	}
	if looksWebM(head) {
		return "video/webm"
	}
	if looksQuickTime(head) {
		return "video/quicktime"
	}
	detected := http.DetectContentType(head)
	switch detected {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return detected
	default:
		return detected
	}
}

func looksMP4(b []byte) bool {
	if len(b) < 12 {
		return false
	}
	return string(b[4:8]) == "ftyp"
}

func looksWebM(b []byte) bool {
	return len(b) >= 4 && b[0] == 0x1a && b[1] == 0x45 && b[2] == 0xdf && b[3] == 0xa3
}

func looksQuickTime(b []byte) bool {
	if len(b) < 12 || string(b[4:8]) != "ftyp" {
		return false
	}
	brand := string(b[8:12])
	return brand == "qt  " || strings.HasPrefix(brand, "qt")
}

func Limit(purpose string) int64 {
	if purpose == "avatar" {
		return MaxAvatarBytes
	}
	return MaxAttachmentBytes
}
