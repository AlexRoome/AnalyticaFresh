import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FiImage } from "react-icons/fi";
import { IoTrashOutline, IoAddOutline } from "react-icons/io5";
// Replacing CiFileOn with FaRegFile
import { FaRegFile } from "react-icons/fa"; 
import "./InvoiceUploadModal.css";

interface UploadedFile {
  file: File;
  uploadDate: Date;
  status: "uploading" | "uploaded";
}

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesUploaded: (files: File[]) => void;
}

/** 
 * Simulate a 2-second upload for each file. 
 * Replace with real logic if needed.
 */
async function simulateUpload(file: File) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 2000);
  });
}

/**
 * Truncates a file name if the base part is too long.
 * Increase maxBaseLength for more characters.
 */
function truncateFileName(fullName: string, maxBaseLength = 60): string {
  const dotIndex = fullName.lastIndexOf(".");
  if (dotIndex < 0) {
    // no extension
    if (fullName.length > maxBaseLength) {
      return fullName.slice(0, maxBaseLength) + "...";
    }
    return fullName;
  }

  const extension = fullName.slice(dotIndex + 1);
  const base = fullName.slice(0, dotIndex);
  if (base.length > maxBaseLength) {
    return base.slice(0, maxBaseLength) + "... ." + extension;
  }
  return fullName;
}

const InvoiceUploadModal: React.FC<InvoiceUploadModalProps> = ({
  isOpen,
  onClose,
  onFilesUploaded,
}) => {
  const [acceptedFiles, setAcceptedFiles] = useState<UploadedFile[]>([]);

  // Called whenever user drops or selects new files
  const onDrop = useCallback((files: File[]) => {
    const newFiles = files.map((file) => ({
      file,
      uploadDate: new Date(),
      status: "uploading" as const,
    }));

    setAcceptedFiles((prev) => [...prev, ...newFiles]);

    // Simulate (or do real) upload
    newFiles.forEach(async (uf) => {
      await simulateUpload(uf.file);
      setAcceptedFiles((prev) =>
        prev.map((item) =>
          item.file === uf.file ? { ...item, status: "uploaded" } : item
        )
      );
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: false,
  });

  // Remove a file from the list
  const removeFile = (fileToRemove: File) => {
    setAcceptedFiles((prev) => prev.filter((f) => f.file !== fileToRemove));
  };

  // "Attach" all files -> pass up, then clear
  const handleAttach = () => {
    if (acceptedFiles.length > 0) {
      const fileObjs = acceptedFiles.map((f) => f.file);
      onFilesUploaded(fileObjs);
      setAcceptedFiles([]);
    }
  };

  // If modal is closed, don't render
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        {...getRootProps()}
        className="modal"
        onClick={(evt) => {
          // Stop the event from hitting overlay
          evt.stopPropagation();
        }}
      >
        <input {...getInputProps()} />

        {/* Title */}
        <div className="title-container">
          <h3 className="title">Upload Invoices</h3>
        </div>

        {/* Show dropzone message if no files; otherwise, file list */}
        {acceptedFiles.length === 0 ? (
          <div className="dropzone dropzone-empty-state">
            <FiImage className="icon" />
            {isDragActive ? (
              <p className="drag-active-text">Drop the files here...</p>
            ) : (
              <p className="drop-text">
                Drag your files here or{" "}
                <span
                  className="click-text"
                  onClick={(evt) => {
                    evt.stopPropagation();
                    open();
                  }}
                >
                  click to upload
                </span>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="attached-files-list">
              <div className="attached-files-header">
                <span className="attached-file-name">FILE</span>
                <span style={{ width: "24px" }}></span>
              </div>

              {acceptedFiles.map(({ file, status }) => {
                const displayName = truncateFileName(file.name);
                return (
                  <div className="attached-file-row" key={file.name}>
                    <div className="attached-file-name">
                      <div className="file-icon-wrapper">
                        {status === "uploading" ? (
                          <div className="file-upload-status" />
                        ) : (
                          <FaRegFile className="uploaded-file-icon" />
                        )}
                      </div>
                      {displayName}
                    </div>
                    <div>
                      <IoTrashOutline
                        className="remove-file-button"
                        style={{ fontSize: "0.8rem" }}
                        onClick={(evt) => {
                          evt.stopPropagation();
                          removeFile(file);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* +Add button for more files */}
            <div style={{ textAlign: "right", marginBottom: "16px" }}>
              <button
                className="add-invoice-button"
                onClick={(evt) => {
                  evt.stopPropagation();
                  open();
                }}
              >
                <IoAddOutline style={{ fontSize: "0.8rem" }} />
                Add
              </button>
            </div>
          </>
        )}

        {/* Info text */}
        <div className="info-text-container">
          <p className="info-text">
            Invoice details will be automatically extracted for your convenience.
          </p>
        </div>

        {/* Bottom-right buttons */}
        <div className="buttons-container">
          <button
            className="cancel-button"
            onClick={(evt) => {
              evt.stopPropagation();
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            className="attach-button"
            disabled={acceptedFiles.length === 0}
            onClick={(evt) => {
              evt.stopPropagation();
              handleAttach();
            }}
          >
            Process
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceUploadModal;
