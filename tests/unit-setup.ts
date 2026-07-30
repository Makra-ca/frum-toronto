/**
 * Setup for the `unit` vitest project.
 *
 * Registers the jest-dom matchers (toHaveValue, toBeVisible, …) used by the
 * component tests. Importing this in the default `node` environment is harmless:
 * it only extends `expect`, and the DOM-dependent matchers simply go unused by
 * the pure tests.
 */
import "@testing-library/jest-dom/vitest";
