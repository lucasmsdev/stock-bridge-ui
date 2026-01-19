// Template definitions for label generation

export interface LabelTemplate {
  name: string;
  format: 'thermal' | 'a4';
  width: number; // in mm
  height: number; // in mm
  labelsPerPage: number;
  columns: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
}

export const THERMAL_TEMPLATE: LabelTemplate = {
  name: 'Térmica 100x150mm',
  format: 'thermal',
  width: 100,
  height: 150,
  labelsPerPage: 1,
  columns: 1,
  rows: 1,
  marginTop: 5,
  marginLeft: 5,
  gapX: 0,
  gapY: 0,
};

export const A4_TEMPLATE: LabelTemplate = {
  name: 'A4 - 24 etiquetas (70x37mm)',
  format: 'a4',
  width: 70,
  height: 37,
  labelsPerPage: 24,
  columns: 3,
  rows: 8,
  marginTop: 10,
  marginLeft: 5,
  gapX: 0,
  gapY: 0,
};

export const A4_LARGE_TEMPLATE: LabelTemplate = {
  name: 'A4 - 8 etiquetas (105x74mm)',
  format: 'a4',
  width: 105,
  height: 74,
  labelsPerPage: 8,
  columns: 2,
  rows: 4,
  marginTop: 0,
  marginLeft: 0,
  gapX: 0,
  gapY: 0,
};

export const TEMPLATES: LabelTemplate[] = [
  THERMAL_TEMPLATE,
  A4_TEMPLATE,
  A4_LARGE_TEMPLATE,
];

export interface LabelOptions {
  showLogo: boolean;
  showPrice: boolean;
  showSku: boolean;
  showEan: boolean;
  showBarcode: boolean;
  barcodeType: 'CODE128' | 'EAN13';
  copies: number;
}

export const DEFAULT_LABEL_OPTIONS: LabelOptions = {
  showLogo: true,
  showPrice: true,
  showSku: true,
  showEan: true,
  showBarcode: true,
  barcodeType: 'CODE128',
  copies: 1,
};
