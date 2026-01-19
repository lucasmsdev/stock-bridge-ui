import { useCallback } from "react";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import type { LabelOptions, LabelTemplate } from "./LabelTemplates";

interface Product {
  id: string;
  name: string;
  sku: string;
  ean?: string | null;
  selling_price?: number | null;
  image_url?: string | null;
}

interface GeneratePdfParams {
  products: Product[];
  template: LabelTemplate;
  options: LabelOptions;
  logoUrl?: string | null;
}

export const useLabelGenerator = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const generateBarcodeDataUrl = (
    value: string,
    format: "CODE128" | "EAN13",
    width: number,
    height: number
  ): string => {
    const canvas = document.createElement("canvas");

    // Validate EAN-13
    const isValidEan13 = format === "EAN13" && /^\d{13}$/.test(value);
    const finalFormat = format === "EAN13" && !isValidEan13 ? "CODE128" : format;
    const cleanValue = value.replace(/[^\w\d\-\.]/g, "") || "NO-CODE";

    try {
      JsBarcode(canvas, finalFormat === "EAN13" ? value : cleanValue, {
        format: finalFormat,
        width,
        height,
        displayValue: true,
        fontSize: finalFormat === "EAN13" ? 12 : 10,
        margin: 2,
      });
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error generating barcode:", error);
      // Fallback to CODE128
      JsBarcode(canvas, cleanValue, {
        format: "CODE128",
        width,
        height,
        displayValue: true,
        fontSize: 10,
        margin: 2,
      });
      return canvas.toDataURL("image/png");
    }
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePdf = useCallback(
    async ({
      products,
      template,
      options,
      logoUrl,
    }: GeneratePdfParams): Promise<Blob> => {
      const isThermal = template.format === "thermal";

      // Create PDF with appropriate size
      const doc = new jsPDF({
        unit: "mm",
        format: isThermal ? [template.width, template.height] : "a4",
        orientation: "portrait",
      });

      // Load logo if needed
      let logoImage: HTMLImageElement | null = null;
      if (options.showLogo && logoUrl) {
        try {
          logoImage = await loadImage(logoUrl);
        } catch (error) {
          console.warn("Could not load logo:", error);
        }
      }

      // Calculate positions
      const pageWidth = isThermal ? template.width : 210;
      const pageHeight = isThermal ? template.height : 297;

      // Expand products based on copies
      const expandedProducts: Product[] = [];
      for (const product of products) {
        for (let i = 0; i < options.copies; i++) {
          expandedProducts.push(product);
        }
      }

      let currentLabelIndex = 0;
      let currentPage = 0;

      for (const product of expandedProducts) {
        // Calculate position on page
        const labelOnPage = currentLabelIndex % template.labelsPerPage;

        // Add new page if needed
        if (labelOnPage === 0 && currentLabelIndex > 0) {
          doc.addPage();
          currentPage++;
        }

        // Calculate x, y position
        let x: number, y: number;

        if (isThermal) {
          x = template.marginLeft;
          y = template.marginTop;
        } else {
          const col = labelOnPage % template.columns;
          const row = Math.floor(labelOnPage / template.columns);

          x = template.marginLeft + col * (template.width + template.gapX);
          y = template.marginTop + row * (template.height + template.gapY);
        }

        // Draw label border (optional, for debugging)
        // doc.setDrawColor(200);
        // doc.rect(x, y, template.width, template.height);

        const labelWidth = template.width - 4;
        const labelHeight = template.height - 4;
        const labelX = x + 2;
        let currentY = y + 3;

        // Logo
        if (options.showLogo && logoImage) {
          const logoMaxWidth = isThermal ? 30 : 20;
          const logoMaxHeight = isThermal ? 12 : 6;
          const aspectRatio = logoImage.width / logoImage.height;

          let logoWidth = logoMaxWidth;
          let logoHeight = logoWidth / aspectRatio;

          if (logoHeight > logoMaxHeight) {
            logoHeight = logoMaxHeight;
            logoWidth = logoHeight * aspectRatio;
          }

          const logoX = labelX + (labelWidth - logoWidth) / 2;
          doc.addImage(logoImage, "PNG", logoX, currentY, logoWidth, logoHeight);
          currentY += logoHeight + 2;
        }

        // Product name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isThermal ? 12 : 7);
        doc.setTextColor(0, 0, 0);

        const nameLines = doc.splitTextToSize(product.name, labelWidth - 2);
        const maxLines = isThermal ? 3 : 2;
        const truncatedLines = nameLines.slice(0, maxLines);

        truncatedLines.forEach((line: string) => {
          doc.text(line, labelX + labelWidth / 2, currentY, { align: "center" });
          currentY += isThermal ? 4 : 2.5;
        });

        currentY += 1;

        // Price
        if (options.showPrice && product.selling_price) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(isThermal ? 18 : 10);
          doc.text(
            formatCurrency(product.selling_price),
            labelX + labelWidth / 2,
            currentY,
            { align: "center" }
          );
          currentY += isThermal ? 7 : 4;
        }

        // SKU
        if (options.showSku) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(isThermal ? 8 : 5);
          doc.setTextColor(80, 80, 80);
          doc.text(`SKU: ${product.sku}`, labelX + labelWidth / 2, currentY, {
            align: "center",
          });
          currentY += isThermal ? 3.5 : 2;
        }

        // EAN
        if (options.showEan && product.ean) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(isThermal ? 8 : 5);
          doc.setTextColor(80, 80, 80);
          doc.text(`EAN: ${product.ean}`, labelX + labelWidth / 2, currentY, {
            align: "center",
          });
          currentY += isThermal ? 3.5 : 2;
        }

        // Barcode
        if (options.showBarcode) {
          const barcodeValue =
            options.showEan && product.ean && options.barcodeType === "EAN13"
              ? product.ean
              : product.sku;

          const barcodeWidth = isThermal ? 2 : 1;
          const barcodeHeight = isThermal ? 40 : 18;

          const barcodeDataUrl = generateBarcodeDataUrl(
            barcodeValue,
            options.barcodeType,
            barcodeWidth,
            barcodeHeight
          );

          // Calculate barcode dimensions
          const barcodeImgWidth = isThermal ? 70 : 35;
          const barcodeImgHeight = isThermal ? 25 : 12;

          // Position at bottom of label
          const barcodeY = y + template.height - barcodeImgHeight - 3;
          const barcodeX = labelX + (labelWidth - barcodeImgWidth) / 2;

          doc.addImage(
            barcodeDataUrl,
            "PNG",
            barcodeX,
            barcodeY,
            barcodeImgWidth,
            barcodeImgHeight
          );
        }

        currentLabelIndex++;
      }

      return doc.output("blob");
    },
    []
  );

  const downloadPdf = useCallback(
    async (params: GeneratePdfParams, filename?: string) => {
      const blob = await generatePdf(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `etiquetas-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [generatePdf]
  );

  const printPdf = useCallback(
    async (params: GeneratePdfParams) => {
      const blob = await generatePdf(params);
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    },
    [generatePdf]
  );

  return {
    generatePdf,
    downloadPdf,
    printPdf,
  };
};
