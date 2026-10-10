import { getSchema } from "better-auth/db";
import { platformAuthOptions } from "../server/platform/auth-options.ts";
import { writeFileSync } from "node:fs";
const tables = getSchema(
  platformAuthOptions(
    "schema-generation-placeholder-not-a-deployed-secret",
    "postgresql://unused.invalid/db",
  ),
);
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const statements = [];
for (const [name, table] of Object.entries(tables).sort(
  (a, b) => a[1].order - b[1].order,
)) {
  const columns = ["id text PRIMARY KEY"];
  for (const [field, config] of Object.entries(table.fields)) {
    const type = {
      string: "text",
      boolean: "boolean",
      date: "timestamptz",
      number: "bigint",
      json: "jsonb",
    }[config.type];
    if (!type) throw new Error("Unmapped field type " + config.type);
    let column = quote(field) + " " + type;
    if (config.required) column += " NOT NULL";
    if (config.unique) column += " UNIQUE";
    if (typeof config.defaultValue === "boolean")
      column += " DEFAULT " + config.defaultValue;
    if (typeof config.defaultValue === "number")
      column += " DEFAULT " + config.defaultValue;
    if (config.references)
      column +=
        " REFERENCES " +
        quote(config.references.model) +
        "(" +
        quote(config.references.field) +
        ") ON DELETE CASCADE";
    columns.push(column);
  }
  statements.push(
    "CREATE TABLE IF NOT EXISTS " +
      quote(name) +
      " (\n  " +
      columns.join(",\n  ") +
      "\n);",
  );
  for (const [field, config] of Object.entries(table.fields)) {
    if (config.index)
      statements.push(
        "CREATE INDEX IF NOT EXISTS " +
          quote(name + "_" + field + "_idx") +
          " ON " +
          quote(name) +
          "(" +
          quote(field) +
          ");",
      );
  }
}
writeFileSync(
  "db/migrations/platform-auth.sql",
  "-- Generated from installed Better Auth schema; review before applying.\n" +
    statements.join("\n\n") +
    "\n",
);
console.log(
  "Generated " + Object.keys(tables).length + " isolated platform auth tables.",
);
