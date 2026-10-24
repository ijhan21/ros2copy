"use client";

import { useState, useRef } from "react";
import { SharedFile, Tab } from "@/lib/types";
import { formatRelativeTime } from "@/lib/time";

interface SharedFilesSectionProps {
  files: SharedFile[];
  tabs: Tab[];
  selectedTabId: number | null;
  isTeacher: boolean;
  teacherPassword?: string;
  onDeleteFile?: (id: number) => Promise<boolean>;
  onFileUploaded?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileBadge(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      color: "text-amber-500 bg-amber-500/10 border-amber-500/30 dark:text-amber-400 dark:bg-amber-400/10",
      icon: "📦",
    };
  }
  if (["py"].includes(ext)) {
    return {
      label: "PYTHON",
      color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-400 dark:bg-emerald-400/10",
      icon: "🐍",
    };
  }
  if (["yaml", "yml", "xml", "urdf", "launch", "xacro", "sh", "bash"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      color: "text-teal-600 bg-teal-500/10 border-teal-500/30 dark:text-teal-400 dark:bg-teal-400/10",
      icon: "⚙️",
    };
  }
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      color: "text-blue-600 bg-blue-500/10 border-blue-500/30 dark:text-blue-400 dark:bg-blue-400/10",
      icon: "📄",
    };
  }
  if (["png", "jpg", "jpeg", "svg", "webp"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      color: "text-purple-600 bg-purple-500/10 border-purple-500/30 dark:text-purple-400 dark:bg-purple-400/10",
      icon: "🖼️",
    };
  }
  if (["bag", "db3", "mcap"].includes(ext)) {
    return {
      label: "ROSBAG",
      color: "text-rose-600 bg-rose-500/10 border-rose-500/30 dark:text-rose-400 dark:bg-rose-400/10",
      icon: "📼",
    };
  }

  return {
    label: ext ? ext.toUpperCase() : "FILE",
    color: "text-[#52525B] bg-[#E4E4E7]/40 border-[#D4D4D8] dark:text-[#A1A1AA] dark:bg-[#26262E] dark:border-[#3F3F46]",
    icon: "📁",
  };
}

export default function SharedFilesSection({
  files,
  tabs,
  selectedTabId,
  isTeacher,
  teacherPassword = "",
  onDeleteFile,
  onFileUploaded,
}: SharedFilesSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 모달 폼 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTabId, setUploadTabId] = useState<number | null>(selectedTabId);
  const [uploadMemo, setUploadMemo] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 현재 탭 기준 필터링
  const filteredFiles =
    selectedTabId === null
      ? files
      : files.filter((f) => f.tab_id === selectedTabId);

  // 복사 핸들러 (wget 명령어 복사)
  const handleCopyWget = async (file: SharedFile) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const downloadUrl = `${origin}/api/files/${file.id}/download`;
    const wgetCmd = `wget "${downloadUrl}" -O "${file.original_name}"`;

    try {
      await navigator.clipboard.writeText(wgetCmd);
      setCopiedId(`wget-${file.id}`);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
    }
  };

  // 복사 핸들러 (직접 다운로드 링크 복사)
  const handleCopyLink = async (file: SharedFile) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const downloadUrl = `${origin}/api/files/${file.id}/download`;

    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedId(`link-${file.id}`);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("링크 복사 실패:", err);
    }
  };

  // 파일 업로드 실행
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("파일을 선택해 주세요.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (uploadTabId !== null) {
      formData.append("tab_id", uploadTabId.toString());
    }
    if (uploadMemo.trim()) {
      formData.append("memo", uploadMemo.trim());
    }

    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: {
          "x-board-password": teacherPassword,
        },
        body: formData,
      });

      if (res.ok) {
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadMemo("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        onFileUploaded?.();
      } else {
        const err = await res.json();
        setUploadError(err.error || "파일 업로드에 실패했습니다.");
      }
    } catch (err: any) {
      setUploadError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  // 파일 삭제 실행
  const handleDelete = async (file: SharedFile) => {
    const confirmed = window.confirm(`'${file.original_name}' 파일을 삭제할까요?`);
    if (!confirmed) return;
    onDeleteFile?.(file.id);
  };

  // 표시할 파일이 없고 강사도 아니라면 숨김
  if (filteredFiles.length === 0 && !isTeacher) {
    return null;
  }

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#18181B] dark:text-[#F4F4F5] flex items-center gap-1.5">
            <span>📁</span>
            <span>실습 공유 파일</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-[#0F766E]/10 text-[#0F766E] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6]">
              {filteredFiles.length}
            </span>
          </span>
          <span className="text-xs text-[#71717A] dark:text-[#9CA3AF] hidden sm:inline">
            우분투 터미널용 wget 명령어 또는 직접 다운로드가 가능합니다.
          </span>
        </div>

        {isTeacher && (
          <button
            onClick={() => {
              setUploadTabId(selectedTabId);
              setUploadError(null);
              setIsUploadModalOpen(true);
            }}
            className="min-h-[30px] px-2.5 text-xs font-semibold rounded-[6px] bg-[#0F766E] hover:bg-[#115E59] text-white transition-colors flex items-center gap-1 shadow-xs"
          >
            <span>+</span>
            <span>파일 올리기</span>
          </button>
        )}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="p-5 text-center border border-dashed border-[#E4E4E7] dark:border-[#2E2E36] rounded-[12px] bg-[#FFFFFF] dark:bg-[#1A1A1E]">
          <p className="text-xs text-[#71717A] dark:text-[#9CA3AF]">
            이 탭에 공유된 실습 파일이 아직 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map((file) => {
            const badge = getFileBadge(file.original_name);
            const isWgetCopied = copiedId === `wget-${file.id}`;
            const isLinkCopied = copiedId === `link-${file.id}`;

            return (
              <div
                key={file.id}
                className="flex flex-col justify-between p-3.5 rounded-[12px] bg-[#FFFFFF] dark:bg-[#1A1A1E] border border-[#E4E4E7] dark:border-[#2E2E36] hover:border-[#0F766E]/40 dark:hover:border-[#14B8A6]/40 transition-all shadow-xs"
              >
                <div>
                  {/* 상단 뱃지 및 메타 */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border ${badge.color} flex items-center gap-1`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                      {selectedTabId === null && file.tabs?.name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#F4F4F5] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] border border-[#E4E4E7] dark:border-[#3F3F46]">
                          {file.tabs.name}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-medium text-[#71717A] dark:text-[#A1A1AA] shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  {/* 파일명 */}
                  <div
                    title={file.original_name}
                    className="font-medium text-xs text-[#18181B] dark:text-[#F4F4F5] break-all line-clamp-2 leading-snug mb-1"
                  >
                    {file.original_name}
                  </div>

                  {/* 설명 메모 */}
                  {file.memo && (
                    <div className="text-[11px] text-[#52525B] dark:text-[#9CA3AF] mb-2 leading-tight">
                      {file.memo}
                    </div>
                  )}

                  {/* 등록 시각 */}
                  <div className="text-[10px] text-[#A1A1AA] dark:text-[#71717A] mb-3">
                    {formatRelativeTime(file.created_at)}
                    {file.download_count > 0 && ` · 다운로드 ${file.download_count}회`}
                  </div>
                </div>

                {/* 하단 액션 단추들 */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-[#F4F4F5] dark:border-[#26262E]">
                  {/* 직접 다운로드 */}
                  <a
                    href={`/api/files/${file.id}/download`}
                    download={file.original_name}
                    className="min-h-[28px] px-2.5 text-xs font-semibold rounded-[6px] bg-[#0F766E] hover:bg-[#115E59] text-white flex-1 inline-flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>↓</span>
                    <span>다운로드</span>
                  </a>

                  {/* wget 복사 (터미널용) */}
                  <button
                    onClick={() => handleCopyWget(file)}
                    title="우분투 터미널용 wget 명령어 복사"
                    className="min-h-[28px] px-2 text-[11px] font-medium rounded-[6px] bg-[#F4F4F5] dark:bg-[#26262E] hover:bg-[#E4E4E7] dark:hover:bg-[#3F3F46] text-[#3F3F46] dark:text-[#D1D5DB] border border-[#E4E4E7] dark:border-[#3F3F46] transition-colors shrink-0"
                  >
                    {isWgetCopied ? "복사됨!" : "wget 복사"}
                  </button>

                  {/* 링크 복사 */}
                  <button
                    onClick={() => handleCopyLink(file)}
                    title="다운로드 주소 복사"
                    className="min-h-[28px] px-2 text-[11px] font-medium rounded-[6px] bg-[#F4F4F5] dark:bg-[#26262E] hover:bg-[#E4E4E7] dark:hover:bg-[#3F3F46] text-[#3F3F46] dark:text-[#D1D5DB] border border-[#E4E4E7] dark:border-[#3F3F46] transition-colors shrink-0"
                  >
                    {isLinkCopied ? "복사됨!" : "링크"}
                  </button>

                  {/* 강사 삭제 */}
                  {isTeacher && (
                    <button
                      onClick={() => handleDelete(file)}
                      title="파일 삭제"
                      className="min-h-[28px] px-2 text-[11px] font-semibold rounded-[6px] bg-[#FEE2E2] dark:bg-[#7F1D1D]/30 text-red-600 dark:text-red-400 hover:bg-[#FECACA] transition-colors shrink-0"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 강사 파일 올리기 모달 */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md p-5 rounded-[16px] bg-[#FFFFFF] dark:bg-[#1A1A1E] border border-[#E4E4E7] dark:border-[#2E2E36] shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E4E7] dark:border-[#2E2E36]">
              <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F4F4F5]">
                실습 파일 올리기
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] dark:hover:text-[#F4F4F5] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {uploadError && (
                <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                  {uploadError}
                </div>
              )}

              {/* 파일 선택 */}
              <div>
                <label className="block text-xs font-semibold text-[#52525B] dark:text-[#D1D5DB] mb-1.5">
                  공유할 파일
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#52525B] dark:text-[#D1D5DB] file:mr-3 file:py-2 file:px-3 file:rounded-[6px] file:border-0 file:text-xs file:font-semibold file:bg-[#0F766E] file:text-white hover:file:bg-[#115E59] file:cursor-pointer cursor-pointer border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] p-2 bg-[#F7F7F8] dark:bg-[#121214]"
                />
                {selectedFile && (
                  <p className="mt-1 text-[11px] text-[#0F766E] dark:text-[#14B8A6]">
                    선택됨: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {/* 탭 지정 */}
              <div>
                <label className="block text-xs font-semibold text-[#52525B] dark:text-[#D1D5DB] mb-1.5">
                  연결할 탭
                </label>
                <select
                  value={uploadTabId === null ? "" : uploadTabId}
                  onChange={(e) =>
                    setUploadTabId(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  className="w-full text-xs px-3 py-2 rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] focus:outline-hidden focus:border-[#0F766E]"
                >
                  <option value="">전체 공통 파일</option>
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 한 줄 설명 */}
              <div>
                <label className="block text-xs font-semibold text-[#52525B] dark:text-[#D1D5DB] mb-1.5">
                  한 줄 메모 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: 3차시 ROS2 패키지 소스코드 압축파일"
                  value={uploadMemo}
                  onChange={(e) => setUploadMemo(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#121214] text-[#18181B] dark:text-[#F4F4F5] focus:outline-hidden focus:border-[#0F766E]"
                />
              </div>

              {/* 하단 단추들 */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7] dark:border-[#2E2E36]">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="min-h-[34px] px-3.5 text-xs font-medium rounded-[8px] border border-[#E4E4E7] dark:border-[#2E2E36] bg-[#FFFFFF] dark:bg-[#26262E] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#F4F4F5] transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="min-h-[34px] px-4 text-xs font-bold rounded-[8px] bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-50 text-white transition-colors shadow-xs"
                >
                  {isUploading ? "올리는 중..." : "파일 올리기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
