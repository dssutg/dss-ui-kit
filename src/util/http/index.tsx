// All HTTP response status codes from (Dec 19th, 2024): https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
// ORDER RESERVED

export const HttpStatus = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  OK: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  IMUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  ContentTooLarge: 413,
  URITooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  IAmATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableContent: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarlyExperimental: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HTTPVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
// ORDER RESERVED

export const HttpStatusCategory = {
  INFORMATIONAL: 100,
  SUCCESSFUL: 200,
  REDIRECTION: 300,
  CLIENT_ERROR: 400,
  SERVER_ERROR: 500,
} as const;

export type HttpStatusCategory = (typeof HttpStatusCategory)[keyof typeof HttpStatusCategory];
// ORDER RESERVED

export const httpStatusNames: Readonly<Record<number, string>> = {
  // 1xx Informational
  [HttpStatus.Continue]: 'Continue',
  [HttpStatus.SwitchingProtocols]: 'Switching Protocols',
  [HttpStatus.Processing]: 'Processing',
  [HttpStatus.EarlyHints]: 'Early Hints',

  // 2xx Success
  [HttpStatus.OK]: 'OK',
  [HttpStatus.Created]: 'Created',
  [HttpStatus.Accepted]: 'Accepted',
  [HttpStatus.NonAuthoritativeInformation]: 'Non-Authoritative Information',
  [HttpStatus.NoContent]: 'No Content',
  [HttpStatus.ResetContent]: 'Reset Content',
  [HttpStatus.PartialContent]: 'Partial Content',
  [HttpStatus.MultiStatus]: 'Multi-Status',
  [HttpStatus.AlreadyReported]: 'Already Reported',
  [HttpStatus.IMUsed]: 'IM Used',

  // 3xx Redirection
  [HttpStatus.MultipleChoices]: 'Multiple Choices',
  [HttpStatus.MovedPermanently]: 'Moved Permanently',
  [HttpStatus.Found]: 'Found',
  [HttpStatus.SeeOther]: 'See Other',
  [HttpStatus.NotModified]: 'Not Modified',
  [HttpStatus.UseProxy]: 'Use Proxy',
  [HttpStatus.Unused]: 'unused',
  [HttpStatus.TemporaryRedirect]: 'Temporary Redirect',
  [HttpStatus.PermanentRedirect]: 'Permanent Redirect',

  // 4xx Client Error
  [HttpStatus.BadRequest]: 'Bad Request',
  [HttpStatus.Unauthorized]: 'Unauthorized',
  [HttpStatus.PaymentRequired]: 'Payment Required',
  [HttpStatus.Forbidden]: 'Forbidden',
  [HttpStatus.NotFound]: 'Not Found',
  [HttpStatus.MethodNotAllowed]: 'Method Not Allowed',
  [HttpStatus.NotAcceptable]: 'Not Acceptable',
  [HttpStatus.ProxyAuthenticationRequired]: 'Proxy Authentication Required',
  [HttpStatus.RequestTimeout]: 'Request Timeout',
  [HttpStatus.Conflict]: 'Conflict',
  [HttpStatus.Gone]: 'Gone',
  [HttpStatus.LengthRequired]: 'Length Required',
  [HttpStatus.PreconditionFailed]: 'Precondition Failed',
  [HttpStatus.ContentTooLarge]: 'Content Too Large',
  [HttpStatus.URITooLong]: 'URI Too Long',
  [HttpStatus.UnsupportedMediaType]: 'Unsupported Media Type',
  [HttpStatus.RangeNotSatisfiable]: 'Range Not Satisfiable',
  [HttpStatus.ExpectationFailed]: 'Expectation Failed',
  [HttpStatus.IAmATeapot]: "I'm a teapot",
  [HttpStatus.MisdirectedRequest]: 'Misdirected Request',
  [HttpStatus.UnprocessableContent]: 'Unprocessable Content',
  [HttpStatus.Locked]: 'Locked',
  [HttpStatus.FailedDependency]: 'Failed Dependency',
  [HttpStatus.TooEarlyExperimental]: 'Too Early Experimental',
  [HttpStatus.UpgradeRequired]: 'Upgrade Required',
  [HttpStatus.PreconditionRequired]: 'Precondition Required',
  [HttpStatus.TooManyRequests]: 'Too Many Requests',
  [HttpStatus.RequestHeaderFieldsTooLarge]: 'Request Header Fields Too Large',
  [HttpStatus.UnavailableForLegalReasons]: 'Unavailable For Legal Reasons',

  // 5xx Server Error
  [HttpStatus.InternalServerError]: 'Internal Server Error',
  [HttpStatus.NotImplemented]: 'Not Implemented',
  [HttpStatus.BadGateway]: 'Bad Gateway',
  [HttpStatus.ServiceUnavailable]: 'Service Unavailable',
  [HttpStatus.GatewayTimeout]: 'Gateway Timeout',
  [HttpStatus.HTTPVersionNotSupported]: 'HTTP Version Not Supported',
  [HttpStatus.VariantAlsoNegotiates]: 'Variant Also Negotiates',
  [HttpStatus.InsufficientStorage]: 'Insufficient Storage',
  [HttpStatus.LoopDetected]: 'Loop Detected',
  [HttpStatus.NotExtended]: 'Not Extended',
  [HttpStatus.NetworkAuthenticationRequired]: 'Network Authentication Required',
};
// ORDER RESERVED

export const httpStatusCategoryNames: Readonly<Record<number, string>> = {
  [HttpStatusCategory.INFORMATIONAL]: 'Informational',
  [HttpStatusCategory.SUCCESSFUL]: 'Successful',
  [HttpStatusCategory.REDIRECTION]: 'Redirection',
  [HttpStatusCategory.CLIENT_ERROR]: 'Client Error',
  [HttpStatusCategory.SERVER_ERROR]: 'Server Error',
};
// ORDER RESERVED

export const httpCategories = [
  HttpStatusCategory.INFORMATIONAL,
  HttpStatusCategory.SUCCESSFUL,
  HttpStatusCategory.REDIRECTION,
  HttpStatusCategory.CLIENT_ERROR,
  HttpStatusCategory.SERVER_ERROR,
] as const;

/**
 * The category a status code falls in, or `null` for a code outside the five categories.
 *
 * From the hundreds digit, so it is right for any code including one this table does not list: a status
 * the library has never heard of still has a category, and whether it is a success does not depend on
 * this library knowing the number.
 */
export function getHttpStatusCategory(status: number): HttpStatusCategory | null {
  return httpCategories[Math.floor(status / 100) - 1] ?? null;
}

/**
 * The name of a status code, for showing one to an operator.
 *
 * The names are the ones IANA publishes, in English, because a status code has exactly one name and
 * inventing a translation would make it unrecognisable in a bug report.
 */
export function getHttpStatusName(status: number): string {
  return httpStatusNames[status] ?? `Unknown HTTP status code ${status}`;
}

/**
 * The name of the category a status code falls in, for grouping codes in a report.
 */
export function getHttpStatusCategoryName(status: number): string {
  const category = getHttpStatusCategory(status);

  if (category === null) {
    return `Unknown category of HTTP status code ${status}`;
  }

  return httpStatusCategoryNames[category] ?? `Unknown HTTP status category ${category}`;
}
