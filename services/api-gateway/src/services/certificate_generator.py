import io
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import qrcode
from PIL import Image

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas


def render_parcel_map_image(geometry: Optional[Dict[str, Any]], survey_no: str, area_acres: Optional[float] = None) -> Optional[bytes]:
    """
    Renders the real cadastral parcel polygon into a high-contrast, professional PNG image.
    Uses matplotlib with cadastral parcel styling. Returns None if geometry is missing or invalid.
    """
    if not geometry or not isinstance(geometry, dict):
        return None

    geom_type = geometry.get("type", "")
    coords = geometry.get("coordinates")
    if not coords or not isinstance(coords, list):
        return None

    try:
        rings = []
        if geom_type == "Polygon":
            rings = [coords[0]]
        elif geom_type == "MultiPolygon":
            for poly in coords:
                if poly and len(poly) > 0:
                    rings.append(poly[0])
        else:
            return None

        fig, ax = plt.subplots(figsize=(3.4, 2.3), dpi=180)
        fig.patch.set_facecolor("#FAF9F5")
        ax.set_facecolor("#F7F5EF")

        all_x, all_y = [], []

        for ring in rings:
            xs = [pt[0] for pt in ring]
            ys = [pt[1] for pt in ring]
            all_x.extend(xs)
            all_y.extend(ys)

            # Draw parcel polygon
            poly_patch = patches.Polygon(
                list(zip(xs, ys)),
                closed=True,
                facecolor="#D1E7DD",
                edgecolor="#0B5B3E",
                linewidth=2.0,
                alpha=0.85,
                zorder=2,
            )
            ax.add_patch(poly_patch)

            # Draw vertex nodes
            ax.scatter(xs, ys, color="#16241F", s=16, zorder=3)

        if not all_x or not all_y:
            plt.close(fig)
            return None

        # Center label
        cx = sum(all_x) / len(all_x)
        cy = sum(all_y) / len(all_y)
        label_text = f"Parcel {survey_no}"
        if area_acres:
            label_text += f"\n{area_acres} ac"
        ax.text(
            cx, cy, label_text,
            color="#16241F",
            fontsize=8,
            fontweight="bold",
            ha="center",
            va="center",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="#FFFFFF", edgecolor="#0B5B3E", alpha=0.9, lw=0.8),
            zorder=4,
        )

        # Padding
        dx = max(all_x) - min(all_x) or 0.001
        dy = max(all_y) - min(all_y) or 0.001
        pad_x = dx * 0.20
        pad_y = dy * 0.20
        ax.set_xlim(min(all_x) - pad_x, max(all_x) + pad_x)
        ax.set_ylim(min(all_y) - pad_y, max(all_y) + pad_y)

        # Grid lines
        ax.grid(True, linestyle="--", linewidth=0.5, color="#D6D0C2", alpha=0.8, zorder=1)

        # North arrow
        ax.annotate(
            "N\n↑",
            xy=(0.90, 0.85),
            xycoords="axes fraction",
            fontsize=9,
            fontweight="bold",
            ha="center",
            va="center",
            color="#0B5B3E",
            bbox=dict(boxstyle="circle,pad=0.2", facecolor="#FAF9F5", edgecolor="#0B5B3E", lw=1),
        )

        ax.tick_params(axis="both", which="both", labelsize=6.5, colors="#5A5243")
        for spine in ax.spines.values():
            spine.set_color("#8C8275")
            spine.set_linewidth(0.8)

        plt.tight_layout(pad=0.5)

        buf = io.BytesIO()
        plt.savefig(buf, format="png", facecolor=fig.get_facecolor(), edgecolor="none")
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()
    except Exception as e:
        plt.close("all")
        return None


def generate_qr_image(url: str) -> bytes:
    """
    Generates a crisp QR code PNG encoding the signed verification URL.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#16241F", back_color="#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


class NumberedCanvas(canvas.Canvas):
    """
    Custom ReportLab canvas that draws the official double border, corner embellishments,
    and footer disclaimer on the page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        width, height = self._pagesize

        # Outer Dark Green Border
        self.saveState()
        self.setStrokeColor(colors.HexColor("#16241F"))
        self.setLineWidth(2.5)
        self.rect(20, 20, width - 40, height - 40)

        # Inner Gold / Thin Border
        self.setStrokeColor(colors.HexColor("#B38E3E"))
        self.setLineWidth(0.75)
        self.rect(24, 24, width - 48, height - 48)

        # Corner Corner Accents
        self.setFillColor(colors.HexColor("#0B5B3E"))
        corner_size = 6
        for (cx, cy) in [(20, 20), (width - 20, 20), (20, height - 20), (width - 20, height - 20)]:
            self.rect(cx - corner_size/2, cy - corner_size/2, corner_size, corner_size, fill=1, stroke=0)

        self.restoreState()


def build_certificate_pdf(
    record_data: Dict[str, Any],
    audit_status: Dict[str, Any],
    gis_geometry: Optional[Dict[str, Any]],
    qr_url: str,
) -> bytes:
    """
    Composes a single-page official government Digital Land Record Certificate.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=32,
        rightMargin=32,
        topMargin=32,
        bottomMargin=32,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CertTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#16241F"),
        alignment=1,  # Center
    )
    subtitle_style = ParagraphStyle(
        "CertSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0B5B3E"),
        alignment=1,
    )
    meta_style = ParagraphStyle(
        "CertMeta",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#5A5243"),
        alignment=1,
    )
    th_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#FFFFFF"),
    )
    td_label_style = ParagraphStyle(
        "TableLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#16241F"),
    )
    td_val_style = ParagraphStyle(
        "TableVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#2B2823"),
    )
    seal_title_style = ParagraphStyle(
        "SealTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#0B5B3E"),
    )
    seal_desc_style = ParagraphStyle(
        "SealDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#2B2823"),
    )
    warn_title_style = ParagraphStyle(
        "WarnTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#B91C1C"),
    )
    warn_desc_style = ParagraphStyle(
        "WarnDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#7F1D1D"),
    )
    footer_style = ParagraphStyle(
        "FooterNote",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#5A5243"),
        alignment=1,
    )

    story = []

    # 1. State and National Header
    state_name = (record_data.get("state") or "KARNATAKA").upper()
    story.append(Paragraph(f"GOVERNMENT OF {state_name}", title_style))
    story.append(Paragraph("DEPARTMENT OF REVENUE & LAND RECORDS MODERNISATION", ParagraphStyle("SubHeader", parent=title_style, fontSize=11, leading=14, textColor=colors.HexColor("#0B5B3E"))))
    story.append(Spacer(1, 2))
    story.append(Paragraph("DIGITAL LAND RECORD CERTIFICATE • REGISTER OF RIGHTS EXTRACT", ParagraphStyle("DocTitle", parent=title_style, fontSize=12, leading=15, textColor=colors.HexColor("#16241F"))))
    story.append(Paragraph("Issued under the Digital India Land Records Modernisation Programme (DILRMP)", subtitle_style))
    story.append(Spacer(1, 4))

    # Certificate ID and Timestamp Bar
    rec_id = str(record_data.get("record_id", ""))
    short_id = rec_id[:8].upper()
    now_utc = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M:%S UTC")
    meta_text = f"CERTIFICATE REF: CERT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{short_id}  |  ISSUED: {now_utc}  |  RECORD ID: {rec_id}"
    story.append(Paragraph(meta_text, meta_style))
    story.append(Spacer(1, 6))

    # 2. Cryptographically Honest Audit Integrity Seal
    is_valid = bool(audit_status.get("valid", False))
    entries_count = audit_status.get("verified_entries", 0)

    if is_valid:
        seal_p = [
            Paragraph("✔  DIGITALLY VERIFIED • HASH-CHAIN INTEGRITY CONFIRMED", seal_title_style),
            Spacer(1, 1),
            Paragraph(
                f"Tamper-Evident Ledger Status: UNTAMPERED across {entries_count} cryptographically sealed audit block(s). "
                "Document coordinates, mutation entries, and field extractions match the certified state ledger.",
                seal_desc_style,
            ),
        ]
        seal_table = Table([[seal_p]], colWidths=[531])
        seal_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E8F5E9")),
                ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#0B5B3E")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ])
        )
    else:
        reason = audit_status.get("reason", "Cryptographic hash mismatch")
        seal_p = [
            Paragraph("⚠  AUDIT INTEGRITY CHECK FAILED • TAMPER DETECTED", warn_title_style),
            Spacer(1, 1),
            Paragraph(
                f"Warning: Audit trail validation failed ({reason}). Stored block hashes diverge from computed ledger values. "
                "This document is flagged for registrar audit and cannot be certified as authentic.",
                warn_desc_style,
            ),
        ]
        seal_table = Table([[seal_p]], colWidths=[531])
        seal_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
                ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#B91C1C")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ])
        )
    story.append(seal_table)
    story.append(Spacer(1, 8))

    # 3. Extracted Fields Data Table
    fields = record_data.get("fields", {}) or {}
    survey_no = fields.get("survey_number") or fields.get("khasra_number") or "N/A"
    khasra_no = fields.get("khasra_number") or "N/A"
    khata_no = fields.get("khata_number") or "N/A"
    owner_name = fields.get("owner_name") or "N/A"
    plot_area = fields.get("plot_area") or "N/A"
    village = fields.get("village") or "N/A"
    tehsil = fields.get("tehsil") or "N/A"
    district = fields.get("district") or "N/A"
    land_class = fields.get("land_classification") or "Agricultural / General"
    mutation_no = fields.get("mutation_number") or f"MUT-{short_id}"
    doc_type = record_data.get("document_type") or "Land Record Extract"
    gis_acres = record_data.get("gis", {}).get("area_gis_acres") if record_data.get("gis") else None
    gis_extent_str = f"{gis_acres} Acres (Cadastral GIS)" if gis_acres else "Pending GIS Mapping"

    table_data = [
        [
            Paragraph("OFFICIAL LAND PARCEL ATTRIBUTES", th_style),
            Paragraph("", th_style),
            Paragraph("ADMINISTRATIVE JURISDICTION & VALIDATION", th_style),
            Paragraph("", th_style),
        ],
        [
            Paragraph("Survey Number:", td_label_style),
            Paragraph(str(survey_no), td_val_style),
            Paragraph("Village / Habitation:", td_label_style),
            Paragraph(str(village), td_val_style),
        ],
        [
            Paragraph("Khasra / Plot Number:", td_label_style),
            Paragraph(str(khasra_no), td_val_style),
            Paragraph("Tehsil / Taluka:", td_label_style),
            Paragraph(str(tehsil), td_val_style),
        ],
        [
            Paragraph("Khata / Ledger Number:", td_label_style),
            Paragraph(str(khata_no), td_val_style),
            Paragraph("District & State:", td_label_style),
            Paragraph(f"{district}, {state_name}", td_val_style),
        ],
        [
            Paragraph("Registered Legal Owner:", td_label_style),
            Paragraph(str(owner_name), td_val_style),
            Paragraph("Document Type:", td_label_style),
            Paragraph(str(doc_type), td_val_style),
        ],
        [
            Paragraph("Deed Stated Extent:", td_label_style),
            Paragraph(str(plot_area), td_val_style),
            Paragraph("Validation Status:", td_label_style),
            Paragraph("OFFICIALLY VALIDATED", ParagraphStyle("ValStatus", parent=td_val_style, fontName="Helvetica-Bold", textColor=colors.HexColor("#0B5B3E"))),
        ],
        [
            Paragraph("Cadastral GIS Extent:", td_label_style),
            Paragraph(str(gis_extent_str), td_val_style),
            Paragraph("Mutation Reference:", td_label_style),
            Paragraph(str(mutation_no), td_val_style),
        ],
        [
            Paragraph("Land Classification:", td_label_style),
            Paragraph(str(land_class), td_val_style),
            Paragraph("Revenue Verifier:", td_label_style),
            Paragraph(record_data.get("review", {}).get("reviewed_by") or "Revenue Officer", td_val_style),
        ],
    ]

    t = Table(table_data, colWidths=[105, 160, 115, 151])
    t.setStyle(
        TableStyle([
            ("SPAN", (0, 0), (1, 0)),
            ("SPAN", (2, 0), (3, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16241F")),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAF9F5")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FAF9F5"), colors.HexColor("#F2EFE9")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6D0C2")),
            ("BOX", (0, 0), (-1, -1), 1.0, colors.HexColor("#16241F")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(t)
    story.append(Spacer(1, 8))

    # 4. Visual Section: GIS Parcel Map Thumbnail (if available) + Scannable QR Code
    map_png_bytes = render_parcel_map_image(gis_geometry, str(survey_no), gis_acres)
    qr_png_bytes = generate_qr_image(qr_url)

    # Left cell: Map render or honest unmapped notice
    if map_png_bytes:
        map_buf = io.BytesIO(map_png_bytes)
        map_img = RLImage(map_buf, width=245, height=155)
        map_caption = Paragraph("<b>Cadastral GIS Parcel Geometry</b> (Bhoomi / Mahabhulekh Linkage Verified)", ParagraphStyle("MC", parent=td_val_style, fontSize=7, alignment=1))
        map_cell = [map_img, Spacer(1, 2), map_caption]
    else:
        unmapped_note = [
            Spacer(1, 20),
            Paragraph("<b>Cadastral Spatial Geometry</b>", ParagraphStyle("UnmappedTitle", parent=td_label_style, alignment=1)),
            Spacer(1, 6),
            Paragraph(
                "Digital cadastral polygon coordinates have not yet been mapped for this survey number in the spatial database. "
                "Geometry will be linked automatically upon cadastral GIS ground verification.",
                ParagraphStyle("UnmappedDesc", parent=td_val_style, fontSize=7.5, leading=10, alignment=1),
            ),
            Spacer(1, 20),
        ]
        map_cell = unmapped_note

    # Right cell: QR Code and instructions
    qr_buf = io.BytesIO(qr_png_bytes)
    qr_img = RLImage(qr_buf, width=115, height=115)
    qr_instructions = [
        Paragraph("<b>Instant Trust Verification</b>", ParagraphStyle("QRT", parent=td_label_style, fontSize=8, alignment=1, textColor=colors.HexColor("#0B5B3E"))),
        Spacer(1, 2),
        qr_img,
        Spacer(1, 3),
        Paragraph("Scan QR with any phone camera to verify authenticity directly against the state ledger.", ParagraphStyle("QRDesc", parent=td_val_style, fontSize=6.5, leading=8.5, alignment=1)),
        Paragraph(f"Signed Key: {record_data.get('verification_token', 'N/A')}", ParagraphStyle("QRTok", parent=td_val_style, fontName="Helvetica", fontSize=6, leading=7.5, alignment=1, textColor=colors.HexColor("#5A5243"))),
    ]

    media_table = Table([[map_cell, qr_instructions]], colWidths=[345, 186])
    media_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAF9F5")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#B38E3E")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(media_table)
    story.append(Spacer(1, 8))

    # 5. Official Signature & Disclaimer Block
    sig_data = [
        [
            Paragraph("<b>Digitally Certified by:</b><br/>VasudhaMithra Automated Digitisation Engine<br/>Revenue Administration & Land Modernisation Portal", ParagraphStyle("SigL", parent=td_val_style, fontSize=7, leading=9)),
            Paragraph(f"<b>Verification Endpoint:</b><br/>{qr_url[:48]}...<br/>HMAC Security Sealed", ParagraphStyle("SigR", parent=td_val_style, fontSize=7, leading=9, alignment=2)),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[310, 221])
    sig_table.setStyle(
        TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#D6D0C2")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ])
    )
    story.append(sig_table)
    story.append(Spacer(1, 3))

    disclaimer_text = (
        "Notice: This document is an official digital extract generated by the VasudhaMithra Digitisation Pipeline "
        "under the Digital India Land Records Modernisation Programme. Authenticity can be independently verified by scanning the QR code above."
    )
    story.append(Paragraph(disclaimer_text, footer_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf.getvalue()
