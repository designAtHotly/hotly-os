import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  ignorePatterns: core.ignorePatterns,
  rules: {
    curly: "off",
    "func-style": "off",
    "react/button-has-type": "off",
    "react/function-component-definition": "off",
    "sort-keys": "off",
  },
});
