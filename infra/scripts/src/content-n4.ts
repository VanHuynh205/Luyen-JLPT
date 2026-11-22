import { fileURLToPath } from "node:url";
import { importDatasetTables } from "./import-dataset";

const source = fileURLToPath(
  new URL("../../dataset_n4_minnanihongo/jsonl/", import.meta.url),
);
const output = fileURLToPath(new URL("../../content/n4/", import.meta.url));

importDatasetTables(source, output, "");
