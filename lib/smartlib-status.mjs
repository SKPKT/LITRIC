// The owner confirmed this production frontend on 2026-11-06. This is not
// evidence that its Apps Script backend or database has been authenticated.
export const SMARTLIB_SOURCE_URL = "https://skpkt.github.io/smartlib/";

/** Fail closed until the actual backend contract and read-only identity exist.
 * Configuration, an HTTP 200, a public ping or a successful Drive read must
 * never be converted into a verified catalogue connection.
 */
export function unverifiedSmartlibStatus(settings = {}, bindings = {}) {
  const hasEndpoint = !!settings.smartlibUrl;
  const hasCredential = !!bindings.SMARTLIB_API_KEY;
  return {
    status: hasEndpoint && hasCredential ? "disconnected" : "not_configured",
    connected: false,
    verified: false,
    health: "not_verified",
    sourceUrl: SMARTLIB_SOURCE_URL,
    sourceVerification: "Frontend confirmed; backend/database binding not verified",
    lastSuccessfulConnectionAt: null,
    lastCatalogueSyncAt: null,
    verifiedAt: null,
    catalogueRecordsRead: null,
    circulationVerified: false,
    readOnly: true,
    missingConfiguration: [
      ...(!hasEndpoint ? ["verified_backend_endpoint"] : []),
      ...(!hasCredential ? ["dedicated_read_only_credential"] : []),
      "production_database_binding",
      "authenticated_api_contract_and_catalogue_validation",
    ],
    message: "SMARTLIB Integration: NOT VERIFIED",
  };
}
