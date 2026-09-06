"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { uploadCreatorMedia, ChatAttachmentRequest } from "@/lib/api";
import { CreatorPricing } from "@/types/coffee.types";
import ContentPricingModal from "./ContentPricingModal";
import { captureError } from "@/lib/utils/error-handler";
import { toastError } from "@/lib/utils/toast";
import { extractVideoThumbnail, isVideoThumbnailSupported } from "@/lib/utils/video-thumbnail";
import { compressVideo, isVideoCompressionSupported } from "@/lib/utils/compress-video";
import { compressImage, isHeicFile } from "@/lib/utils/compress-image";
import { AttachmentViewer, Attachment } from "./AttachmentViewer";
import { ImagePlus } from "lucide-react";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface SelectedFile {
  file: File;
  preview?: string;
  viewerUrl: string;
  thumbnailFile?: File | null;
  type: "image" | "video" | "file";
}

function revokeFileUrls(files: SelectedFile[]) {
  files.forEach(sf => {
    URL.revokeObjectURL(sf.viewerUrl);
    if (sf.preview && sf.preview !== sf.viewerUrl) URL.revokeObjectURL(sf.preview);
  });
}

function getFileType(file: File): SelectedFile["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export interface ThreadReplyInputProps {
  chatUuid: string;
  lastMessageUuid: string;
  fanUserId: number;
  fanName: string;
  isActive: boolean;
  isFirst: boolean;
  firstInputRef: React.RefObject<HTMLTextAreaElement | null>;
  canAttach: boolean;
  pricing?: CreatorPricing;
  onSendReply: (messageUuid: string, fanUserId: number, content: string, attachments?: ChatAttachmentRequest[], priceInCents?: number, priceCurrencyCode?: string) => Promise<boolean>;
}

export function ThreadReplyInput({
  chatUuid,
  lastMessageUuid,
  fanUserId,
  fanName,
  isActive,
  isFirst,
  firstInputRef,
  canAttach,
  pricing,
  onSendReply,
}: ThreadReplyInputProps) {
  const [replyText, setReplyText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingHeic, setIsProcessingHeic] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileAttachments: Attachment[] = useMemo(() =>
    selectedFiles
      .filter(sf => sf.type === "image" || sf.type === "video")
      .map(sf => ({
        url: sf.viewerUrl,
        type: sf.type as "image" | "video",
        name: sf.file.name,
      })),
    [selectedFiles]
  );

  // Clear reply text and files when card is deactivated
  useEffect(() => {
    if (!isActive) {
      setReplyText("");
      setSelectedFiles(prev => { revokeFileUrls(prev); return []; });
    }
  }, [isActive]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      setSelectedFiles(prev => { revokeFileUrls(prev); return []; });
    };
  }, []);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = isFirst ? firstInputRef.current : textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [replyText, isFirst, firstInputRef]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 10 - selectedFiles.length;
    if (remaining <= 0) {
      toastError("Up to 10 photos or videos per reply.");
      e.target.value = "";
      return;
    }

    const newFiles: SelectedFile[] = [];
    const limit = Math.min(files.length, remaining);
    for (let i = 0; i < limit; i++) {
      const file = files[i];
      const type = getFileType(file);
      if (type === "file") {
        toastError("Photos and videos only.");
        continue;
      }
      const viewerUrl = URL.createObjectURL(file);
      const selected: SelectedFile = { file, type, viewerUrl };

      if (type === "image") {
        if (isHeicFile(file)) {
          setIsProcessingHeic(true);
          try {
            const converted = await compressImage(file, {
              maxSizeMB: 2,
              maxWidthOrHeight: 2048,
              fileType: "image/png",
            });
            selected.file = converted;
            selected.viewerUrl = URL.createObjectURL(converted);
            selected.preview = selected.viewerUrl;
          } finally {
            setIsProcessingHeic(false);
          }
        } else {
          selected.preview = viewerUrl;
        }
      } else if (type === "video" && isVideoThumbnailSupported()) {
        const thumbFile = await extractVideoThumbnail(file, {
          seekTime: 1,
          maxWidth: 320,
          maxHeight: 240,
          quality: 0.8,
        });
        if (thumbFile) {
          selected.thumbnailFile = thumbFile;
          selected.preview = URL.createObjectURL(thumbFile);
        }
      }

      newFiles.push(selected);
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const removed = prev[index];
      if (removed) revokeFileUrls([removed]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAfterSend = () => {
    setReplyText("");
    setSelectedFiles(prev => { revokeFileUrls(prev); return []; });
  };

  const uploadFiles = async (): Promise<ChatAttachmentRequest[] | null> => {
    const attachments: ChatAttachmentRequest[] = [];
    setIsUploading(true);
    try {
      for (const sf of selectedFiles) {
        if (sf.type !== "image" && sf.type !== "video") {
          toastError("Photos and videos only.");
          continue;
        }
        let fileToUpload = sf.file;
        if (sf.type === "image") {
          fileToUpload = await compressImage(sf.file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 2048,
            fileType: "image/png",
          });
        }
        if (sf.type === "video" && isVideoCompressionSupported()) {
          fileToUpload = await compressVideo(sf.file, {
            maxSizeMB: 10,
            maxWidth: 1280,
            maxHeight: 720,
          });
        }
        if (fileToUpload.size > MAX_FILE_SIZE) {
          toastError(`${sf.file.name} is still over 50MB after compression and was skipped`);
          continue;
        }
        const uploaded = await uploadCreatorMedia(fileToUpload);
        if (!uploaded.body?.object_key) throw new Error("Failed to upload");
        attachments.push({
          url: uploaded.body.object_key,
          filename: uploaded.body.filename || fileToUpload.name,
          size: uploaded.body.size || fileToUpload.size,
          type: uploaded.body.type || sf.type,
        });
      }
    } catch (err) {
      captureError(err, { action: "upload_attachment", component: "ThreadReplyInput" });
      toastError("Failed to upload attachment. Please try again.");
      setIsUploading(false);
      return null;
    }
    setIsUploading(false);
    return attachments;
  };

  const handleSubmit = async () => {
    const hasText = replyText.trim();
    const hasFiles = selectedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    // If there are files and pricing is available, show pricing modal first
    if (hasFiles && pricing) {
      setShowPricingModal(true);
      return;
    }

    // Upload files if any, then send
    let attachments: ChatAttachmentRequest[] | undefined;
    if (hasFiles) {
      const uploaded = await uploadFiles();
      if (!uploaded) return;
      attachments = uploaded;
    }

    const success = await onSendReply(lastMessageUuid, fanUserId, replyText.trim(), attachments);
    if (success) clearAfterSend();
  };


  const handlePricingSendPaid = async (priceInCents: number, currencyCode: string) => {
    setShowPricingModal(false);

    let attachments: ChatAttachmentRequest[] | undefined;
    if (selectedFiles.length > 0) {
      const uploaded = await uploadFiles();
      if (!uploaded) return;
      attachments = uploaded;
    }

    const success = await onSendReply(lastMessageUuid, fanUserId, replyText.trim(), attachments, priceInCents, currencyCode);
    if (success) clearAfterSend();
  };

  const handlePricingSendFree = async () => {
    setShowPricingModal(false);

    let attachments: ChatAttachmentRequest[] | undefined;
    if (selectedFiles.length > 0) {
      const uploaded = await uploadFiles();
      if (!uploaded) return;
      attachments = uploaded;
    }

    const success = await onSendReply(lastMessageUuid, fanUserId, replyText.trim(), attachments);
    if (success) clearAfterSend();
  };

  return (
    <>
      <div>
        {/* HEIC processing indicator */}
        {isProcessingHeic && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2 text-xs text-stone-500">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing image...
          </div>
        )}

        {/* File previews */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {selectedFiles.map((sf, i) => {
              const viewableIndex = (sf.type === "image" || sf.type === "video")
                ? selectedFiles.slice(0, i).filter(f => f.type === "image" || f.type === "video").length
                : -1;

              return (
                <div key={i} className="relative group">
                  {sf.type === "image" && sf.preview ? (
                    <button
                      onClick={() => { setViewerIndex(viewableIndex); setViewerOpen(true); }}
                      className="block"
                    >
                      <img
                        src={sf.preview}
                        alt={sf.file.name}
                        className="w-16 h-16 rounded-lg object-cover border border-stone-200"
                      />
                    </button>
                  ) : sf.type === "video" && sf.preview ? (
                    <button
                      onClick={() => { setViewerIndex(viewableIndex); setViewerOpen(true); }}
                      className="block relative w-16 h-16"
                    >
                      <img
                        src={sf.preview}
                        alt={sf.file.name}
                        className="w-16 h-16 rounded-lg object-cover border border-stone-200"
                      />
                      <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-stone-100 border border-stone-200 flex flex-col items-center justify-center px-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-[8px] text-stone-400 truncate w-full text-center mt-1">
                        {sf.file.name.split(".").pop()}
                      </span>
                    </div>
                  )}
                  {!isUploading && <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-700 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>}
                </div>
              );
            })}
          </div>
        )}

        {/* Attachment viewer modal */}
        <AttachmentViewer
          attachments={fileAttachments}
          initialIndex={viewerIndex}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />

        <div className="flex gap-2 items-end">
          {canAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 text-stone-400 hover:text-amber-500 hover:bg-stone-50 rounded-xl transition-colors disabled:opacity-40"
                title="Attach file"
              >
                <ImagePlus size={20} />
              </button>
            </>
          )}
          <textarea
            ref={isFirst ? firstInputRef : textareaRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Reply to ${fanName}...`}
            rows={1}
            autoFocus
            disabled={isUploading}
            className="flex-1 px-4 py-2.5 bg-stone-50 rounded-xl text-stone-700 placeholder:text-stone-400 border-2 border-transparent focus:outline-none focus:bg-white focus:border-amber-300 transition-colors resize-none overflow-hidden disabled:opacity-60"
          />
          <button
            onClick={handleSubmit}
            disabled={(!replyText.trim() && selectedFiles.length === 0) || isUploading}
            className="px-5 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Content pricing modal */}
      {pricing && (
        <ContentPricingModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          onSendPaid={handlePricingSendPaid}
          onSendFree={handlePricingSendFree}
          pricing={pricing}
          isLoading={isUploading}
        />
      )}
    </>
  );
}
