import * as core from "@actions/core";

jest.mock("@actions/core", () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setSecret: jest.fn(),
}));

// Importing the module must not execute the action. The bootstrap lives in main.ts.
// When run() was called at the bottom of index.ts, this import fired the action with
// unconfigured mocks and left a stray setFailed() that broke an unrelated e2e assertion.
import "../index";

describe("module import", () => {
  it("does not run the action as a side effect", () => {
    expect(core.info).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.getInput).not.toHaveBeenCalled();
  });
});
