/** A request the UI can fix (bad input, wrong state) - answered as HTTP 400. */
export class ActionError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
  }
}

/** A setting the action can't run without - answered as HTTP 412 `not_configured`. */
export class NotConfiguredError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'NotConfiguredError';
  }
}
