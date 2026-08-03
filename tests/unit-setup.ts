/**
 * Setup for the `unit` vitest project.
 *
 * Registers the jest-dom matchers (toHaveValue, toBeVisible, …) used by the
 * component tests. Importing this in the default `node` environment is harmless:
 * it only extends `expect`, and the DOM-dependent matchers simply go unused by
 * the pure tests.
 */
import "@testing-library/jest-dom/vitest";

// Radix primitives (Select, DropdownMenu, …) drive their popups through Pointer
// Events APIs that jsdom does not implement, so a trigger click never opens the
// list and every option assertion fails with "Unable to find role=option".
// These are the four jsdom is missing; without them Radix components are
// effectively untestable here.
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
