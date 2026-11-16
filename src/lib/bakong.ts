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
  /** Bill number shown in the customer's banking app (max 25 chars). */
  reference?: string;
  /** Purpose of transaction (max 25 chars). */
  description?: string;
  storeLabel?: string;
  terminalLabel?: string;
  /** How long a QR with an amount stays payable. KHQR requires an expiry for these. Default 10. */
  expiresInMinutes?: number;
}

export function getBakongPaymentConfig(): BakongPaymentConfig {
  return {
    merchantName: import.meta.env.VITE_BAKONG_MERCHANT_NAME || "BillieGrace Closet",
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
 * Generate a KHQR string for an individual Bakong account.
 *
 * Field layout follows the official NBC `bakong-khqr` SDK (v1.0.20):
 *   00 - Payload Format Indicator ("01")
 *   01 - Point of Initiation Method ("11" static, "12" dynamic = has amount)
 *   29 - Individual account: 00 = Bakong account ID, 02 = acquiring bank (optional)
 *   52 - Merchant Category Code ("5999" general)
 *   53 - Transaction Currency (840 USD, 116 KHR)
 *   54 - Transaction Amount (dynamic only; USD up to 2 decimals, KHR whole riel)
 *   58 - Country Code ("KH")
 *   59 - Merchant Name (max 25)
 *   60 - Merchant City (max 15)
 *   62 - Additional data: 01 bill number, 03 store label, 07 terminal, 08 purpose
 *   99 - Timestamps in ms: 00 created, 01 expires (required for dynamic QR)
 *   63 - CRC16 checksum
 */
export function generateBakongQR(
  config: BakongPaymentConfig,
  payload: BakongQRPayload = {},
): string {
  const currency = (payload.currency || config.currencyCode || DEFAULT_CURRENCY).toUpperCase();
  const currencyCode = CURRENCY_CODES[currency] || CURRENCY_CODES.USD;
  const isDynamic = typeof payload.amount === "number" && payload.amount > 0;

  let qrString = tlv("00", "01");
  qrString += tlv("01", isDynamic ? "12" : "11");

  let accountInfo = tlv("00", config.merchantAccount);
  if (config.acquiringBank) accountInfo += tlv("02", config.acquiringBank.substring(0, 32));
  qrString += tlv("29", accountInfo);

  qrString += tlv("52", "5999");
  qrString += tlv("53", currencyCode);

  if (isDynamic) {
    const amount = payload.amount!;
    let formatted: string;
    if (currencyCode === CURRENCY_CODES.KHR) {
      formatted = String(Math.round(amount));
    } else {
      const cents = Math.round(amount * 100);
      formatted = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
    }
    qrString += tlv("54", formatted);
  }

  qrString += tlv("58", "KH");
  qrString += tlv("59", config.merchantName.substring(0, 25));
  qrString += tlv("60", (config.merchantCity || "Phnom Penh").substring(0, 15));

  let additionalData = "";
  if (payload.reference) additionalData += tlv("01", payload.reference.substring(0, 25));
  if (payload.storeLabel) additionalData += tlv("03", payload.storeLabel.substring(0, 25));
  if (payload.terminalLabel) additionalData += tlv("07", payload.terminalLabel.substring(0, 25));
  if (payload.description) additionalData += tlv("08", payload.description.substring(0, 25));
  if (additionalData) qrString += tlv("62", additionalData);

  if (isDynamic) {
    const created = Date.now();
    const expires = created + Math.max(payload.expiresInMinutes ?? 10, 1) * 60 * 1000;
    qrString += tlv("99", tlv("00", String(created)) + tlv("01", String(expires)));
  }

  // Field 63 - CRC (calculated over everything including "6304")
  qrString += "6304";
  qrString += crc16(qrString);

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
