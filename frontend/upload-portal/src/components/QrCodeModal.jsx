import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  X,
  ExternalLink,
  Copy,
  Check,
  Download,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

export default function QrCodeModal({ record, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const origin = window.location.origin;
  const verificationPath = record.verification_url || /verify/?token=;
  const fullVerificationUrl = ${origin};

  const handleCopy = () => {
    navigator.clipboard.writeText(fullVerificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    const svgElement = document.getElementById("record-qr-svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 600;
      canvas.height = 600;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 50, 50, 500, 500);

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = QR_Verify_.png;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-xl relative space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]/30 flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-serif font-bold text-[var(--color-text-primary)]">
              Land Record Verification QR
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Signed QR code for public citizen and buyer trust checks
            </p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-6 rounded-xl border border-[var(--color-border)] flex flex-col items-center justify-center shadow-inner">
          <div className="p-2 border border-slate-200 rounded-lg bg-white">
            <QRCodeSVG
              id="record-qr-svg"
              value={fullVerificationUrl}
              size={190}
              level="H"
              includeMargin={true}
            />
          </div>
          <div className="mt-3 text-center space-y-0.5">
            <div className="text-xs font-bold text-slate-800">
              Survey No: {record.fields?.survey_number || record.fields?.khasra_number || "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              Owner: {record.fields?.owner_name || "—"}
            </div>
          </div>
        </div>

        {/* Verification Link Info */}
        <div className="space-y-1.5 text-xs">
          <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)]">
            Signed Public Verification URL
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              readOnly
              value={fullVerificationUrl}
              className="flex-1 bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg px-2.5 py-2 text-[11px] font-mono text-[var(--color-text-primary)] outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] rounded-lg text-xs font-semibold text-[var(--color-text-primary)] inline-flex items-center gap-1 transition-colors cursor-pointer"
              title="Copy URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <button
            onClick={handleDownloadQr}
            className="flex-1 px-3.5 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] rounded-lg text-xs font-semibold text-[var(--color-text-primary)] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Download PNG</span>
          </button>

          <a
            href={fullVerificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3.5 py-2.5 bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)] text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <span>Preview Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
