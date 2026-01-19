import { BarcodeGenerator } from "./BarcodeGenerator";
import type { LabelOptions, LabelTemplate } from "./LabelTemplates";

interface Product {
  id: string;
  name: string;
  sku: string;
  ean?: string | null;
  selling_price?: number | null;
  image_url?: string | null;
}

interface LabelPreviewProps {
  product: Product;
  template: LabelTemplate;
  options: LabelOptions;
  logoUrl?: string | null;
  scale?: number;
}

export const LabelPreview = ({
  product,
  template,
  options,
  logoUrl,
  scale = 2,
}: LabelPreviewProps) => {
  const isThermal = template.format === 'thermal';
  
  // Scale dimensions for preview
  const width = template.width * scale;
  const height = template.height * scale;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getBarcodeValue = () => {
    if (options.showEan && product.ean && options.barcodeType === 'EAN13') {
      return product.ean;
    }
    return product.sku;
  };

  return (
    <div
      className="bg-white border-2 border-dashed border-border rounded-lg flex flex-col justify-between overflow-hidden"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        padding: isThermal ? '12px' : '6px',
      }}
    >
      {/* Header with Logo */}
      {options.showLogo && logoUrl && (
        <div className="flex justify-center mb-1">
          <img
            src={logoUrl}
            alt="Logo"
            className="object-contain"
            style={{
              maxHeight: isThermal ? '40px' : '16px',
              maxWidth: isThermal ? '80px' : '40px',
            }}
          />
        </div>
      )}

      {/* Product Name */}
      <div className="text-center flex-shrink-0">
        <p
          className="font-bold text-gray-900 leading-tight line-clamp-2"
          style={{
            fontSize: isThermal ? '14px' : '8px',
          }}
        >
          {product.name}
        </p>
      </div>

      {/* Price */}
      {options.showPrice && product.selling_price && (
        <div className="text-center flex-shrink-0">
          <p
            className="font-bold text-gray-900"
            style={{
              fontSize: isThermal ? '28px' : '12px',
            }}
          >
            {formatCurrency(product.selling_price)}
          </p>
        </div>
      )}

      {/* SKU / EAN */}
      <div className="text-center flex-shrink-0 space-y-0.5">
        {options.showSku && (
          <p
            className="text-gray-600"
            style={{
              fontSize: isThermal ? '10px' : '6px',
            }}
          >
            SKU: {product.sku}
          </p>
        )}
        {options.showEan && product.ean && (
          <p
            className="text-gray-600"
            style={{
              fontSize: isThermal ? '10px' : '6px',
            }}
          >
            EAN: {product.ean}
          </p>
        )}
      </div>

      {/* Barcode */}
      {options.showBarcode && (
        <div className="flex justify-center flex-shrink-0 mt-auto">
          <BarcodeGenerator
            value={getBarcodeValue()}
            format={options.barcodeType}
            width={isThermal ? 2 : 1}
            height={isThermal ? 50 : 20}
            fontSize={isThermal ? 10 : 6}
            displayValue={true}
          />
        </div>
      )}
    </div>
  );
};
