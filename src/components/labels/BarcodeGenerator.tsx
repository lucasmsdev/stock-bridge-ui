import Barcode from "react-barcode";

interface BarcodeGeneratorProps {
  value: string;
  format?: "CODE128" | "EAN13" | "EAN8" | "UPC";
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  background?: string;
  lineColor?: string;
}

export const BarcodeGenerator = ({
  value,
  format = "CODE128",
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 12,
  background = "#ffffff",
  lineColor = "#000000",
}: BarcodeGeneratorProps) => {
  // Validate EAN-13 (must be exactly 13 digits)
  const isValidEan13 = format === "EAN13" && /^\d{13}$/.test(value);
  
  // For EAN13, fallback to CODE128 if invalid
  const finalFormat = format === "EAN13" && !isValidEan13 ? "CODE128" : format;
  
  // Clean value for barcode (remove special characters for CODE128)
  const cleanValue = value.replace(/[^\w\d\-\.]/g, '') || 'NO-CODE';

  return (
    <Barcode
      value={finalFormat === "EAN13" ? value : cleanValue}
      format={finalFormat}
      width={width}
      height={height}
      displayValue={displayValue}
      fontSize={fontSize}
      background={background}
      lineColor={lineColor}
      margin={0}
    />
  );
};

// Utility to validate EAN-13 checksum
export const validateEan13 = (ean: string): boolean => {
  if (!/^\d{13}$/.test(ean)) return false;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(ean[i]) * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return parseInt(ean[12]) === checkDigit;
};

// Generate EAN-13 check digit
export const generateEan13CheckDigit = (ean12: string): string => {
  if (!/^\d{12}$/.test(ean12)) return '';
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(ean12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return ean12 + checkDigit;
};
