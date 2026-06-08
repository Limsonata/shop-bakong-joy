// Bakong KHQR generator
// Implements the KHQR (Cambodia's national QR standard) based on the EMVCo merchant-presented QR specification
// References:
// - https://bakong.nbc.gov.kh/
// - EMVCo QR Code Specification for Payment Systems

const DEFAULT_CURRENCY = "USD";

// KHQR Currency codes (ISO 4217 numeric)
const CURRENCY_CODES: Record<string, string> = {
  USD: "840",
  KHR: "116",
};

export interface BakongPaymentConfig {
  merchantName: string;
  merchantAccount: string; // Bakong account ID like name@bank
  merchantCity: string;
  qrImageUrl: string;
  currencyCode: string;
  acquiringBank?: string;
}

export interface BakongQRPayload {
  amount?: number;
  currency?: string;
  reference?: string;
  description?: string;
  storeLabel?: string;
  terminalLabel?: string;
}

export function getBakongPaymentConfig(): BakongPaymentConfig {
  return {
    merchantName: import.meta.env.VITE_BAKONG_MERCHANT_NAME || "Shop Bakong Joy",
    merchantAccount: import.meta.env.VITE_BAKONG_MERCHANT_ACCOUNT || "mengsry_mey@bkrt",
    merchantCity: import.meta.env.VITE_BAKONG_MERCHANT_CITY || "Phnom Penh",
    qrImageUrl: import.meta.env.VITE_BAKONG_QR_IMAGE_URL || "",
    currencyCode: import.meta.env.VITE_BAKONG_CURRENCY || DEFAULT_CURRENCY,
    acquiringBank: import.meta.env.VITE_BAKONG_ACQUIRING_BANK || "",
  };
}

export function isBakongConfigured(config = getBakongPaymentConfig()): boolean {
  return Boolean(config.merchantAccount || config.qrImageUrl);
}

export function getBakongCheckoutUrl(): string {
  return "/checkout/bakong";
}

/**
 * Format a TLV (Tag-Length-Value) field used in EMVCo QR codes.
 * Each field is: 2-digit tag + 2-digit length + value
 */
function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${tag}${length}${value}`;
}

/**
 * Calculate CRC16-CCITT (polynomial 0x1021, initial 0xFFFF)
 * This is the checksum format required by EMVCo/KHQR.
 */
function crc16(data: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Generate a KHQR-compliant QR code string for Bakong payments.
 *
 * Field layout (EMVCo / KHQR):
 *   00 - Payload Format Indicator ("01")
 *   01 - Point of Initiation Method ("11" static, "12" dynamic)
 *   29 - Merchant Account Information (Bakong - account ID)
 *   52 - Merchant Category Code ("5999" general)
 *   53 - Transaction Currency (ISO 4217 numeric)
 *   54 - Transaction Amount (optional, for dynamic QR)
 *   58 - Country Code ("KH")
 *   59 - Merchant Name
 *   60 - Merchant City
 *   62 - Additional Data (reference, description)
 *   63 - CRC checksum
 */
export function generateBakongQR(
  config: BakongPaymentConfig,
  payload: BakongQRPayload = {},
): string {
  const currency = payload.currency || config.currencyCode || DEFAULT_CURRENCY;
  const currencyCode = CURRENCY_CODES[currency.toUpperCase()] || CURRENCY_CODES.USD;
  const isDynamic = typeof payload.amount === "number" && payload.amount > 0;

  // Field 00 - Payload Format Indicator
  let qrString = tlv("00", "01");

  // Field 01 - Point of Initiation Method (11=static, 12=dynamic)
  qrString += tlv("01", isDynamic ? "12" : "11");

  // Field 29 - Merchant Account Information for Bakong
  // Sub-tag 00 = Globally Unique Identifier ("kh.gov.nbc.bakong")
  // Sub-tag 01 = Merchant Bakong Account ID
  const merchantAccountInfo =
    tlv("00", "kh.gov.nbc.bakong") + tlv("01", config.merchantAccount);
  qrString += tlv("29", merchantAccountInfo);

  // Field 52 - Merchant Category Code (5999 = general retail)
  qrString += tlv("52", "5999");

  // Field 53 - Transaction Currency
  qrString += tlv("53", currencyCode);

  // Field 54 - Transaction Amount (only for dynamic QR)
  if (isDynamic) {
    const amount = payload.amount!.toFixed(2);
    qrString += tlv("54", amount);
  }

  // Field 58 - Country Code
  qrString += tlv("58", "KH");

  // Field 59 - Merchant Name (max 25 chars)
  const merchantName = config.merchantName.substring(0, 25);
  qrString += tlv("59", merchantName);

  // Field 60 - Merchant City (max 15 chars)
  const merchantCity = (config.merchantCity || "Phnom Penh").substring(0, 15);
  qrString += tlv("60", merchantCity);

  // Field 62 - Additional Data Field (reference, description)
  if (payload.reference || payload.description || payload.storeLabel || payload.terminalLabel) {
    let additionalData = "";
    if (payload.storeLabel) {
      additionalData += tlv("03", payload.storeLabel.substring(0, 25));
    }
    if (payload.reference) {
      additionalData += tlv("05", payload.reference.substring(0, 25));
    }
    if (payload.terminalLabel) {
      additionalData += tlv("07", payload.terminalLabel.substring(0, 25));
    }
    if (payload.description) {
      additionalData += tlv("08", payload.description.substring(0, 25));
    }
    if (additionalData) {
      qrString += tlv("62", additionalData);
    }
  }

  // Field 63 - CRC (calculate over everything including "6304")
  qrString += "6304";
  const checksum = crc16(qrString);
  qrString += checksum;

  return qrString;
}

/**
 * Validate a Bakong account ID format.
 * Bakong accounts follow the pattern: identifier@bank (e.g., "mengsry_mey@bkrt")
 */
export function isValidBakongAccount(account: string): boolean {
  if (!account) return false;
  return /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$/.test(account);
}
